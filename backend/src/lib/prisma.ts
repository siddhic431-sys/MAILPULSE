import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.__prismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

let isPrismaConnected = false;

export function getIsPrismaConnected(): boolean {
  return isPrismaConnected;
}

export async function connectPrisma(): Promise<boolean> {
  try {
    await prisma.$connect();
    isPrismaConnected = true;
    logger.info('PostgreSQL connected successfully via Prisma');
    return true;
  } catch (error: any) {
    isPrismaConnected = false;
    logger.error('Failed to connect to PostgreSQL via Prisma:', { error: error.message });
    return false;
  }
}
