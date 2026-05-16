"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getDb = getDb;
exports.disconnectDb = disconnectDb;
const client_1 = require("@prisma/client");
require("dotenv/config");
const logger_1 = __importDefault(require("../utils/logger"));
let prisma;
function getDb() {
    if (!prisma) {
        exports.prisma = prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
                : ['warn', 'error'],
        });
        if (process.env.NODE_ENV === 'development') {
            prisma.$on('query', (e) => {
                logger_1.default.debug(`Query: ${e.query} — ${e.duration}ms`);
            });
        }
    }
    return prisma;
}
async function disconnectDb() {
    if (prisma) {
        await prisma.$disconnect();
        logger_1.default.info('Database disconnected');
    }
}
