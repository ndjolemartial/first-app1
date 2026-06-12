import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// L'environnement (dont DATABASE_URL) est chargé en amont par loadAppEnv()
// (src/main/utils/loadEnv.ts), appelé au démarrage avant toute connexion.

let prisma: PrismaClient | null = null;

/** Instancie un client Prisma sur l'URL courante (`process.env.DATABASE_URL`). */
function createClient(): PrismaClient {
  const client = new PrismaClient({
    // URL explicite : permet de reconstruire le client après reconfiguration.
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

  if (process.env.NODE_ENV === 'development') {
    (client as any).$on('query', (e: any) => {
      logger.debug(`Query: ${e.query} — ${e.duration}ms`);
    });
  }
  return client;
}

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = createClient();
  }
  return prisma;
}

/**
 * Reconstruit le client Prisma sur la nouvelle URL (`process.env.DATABASE_URL`).
 * Utilisé après modification de la configuration de connexion via l'écran dédié.
 */
export async function reconnectDb(): Promise<void> {
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore — on remplace le client de toute façon */
    }
  }
  prisma = createClient();
  logger.info('Database client reconnected');
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}
