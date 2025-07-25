import { PrismaClient } from '@prisma/client';

class PrismaConnectionError extends Error {
  constructor(message: string) {
    super(`Prisma Connection Error: ${message}`);
    this.name = 'PrismaConnectionError';
  }
}

// Global Prisma client instance
let prismaClient: PrismaClient | null = null;

// Create Prisma client with proper configuration
export function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    errorFormat: 'pretty',
  });

  return client;
}

// Connect to database using Prisma
export async function connectPrisma(): Promise<void> {
  try {
    if (!prismaClient) {
      prismaClient = createPrismaClient();
    }

    // Test the connection
    await prismaClient.$connect();
    console.log('Prisma client connected successfully');
  } catch (error) {
    console.error('Failed to connect Prisma client:', error);
    throw new PrismaConnectionError(`Failed to connect to database: ${error}`);
  }
}

// Disconnect from database
export async function disconnectPrisma(): Promise<void> {
  try {
    if (prismaClient) {
      await prismaClient.$disconnect();
      prismaClient = null;
      console.log('Prisma client disconnected successfully');
    }
  } catch (error) {
    console.error('Error disconnecting Prisma client:', error);
    throw new PrismaConnectionError(`Failed to disconnect from database: ${error}`);
  }
}

// Get Prisma client instance
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    throw new PrismaConnectionError('Prisma client not initialized. Call connectPrisma() first.');
  }
  return prismaClient;
}

// Test Prisma connection
export async function testPrismaConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    
    // Execute a simple query to test the connection
    await client.$queryRaw`SELECT NOW() as current_time`;
    console.log('Prisma connection test successful');
    return true;
  } catch (error) {
    console.error('Prisma connection test failed:', error);
    return false;
  }
}

// Health check for Prisma
export async function prismaHealthCheck(): Promise<{
  healthy: boolean;
  timestamp: string;
  error?: string;
}> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1 as health_check`;
    
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
    console.log('Prisma migrations completed successfully');
  } catch (error) {
    console.error('Failed to run Prisma migrations:', error);
    throw new PrismaConnectionError(`Migration failed: ${error}`);
  }
}

// Reset database (for development/testing)
export async function resetPrismaDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new PrismaConnectionError('Database reset is not allowed in production');
  }

  try {
    const { execSync } = await import('child_process');
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    console.log('Prisma database reset completed successfully');
  } catch (error) {
    console.error('Failed to reset Prisma database:', error);
    throw new PrismaConnectionError(`Database reset failed: ${error}`);
  }
}

export default prismaClient; 