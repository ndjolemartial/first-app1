"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const loadEnv_1 = require("./utils/loadEnv");
const logger_1 = __importDefault(require("./utils/logger"));
const db_service_1 = require("./services/db.service");
const config_ipc_1 = require("./ipc/config.ipc");
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
const quotes_ipc_1 = require("./ipc/quotes.ipc");
const quote_templates_ipc_1 = require("./ipc/quote-templates.ipc");
const catalog_ipc_1 = require("./ipc/catalog.ipc");
const accounting_ipc_1 = require("./ipc/accounting.ipc");
const bilan_ipc_1 = require("./ipc/bilan.ipc");
const communication_ipc_1 = require("./ipc/communication.ipc");
const crm_ipc_1 = require("./ipc/crm.ipc");
const archiving_ipc_1 = require("./ipc/archiving.ipc");
const documents_ipc_1 = require("./ipc/documents.ipc");
const lotissements_ipc_1 = require("./ipc/lotissements.ipc");
const terrains_ipc_1 = require("./ipc/terrains.ipc");
const programmes_ipc_1 = require("./ipc/programmes.ipc");
const projects_ipc_1 = require("./ipc/projects.ipc");
const hr_ipc_1 = require("./ipc/hr.ipc");
const career_profiles_ipc_1 = require("./ipc/career-profiles.ipc");
const wire_transfer_ipc_1 = require("./ipc/wire-transfer.ipc");
const performance_ipc_1 = require("./ipc/performance.ipc");
const performance_service_1 = require("./services/performance.service");
const visitors_ipc_1 = require("./ipc/visitors.ipc");
const calls_ipc_1 = require("./ipc/calls.ipc");
const social_media_ipc_1 = require("./ipc/social-media.ipc");
const it_innovations_ipc_1 = require("./ipc/it-innovations.ipc");
const construction_library_ipc_1 = require("./ipc/construction-library.ipc");
const construction_projects_ipc_1 = require("./ipc/construction-projects.ipc");
const geo_ipc_1 = require("./ipc/geo.ipc");
const countries_ipc_1 = require("./ipc/countries.ipc");
const commissions_ipc_1 = require("./ipc/commissions.ipc");
const forecast_expenses_ipc_1 = require("./ipc/forecast-expenses.ipc");
const analytics_ipc_1 = require("./ipc/analytics.ipc");
const export_ipc_1 = require("./ipc/export.ipc");
const invoice_templates_ipc_1 = require("./ipc/invoice-templates.ipc");
const list_export_templates_ipc_1 = require("./ipc/list-export-templates.ipc");
const treasury_ipc_1 = require("./ipc/treasury.ipc");
const budget_ipc_1 = require("./ipc/budget.ipc");
const dashboard_ipc_1 = require("./ipc/dashboard.ipc");
const settings_ipc_1 = require("./ipc/settings.ipc");
const document_export_ipc_1 = require("./ipc/document-export.ipc");
const archiving_service_1 = require("./services/archiving.service");
const reminders_ipc_1 = require("./ipc/reminders.ipc");
const reminders_service_1 = require("./services/reminders.service");
const attestation_templates_service_1 = require("./services/attestation-templates.service");
const quote_templates_service_1 = require("./services/quote-templates.service");
const hr_templates_service_1 = require("./services/hr-templates.service");
const leave_service_1 = require("./services/leave.service");
// Distinction dev/prod basée sur l'empaquetage Electron (plus fiable que
// NODE_ENV, absent dans l'application installée).
const isDev = !electron_1.app.isPackaged;
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
    (0, quotes_ipc_1.registerQuotesIPC)();
    (0, quote_templates_ipc_1.registerQuoteTemplatesIPC)();
    (0, catalog_ipc_1.registerCatalogIPC)();
    (0, accounting_ipc_1.registerAccountingIPC)();
    (0, bilan_ipc_1.registerBilanIPC)();
    (0, communication_ipc_1.registerCommunicationIPC)();
    (0, crm_ipc_1.registerCrmIPC)();
    (0, archiving_ipc_1.registerArchivingIPC)();
    (0, documents_ipc_1.registerDocumentsIPC)();
    (0, lotissements_ipc_1.registerLotissementsIPC)();
    (0, terrains_ipc_1.registerTerrainsIPC)();
    (0, programmes_ipc_1.registerProgrammesIPC)();
    (0, projects_ipc_1.registerProjectsIPC)();
    (0, hr_ipc_1.registerHrIPC)();
    (0, career_profiles_ipc_1.registerCareerProfilesIPC)();
    (0, wire_transfer_ipc_1.registerWireTransferIPC)();
    (0, performance_ipc_1.registerPerformanceIPC)();
    (0, visitors_ipc_1.registerVisitorsIPC)();
    (0, calls_ipc_1.registerCallsIPC)();
    (0, social_media_ipc_1.registerSocialMediaIPC)();
    (0, it_innovations_ipc_1.registerItInnovationsIPC)();
    (0, construction_library_ipc_1.registerConstructionLibraryIPC)();
    (0, construction_projects_ipc_1.registerConstructionProjectsIPC)();
    (0, geo_ipc_1.registerGeoIPC)();
    (0, countries_ipc_1.registerCountriesIPC)();
    (0, commissions_ipc_1.registerCommissionsIPC)();
    (0, forecast_expenses_ipc_1.registerForecastExpensesIPC)();
    (0, analytics_ipc_1.registerAnalyticsIPC)();
    (0, export_ipc_1.registerExportIPC)();
    (0, invoice_templates_ipc_1.registerInvoiceTemplatesIPC)();
    (0, list_export_templates_ipc_1.registerListExportTemplatesIPC)();
    (0, treasury_ipc_1.registerTreasuryIPC)();
    (0, budget_ipc_1.registerBudgetIPC)();
    (0, dashboard_ipc_1.registerDashboardIPC)();
    (0, settings_ipc_1.registerSettingsIPC)();
    (0, document_export_ipc_1.registerDocumentExportIPC)();
    (0, reminders_ipc_1.registerRemindersIPC)();
    // Configuration de la connexion BDD — utilisable avant authentification.
    (0, config_ipc_1.registerConfigIPC)();
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
    // Charge DATABASE_URL (.env en dev, <userData>/config.env en prod) AVANT
    // toute connexion à la base.
    (0, loadEnv_1.loadAppEnv)();
    (0, db_service_1.getDb)();
    registerIPC();
    // Propage le chemin de stockage paramétré (AppSetting) au storage.service.
    await (0, settings_ipc_1.initStorageOverride)();
    // Politiques d'archivage par défaut + déclenchement de la passe quotidienne.
    // Tout est fait en fire-and-forget pour ne pas retarder l'apparition de la
    // fenêtre principale.
    (0, archiving_service_1.seedDefaultArchivePolicies)()
        .then(() => (0, archiving_service_1.scheduleAutoArchiving)())
        .catch((e) => logger_1.default.error(`Auto-archiving bootstrap failed: ${e.message}`));
    // Politique de relance : seed des templates/règles par défaut puis passe quotidienne.
    (0, reminders_service_1.seedDefaultRemindersConfig)()
        .then(() => (0, reminders_service_1.scheduleReminders)())
        .catch((e) => logger_1.default.error(`Reminders bootstrap failed: ${e.message}`));
    // Modèle d'attestation de SOLDE par défaut (créé une seule fois si absent).
    (0, attestation_templates_service_1.seedDefaultAttestationTemplate)()
        .catch((e) => logger_1.default.error(`Attestation template bootstrap failed: ${e.message}`));
    // Modèle de devis par défaut (créé une seule fois si absent).
    (0, quote_templates_service_1.seedDefaultQuoteTemplate)()
        .catch((e) => logger_1.default.error(`Quote template bootstrap failed: ${e.message}`));
    // Modèles RH : contrats (un par type) + bulletins de paie (3 modèles).
    (0, hr_templates_service_1.seedDefaultContractTemplates)()
        .then(() => (0, hr_templates_service_1.seedDefaultPayslipTemplates)())
        .then(() => (0, hr_templates_service_1.seedDefaultEssaiCategories)())
        .catch((e) => logger_1.default.error(`HR templates bootstrap failed: ${e.message}`));
    (0, leave_service_1.seedDefaultLeaveTypes)()
        .catch((e) => logger_1.default.error(`Leave types bootstrap failed: ${e.message}`));
    // Catégorie GED par défaut « UPLOAD FILES » (fichiers importés sans catégorie).
    (0, documents_ipc_1.seedUploadFilesCategory)()
        .catch((e) => logger_1.default.error(`Upload files category bootstrap failed: ${e.message}`));
    // Catalogue de KPI de performance par défaut + unités (idempotent).
    (0, performance_service_1.seedDefaultKpis)()
        .then(() => (0, performance_service_1.seedKpiUnits)())
        .catch((e) => logger_1.default.error(`Performance KPIs bootstrap failed: ${e.message}`));
    // Référentiels postes & départements amorcés depuis les fiches employés.
    (0, hr_ipc_1.seedJobPositionsFromEmployees)()
        .catch((e) => logger_1.default.error(`Job positions bootstrap failed: ${e.message}`));
    (0, hr_ipc_1.seedDepartmentsFromEmployees)()
        .catch((e) => logger_1.default.error(`Departments bootstrap failed: ${e.message}`));
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
