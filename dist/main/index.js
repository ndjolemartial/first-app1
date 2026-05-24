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
const conventions_ipc_1 = require("./ipc/conventions.ipc");
const convention_templates_ipc_1 = require("./ipc/convention-templates.ipc");
const attestation_templates_ipc_1 = require("./ipc/attestation-templates.ipc");
const attestations_ipc_1 = require("./ipc/attestations.ipc");
const accounting_ipc_1 = require("./ipc/accounting.ipc");
const communication_ipc_1 = require("./ipc/communication.ipc");
const crm_ipc_1 = require("./ipc/crm.ipc");
const archiving_ipc_1 = require("./ipc/archiving.ipc");
const documents_ipc_1 = require("./ipc/documents.ipc");
const lotissements_ipc_1 = require("./ipc/lotissements.ipc");
const terrains_ipc_1 = require("./ipc/terrains.ipc");
const programmes_ipc_1 = require("./ipc/programmes.ipc");
const projects_ipc_1 = require("./ipc/projects.ipc");
const geo_ipc_1 = require("./ipc/geo.ipc");
const countries_ipc_1 = require("./ipc/countries.ipc");
const commissions_ipc_1 = require("./ipc/commissions.ipc");
const export_ipc_1 = require("./ipc/export.ipc");
const invoice_templates_ipc_1 = require("./ipc/invoice-templates.ipc");
const treasury_ipc_1 = require("./ipc/treasury.ipc");
const budget_ipc_1 = require("./ipc/budget.ipc");
const dashboard_ipc_1 = require("./ipc/dashboard.ipc");
const settings_ipc_1 = require("./ipc/settings.ipc");
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
    (0, conventions_ipc_1.registerConventionsIPC)();
    (0, convention_templates_ipc_1.registerConventionTemplatesIPC)();
    (0, attestation_templates_ipc_1.registerAttestationTemplatesIPC)();
    (0, attestations_ipc_1.registerAttestationsIPC)();
    (0, accounting_ipc_1.registerAccountingIPC)();
    (0, communication_ipc_1.registerCommunicationIPC)();
    (0, crm_ipc_1.registerCrmIPC)();
    (0, archiving_ipc_1.registerArchivingIPC)();
    (0, documents_ipc_1.registerDocumentsIPC)();
    (0, lotissements_ipc_1.registerLotissementsIPC)();
    (0, terrains_ipc_1.registerTerrainsIPC)();
    (0, programmes_ipc_1.registerProgrammesIPC)();
    (0, projects_ipc_1.registerProjectsIPC)();
    (0, geo_ipc_1.registerGeoIPC)();
    (0, countries_ipc_1.registerCountriesIPC)();
    (0, commissions_ipc_1.registerCommissionsIPC)();
    (0, export_ipc_1.registerExportIPC)();
    (0, invoice_templates_ipc_1.registerInvoiceTemplatesIPC)();
    (0, treasury_ipc_1.registerTreasuryIPC)();
    (0, budget_ipc_1.registerBudgetIPC)();
    (0, dashboard_ipc_1.registerDashboardIPC)();
    (0, settings_ipc_1.registerSettingsIPC)();
    logger_1.default.info('All IPC handlers registered');
}
/**
 * Configure le menu applicatif — menu standard sans « Toggle Full Screen ».
 */
function setupAppMenu() {
    const template = [
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
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
electron_1.app.whenReady().then(async () => {
    (0, db_service_1.getDb)();
    registerIPC();
    // Propage le chemin de stockage paramétré (AppSetting) au storage.service.
    await (0, settings_ipc_1.initStorageOverride)();
    setupAppMenu();
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
