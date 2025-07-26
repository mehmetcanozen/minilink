import { Queue, Worker, Job } from 'bullmq';
import { redisConfig } from '../config';
import { logger } from '../middleware/logger';
import { CacheService } from '../services/CacheService';
import { PrismaUrlRepository } from '../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../config/prisma';
import { createRedisCache } from '../config/redis';

// Queue names
export const QUEUE_NAMES = {
  CLICK_PROCESSING: 'click-processing',
  SHORT_CODE_POOL: 'short-code-pool',
  CACHE_SYNC: 'cache-sync',
  EXPIRED_URL_CLEANUP: 'expired-url-cleanup',
  CACHE_WARM_UP: 'cache-warm-up',
} as const;

// Job types
export interface ClickProcessingJob {
  slug: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface ShortCodePoolJob {
  count: number;
  priority?: number;
}

export interface CacheSyncJob {
  slug: string;
  operation: 'sync' | 'invalidate';
  data?: Record<string, unknown>;
}

export interface ExpiredUrlCleanupJob {
  timestamp: string;
  batchSize?: number;
}

export interface CacheWarmUpJob {
  timestamp: string;
  batchSize?: number;
}

// Queue configuration
const queueConfig = {
  connection: {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.database,
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep only last 100 completed jobs
    removeOnFail: 50, // Keep only last 50 failed jobs
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
  },
};

// Worker configuration
const workerConfig = {
  connection: queueConfig.connection,
  concurrency: 5, // Process up to 5 jobs concurrently
  maxStalledCount: 1, // Retry stalled jobs once
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
};

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private isShuttingDown = false;
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor() {
    // Initialize dependencies
    const redisCache = createRedisCache();
    this.cacheService = new CacheService(redisCache);
    this.urlRepository = new PrismaUrlRepository(getPrismaClient());
  }

  // Initialize queues
  async initialize(): Promise<void> {
    try {
      // Create queues
      this.createQueue(QUEUE_NAMES.CLICK_PROCESSING);
      this.createQueue(QUEUE_NAMES.SHORT_CODE_POOL);
      this.createQueue(QUEUE_NAMES.CACHE_SYNC);
      this.createQueue(QUEUE_NAMES.EXPIRED_URL_CLEANUP);
      this.createQueue(QUEUE_NAMES.CACHE_WARM_UP);

      logger.info('QueueManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize QueueManager', error as Error);
      throw error;
    }
  }

  // Create a queue
  private createQueue(name: string): Queue {
    const queue = new Queue(name, queueConfig);

    // Queue event handlers
    queue.on('error', (error: Error) => {
      logger.error(`Queue ${name} error`, error);
    });

    this.queues.set(name, queue);
    return queue;
  }

  // Create a worker with dependency injection
  createWorker<T = unknown>(
    queueName: string,
    processor: (job: Job<T>) => Promise<unknown>,
    options?: Partial<typeof workerConfig>
  ): Worker<T> {
    const config = { ...workerConfig, ...options };
    const worker = new Worker<T>(queueName, processor, config);

    // Worker event handlers
    worker.on('error', (error: Error) => {
      logger.error(`Worker for queue ${queueName} error`, error);
    });

    worker.on('ready', () => {
      logger.info(`Worker for queue ${queueName} is ready`);
    });

    worker.on('completed', (job: Job<T>) => {
      logger.debug(`Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job: Job<T> | undefined, error: Error) => {
      logger.error(`Worker failed job ${job?.id} in queue ${queueName}`, error);
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  // Get a queue
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  // Get a worker
  getWorker(name: string): Worker | undefined {
    return this.workers.get(name);
  }

  // Add job to queue
  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      repeat?: { pattern: string };
      removeOnComplete?: number;
      removeOnFail?: number;
    }
  ): Promise<Job<T> | undefined> {
    try {
      const queue = this.getQueue(queueName);
      if (!queue) {
        logger.error(`Queue ${queueName} not found`);
        return undefined;
      }

      const job = await queue.add(jobName, data, {
        ...queueConfig.defaultJobOptions,
        ...options,
      });

      logger.debug(`Job ${job.id} added to queue ${queueName}`, { jobName, queueName });
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}`, error as Error, { jobName, queueName });
      return undefined;
    }
  }

  // Get queue statistics
  async getQueueStats(queueName: string): Promise<Record<string, number> | null> {
    try {
      const queue = this.getQueue(queueName);
      if (!queue) {
        return null;
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error(`Failed to get stats for queue ${queueName}`, error as Error);
      return null;
    }
  }

  // Get all queue statistics
  async getAllQueueStats(): Promise<Record<string, Record<string, number>>> {
    const stats: Record<string, Record<string, number>> = {};

    for (const queueName of this.queues.keys()) {
      const queueStats = await this.getQueueStats(queueName);
      if (queueStats) {
        stats[queueName] = queueStats;
      }
    }

    return stats;
  }

  // Pause a queue
  async pauseQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      if (queue) {
        await queue.pause();
        logger.info(`Queue ${queueName} paused`);
      }
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}`, error as Error);
    }
  }

  // Resume a queue
  async resumeQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      if (queue) {
        await queue.resume();
        logger.info(`Queue ${queueName} resumed`);
      }
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}`, error as Error);
    }
  }

  // Clean old jobs from a queue
  async cleanQueue(
    queueName: string,
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    maxCount: number = 100
  ): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      if (queue) {
        await Promise.all([
          queue.clean(maxAge, maxCount, 'completed'),
          queue.clean(maxAge, maxCount, 'failed'),
        ]);
        logger.info(`Queue ${queueName} cleaned`, { maxAge, maxCount });
      }
    } catch (error) {
      logger.error(`Failed to clean queue ${queueName}`, error as Error);
    }
  }

  // Health check for queues
  async isHealthy(): Promise<boolean> {
    try {
      for (const [, queue] of this.queues) {
        await queue.getWaiting();
      }
      return true;
    } catch (error) {
      logger.error('Queue health check failed', error as Error);
      return false;
    }
  }

  // Get dependencies for job handlers
  getDependencies() {
    return {
      cacheService: this.cacheService,
      urlRepository: this.urlRepository,
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down QueueManager...');

    try {
      // Close all workers first
      const workerPromises = Array.from(this.workers.values()).map(async (worker) => {
        await worker.close();
      });
      await Promise.all(workerPromises);
      logger.info('All workers closed');

      // Close all queues
      const queuePromises = Array.from(this.queues.values()).map(async (queue) => {
        await queue.close();
      });
      await Promise.all(queuePromises);
      logger.info('All queues closed');

      this.queues.clear();
      this.workers.clear();

      logger.info('QueueManager shutdown completed');
    } catch (error) {
      logger.error('Error during QueueManager shutdown', error as Error);
      throw error;
    }
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

export async function initializeQueues(): Promise<QueueManager> {
  const manager = getQueueManager();
  await manager.initialize();
  return manager;
}

export async function shutdownQueues(): Promise<void> {
  if (queueManager) {
    await queueManager.shutdown();
    queueManager = null;
  }
} 