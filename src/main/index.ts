import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import { loadAppEnv } from './utils/loadEnv';
import logger from './utils/logger';
import { disconnectDb, getDb } from './services/db.service';
import { registerConfigIPC } from './ipc/config.ipc';
import { registerUsersIPC } from './ipc/users.ipc';
import { registerProspectsIPC } from './ipc/prospects.ipc';
import { registerClientsIPC } from './ipc/clients.ipc';
import { registerOwnersIPC } from './ipc/owners.ipc';
import { registerAuthIPC } from './ipc/auth.ipc';
import { registerPropertiesIPC } from './ipc/properties.ipc';
import { registerConventionsIPC } from './ipc/conventions.ipc';
import { registerConventionTemplatesIPC } from './ipc/convention-templates.ipc';
import { registerAttestationTemplatesIPC } from './ipc/attestation-templates.ipc';
import { registerAttestationsIPC } from './ipc/attestations.ipc';
import { registerQuotesIPC } from './ipc/quotes.ipc';
import { registerQuoteTemplatesIPC } from './ipc/quote-templates.ipc';
import { registerCatalogIPC } from './ipc/catalog.ipc';
import { registerAccountingIPC } from './ipc/accounting.ipc';
import { registerBilanIPC } from './ipc/bilan.ipc';
import { registerCommunicationIPC } from './ipc/communication.ipc';
import { registerCrmIPC } from './ipc/crm.ipc';
import { registerArchivingIPC } from './ipc/archiving.ipc';
import { registerDocumentsIPC, seedUploadFilesCategory } from './ipc/documents.ipc';
import { registerLotissementsIPC } from './ipc/lotissements.ipc';
import { registerTerrainsIPC } from './ipc/terrains.ipc';
import { registerProgrammesIPC } from './ipc/programmes.ipc';
import { registerProjectsIPC } from './ipc/projects.ipc';
import { registerHrIPC } from './ipc/hr.ipc';
import { registerVisitorsIPC } from './ipc/visitors.ipc';
import { registerGeoIPC } from './ipc/geo.ipc';
import { registerCountriesIPC } from './ipc/countries.ipc';
import { registerCommissionsIPC } from './ipc/commissions.ipc';
import { registerForecastExpensesIPC } from './ipc/forecast-expenses.ipc';
import { registerAnalyticsIPC } from './ipc/analytics.ipc';
import { registerExportIPC } from './ipc/export.ipc';
import { registerInvoiceTemplatesIPC } from './ipc/invoice-templates.ipc';
import { registerListExportTemplatesIPC } from './ipc/list-export-templates.ipc';
import { registerTreasuryIPC } from './ipc/treasury.ipc';
import { registerBudgetIPC } from './ipc/budget.ipc';
import { registerDashboardIPC } from './ipc/dashboard.ipc';
import { registerSettingsIPC, initStorageOverride } from './ipc/settings.ipc';
import { registerDocumentExportIPC } from './ipc/document-export.ipc';
import { seedDefaultArchivePolicies, scheduleAutoArchiving } from './services/archiving.service';
import { registerRemindersIPC } from './ipc/reminders.ipc';
import { seedDefaultRemindersConfig, scheduleReminders } from './services/reminders.service';
import { seedDefaultAttestationTemplate } from './services/attestation-templates.service';
import { seedDefaultQuoteTemplate } from './services/quote-templates.service';
import { seedDefaultContractTemplates, seedDefaultPayslipTemplates, seedDefaultEssaiCategories } from './services/hr-templates.service';
import { seedDefaultLeaveTypes } from './services/leave.service';

