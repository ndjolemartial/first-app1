import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import logger from '../utils/logger';

let prisma: PrismaClient;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    });

    if (process.env.NODE_ENV === 'development') {
      (prisma as any).$on('query', (e: any) => {
        logger.debug(`Query: ${e.query} — ${e.duration}ms`);
      });
    }
  }
  return prisma;
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}

export { prisma };
