"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.reconnectDb = reconnectDb;
exports.disconnectDb = disconnectDb;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
// L'environnement (dont DATABASE_URL) est chargé en amont par loadAppEnv()
// (src/main/utils/loadEnv.ts), appelé au démarrage avant toute connexion.
let prisma = null;
/** Instancie un client Prisma sur l'URL courante (`process.env.DATABASE_URL`). */
function createClient() {
    const client = new client_1.PrismaClient({
        // URL explicite : permet de reconstruire le client après reconfiguration.
        datasourceUrl: process.env.DATABASE_URL,
        log: process.env.NODE_ENV === 'development'
            ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
            : ['warn', 'error'],
    });
    if (process.env.NODE_ENV === 'development') {
        client.$on('query', (e) => {
            logger_1.default.debug(`Query: ${e.query} — ${e.duration}ms`);
        });
    }
    return client;
}
function getDb() {
    if (!prisma) {
        prisma = createClient();
    }
    return prisma;
}
/**
 * Reconstruit le client Prisma sur la nouvelle URL (`process.env.DATABASE_URL`).
 * Utilisé après modification de la configuration de connexion via l'écran dédié.
 */
async function reconnectDb() {
    if (prisma) {
        try {
            await prisma.$disconnect();
        }
        catch {
            /* ignore — on remplace le client de toute façon */
        }
    }
    prisma = createClient();
    logger_1.default.info('Database client reconnected');
}
async function disconnectDb() {
    if (prisma) {
        await prisma.$disconnect();
        logger_1.default.info('Database disconnected');
    }
}
