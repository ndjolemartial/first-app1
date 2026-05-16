import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

export const logger = {
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => log.error(message, ...args),
};

export default logger;
