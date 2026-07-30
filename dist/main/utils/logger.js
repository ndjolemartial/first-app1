"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
// Nom d'application explicite : hors runtime Electron (ex. script autonome
// de relances déployé sur un NAS, cf. run-reminders-once.ts, qui ne copie
// que dist/ + node_modules/, sans package.json), electron-log ne peut pas
// déduire le nom de l'app ni le chemin de son fichier de log — tout appel à
// logger.error/warn/info plante alors avec « can't determine the app name ».
electron_log_1.default.transports.file.setAppName('Afrikimmo-App');
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';
exports.logger = {
    debug: (message, ...args) => electron_log_1.default.debug(message, ...args),
    info: (message, ...args) => electron_log_1.default.info(message, ...args),
    warn: (message, ...args) => electron_log_1.default.warn(message, ...args),
    error: (message, ...args) => electron_log_1.default.error(message, ...args),
};
exports.default = exports.logger;
