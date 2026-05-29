import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import 'dotenv/config';
import logger from './utils/logger';
import { disconnectDb, getDb } from './services/db.service';
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
import { registerAccountingIPC } from './ipc/accounting.ipc';
import { registerCommunicationIPC } from './ipc/communication.ipc';
import { registerCrmIPC } from './ipc/crm.ipc';
import { registerArchivingIPC } from './ipc/archiving.ipc';
import { registerDocumentsIPC } from './ipc/documents.ipc';
import { registerLotissementsIPC } from './ipc/lotissements.ipc';
import { registerTerrainsIPC } from './ipc/terrains.ipc';
import { registerProgrammesIPC } from './ipc/programmes.ipc';
import { registerProjectsIPC } from './ipc/projects.ipc';
import { registerGeoIPC } from './ipc/geo.ipc';
import { registerCountriesIPC } from './ipc/countries.ipc';
import { registerCommissionsIPC } from './ipc/commissions.ipc';
import { registerExportIPC } from './ipc/export.ipc';
import { registerInvoiceTemplatesIPC } from './ipc/invoice-templates.ipc';
import { registerTreasuryIPC } from './ipc/treasury.ipc';
import { registerBudgetIPC } from './ipc/budget.ipc';
import { registerDashboardIPC } from './ipc/dashboard.ipc';
import { registerSettingsIPC, initStorageOverride } from './ipc/settings.ipc';
import { registerDocumentExportIPC } from './ipc/document-export.ipc';
import { seedDefaultArchivePolicies, scheduleAutoArchiving } from './services/archiving.service';

const isDev = process.env.NODE_ENV === 'development';
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
  registerAccountingIPC();
  registerCommunicationIPC();
  registerCrmIPC();
  registerArchivingIPC();
  registerDocumentsIPC();
  registerLotissementsIPC();
  registerTerrainsIPC();
  registerProgrammesIPC();
  registerProjectsIPC();
  registerGeoIPC();
  registerCountriesIPC();
  registerCommissionsIPC();
  registerExportIPC();
  registerInvoiceTemplatesIPC();
  registerTreasuryIPC();
  registerBudgetIPC();
  registerDashboardIPC();
  registerSettingsIPC();
  registerDocumentExportIPC();
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
