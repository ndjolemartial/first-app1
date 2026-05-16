"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const logger_1 = __importDefault(require("./utils/logger"));
const db_service_1 = require("./services/db.service");
const users_ipc_1 = require("./ipc/users.ipc");
const prospects_ipc_1 = require("./ipc/prospects.ipc");
const clients_ipc_1 = require("./ipc/clients.ipc");
const owners_ipc_1 = require("./ipc/owners.ipc");
const auth_ipc_1 = require("./ipc/auth.ipc");
const properties_ipc_1 = require("./ipc/properties.ipc");
const contracts_ipc_1 = require("./ipc/contracts.ipc");
const accounting_ipc_1 = require("./ipc/accounting.ipc");
const communication_ipc_1 = require("./ipc/communication.ipc");
const crm_ipc_1 = require("./ipc/crm.ipc");
const archiving_ipc_1 = require("./ipc/archiving.ipc");
const documents_ipc_1 = require("./ipc/documents.ipc");
const lotissements_ipc_1 = require("./ipc/lotissements.ipc");
const terrains_ipc_1 = require("./ipc/terrains.ipc");
const geo_ipc_1 = require("./ipc/geo.ipc");
const commissions_ipc_1 = require("./ipc/commissions.ipc");
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            // En dev, tsx exécute depuis src/main → __dirname = src/main,
            // le preload compilé se trouve dans dist/preload/index.js depuis la racine.
            preload: isDev
                ? path_1.default.join(process.cwd(), 'dist/preload/index.js')
                : path_1.default.join(__dirname, '../preload/index.js'),
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
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        logger_1.default.info('Main window shown');
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function registerIPC() {
    (0, auth_ipc_1.registerAuthIPC)();
    (0, users_ipc_1.registerUsersIPC)();
    (0, prospects_ipc_1.registerProspectsIPC)();
    (0, clients_ipc_1.registerClientsIPC)();
    (0, owners_ipc_1.registerOwnersIPC)();
    (0, properties_ipc_1.registerPropertiesIPC)();
    (0, contracts_ipc_1.registerContractsIPC)();
    (0, accounting_ipc_1.registerAccountingIPC)();
    (0, communication_ipc_1.registerCommunicationIPC)();
    (0, crm_ipc_1.registerCrmIPC)();
    (0, archiving_ipc_1.registerArchivingIPC)();
    (0, documents_ipc_1.registerDocumentsIPC)();
    (0, lotissements_ipc_1.registerLotissementsIPC)();
    (0, terrains_ipc_1.registerTerrainsIPC)();
    (0, geo_ipc_1.registerGeoIPC)();
    (0, commissions_ipc_1.registerCommissionsIPC)();
    logger_1.default.info('All IPC handlers registered');
}
electron_1.app.whenReady().then(() => {
    (0, db_service_1.getDb)();
    registerIPC();
    createWindow();
    logger_1.default.info('Application started');
});
electron_1.app.on('window-all-closed', async () => {
    await (0, db_service_1.disconnectDb)();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
