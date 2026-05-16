import { app, BrowserWindow, shell } from 'electron';
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
import { registerContractsIPC } from './ipc/contracts.ipc';
import { registerAccountingIPC } from './ipc/accounting.ipc';
import { registerCommunicationIPC } from './ipc/communication.ipc';
import { registerCrmIPC } from './ipc/crm.ipc';
import { registerArchivingIPC } from './ipc/archiving.ipc';
import { registerDocumentsIPC } from './ipc/documents.ipc';
import { registerLotissementsIPC } from './ipc/lotissements.ipc';
import { registerTerrainsIPC } from './ipc/terrains.ipc';
import { registerGeoIPC } from './ipc/geo.ipc';
import { registerCommissionsIPC } from './ipc/commissions.ipc';

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
  registerContractsIPC();
  registerAccountingIPC();
  registerCommunicationIPC();
  registerCrmIPC();
  registerArchivingIPC();
  registerDocumentsIPC();
  registerLotissementsIPC();
  registerTerrainsIPC();
  registerGeoIPC();
  registerCommissionsIPC();
  logger.info('All IPC handlers registered');
}

app.whenReady().then(() => {
  getDb();
  registerIPC();
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