// Distinction dev/prod basée sur l'empaquetage Electron (plus fiable que
// NODE_ENV, absent dans l'application installée).
const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      // En dev, tsx exécute depuis src/main → __dirname = src/main,
      // le preload compilé se trouve dans dist/preload/index.js depuis la racine.
      preload: isDev
        ? path.join(process.cwd(), 'dist/preload/index.js')
        : path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Active le lecteur PDF intégré de Chromium (sinon aperçu PDF blanc).
      plugins: true,
      // Autorise la lecture automatique avec son (slideshow vidéo du tableau de
      // bord) — sinon Chromium bloque play() sur une vidéo non mutée.
      autoplayPolicy: 'no-user-gesture-required',
      // Empêche Chromium de throttler/geler les timers JS quand la fenêtre est
      // en arrière-plan. Indispensable pour la déconnexion automatique après
      // inactivité (cf. useIdleLogout) : sans cela, l'utilisateur qui bascule
      // vers une autre application ne serait jamais déconnecté, le minuteur
      // d'inactivité étant gelé pendant que la fenêtre est masquée.
      backgroundThrottling: false,
    },
    titleBarStyle: 'default',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('Main window shown');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIPC(): void {
  registerAuthIPC();
  registerUsersIPC();
  registerProspectsIPC();
  registerClientsIPC();
  registerOwnersIPC();
  registerPropertiesIPC();
  registerConventionsIPC();
  registerConventionTemplatesIPC();
  registerAttestationTemplatesIPC();
  registerAttestationsIPC();
  registerQuotesIPC();
  registerQuoteTemplatesIPC();
  registerCatalogIPC();
  registerAccountingIPC();
  registerBilanIPC();
  registerCommunicationIPC();
  registerCrmIPC();
  registerArchivingIPC();
  registerDocumentsIPC();
  registerLotissementsIPC();
  registerTerrainsIPC();
  registerProgrammesIPC();
  registerProjectsIPC();
  registerHrIPC();
  registerVisitorsIPC();
  registerGeoIPC();
  registerCountriesIPC();
  registerCommissionsIPC();
  registerForecastExpensesIPC();
  registerAnalyticsIPC();
  registerExportIPC();
  registerInvoiceTemplatesIPC();
  registerListExportTemplatesIPC();
  registerTreasuryIPC();
  registerBudgetIPC();
  registerDashboardIPC();
  registerSettingsIPC();
  registerDocumentExportIPC();
  registerRemindersIPC();
  // Configuration de la connexion BDD — utilisable avant authentification.
  registerConfigIPC();
  logger.info('All IPC handlers registered');
}

/**
 * Configure le menu applicatif — menu standard sans « Toggle Full Screen ».
 */
function setupAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  // Charge DATABASE_URL (.env en dev, <userData>/config.env en prod) AVANT
  // toute connexion à la base.
  loadAppEnv();
  getDb();
  registerIPC();
  // Propage le chemin de stockage paramétré (AppSetting) au storage.service.
  await initStorageOverride();
  // Politiques d'archivage par défaut + déclenchement de la passe quotidienne.
  // Tout est fait en fire-and-forget pour ne pas retarder l'apparition de la
  // fenêtre principale.
  seedDefaultArchivePolicies()
    .then(() => scheduleAutoArchiving())
    .catch((e) => logger.error(`Auto-archiving bootstrap failed: ${e.message}`));
  // Politique de relance : seed des templates/règles par défaut puis passe quotidienne.
  seedDefaultRemindersConfig()
    .then(() => scheduleReminders())
    .catch((e) => logger.error(`Reminders bootstrap failed: ${e.message}`));
  // Modèle d'attestation de SOLDE par défaut (créé une seule fois si absent).
  seedDefaultAttestationTemplate()
    .catch((e) => logger.error(`Attestation template bootstrap failed: ${e.message}`));
  // Modèle de devis par défaut (créé une seule fois si absent).
  seedDefaultQuoteTemplate()
    .catch((e) => logger.error(`Quote template bootstrap failed: ${e.message}`));
  // Modèles RH : contrats (un par type) + bulletins de paie (3 modèles).
  seedDefaultContractTemplates()
    .then(() => seedDefaultPayslipTemplates())
    .then(() => seedDefaultEssaiCategories())
    .catch((e) => logger.error(`HR templates bootstrap failed: ${e.message}`));
  seedDefaultLeaveTypes()
    .catch((e) => logger.error(`Leave types bootstrap failed: ${e.message}`));
  // Catégorie GED par défaut « UPLOAD FILES » (fichiers importés sans catégorie).
  seedUploadFilesCategory()
    .catch((e) => logger.error(`Upload files category bootstrap failed: ${e.message}`));
  setupAppMenu();
  createWindow();
  logger.info('Application started');
});

app.on('window-all-closed', async () => {
  await disconnectDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
