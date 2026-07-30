import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'AGENT_TECHNIQUE', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'RH', 'READONLY'];
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION'];

// Visibilité restreinte (AGENT / AGENT_TECHNIQUE / READONLY) : les compteurs du
// tableau de bord doivent refléter ce que l'utilisateur voit réellement dans ses
// listes. Ces filtres reproduisent ceux des modules Prospects et Clients.

/** Miroir de la visibilité prospects (cf. `prospects.ipc.ts` buildVisibilityWhere). */
function prospectVisibilityWhere(session: { userId: number }): any {
  return {
    OR: [
      { assignedToId: session.userId },
      { createdById: session.userId },
      { assignedToId: null },
    ],
  };
}

/** Miroir de la visibilité clients (cf. `clients.ipc.ts` buildVisibilityWhere). */
function clientVisibilityWhere(session: { userId: number }): any {
  return {
    OR: [
      { assignedToId: session.userId },
      { prospect: { is: { assignedToId: session.userId } } },
    ],
  };
}

/** Miroir de la visibilité apporteurs d'affaire (cf. `commissions.ipc.ts` referrerScopeWhere). */
function referrerVisibilityWhere(session: { userId: number }): any {
  return { assignedToId: session.userId };
}

const SLIDESHOW_SETTING_KEY = 'dashboard.slideshow';
const SLIDESHOW_ROLES_SETTING_KEY = 'dashboard.slideshow.allowedRoles';
const ATT_QR_ENABLED_KEY = 'attendance.qr.enabled';
const ATT_QR_BASEURL_KEY = 'attendance.qr.baseUrl';
const ATT_QR_ROLES_KEY = 'attendance.qr.allowedRoles';
const ATT_QR_MODEL_KEY = 'attendance.qr.model';
const VIS_QR_ENABLED_KEY = 'visitors.qr.enabled';
const VIS_QR_BASEURL_KEY = 'visitors.qr.baseUrl';
const VIS_QR_ROLES_KEY = 'visitors.qr.allowedRoles';
const VIS_QR_MODEL_KEY = 'visitors.qr.model';

interface SlideshowItem {
  type: 'image' | 'video';
  src: string;
  caption?: string;
  durationMs?: number;
}

