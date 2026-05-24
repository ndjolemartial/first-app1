"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDashboardIPC = registerDashboardIPC;
const electron_1 = require("electron");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const logger_1 = __importDefault(require("../utils/logger"));
const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'READONLY'];
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];
const SLIDESHOW_SETTING_KEY = 'dashboard.slideshow';
const DEFAULT_SLIDESHOW = [
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80',
        caption: 'Bienvenue sur Afrikimmo — votre portefeuille immobilier en un coup d’œil',
        durationMs: 6000,
    },
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1600&q=80',
        caption: 'Gérez vos biens, conventions et clients depuis une interface unique',
        durationMs: 6000,
    },
    {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80',
        caption: 'Suivez vos ventes, vos échéances et vos commissions en temps réel',
        durationMs: 6000,
    },
];
function registerDashboardIPC() {
    electron_1.ipcMain.handle('dashboard:getStats', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, READ_ROLES);
            const db = (0, db_service_1.getDb)();
            const isPrivileged = PRIVILEGED_ROLES.includes(session.role);
            const prospectsCountPromise = db.prospect.count({ where: { deletedAt: null } });
            const privilegedPromises = isPrivileged
                ? Promise.all([
                    db.client.count({ where: { deletedAt: null } }),
                    db.owner.count({ where: { deletedAt: null } }),
                    db.terrain.count({ where: { deletedAt: null, statut: 'DISPONIBLE' } }),
                    db.property.count({ where: { deletedAt: null, status: 'DISPONIBLE' } }),
                    db.lotissement.count({ where: { deletedAt: null } }),
                    db.programmeImmobilier.count({ where: { deletedAt: null } }),
                ])
                : Promise.resolve([null, null, null, null, null, null]);
            const slideshowPromise = db.appSetting
                .findUnique({ where: { key: SLIDESHOW_SETTING_KEY } })
                .then((s) => {
                if (!s?.value)
                    return DEFAULT_SLIDESHOW;
                try {
                    const parsed = JSON.parse(s.value);
                    return Array.isArray(parsed) && parsed.length > 0
                        ? parsed
                        : DEFAULT_SLIDESHOW;
                }
                catch {
                    return DEFAULT_SLIDESHOW;
                }
            })
                .catch(() => DEFAULT_SLIDESHOW);
            const [prospectsCount, privileged, slideshow] = await Promise.all([
                prospectsCountPromise,
                privilegedPromises,
                slideshowPromise,
            ]);
            const [clientsCount, ownersCount, availableTerrainsCount, availablePropertiesCount, lotissementsCount, programmesCount] = privileged;
            return {
                success: true,
                data: {
                    isPrivileged,
                    counts: {
                        prospects: prospectsCount,
                        clients: clientsCount,
                        owners: ownersCount,
                        availableTerrains: availableTerrainsCount,
                        availableProperties: availablePropertiesCount,
                        lotissements: lotissementsCount,
                        programmes: programmesCount,
                    },
                    slideshow,
                },
            };
        }
        catch (error) {
            logger_1.default.error('dashboard:getStats error', error.message);
            return { success: false, error: error.message };
        }
    });
}
