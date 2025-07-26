import { PrismaClient } from '@prisma/client';
import { logger } from '../middleware/logger';

class PrismaConnectionError extends Error {
  constructor(message: string) {
    super(`Prisma Connection Error: ${message}`);
    this.name = 'PrismaConnectionError';
  }
}

// Module-level singleton Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
});

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma client connected successfully');
  } catch (error) {
    logger.error('Failed to connect Prisma client', error as Error);
    throw new PrismaConnectionError(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting Prisma client', error as Error);
    throw new PrismaConnectionError(`Failed to disconnect from database: ${error}`);
  }
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}

export async function testPrismaConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT NOW() as current_time`;
    logger.info('Prisma connection test successful');
    return true;
  } catch (error) {
    logger.error('Prisma connection test failed', error as Error);
    return false;
  }
}

export async function prismaHealthCheck(): Promise<{
  healthy: boolean;
  timestamp: string;
  error?: string;
}> {
  try {
    await prisma.$queryRaw`SELECT 1 as health_check`;
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Migration utilities (for development)
export async function runPrismaMigrations(): Promise<void> {
  try {
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logger.info('Prisma migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run Prisma migrations', error as Error);
    throw new PrismaConnectionError(`Migration failed: ${error}`);
  }
}

export async function resetPrismaDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new PrismaConnectionError('Database reset is not allowed in production');
  }

  try {
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    logger.info('Prisma database reset completed successfully');
  } catch (error) {
    logger.error('Failed to reset Prisma database', error as Error);
    throw new PrismaConnectionError(`Database reset failed: ${error}`);
  }
}

export default prisma; 