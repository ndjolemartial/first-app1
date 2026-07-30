import log from 'electron-log';

// Nom d'application explicite : hors runtime Electron (ex. script autonome
// de relances déployé sur un NAS, cf. run-reminders-once.ts, qui ne copie
// que dist/ + node_modules/, sans package.json), electron-log ne peut pas
// déduire le nom de l'app ni le chemin de son fichier de log — tout appel à
// logger.error/warn/info plante alors avec « can't determine the app name ».
log.transports.file.setAppName('Afrikimmo-App');

log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

export const logger = {
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => log.error(message, ...args),
};

export default logger;