const DEFAULT_SLIDESHOW: SlideshowItem[] = [
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

export function registerDashboardIPC(): void {
  ipcMain.handle('dashboard:getStats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);

      const db = getDb();
      const isPrivileged = PRIVILEGED_ROLES.includes(session.role);

      // Prospects : tous (privilégiés) ou seulement ceux accessibles (restreints).
      const prospectsCountPromise = db.prospect.count({
        where: { deletedAt: null, ...(isPrivileged ? {} : prospectVisibilityWhere(session)) },
      });

      const privilegedPromises = isPrivileged
        ? Promise.all([
            db.client.count({ where: { deletedAt: null } }),
            db.owner.count({ where: { deletedAt: null } }),
            db.terrain.count({ where: { deletedAt: null, statut: 'DISPONIBLE' } }),
            db.property.count({ where: { deletedAt: null, status: 'DISPONIBLE' } }),
            db.lotissement.count({ where: { deletedAt: null } }),
            db.programmeImmobilier.count({ where: { deletedAt: null } }),
            db.businessReferrer.count({ where: { deletedAt: null } }),
          ])
        : Promise.resolve([null, null, null, null, null, null, null] as const);

      // Rôles restreints (AGENT / AGENT_TECHNIQUE / READONLY) : clients accessibles,
      // terrains et biens disponibles (que ces rôles peuvent consulter), ainsi que
      // les apporteurs d'affaire dont ils sont l'utilisateur référent (même règle
      // d'accès que la zone Clients).
      const restrictedPromises = isPrivileged
        ? Promise.resolve([null, null, null, null] as const)
        : Promise.all([
            db.client.count({ where: { deletedAt: null, ...clientVisibilityWhere(session) } }),
            db.terrain.count({ where: { deletedAt: null, statut: 'DISPONIBLE' } }),
            db.property.count({ where: { deletedAt: null, status: 'DISPONIBLE' } }),
            db.businessReferrer.count({ where: { deletedAt: null, ...referrerVisibilityWhere(session) } }),
          ]);

      const slideshowRolesPromise = db.appSetting
        .findUnique({ where: { key: SLIDESHOW_ROLES_SETTING_KEY } })
        .then((s) => {
          if (!s?.value) return [] as string[];
          try {
            const parsed = JSON.parse(s.value);
            return Array.isArray(parsed) ? (parsed as string[]) : [];
          } catch {
            return [] as string[];
          }
        })
        .catch(() => [] as string[]);

      const slideshowItemsPromise = db.appSetting
        .findUnique({ where: { key: SLIDESHOW_SETTING_KEY } })
        .then((s) => {
          if (!s?.value) return DEFAULT_SLIDESHOW;
          try {
            const parsed = JSON.parse(s.value);
            return Array.isArray(parsed) && parsed.length > 0
              ? (parsed as SlideshowItem[])
              : DEFAULT_SLIDESHOW;
          } catch {
            return DEFAULT_SLIDESHOW;
          }
        })
        .catch(() => DEFAULT_SLIDESHOW);

      // Pointage par QR Code — exposé au tableau de bord des rôles autorisés.
      const attendanceQrPromise = db.appSetting
        .findMany({ where: { key: { in: [ATT_QR_ENABLED_KEY, ATT_QR_BASEURL_KEY, ATT_QR_ROLES_KEY, ATT_QR_MODEL_KEY] } } })
        .then((rows) => {
          const map = new Map(rows.map((r) => [r.key, r.value]));
          if (map.get(ATT_QR_ENABLED_KEY) !== 'true') return null;
          const url = (map.get(ATT_QR_BASEURL_KEY) ?? '').trim();
          if (!url) return null;
          let roles: string[] = [];
          try { const p = JSON.parse(map.get(ATT_QR_ROLES_KEY) ?? '[]'); if (Array.isArray(p)) roles = p; } catch { /* noop */ }
          const model = ['1', '2', '3'].includes(map.get(ATT_QR_MODEL_KEY) ?? '') ? map.get(ATT_QR_MODEL_KEY)! : '1';
          return roles.includes(session.role) ? { url, model } : null;
        })
        .catch(() => null);

      // QR Visiteurs — exposé au tableau de bord des rôles autorisés.
      const visitorQrPromise = db.appSetting
        .findMany({ where: { key: { in: [VIS_QR_ENABLED_KEY, VIS_QR_BASEURL_KEY, VIS_QR_ROLES_KEY, VIS_QR_MODEL_KEY] } } })
        .then((rows) => {
          const map = new Map(rows.map((r) => [r.key, r.value]));
          if (map.get(VIS_QR_ENABLED_KEY) !== 'true') return null;
          const url = (map.get(VIS_QR_BASEURL_KEY) ?? '').trim();
          if (!url) return null;
          let roles: string[] = [];
          try { const p = JSON.parse(map.get(VIS_QR_ROLES_KEY) ?? '[]'); if (Array.isArray(p)) roles = p; } catch { /* noop */ }
          const model = ['1', '2', '3'].includes(map.get(VIS_QR_MODEL_KEY) ?? '') ? map.get(VIS_QR_MODEL_KEY)! : '1';
          return roles.includes(session.role) ? { url, model } : null;
        })
        .catch(() => null);

      const [prospectsCount, privileged, restricted, slideshowItems, slideshowRoles, attendanceQr, visitorQr] = await Promise.all([
        prospectsCountPromise,
        privilegedPromises,
        restrictedPromises,
        slideshowItemsPromise,
        slideshowRolesPromise,
        attendanceQrPromise,
        visitorQrPromise,
      ]);

      // Slideshow visible uniquement si le rôle de l'utilisateur figure dans
      // la liste d'autorisation (vide par défaut = personne).
      const slideshow = slideshowRoles.includes(session.role) ? slideshowItems : [];

      const [clientsCount, ownersCount, availableTerrainsCount, availablePropertiesCount, lotissementsCount, programmesCount, apporteursCount] = privileged;
      const [restrictedClientsCount, restrictedTerrainsCount, restrictedPropertiesCount, restrictedApporteursCount] = restricted;

      return {
        success: true,
        data: {
          isPrivileged,
          counts: {
            prospects: prospectsCount,
            // Pour les rôles restreints : compteurs filtrés sur le périmètre accessible.
            clients: isPrivileged ? clientsCount : restrictedClientsCount,
            owners: ownersCount,
            availableTerrains: isPrivileged ? availableTerrainsCount : restrictedTerrainsCount,
            availableProperties: isPrivileged ? availablePropertiesCount : restrictedPropertiesCount,
            lotissements: lotissementsCount,
            programmes: programmesCount,
            apporteurs: isPrivileged ? apporteursCount : restrictedApporteursCount,
          },
          slideshow,
          attendanceQr,
          visitorQr,
        },
      };
    } catch (error: any) {
      logger.error('dashboard:getStats error', error.message);
      return { success: false, error: error.message };
    }
  });
}
