"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';
exports.logger = {
    debug: (message, ...args) => electron_log_1.default.debug(message, ...args),
    info: (message, ...args) => electron_log_1.default.info(message, ...args),
    warn: (message, ...args) => electron_log_1.default.warn(message, ...args),
    error: (message, ...args) => electron_log_1.default.error(message, ...args),
};
exports.default = exports.logger;
