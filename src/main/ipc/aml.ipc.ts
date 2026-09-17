import { ipcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { getAmlRiskThresholds, setAmlRiskThresholds, recomputeProfileRisk } from '../services/aml-risk-engine.service';
import {
  runScreening,
  getAmlScreeningSchedule,
  setAmlScreeningSchedule,
  type AmlScreeningSchedule,
} from '../services/aml-screening.service';
import { getSetting, setSetting, SettingsKeys } from '../services/settings.service';
import logger from '../utils/logger';

type Db = ReturnType<typeof getDb>;

// Module 19 — Conformité LBC/FT. Rôle CONFORMITE exclusif (comme RH pour
// le Module 12) : aucune équivalence dans checkRole, contrôle par rôle exact.
// MANAGER puis ACCOUNTANT ont été ajoutés avec parité totale ADMIN (y compris
// AML_ADMIN_ONLY ci-dessous) — plein accès explicitement demandé, au-delà du
// périmètre de CONFORMITE lui-même sur les 3 actions les plus sensibles.
export const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];
const AML_ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
// Nommée distinctement d'AML_ROLES pour la lisibilité de la confidentialité,
// bien qu'identique aujourd'hui.
export const AML_REPORT_MANAGE_ROLES = AML_ROLES;
// Signalement interne d'un soupçon : large, exigence GAFI de remontée
// interne — tous les rôles sauf READONLY.
export const AML_REPORT_CREATE_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION',
  'AGENT', 'AGENT_TECHNIQUE', 'RH', 'CONFORMITE',
];
// Lecture du badge (résumé non sensible) sur les fiches Client/Owner/Convention —
// via checkRole (équivalences) pour couvrir les mêmes rôles que clients:read.
const AML_BADGE_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY', 'CONFORMITE'];

// AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION / READONLY : accès
// **restreint** au module, limité aux deux interfaces Référentiel de
// vigilance et Formations (jamais Profils/Revues/Déclarations/Tableau de
// bord — cf. RoleGuard dédié dans router.tsx, disjoint du groupe AML_ROLES).
const AML_RESTRICTED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];
// Au sein de ce groupe restreint, seul AGENT_TECHNIQUE peut créer/modifier/
// supprimer une entrée du référentiel de vigilance — AGENT, ASSISTANTE_
// DIRECTION et READONLY y sont en lecture seule (READONLY en particulier,
// conformément à son rôle, n'écrit jamais nulle part dans le module).
const WATCHLIST_RESTRICTED_WRITE_ROLES = ['AGENT_TECHNIQUE'];

// « Nos Procédures LBC/FT » — bibliothèque documentaire consultable par TOUT
// utilisateur authentifié (y compris RH, autrement exclusif à son module ; cf.
// aml:procedures:list/getById, sans aucun contrôle de rôle). Seuls joindre
// (create + documents:import) et supprimer sont réservés à ces 4 rôles —
// rôle EXACT (checkExactRole), volontairement sans l'équivalence
// ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER de checkRole, pour exclure
// ACCOUNTANT comme demandé.
const PROCEDURE_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION'];

// « Registres LBC/FT » (notifications, échanges CENTIF-CI, DSTE, opérations
// suspectes) — accès (enregistrement + visualisation + impression, un seul
// niveau, non distingué) géré **indépendamment des rôles** : les rôles à
// plein accès du module (AML_ROLES) l'ont par défaut ; un administrateur
// (SUPER_ADMIN/ADMIN uniquement) peut en plus désigner individuellement
// n'importe quel autre employé depuis Paramètres → « Registres LBC/FT —
// accès » — même principe que l'accès individuel à la Fiche KYC.
const REGISTERS_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function registersAuthorizedUserIds(db: Db): Promise<number[]> {
  const raw = await getSetting(SettingsKeys.registersAuthorizedUserIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n: any) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** Rejette si l'utilisateur n'a ni le rôle à plein accès du module, ni une désignation individuelle. */
async function assertRegistersAccess(db: Db, session: { role: string; userId: number }): Promise<void> {
  if (AML_ROLES.includes(session.role)) return;
  const ids = await registersAuthorizedUserIds(db);
  if (!ids.includes(session.userId)) throw new Error('Permission insuffisante');
}

// « Criblage » (`/aml/screening`) — contrairement au reste du module, la vue
// complète (AML_ROLES) n'est pas le rôle par défaut : seuls SUPER_ADMIN,
// ADMIN et MANAGER y accèdent d'office. Tous les autres rôles — y compris
// CONFORMITE et ACCOUNTANT, pourtant en plein accès sur le reste du module 19
// — n'y accèdent que par désignation individuelle depuis Paramètres →
// « Criblage — accès » (même mécanisme que Registres LBC/FT / Fiche KYC).
const SCREENING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const SCREENING_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function screeningAuthorizedUserIds(db: Db): Promise<number[]> {
  const raw = await getSetting(SettingsKeys.screeningAuthorizedUserIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n: any) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** Rejette si l'utilisateur n'a ni SUPER_ADMIN/ADMIN/MANAGER, ni une désignation individuelle. */
async function assertScreeningAccess(db: Db, session: { role: string; userId: number }): Promise<void> {
  if (SCREENING_ROLES.includes(session.role)) return;
  const ids = await screeningAuthorizedUserIds(db);
  if (!ids.includes(session.userId)) throw new Error('Permission insuffisante');
}

// « Alertes » (`/aml/alerts`) — même principe restrictif que Criblage
// ci-dessus : seuls SUPER_ADMIN, ADMIN et MANAGER y accèdent d'office
// (CONFORMITE et ACCOUNTANT en sont exclus par défaut, contrairement au
// reste du module 19), les autres via désignation individuelle depuis
// Paramètres → « Alertes — accès ». Couvre tout le CRUD (y compris la
// suppression, auparavant réservée à AML_ADMIN_ONLY).
const ALERTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const ALERTS_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function alertsAuthorizedUserIds(db: Db): Promise<number[]> {
  const raw = await getSetting(SettingsKeys.alertsAuthorizedUserIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n: any) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** Rejette si l'utilisateur n'a ni SUPER_ADMIN/ADMIN/MANAGER, ni une désignation individuelle. */
async function assertAlertsAccess(db: Db, session: { role: string; userId: number }): Promise<void> {
  if (ALERTS_ROLES.includes(session.role)) return;
  const ids = await alertsAuthorizedUserIds(db);
  if (!ids.includes(session.userId)) throw new Error('Permission insuffisante');
}

/** Vérifie un rôle exact (pas d'équivalence ACCOUNTANT/ASSISTANTE_DIRECTION → MANAGER). */
function checkExactRole(session: { role: string }, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);
/** Sérialise pour l'IPC : les Date/Decimal Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const subjectTypeSchema = z.enum(['CLIENT', 'OWNER']);

async function nextReference(
  db: Db,
  model:
    | 'amlProfile' | 'amlTransactionReview' | 'amlSuspiciousReport' | 'amlTraining' | 'amlProcedure'
    | 'amlNotificationRecord' | 'amlCentifExchange' | 'amlDsteRecord' | 'amlSuspiciousOperationRecord',
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const last = await (db[model] as any).findFirst({
    where: { reference: { startsWith: `${prefix}-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

/** Lecture volontairement étroite du sujet (Client ou Owner) — jamais l'objet complet. */
async function resolveSubjectSummary(db: Db, subjectType: string, subjectId: number) {
  if (subjectType === 'CLIENT') {
    return db.client.findFirst({
      where: { id: subjectId },
      select: { id: true, type: true, firstName: true, lastName: true, entreprise: true, nationality: true, idNumber: true, birthDate: true, country: true },
    });
  }
  return db.owner.findFirst({
    where: { id: subjectId },
    select: { id: true, type: true, firstName: true, lastName: true, companyName: true, country: true },
  });
}

/** Résout les noms des utilisateurs référencés par des colonnes `Int?` sans relation typée pour l'appelant. */
async function resolveUserNames(db: Db, ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((v): v is number => typeof v === 'number')));
  if (!unique.length) return new Map();
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.lastName} ${u.firstName}`]));
}

/* ─── Schémas Zod ────────────────────────────────────────────── */

const profileWriteSchema = z.object({
  isPep: z.boolean().optional(),
  pepCategory: z.enum(['PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP']).nullable().optional(),
  pepFunction: z.preprocess(emptyToNull, z.string().nullable().optional()),
  hasRiskyCountryLink: z.boolean().optional(),
  sourceOfFunds: z.preprocess(emptyToNull, z.string().nullable().optional()),
  sourceOfWealth: z.preprocess(emptyToNull, z.string().nullable().optional()),
  vigilanceType: z.enum(['SIMPLIFIEE', 'NORMALE', 'RENFORCEE']).optional(),
  nextReviewDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const profileCreateSchema = profileWriteSchema.extend({
  subjectType: subjectTypeSchema,
  subjectId: z.coerce.number().int().positive(),
});

const setRiskFactorsSchema = z.object({ riskFactorIds: z.array(z.coerce.number().int().positive()) });

const beneficialOwnerSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  nationality: z.preprocess(emptyToNull, z.string().nullable().optional()),
  idNumber: z.preprocess(emptyToNull, z.string().nullable().optional()),
  ownershipPct: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable().optional()),
  role: z.preprocess(emptyToNull, z.string().nullable().optional()),
  isPep: z.boolean().optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const riskFactorSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  label: z.string().min(1, 'Libellé requis'),
  category: z.preprocess(emptyToNull, z.string().nullable().optional()),
  weight: z.coerce.number().int().min(0).default(1),
  isAutoDetected: z.boolean().optional(),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  isActive: z.boolean().optional(),
});

const thresholdsSchema = z.object({
  faibleMax: z.coerce.number().int().min(0),
  moyenMax: z.coerce.number().int().min(0),
  amountThreshold: z.coerce.number().min(0),
  dsteThreshold: z.coerce.number().min(0),
}).refine((d) => d.moyenMax >= d.faibleMax, { message: 'Le seuil moyen doit être supérieur ou égal au seuil faible', path: ['moyenMax'] });

const watchlistSchema = z.object({
  listType: z.enum(['ONU', 'UE', 'NATIONALE', 'GIABA', 'AUTRE']),
  personType: z.enum(['PHYSIQUE', 'MORALE']).optional(),
  name: z.string().min(1, 'Nom requis'), // Nom et prénoms / raison sociale
  aliases: z.array(z.string()).optional(),
  sex: z.preprocess(emptyToNull, z.string().nullable().optional()),
  nationality: z.preprocess(emptyToNull, z.string().nullable().optional()),
  // number[] — âges connus (indicatifs), plusieurs valeurs fréquentes pour une
  // même personne, comme les dates de naissance ci-dessous.
  ages: z.array(z.coerce.number().int().min(0).max(150)).optional(),
  // string[] de dates ISO (YYYY-MM-DD) — plusieurs dates de naissance connues
  // pour une même personne (fréquent sur les listes SFC/PPE sources).
  birthDates: z.array(z.string().min(1)).optional(),
  birthPlace: z.preprocess(emptyToNull, z.string().nullable().optional()),
  relatedPersons: z.preprocess(emptyToNull, z.string().nullable().optional()),
  maritalStatus: z.preprocess(emptyToNull, z.enum(['CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF']).nullable().optional()),
  spokenLanguage: z.preprocess(emptyToNull, z.string().nullable().optional()),
  residenceCountry: z.preprocess(emptyToNull, z.string().nullable().optional()),
  address: z.preprocess(emptyToNull, z.string().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
  profession: z.preprocess(emptyToNull, z.string().nullable().optional()),
  reason: z.preprocess(emptyToNull, z.string().nullable().optional()),
  sourceRef: z.preprocess(emptyToNull, z.string().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
  isActive: z.boolean().optional(),
});

const matchReviewSchema = z.object({
  status: z.enum(['CONFIRME', 'FAUX_POSITIF']),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const reviewCreateSchema = z.object({
  // Source réelle de l'encaissement — un paiement de facture ou une échéance
  // (convention-liée ou héritée). Une revue ne se déclenche plus jamais sur
  // la seule convention.
  sourceType: z.enum(['PAYMENT', 'INSTALLMENT', 'INVOICE']),
  sourceId: z.coerce.number().int().positive(),
  conventionId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  sourceLabel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  subjectType: subjectTypeSchema,
  subjectId: z.coerce.number().int().positive(),
  triggerReason: z.enum(['SEUIL_MONTANT', 'RISQUE_ELEVE', 'PEP', 'PAYS_RISQUE', 'ESPECES', 'WATCHLIST', 'MANUEL']),
  amount: z.preprocess(emptyToNull, z.coerce.number().nullable().optional()),
  paymentMethod: z.preprocess(emptyToNull, z.string().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const reviewCloseSchema = z.object({
  status: z.enum(['CLOTUREE_RAS', 'CLOTUREE_DECLAREE']),
  conclusion: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const reportMotifCategory = z.enum(['STRUCTURATION', 'ORIGINE_FONDS_SUSPECTE', 'INCOHERENCE_PROFIL', 'MONTAGE_COMPLEXE', 'PEP_NON_JUSTIFIE', 'WATCHLIST_CONFIRMEE', 'AUTRE']);

const reportCreateSchema = z.object({
  subjectType: subjectTypeSchema,
  subjectId: z.coerce.number().int().positive(),
  conventionId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  transactionReviewId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  motifCategory: reportMotifCategory.nullable().optional(),
  motif: z.string().min(1, 'Motif requis'),
});

const reportUpdateSchema = z.object({
  motifCategory: reportMotifCategory.nullable().optional(),
  motif: z.string().min(1).optional(),
  complianceOfficerId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const reportTransmitSchema = z.object({ centifReference: z.string().min(1, 'Référence CENTIF requise') });
const reportClassifySchema = z.object({ classificationReason: z.string().min(1, 'Motif requis') });

const trainingBaseSchema = z.object({
  trainingDate: z.coerce.date(),
  topic: z.string().min(1, 'Sujet requis'),
  provider: z.preprocess(emptyToNull, z.string().nullable().optional()),
  durationHours: z.preprocess(emptyToNull, z.coerce.number().min(0).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
// Création : plusieurs participants pour une même session de formation —
// une ligne AmlTraining par participant (registre plat conservé, cf. plan),
// même sujet/date/organisme/durée/notes partagés.
const trainingCreateSchema = trainingBaseSchema.extend({
  userIds: z.array(z.coerce.number().int().positive()).min(1, 'Sélectionnez au moins un participant'),
});
// Modification : une ligne = un participant, le participant reste modifiable individuellement.
const trainingUpdateSchema = trainingBaseSchema.extend({ userId: z.coerce.number().int().positive() }).partial();

// Alerte CENTIF-CI / mise à jour d'une liste SFC — un enregistrement = une
// version de la base de criblage.
const alertBaseSchema = z.object({
  source: z.enum(['CENTIF_CI', 'SFC', 'ONU', 'UE', 'GIABA', 'AUTRE']),
  title: z.string().min(1, 'Intitulé requis'),
  centifPublicationDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  fileDownloadedAt: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  integratedAt: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  operatorId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  operatorName: z.preprocess(emptyToNull, z.string().nullable().optional()),
  entriesAdded: z.preprocess(emptyToNull, z.coerce.number().int().min(0).nullable().optional()),
  entriesModified: z.preprocess(emptyToNull, z.coerce.number().int().min(0).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const alertCreateSchema = alertBaseSchema;
const alertUpdateSchema = alertBaseSchema.partial();

// Procédure interne LBC/FT — métadonnées seules (le/les fichier(s) sont
// joints séparément via documents:import avec amlProcedureId).
const procedureBaseSchema = z.object({
  title: z.string().min(1, 'Intitulé requis'),
  category: z.preprocess(emptyToNull, z.string().nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const procedureCreateSchema = procedureBaseSchema;
const procedureUpdateSchema = procedureBaseSchema.partial();

/* ─── Registres LBC/FT ──────────────────────────────────────── */

// 1. Registre de suivi des notifications.
const notificationBaseSchema = z.object({
  updateDate: z.coerce.date(),
  updateDescription: z.string().min(1, 'Description de la mise à jour requise'),
  notificationDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  transmissionMode: z.preprocess(emptyToNull, z.string().nullable().optional()),
  ackReceived: z.boolean().optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const notificationCreateSchema = notificationBaseSchema;
const notificationUpdateSchema = notificationBaseSchema.partial();

// 2. Registre de suivi des échanges avec la CENTIF-CI.
const exchangeBaseSchema = z.object({
  exchangeDate: z.coerce.date(),
  direction: z.enum(['ENTRANT', 'SORTANT']),
  nature: z.string().min(1, "Nature de l'échange requise"),
  channel: z.preprocess(emptyToNull, z.string().nullable().optional()),
  status: z.enum(['EN_COURS', 'CLOTURE', 'SANS_SUITE']).optional(),
  closedAt: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const exchangeCreateSchema = exchangeBaseSchema;
const exchangeUpdateSchema = exchangeBaseSchema.partial();

// 3. Grille de recensement des transactions en espèces éligibles à la DSTE.
const dsteBaseSchema = z.object({
  transactionDate: z.coerce.date(),
  subjectLabel: z.string().min(1, 'Client / dossier concerné requis'),
  amount: z.coerce.number().positive('Montant requis'),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const dsteCreateSchema = dsteBaseSchema;
const dsteUpdateSchema = dsteBaseSchema.partial();

// 4. Registre des opérations suspectes.
const suspiciousOperationBaseSchema = z.object({
  detectionDate: z.coerce.date(),
  subjectLabel: z.string().min(1, 'Client / dossier concerné requis'),
  description: z.string().min(1, 'Description des faits requise'),
  decision: z.enum(['DOS_TRANSMISE', 'DOS_NON_RETENUE']).nullable().optional(),
  dosExchangeId: z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});
const suspiciousOperationCreateSchema = suspiciousOperationBaseSchema;
const suspiciousOperationUpdateSchema = suspiciousOperationBaseSchema.partial();

const hitReviewSchema = z.object({
  status: z.enum(['A_VERIFIER', 'CONFIRME', 'FAUX_POSITIF']),
  notes: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const screeningScheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  weekday: z.coerce.number().int().min(0).max(6),
  monthday: z.coerce.number().int().min(1).max(28),
  hour: z.coerce.number().int().min(0).max(23),
});

async function nextAlertReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.amlWatchlistAlert.findFirst({
    where: { reference: { startsWith: `MAJ-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `MAJ-${year}-${String(seq).padStart(4, '0')}`;
}

const SCREENING_ENTITY_LABEL: Record<string, string> = {
  CLIENT: 'Client', PROSPECT: 'Prospect', OWNER: 'Propriétaire', REFERRER: "Apporteur d'affaires",
};

/** Enregistre les handlers IPC du module Conformité LBC/FT (Module 19). */
export function registerAmlIPC(): void {
  /* ─── Profils ──────────────────────────────────────────────── */

  ipcMain.handle('aml:profiles:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.riskLevel) where.riskLevel = filters.riskLevel;
      if (filters.status) where.status = filters.status;
      if (filters.subjectType) where.subjectType = filters.subjectType;

      const [rows, total] = await db.$transaction([
        db.amlProfile.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.amlProfile.count({ where }),
      ]);
      const data = await Promise.all(rows.map(async (p) => ({ ...p, subject: await resolveSubjectSummary(db, p.subjectType, p.subjectId) })));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:profiles:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const profile = await db.amlProfile.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: {
          beneficialOwners: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
          riskFactorLinks: { include: { riskFactor: true } },
          watchlistMatches: { include: { watchlist: true }, orderBy: { createdAt: 'desc' } },
          documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!profile) return { success: false, error: 'Profil introuvable' };
      const subject = await resolveSubjectSummary(db, profile.subjectType, profile.subjectId);
      const names = await resolveUserNames(db, [profile.validatedById, profile.createdById]);
      const data = {
        ...profile,
        subject,
        validatedByName: profile.validatedById ? names.get(profile.validatedById) ?? null : null,
        createdByName: profile.createdById ? names.get(profile.createdById) ?? null : null,
      };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:profiles:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  // Badge non sensible pour les fiches Client/Owner — accessible aux mêmes
  // rôles que la lecture de ces fiches (checkRole, avec équivalences).
  ipcMain.handle('aml:profiles:getBySubject', async (_event, { token, subjectType, subjectId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, AML_BADGE_READ_ROLES);
      const db = getDb();
      const profile = await db.amlProfile.findFirst({
        where: { subjectType, subjectId: Number(subjectId), deletedAt: null },
        select: { id: true, riskLevel: true, status: true, vigilanceType: true, isPep: true, updatedAt: true },
      });
      return ser({ success: true, data: profile ?? null });
    } catch (error: any) {
      logger.error('aml:profiles:getBySubject', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:subjectsWithoutProfile', async (_event, { token, subjectType, search }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const existing = await db.amlProfile.findMany({ where: { subjectType }, select: { subjectId: true } });
      const excludeIds = existing.map((e) => e.subjectId);
      if (subjectType === 'CLIENT') {
        const data = await db.client.findMany({
          where: {
            deletedAt: null,
            id: { notIn: excludeIds },
            ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { entreprise: { contains: search } }] } : {}),
          },
          select: { id: true, type: true, firstName: true, lastName: true, entreprise: true },
          orderBy: { lastName: 'asc' },
          take: 50,
        });
        return ser({ success: true, data });
      }
      const data = await db.owner.findMany({
        where: {
          deletedAt: null,
          id: { notIn: excludeIds },
          ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { companyName: { contains: search } }] } : {}),
        },
        select: { id: true, type: true, firstName: true, lastName: true, companyName: true },
        orderBy: { lastName: 'asc' },
        take: 50,
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:profiles:subjectsWithoutProfile', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = profileCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const subject = await resolveSubjectSummary(db, parsed.data.subjectType, parsed.data.subjectId);
      if (!subject) return { success: false, error: 'Client ou propriétaire introuvable' };
      const already = await db.amlProfile.findFirst({ where: { subjectType: parsed.data.subjectType, subjectId: parsed.data.subjectId } });
      if (already) return { success: false, error: 'Un profil LBC/FT existe déjà pour ce sujet' };

      const reference = await nextReference(db, 'amlProfile', 'LBC');
      const { subjectType, subjectId, ...rest } = parsed.data;
      const profile = await db.amlProfile.create({
        data: { reference, subjectType, subjectId, ...rest, createdById: session.userId },
      });
      logger.info(`Profil LBC/FT créé : ${profile.reference}`);
      return ser({ success: true, data: profile });
    } catch (error: any) {
      logger.error('aml:profiles:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = profileWriteSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Profil introuvable' };
      const profile = await db.amlProfile.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: profile });
    } catch (error: any) {
      logger.error('aml:profiles:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:setRiskFactors', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = setRiskFactorsSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Profil introuvable' };

      await db.$transaction(async (tx) => {
        // Ne touche que les liens MANUEL — les liens AUTO restent gérés par recomputeProfileRisk.
        await tx.amlProfileRiskFactor.deleteMany({ where: { profileId: existing.id, source: 'MANUEL' } });
        const currentAuto = await tx.amlProfileRiskFactor.findMany({ where: { profileId: existing.id, source: 'AUTO' }, select: { riskFactorId: true } });
        const autoIds = new Set(currentAuto.map((l) => l.riskFactorId));
        const toCreate = parsed.data.riskFactorIds.filter((rid) => !autoIds.has(rid));
        if (toCreate.length) {
          await tx.amlProfileRiskFactor.createMany({ data: toCreate.map((riskFactorId) => ({ profileId: existing.id, riskFactorId, source: 'MANUEL' as const })) });
        }
      });
      const profile = await recomputeProfileRisk(db, existing.id);
      return ser({ success: true, data: profile });
    } catch (error: any) {
      logger.error('aml:profiles:setRiskFactors', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:profiles:computeRisk', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Profil introuvable' };
      const profile = await recomputeProfileRisk(db, existing.id);
      return ser({ success: true, data: profile });
    } catch (error: any) {
      logger.error('aml:profiles:computeRisk', error.message);
      return { success: false, error: error.message };
    }
  });

  const transitionHandler = (status: 'VALIDE' | 'A_REVOIR' | 'REFUSE', channel: string) => {
    ipcMain.handle(channel, async (_event, { token, id }: any) => {
      try {
        const session = getSession(token);
        if (!session) return { success: false, error: 'Session expirée' };
        checkExactRole(session, AML_ROLES);
        const db = getDb();
        const existing = await db.amlProfile.findFirst({ where: { id: Number(id), deletedAt: null } });
        if (!existing) return { success: false, error: 'Profil introuvable' };
        const data: any = { status };
        if (status === 'VALIDE') { data.validatedById = session.userId; data.validatedAt = new Date(); }
        const profile = await db.amlProfile.update({ where: { id: existing.id }, data });
        return ser({ success: true, data: profile });
      } catch (error: any) {
        logger.error(channel, error.message);
        return { success: false, error: error.message };
      }
    });
  };
  transitionHandler('VALIDE', 'aml:profiles:validate');
  transitionHandler('A_REVOIR', 'aml:profiles:markToReview');
  transitionHandler('REFUSE', 'aml:profiles:markRefused');

  ipcMain.handle('aml:profiles:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ADMIN_ONLY);
      const db = getDb();
      await db.amlProfile.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:profiles:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Bénéficiaires effectifs ──────────────────────────────── */

  ipcMain.handle('aml:beneficialOwners:list', async (_event, { token, profileId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const data = await db.amlBeneficialOwner.findMany({ where: { profileId: Number(profileId), deletedAt: null }, orderBy: { createdAt: 'asc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:beneficialOwners:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:beneficialOwners:create', async (_event, { token, profileId, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = beneficialOwnerSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const profile = await db.amlProfile.findFirst({ where: { id: Number(profileId), deletedAt: null } });
      if (!profile) return { success: false, error: 'Profil introuvable' };
      const data = await db.amlBeneficialOwner.create({ data: { ...parsed.data, profileId: profile.id } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:beneficialOwners:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:beneficialOwners:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = beneficialOwnerSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data = await db.amlBeneficialOwner.update({ where: { id: Number(id) }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:beneficialOwners:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:beneficialOwners:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      await db.amlBeneficialOwner.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:beneficialOwners:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Catalogue des facteurs de risque + seuils ───────────── */

  ipcMain.handle('aml:riskFactors:list', async (_event, { token, includeInactive }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (!includeInactive) where.isActive = true;
      const data = await db.amlRiskFactorCatalog.findMany({ where, orderBy: [{ category: 'asc' }, { label: 'asc' }] });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:riskFactors:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:riskFactors:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = riskFactorSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data = await db.amlRiskFactorCatalog.create({ data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, error: 'Ce code existe déjà' };
      logger.error('aml:riskFactors:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:riskFactors:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = riskFactorSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data = await db.amlRiskFactorCatalog.update({ where: { id: Number(id) }, data: parsed.data });
      return ser({ success: true, data });
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, error: 'Ce code existe déjà' };
      logger.error('aml:riskFactors:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:riskFactors:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      await db.amlRiskFactorCatalog.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:riskFactors:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getAmlRiskThresholds', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const data = await getAmlRiskThresholds(getDb());
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('settings:getAmlRiskThresholds', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:updateAmlRiskThresholds', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ADMIN_ONLY);
      const parsed = thresholdsSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      await setAmlRiskThresholds(parsed.data, getDb());
      return { success: true, data: parsed.data };
    } catch (error: any) {
      logger.error('settings:updateAmlRiskThresholds', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Référentiel de vigilance (watchlist) ────────────────── */

  ipcMain.handle('aml:watchlist:list', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...AML_RESTRICTED_ROLES]);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.listType) where.listType = filters.listType;
      if (filters.personType) where.personType = filters.personType;
      let data = await db.amlWatchlist.findMany({ where, orderBy: { name: 'asc' } });
      // Recherche élargie — nom, alias, nationalité, pays de résidence habituel,
      // référence dans la liste source — appliquée en mémoire (comme
      // `aml:watchlist:screen` ci-dessous) : le filtre JSON "contains" de
      // Prisma/MySQL ne permet de tester qu'une égalité exacte d'élément de
      // tableau, pas une sous-chaîne au sein d'un alias.
      if (filters.search) {
        const term = String(filters.search).toLowerCase();
        data = data.filter((w) => {
          const haystacks = [
            w.name,
            ...(Array.isArray(w.aliases) ? (w.aliases as string[]) : []),
            w.nationality,
            w.residenceCountry,
            w.sourceRef,
          ];
          return haystacks.some((v) => typeof v === 'string' && v.toLowerCase().includes(term));
        });
      }
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:watchlist:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlist:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...AML_RESTRICTED_ROLES]);
      const db = getDb();
      const data = await db.amlWatchlist.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!data) return { success: false, error: 'Entrée introuvable' };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:watchlist:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlist:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
      const parsed = watchlistSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data = await db.amlWatchlist.create({ data: parsed.data });
      runScreening({ trigger: 'REFERENTIEL_MAJ', operatorId: session.userId }).catch((e) => logger.error(`aml screening after watchlist:create: ${e.message}`));
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:watchlist:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlist:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
      const parsed = watchlistSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const data = await db.amlWatchlist.update({ where: { id: Number(id) }, data: parsed.data });
      runScreening({ trigger: 'REFERENTIEL_MAJ', operatorId: session.userId }).catch((e) => logger.error(`aml screening after watchlist:update: ${e.message}`));
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:watchlist:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlist:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...WATCHLIST_RESTRICTED_WRITE_ROLES]);
      const db = getDb();
      await db.amlWatchlist.update({ where: { id: Number(id) }, data: { deletedAt: new Date(), isActive: false } });
      runScreening({ trigger: 'REFERENTIEL_MAJ', operatorId: session.userId }).catch((e) => logger.error(`aml screening after watchlist:delete: ${e.message}`));
      return { success: true };
    } catch (error: any) {
      logger.error('aml:watchlist:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  // Rapprochement manuel/semi-assisté — correspondance textuelle sur nom/alias.
  // Aucune connexion à une API externe (aucune n'est disponible localement).
  ipcMain.handle('aml:watchlist:screen', async (_event, { token, profileId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const profile = await db.amlProfile.findFirst({ where: { id: Number(profileId), deletedAt: null } });
      if (!profile) return { success: false, error: 'Profil introuvable' };
      const subject = await resolveSubjectSummary(db, profile.subjectType, profile.subjectId);
      if (!subject) return { success: false, error: 'Sujet introuvable' };
      const names = [
        'firstName' in subject ? [subject.firstName, (subject as any).lastName].filter(Boolean).join(' ') : null,
        (subject as any).entreprise, (subject as any).companyName,
      ].filter((n): n is string => !!n && n.trim().length > 0);

      const active = await db.amlWatchlist.findMany({ where: { deletedAt: null, isActive: true } });
      const matched = active.filter((w) => {
        const candidates = [w.name, ...(Array.isArray(w.aliases) ? (w.aliases as string[]) : [])].map((s) => s.toLowerCase());
        return names.some((n) => candidates.some((c) => c.includes(n.toLowerCase()) || n.toLowerCase().includes(c)));
      });

      const existingMatches = await db.amlWatchlistMatch.findMany({ where: { profileId: profile.id, status: 'A_VERIFIER' }, select: { watchlistId: true } });
      const existingIds = new Set(existingMatches.map((m) => m.watchlistId));
      const toCreate = matched.filter((w) => !existingIds.has(w.id));
      if (toCreate.length) {
        await db.amlWatchlistMatch.createMany({ data: toCreate.map((w) => ({ profileId: profile.id, watchlistId: w.id })) });
      }
      const data = await db.amlWatchlistMatch.findMany({ where: { profileId: profile.id }, include: { watchlist: true }, orderBy: { createdAt: 'desc' } });
      return ser({ success: true, data, matchCount: matched.length });
    } catch (error: any) {
      logger.error('aml:watchlist:screen', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlistMatches:list', async (_event, { token, profileId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const data = await db.amlWatchlistMatch.findMany({ where: { profileId: Number(profileId) }, include: { watchlist: true }, orderBy: { createdAt: 'desc' } });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:watchlistMatches:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:watchlistMatches:review', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = matchReviewSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlWatchlistMatch.findFirst({ where: { id: Number(id) } });
      if (!existing) return { success: false, error: 'Correspondance introuvable' };
      const match = await db.amlWatchlistMatch.update({
        where: { id: existing.id },
        data: { status: parsed.data.status, notes: parsed.data.notes, reviewedById: session.userId, reviewedAt: new Date() },
      });
      if (parsed.data.status === 'CONFIRME') await recomputeProfileRisk(db, existing.profileId);
      return ser({ success: true, data: match });
    } catch (error: any) {
      logger.error('aml:watchlistMatches:review', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Revues de transaction ────────────────────────────────── */

  ipcMain.handle('aml:reviews:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      const [data, total] = await db.$transaction([
        db.amlTransactionReview.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.amlTransactionReview.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:reviews:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:reviews:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const review = await db.amlTransactionReview.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { documents: { where: { deletedAt: null } }, reports: { where: { deletedAt: null } } },
      });
      if (!review) return { success: false, error: 'Revue introuvable' };
      const subject = await resolveSubjectSummary(db, review.subjectType, review.subjectId);
      return ser({ success: true, data: { ...review, subject } });
    } catch (error: any) {
      logger.error('aml:reviews:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  // Badge non sensible pour la fiche Convention.
  ipcMain.handle('aml:reviews:getByConvention', async (_event, { token, conventionId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, AML_BADGE_READ_ROLES);
      const db = getDb();
      const review = await db.amlTransactionReview.findFirst({
        where: { conventionId: Number(conventionId), deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true, status: true, triggerReason: true },
      });
      return ser({ success: true, data: review ?? null });
    } catch (error: any) {
      logger.error('aml:reviews:getByConvention', error.message);
      return { success: false, error: error.message };
    }
  });

  // File dérivée, calculée à la demande — pas de tâche planifiée en phase 1.
  // Portée sur les encaissements effectifs (Payment / SaleInstallment
  // encaissée), jamais sur les Conventions elles-mêmes : le risque LBC/FT
  // porte sur l'argent qui bouge, pas sur le contrat signé. Seul critère de
  // déclenchement automatique : le montant dépasse le seuil « élevé »
  // paramétrable (Paramètres → Conformité LBC/FT → Seuils de scoring) —
  // le mode de paiement espèces et le profil à risque ne déclenchent plus
  // seuls une candidature (ils restent disponibles comme motifs de revue
  // manuelle, cf. `triggerReason` à la création).
  ipcMain.handle('aml:reviews:pendingCandidates', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const thresholds = await getAmlRiskThresholds(db);

      const openReviews = await db.amlTransactionReview.findMany({
        where: { status: { in: ['OUVERTE', 'EN_COURS'] } },
        select: { sourceType: true, sourceId: true },
      });
      const isOpen = (t: string, id: number) => openReviews.some((r) => r.sourceType === t && r.sourceId === id);

      // 1) Paiements de factures
      const payments = await db.payment.findMany({
        include: { invoice: { select: { id: true, reference: true, clientId: true, conventionId: true } } },
        orderBy: { paidAt: 'desc' },
        take: 200,
      });
      const paymentCandidates = payments
        .filter((p) => !isOpen('PAYMENT', p.id) && p.invoice.clientId != null)
        .filter((p) => p.amount.gt(thresholds.amountThreshold))
        .map((p) => ({
          sourceType: 'PAYMENT' as const,
          sourceId: p.id,
          amount: p.amount,
          paymentMethod: p.method,
          conventionId: p.invoice.conventionId,
          clientId: p.invoice.clientId as number,
          label: `Paiement facture ${p.invoice.reference}`,
          date: p.paidAt,
        }));

      // 2) Échéances encaissées (convention-liées + héritées) — un seul
      // modèle, distinguées par la présence de conventionId. Une échéance
      // n'est un encaissement que si status ∈ {PARTIEL, PAYE}.
      const installments = await db.saleInstallment.findMany({
        where: { status: { in: ['PARTIEL', 'PAYE'] } },
        include: { convention: { select: { id: true, reference: true, clientId: true } } },
        orderBy: { paidAt: 'desc' },
        take: 200,
      });
      const installmentCandidates = installments
        .filter((i) => !isOpen('INSTALLMENT', i.id))
        .map((i) => ({ i, resolvedClientId: i.clientId ?? i.convention?.clientId ?? null }))
        .filter((x): x is typeof x & { resolvedClientId: number } => x.resolvedClientId != null)
        .filter((x) => x.i.amount.gt(thresholds.amountThreshold))
        .map(({ i, resolvedClientId }) => ({
          sourceType: 'INSTALLMENT' as const,
          sourceId: i.id,
          amount: i.amount,
          paymentMethod: i.paymentMethod,
          conventionId: i.conventionId,
          clientId: resolvedClientId,
          label: i.conventionId
            ? `Échéance n°${i.installmentNumber} — ${i.convention?.reference ?? i.conventionId}`
            : `Échéance héritée — ${i.detailsSouscription ?? 'souscription sans convention'}`,
          date: i.paidAt,
        }));

      // 3) Factures « Apport initial » / « Paiement comptant » (VENTE) réglées
      // sans passer par le grand livre des paiements (`accounting:updateInvoiceStatus`
      // permet de faire basculer une facture directement en PAYEE, ex. « → Payée »
      // sur la fiche facture, sans jamais créer de Payment) — ces encaissements
      // ne remontent donc pas via le bucket (1) ci-dessus. Ne compte que la part
      // non déjà couverte par des Payment enregistrés (évite les doublons quand
      // la facture a bien été réglée via accounting:addPayment).
      const cashInvoices = await db.invoice.findMany({
        where: { deletedAt: null, type: { in: ['APPORT_INITIAL', 'VENTE'] }, status: 'PAYEE', clientId: { not: null } },
        include: { payments: { select: { amount: true } } },
        orderBy: { paidAt: 'desc' },
        take: 200,
      });
      const invoiceCandidates = cashInvoices
        .filter((inv) => !isOpen('INVOICE', inv.id))
        .filter((inv) => inv.payments.reduce((s, p) => s + Number(p.amount), 0) < Number(inv.total))
        .filter((inv) => inv.total.gt(thresholds.amountThreshold))
        .map((inv) => ({
          sourceType: 'INVOICE' as const,
          sourceId: inv.id,
          amount: inv.total,
          paymentMethod: null as string | null,
          conventionId: inv.conventionId,
          clientId: inv.clientId as number,
          label: `${inv.type === 'APPORT_INITIAL' ? 'Apport initial' : 'Paiement comptant'} — facture ${inv.reference}`,
          date: inv.paidAt,
        }));

      const candidates = [...paymentCandidates, ...installmentCandidates, ...invoiceCandidates];
      const clientIds = Array.from(new Set(candidates.map((c) => c.clientId)));
      const clients = clientIds.length
        ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, type: true, firstName: true, lastName: true, entreprise: true } })
        : [];
      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const data = candidates
        .map((c) => ({ ...c, client: clientMap.get(c.clientId) ?? null }))
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:reviews:pendingCandidates', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:reviews:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = reviewCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db, 'amlTransactionReview', 'RC');
      const review = await db.amlTransactionReview.create({
        data: { reference, ...parsed.data, createdById: session.userId },
      });
      logger.info(`Revue LBC/FT créée : ${review.reference}`);
      return ser({ success: true, data: review });
    } catch (error: any) {
      logger.error('aml:reviews:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:reviews:close', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = reviewCloseSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlTransactionReview.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Revue introuvable' };
      const review = await db.amlTransactionReview.update({
        where: { id: existing.id },
        data: { status: parsed.data.status, conclusion: parsed.data.conclusion, reviewedById: session.userId, reviewedAt: new Date() },
      });
      return ser({ success: true, data: review });
    } catch (error: any) {
      logger.error('aml:reviews:close', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:reviews:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ADMIN_ONLY);
      const db = getDb();
      await db.amlTransactionReview.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:reviews:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Déclarations de soupçon (strictement confidentiel) ──── */

  // Signalement interne — large (tous rôles sauf READONLY), verrouillé sur
  // soi-même, réponse limitée à l'accusé de réception (jamais de relecture
  // possible ensuite pour le déclarant — cf. list/getById ci-dessous).
  ipcMain.handle('aml:suspiciousReports:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_CREATE_ROLES);
      const parsed = reportCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db, 'amlSuspiciousReport', 'DS');
      const report = await db.amlSuspiciousReport.create({
        data: { reference, ...parsed.data, declaredById: session.userId },
      });
      logger.info(`Déclaration de soupçon créée : ${report.reference}`);
      return ser({ success: true, data: { id: report.id, reference: report.reference } });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousReports:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_MANAGE_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.status) where.status = filters.status;
      const [rows, total] = await db.$transaction([
        db.amlSuspiciousReport.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        db.amlSuspiciousReport.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.flatMap((r) => [r.declaredById, r.complianceOfficerId, r.transmittedById]));
      const data = await Promise.all(rows.map(async (r) => ({
        ...r,
        subject: await resolveSubjectSummary(db, r.subjectType, r.subjectId),
        declaredByName: names.get(r.declaredById) ?? null,
        complianceOfficerName: r.complianceOfficerId ? names.get(r.complianceOfficerId) ?? null : null,
      })));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousReports:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_MANAGE_ROLES);
      const db = getDb();
      const report = await db.amlSuspiciousReport.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { documents: { where: { deletedAt: null } }, transactionReview: true },
      });
      if (!report) return { success: false, error: 'Déclaration introuvable' };
      const subject = await resolveSubjectSummary(db, report.subjectType, report.subjectId);
      const names = await resolveUserNames(db, [report.declaredById, report.complianceOfficerId, report.transmittedById]);
      const data = {
        ...report,
        subject,
        declaredByName: names.get(report.declaredById) ?? null,
        complianceOfficerName: report.complianceOfficerId ? names.get(report.complianceOfficerId) ?? null : null,
        transmittedByName: report.transmittedById ? names.get(report.transmittedById) ?? null : null,
      };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousReports:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_MANAGE_ROLES);
      const parsed = reportUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Déclaration introuvable' };
      const data: any = { ...parsed.data };
      if (existing.status === 'BROUILLON' && data.complianceOfficerId) data.status = 'VALIDEE_INTERNE';
      const report = await db.amlSuspiciousReport.update({ where: { id: existing.id }, data });
      return ser({ success: true, data: report });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousReports:transmit', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_MANAGE_ROLES);
      const parsed = reportTransmitSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Déclaration introuvable' };
      const report = await db.amlSuspiciousReport.update({
        where: { id: existing.id },
        data: {
          status: 'TRANSMISE_CENTIF',
          centifReference: parsed.data.centifReference,
          transmittedById: session.userId,
          transmittedAt: new Date(),
        },
      });
      logger.info(`Déclaration de soupçon transmise à la CENTIF : ${report.reference}`);
      return ser({ success: true, data: report });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:transmit', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousReports:classify', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_REPORT_MANAGE_ROLES);
      const parsed = reportClassifySchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlSuspiciousReport.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Déclaration introuvable' };
      const report = await db.amlSuspiciousReport.update({
        where: { id: existing.id },
        data: { status: 'CLASSEE_SANS_SUITE', classificationReason: parsed.data.classificationReason },
      });
      return ser({ success: true, data: report });
    } catch (error: any) {
      logger.error('aml:suspiciousReports:classify', error.message);
      return { success: false, error: error.message };
    }
  });
  // Aucun handler `aml:suspiciousReports:delete` n'est jamais enregistré —
  // obligation réglementaire de non-altération (cf. plan Module 19).

  /* ─── Formations du personnel ──────────────────────────────── */
  // Registre plat, pas de workflow de validation. Gestion réservée AML_ROLES,
  // comme le reste du module. Pas de confidentialité particulière (contrairement
  // aux déclarations de soupçon) : une formation n'est pas un secret.

  ipcMain.handle('aml:training:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...AML_RESTRICTED_ROLES]);
      const db = getDb();
      const where: any = { deletedAt: null };
      // AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION : uniquement les
      // formations dont ils sont participants — force le filtre, ignore
      // tout `filters.userId` transmis par le client.
      if (AML_RESTRICTED_ROLES.includes(session.role)) {
        where.userId = session.userId;
      } else if (filters.userId) where.userId = Number(filters.userId);
      if (filters.dateFrom || filters.dateTo) {
        where.trainingDate = {};
        if (filters.dateFrom) where.trainingDate.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.trainingDate.lte = new Date(`${filters.dateTo}T23:59:59`);
      }
      if (filters.search) {
        where.OR = [{ topic: { contains: filters.search } }, { provider: { contains: filters.search } }];
      }
      const [rows, total] = await db.$transaction([
        db.amlTraining.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: { trainingDate: 'desc' },
          include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
        }),
        db.amlTraining.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.flatMap((r) => [r.userId, r.recordedById]));
      const data = rows.map((r) => ({
        ...r,
        userName: names.get(r.userId) ?? null,
        recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null,
      }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:training:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:training:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, [...AML_ROLES, ...AML_RESTRICTED_ROLES]);
      const db = getDb();
      const training = await db.amlTraining.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { documents: { where: { deletedAt: null } } },
      });
      if (!training) return { success: false, error: 'Formation introuvable' };
      // AGENT / AGENT_TECHNIQUE / ASSISTANTE_DIRECTION : uniquement leurs
      // propres formations — masqué en « introuvable », pas en refus explicite.
      if (AML_RESTRICTED_ROLES.includes(session.role) && training.userId !== session.userId) {
        return { success: false, error: 'Formation introuvable' };
      }
      const names = await resolveUserNames(db, [training.userId, training.recordedById]);
      const data = {
        ...training,
        userName: names.get(training.userId) ?? null,
        recordedByName: training.recordedById ? names.get(training.recordedById) ?? null : null,
      };
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:training:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:training:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = trainingCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const { userIds, ...shared } = parsed.data;
      const created: any[] = [];
      // Créations séquentielles (pas Promise.all) : nextReference() lit puis
      // écrit la dernière référence — un lot en parallèle risquerait des
      // doublons de référence. Chaque await se termine avant le suivant.
      for (const userId of userIds) {
        const reference = await nextReference(db, 'amlTraining', 'FORM');
        const training = await db.amlTraining.create({
          data: { reference, userId, ...shared, recordedById: session.userId },
        });
        created.push(training);
      }
      logger.info(`Formation(s) LBC/FT enregistrée(s) : ${created.map((t) => t.reference).join(', ')}`);
      return ser({ success: true, data: created });
    } catch (error: any) {
      logger.error('aml:training:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:training:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const parsed = trainingUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlTraining.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Formation introuvable' };
      const training = await db.amlTraining.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: training });
    } catch (error: any) {
      logger.error('aml:training:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:training:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      await db.amlTraining.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:training:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Alertes CENTIF-CI / mises à jour des listes SFC ─────── */

  ipcMain.handle('aml:alerts:list', async (_event, { token, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertAlertsAccess(db, session);
      const where = { deletedAt: null };
      const [rows, total] = await db.$transaction([
        db.amlWatchlistAlert.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: [{ integratedAt: 'desc' }, { createdAt: 'desc' }],
          include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
        }),
        db.amlWatchlistAlert.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.flatMap((r) => [r.operatorId, r.createdById]));
      const current = await db.amlWatchlistAlert.findFirst({
        where: { deletedAt: null, integratedAt: { not: null } }, orderBy: { integratedAt: 'desc' }, select: { id: true },
      });
      const data = rows.map((r) => ({
        ...r,
        operatorDisplayName: r.operatorId ? names.get(r.operatorId) ?? null : r.operatorName ?? null,
        createdByName: r.createdById ? names.get(r.createdById) ?? null : null,
        isCurrent: current?.id === r.id,
      }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:alerts:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:alerts:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertAlertsAccess(db, session);
      const alert = await db.amlWatchlistAlert.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } } },
      });
      if (!alert) return { success: false, error: 'Alerte introuvable' };
      return ser({ success: true, data: alert });
    } catch (error: any) {
      logger.error('aml:alerts:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:alerts:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertAlertsAccess(db, session);
      const parsed = alertCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const reference = await nextAlertReference(db);
      const alert = await db.amlWatchlistAlert.create({ data: { reference, ...parsed.data, createdById: session.userId } });
      logger.info(`Alerte LBC/FT enregistrée : ${alert.reference}`);
      // Une alerte intégrée = une nouvelle version de la base de criblage →
      // re-cribler l'ensemble du portefeuille (le run se rattache
      // automatiquement à cette alerte via `baseAlertId`, cf. runScreening).
      if (alert.integratedAt) {
        runScreening({ trigger: 'REFERENTIEL_MAJ', operatorId: session.userId })
          .catch((e) => logger.error(`aml screening after alerts:create: ${e.message}`));
      }
      return ser({ success: true, data: alert });
    } catch (error: any) {
      logger.error('aml:alerts:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:alerts:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertAlertsAccess(db, session);
      const parsed = alertUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const existing = await db.amlWatchlistAlert.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Alerte introuvable' };
      const alert = await db.amlWatchlistAlert.update({ where: { id: existing.id }, data: parsed.data });
      // Re-cribler si l'alerte est (ou devient) intégrée ET que sa date
      // d'intégration a changé — c.-à-d. que la version courante de la base
      // de criblage a bougé. Une simple retouche de notes n'y suffit pas.
      const integratedChanged =
        !!alert.integratedAt &&
        (!existing.integratedAt || existing.integratedAt.getTime() !== alert.integratedAt.getTime());
      if (integratedChanged) {
        runScreening({ trigger: 'REFERENTIEL_MAJ', operatorId: session.userId })
          .catch((e) => logger.error(`aml screening after alerts:update: ${e.message}`));
      }
      return ser({ success: true, data: alert });
    } catch (error: any) {
      logger.error('aml:alerts:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:alerts:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertAlertsAccess(db, session);
      await db.amlWatchlistAlert.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:alerts:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Criblage de masse ────────────────────────────────────── */

  ipcMain.handle('aml:screening:run', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      await assertScreeningAccess(getDb(), session);
      const result = await runScreening({ trigger: 'MANUEL', operatorId: session.userId });
      return ser({ success: true, data: result });
    } catch (error: any) {
      logger.error('aml:screening:run', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:screening:runs:list', async (_event, { token, filters = {}, page = 1, limit = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertScreeningAccess(db, session);
      const where: any = {};
      if (filters.trigger) where.trigger = filters.trigger;
      const [rows, total] = await db.$transaction([
        db.amlScreeningRun.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: { startedAt: 'desc' },
          include: { baseAlert: { select: { reference: true, title: true } } },
        }),
        db.amlScreeningRun.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.operatorId));
      const data = rows.map((r) => ({
        ...r,
        operatorDisplayName: r.operatorId ? names.get(r.operatorId) ?? null : r.operatorName ?? null,
      }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:screening:runs:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:screening:runs:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertScreeningAccess(db, session);
      const run = await db.amlScreeningRun.findFirst({
        where: { id: Number(id) },
        include: { baseAlert: { select: { reference: true, title: true } }, hits: { include: { watchlist: true }, orderBy: { lastDetectedAt: 'desc' } } },
      });
      if (!run) return { success: false, error: 'Criblage introuvable' };
      const names = await resolveUserNames(db, [run.operatorId]);
      return ser({ success: true, data: { ...run, operatorDisplayName: run.operatorId ? names.get(run.operatorId) ?? null : run.operatorName ?? null } });
    } catch (error: any) {
      logger.error('aml:screening:runs:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:screening:summary', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertScreeningAccess(db, session);
      const [lastRun, currentAlert, byStatus, stale, clients, prospects, owners, referrers, watchlistCount] = await Promise.all([
        db.amlScreeningRun.findFirst({ orderBy: { startedAt: 'desc' } }),
        db.amlWatchlistAlert.findFirst({ where: { deletedAt: null, integratedAt: { not: null } }, orderBy: { integratedAt: 'desc' } }),
        db.amlScreeningHit.groupBy({ by: ['status'], where: { stillMatching: true }, _count: true }),
        db.amlScreeningHit.count({ where: { stillMatching: false } }),
        db.client.count({ where: { deletedAt: null } }),
        db.prospect.count({ where: { deletedAt: null } }),
        db.owner.count({ where: { deletedAt: null } }),
        db.businessReferrer.count({ where: { deletedAt: null } }),
        db.amlWatchlist.count({ where: { deletedAt: null, isActive: true } }),
      ]);
      return ser({
        success: true,
        data: {
          lastRun,
          currentBaseVersion: currentAlert
            ? `${currentAlert.reference} — ${currentAlert.title}`
            : null,
          currentBaseIntegratedAt: currentAlert?.integratedAt ?? null,
          hitsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
          hitsStale: stale,
          watchlistCount,
          scopeCounts: { CLIENT: clients, PROSPECT: prospects, OWNER: owners, REFERRER: referrers },
        },
      });
    } catch (error: any) {
      logger.error('aml:screening:summary', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:screening:hits:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertScreeningAccess(db, session);
      const where: any = {};
      if (filters.status) where.status = filters.status;
      if (filters.entityType) where.entityType = filters.entityType;
      if (filters.runId) where.runId = Number(filters.runId);
      if (filters.stillMatching === true || filters.stillMatching === false) where.stillMatching = filters.stillMatching;
      if (filters.search) {
        where.OR = [
          { entityLabel: { contains: filters.search } },
          { matchedOn: { contains: filters.search } },
        ];
      }
      const [rows, total] = await db.$transaction([
        db.amlScreeningHit.findMany({
          where, skip: (page - 1) * limit, take: limit,
          orderBy: [{ status: 'asc' }, { lastDetectedAt: 'desc' }],
          include: { watchlist: { select: { id: true, name: true, listType: true, personType: true } } },
        }),
        db.amlScreeningHit.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.reviewedById));
      const data = rows.map((r) => ({
        ...r,
        entityTypeLabel: SCREENING_ENTITY_LABEL[r.entityType] ?? r.entityType,
        reviewedByName: r.reviewedById ? names.get(r.reviewedById) ?? null : null,
      }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:screening:hits:list', error.message);
      return { success: false, error: error.message };
    }
  });

  // Qualification d'une correspondance. Sur CONFIRME d'un Client/Owner : crée
  // (si absent) un AmlProfile en vigilance renforcée, y attache une
  // AmlWatchlistMatch CONFIRME et recalcule le score (moteur existant).
  ipcMain.handle('aml:screening:hits:review', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertScreeningAccess(db, session);
      const parsed = hitReviewSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const hit = await db.amlScreeningHit.findFirst({ where: { id: Number(id) } });
      if (!hit) return { success: false, error: 'Correspondance introuvable' };

      let amlProfileId = hit.amlProfileId;
      if (parsed.data.status === 'CONFIRME' && (hit.entityType === 'CLIENT' || hit.entityType === 'OWNER')) {
        const subjectType = hit.entityType; // 'CLIENT' | 'OWNER'
        let profile = await db.amlProfile.findFirst({ where: { subjectType, subjectId: hit.entityId, deletedAt: null } });
        if (!profile) {
          const reference = await nextReference(db, 'amlProfile', 'LBC');
          profile = await db.amlProfile.create({
            data: {
              reference, subjectType, subjectId: hit.entityId,
              vigilanceType: 'RENFORCEE', status: 'EN_COURS', createdById: session.userId,
              notes: `Profil créé automatiquement suite à une correspondance de criblage confirmée (${hit.entityLabel} ↔ ${hit.matchedOn}).`,
            },
          });
          logger.info(`Profil LBC/FT créé (criblage confirmé) : ${profile.reference}`);
        }
        amlProfileId = profile.id;
        const already = await db.amlWatchlistMatch.findFirst({ where: { profileId: profile.id, watchlistId: hit.watchlistId } });
        if (!already) {
          await db.amlWatchlistMatch.create({
            data: { profileId: profile.id, watchlistId: hit.watchlistId, status: 'CONFIRME', reviewedById: session.userId, reviewedAt: new Date() },
          });
        } else if (already.status !== 'CONFIRME') {
          await db.amlWatchlistMatch.update({ where: { id: already.id }, data: { status: 'CONFIRME', reviewedById: session.userId, reviewedAt: new Date() } });
        }
        await recomputeProfileRisk(db, profile.id);
      }

      const updated = await db.amlScreeningHit.update({
        where: { id: hit.id },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          amlProfileId,
        },
      });
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('aml:screening:hits:review', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:getAmlScreeningSchedule', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const data = await getAmlScreeningSchedule(getDb());
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('settings:getAmlScreeningSchedule', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:updateAmlScreeningSchedule', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ADMIN_ONLY);
      const parsed = screeningScheduleSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      await setAmlScreeningSchedule(parsed.data as AmlScreeningSchedule, getDb());
      return { success: true, data: parsed.data };
    } catch (error: any) {
      logger.error('settings:updateAmlScreeningSchedule', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Procédures internes LBC/FT/FP ────────────────────────── */
  // Consultation ouverte à TOUT utilisateur authentifié — aucun checkRole/
  // checkExactRole ici, contrairement au reste du module (cf. commentaire
  // sur PROCEDURE_WRITE_ROLES). Seuls create/update/delete (et le
  // documents:import associé, cf. documents.ipc.ts) sont restreints.

  ipcMain.handle('aml:procedures:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.category) where.category = filters.category;
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ];
      }
      const [rows, total] = await db.$transaction([
        db.amlProcedure.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
          include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
        }),
        db.amlProcedure.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.createdById));
      const data = rows.map((r) => ({ ...r, createdByName: r.createdById ? names.get(r.createdById) ?? null : null }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:procedures:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:procedures:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      const procedure = await db.amlProcedure.findFirst({
        where: { id: Number(id), deletedAt: null },
        include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } } },
      });
      if (!procedure) return { success: false, error: 'Procédure introuvable' };
      return ser({ success: true, data: procedure });
    } catch (error: any) {
      logger.error('aml:procedures:getById', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:procedures:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, PROCEDURE_WRITE_ROLES);
      const parsed = procedureCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db, 'amlProcedure', 'PROC');
      const procedure = await db.amlProcedure.create({ data: { reference, ...parsed.data, createdById: session.userId } });
      logger.info(`Procédure LBC/FT enregistrée : ${procedure.reference}`);
      return ser({ success: true, data: procedure });
    } catch (error: any) {
      logger.error('aml:procedures:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:procedures:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, PROCEDURE_WRITE_ROLES);
      const parsed = procedureUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const existing = await db.amlProcedure.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Procédure introuvable' };
      const procedure = await db.amlProcedure.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: procedure });
    } catch (error: any) {
      logger.error('aml:procedures:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:procedures:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, PROCEDURE_WRITE_ROLES);
      const db = getDb();
      await db.amlProcedure.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:procedures:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Registres LBC/FT — accès individuel (Paramètres) ─────── */

  ipcMain.handle('settings:getRegistersAuthorizedUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, REGISTERS_ADMIN_ROLES);
      const db = getDb();
      const userIds = await registersAuthorizedUserIds(db);
      return { success: true, data: { userIds } };
    } catch (error: any) {
      logger.error('settings:getRegistersAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:updateRegistersAuthorizedUsers', async (_event, { token, userIds }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, REGISTERS_ADMIN_ROLES);
      const ids = Array.isArray(userIds)
        ? Array.from(new Set(userIds.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)))
        : [];
      const db = getDb();
      const validUsers = ids.length
        ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
        : [];
      const validIds = validUsers.map((u) => u.id);
      await setSetting(SettingsKeys.registersAuthorizedUserIds, JSON.stringify(validIds));
      logger.info(`Utilisateurs désignés (accès Registres LBC/FT) mis à jour (${validIds.length} utilisateur(s))`);
      return { success: true, data: { userIds: validIds } };
    } catch (error: any) {
      logger.error('settings:updateRegistersAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Accessible à tout utilisateur authentifié — pilote l'affichage du sous-menu/la garde de route. */
  ipcMain.handle('settings:myRegistersAccess', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      let hasAccess = AML_ROLES.includes(session.role);
      if (!hasAccess) {
        const ids = await registersAuthorizedUserIds(db);
        hasAccess = ids.includes(session.userId);
      }
      return { success: true, data: { hasAccess } };
    } catch (error: any) {
      logger.error('settings:myRegistersAccess', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Criblage — accès individuel (Paramètres) ──────────────── */

  ipcMain.handle('settings:getScreeningAuthorizedUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, SCREENING_ADMIN_ROLES);
      const db = getDb();
      const userIds = await screeningAuthorizedUserIds(db);
      return { success: true, data: { userIds } };
    } catch (error: any) {
      logger.error('settings:getScreeningAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:updateScreeningAuthorizedUsers', async (_event, { token, userIds }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, SCREENING_ADMIN_ROLES);
      const ids = Array.isArray(userIds)
        ? Array.from(new Set(userIds.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)))
        : [];
      const db = getDb();
      const validUsers = ids.length
        ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
        : [];
      const validIds = validUsers.map((u) => u.id);
      await setSetting(SettingsKeys.screeningAuthorizedUserIds, JSON.stringify(validIds));
      logger.info(`Utilisateurs désignés (accès Criblage) mis à jour (${validIds.length} utilisateur(s))`);
      return { success: true, data: { userIds: validIds } };
    } catch (error: any) {
      logger.error('settings:updateScreeningAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Accessible à tout utilisateur authentifié — pilote l'affichage du sous-menu/la garde de route. */
  ipcMain.handle('settings:myScreeningAccess', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      let hasAccess = SCREENING_ROLES.includes(session.role);
      if (!hasAccess) {
        const ids = await screeningAuthorizedUserIds(db);
        hasAccess = ids.includes(session.userId);
      }
      return { success: true, data: { hasAccess } };
    } catch (error: any) {
      logger.error('settings:myScreeningAccess', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Alertes — accès individuel (Paramètres) ───────────────── */

  ipcMain.handle('settings:getAlertsAuthorizedUsers', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, ALERTS_ADMIN_ROLES);
      const db = getDb();
      const userIds = await alertsAuthorizedUserIds(db);
      return { success: true, data: { userIds } };
    } catch (error: any) {
      logger.error('settings:getAlertsAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:updateAlertsAuthorizedUsers', async (_event, { token, userIds }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, ALERTS_ADMIN_ROLES);
      const ids = Array.isArray(userIds)
        ? Array.from(new Set(userIds.map((v: any) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)))
        : [];
      const db = getDb();
      const validUsers = ids.length
        ? await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
        : [];
      const validIds = validUsers.map((u) => u.id);
      await setSetting(SettingsKeys.alertsAuthorizedUserIds, JSON.stringify(validIds));
      logger.info(`Utilisateurs désignés (accès Alertes) mis à jour (${validIds.length} utilisateur(s))`);
      return { success: true, data: { userIds: validIds } };
    } catch (error: any) {
      logger.error('settings:updateAlertsAuthorizedUsers', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Accessible à tout utilisateur authentifié — pilote l'affichage du sous-menu/la garde de route. */
  ipcMain.handle('settings:myAlertsAccess', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      let hasAccess = ALERTS_ROLES.includes(session.role);
      if (!hasAccess) {
        const ids = await alertsAuthorizedUserIds(db);
        hasAccess = ids.includes(session.userId);
      }
      return { success: true, data: { hasAccess } };
    } catch (error: any) {
      logger.error('settings:myAlertsAccess', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── 1. Registre de suivi des notifications ───────────────── */

  ipcMain.handle('aml:notifications:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const where: any = { deletedAt: null };
      if (filters.search) where.updateDescription = { contains: filters.search };
      const [rows, total] = await db.$transaction([
        db.amlNotificationRecord.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { updateDate: 'desc' } }),
        db.amlNotificationRecord.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.recordedById));
      const data = rows.map((r) => ({ ...r, recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:notifications:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:notifications:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = notificationCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const reference = await nextReference(db, 'amlNotificationRecord', 'NOTIF');
      const record = await db.amlNotificationRecord.create({ data: { reference, ...parsed.data, recordedById: session.userId } });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:notifications:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:notifications:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = notificationUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const existing = await db.amlNotificationRecord.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Enregistrement introuvable' };
      const record = await db.amlNotificationRecord.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:notifications:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:notifications:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      await db.amlNotificationRecord.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:notifications:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── 2. Registre de suivi des échanges avec la CENTIF-CI ──── */

  ipcMain.handle('aml:centifExchanges:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const where: any = { deletedAt: null };
      if (filters.direction) where.direction = filters.direction;
      if (filters.status) where.status = filters.status;
      if (filters.search) where.nature = { contains: filters.search };
      const [rows, total] = await db.$transaction([
        db.amlCentifExchange.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { exchangeDate: 'desc' } }),
        db.amlCentifExchange.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.recordedById));
      const data = rows.map((r) => ({ ...r, recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:centifExchanges:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:centifExchanges:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = exchangeCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const reference = await nextReference(db, 'amlCentifExchange', 'ECH');
      const record = await db.amlCentifExchange.create({ data: { reference, ...parsed.data, recordedById: session.userId } });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:centifExchanges:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:centifExchanges:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = exchangeUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const existing = await db.amlCentifExchange.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Échange introuvable' };
      const record = await db.amlCentifExchange.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:centifExchanges:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:centifExchanges:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      await db.amlCentifExchange.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:centifExchanges:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Sélecteur « Référence DOS » du registre des opérations suspectes. */
  ipcMain.handle('aml:centifExchanges:listSelectable', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const data = await db.amlCentifExchange.findMany({
        where: { deletedAt: null },
        orderBy: { exchangeDate: 'desc' },
        select: { id: true, reference: true, exchangeDate: true, nature: true },
        take: 500,
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('aml:centifExchanges:listSelectable', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── 3. Grille de recensement DSTE ─────────────────────────── */

  ipcMain.handle('aml:dste:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const where: any = { deletedAt: null };
      if (filters.search) where.subjectLabel = { contains: filters.search };
      const [rows, total] = await db.$transaction([
        db.amlDsteRecord.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { transactionDate: 'desc' } }),
        db.amlDsteRecord.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.recordedById));
      const thresholds = await getAmlRiskThresholds(db);
      const data = rows.map((r) => ({ ...r, recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null }));
      return ser({ success: true, data, total, dsteThreshold: thresholds.dsteThreshold });
    } catch (error: any) {
      logger.error('aml:dste:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:dste:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = dsteCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const reference = await nextReference(db, 'amlDsteRecord', 'DSTE');
      const record = await db.amlDsteRecord.create({ data: { reference, ...parsed.data, recordedById: session.userId } });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:dste:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:dste:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = dsteUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const existing = await db.amlDsteRecord.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Enregistrement introuvable' };
      const record = await db.amlDsteRecord.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:dste:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:dste:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      await db.amlDsteRecord.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:dste:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── 4. Registre des opérations suspectes ──────────────────── */

  ipcMain.handle('aml:suspiciousOperations:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const where: any = { deletedAt: null };
      if (filters.decision) where.decision = filters.decision;
      if (filters.search) where.subjectLabel = { contains: filters.search };
      const [rows, total] = await db.$transaction([
        db.amlSuspiciousOperationRecord.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: { detectionDate: 'desc' },
          include: { dosExchange: { select: { id: true, reference: true, nature: true } } },
        }),
        db.amlSuspiciousOperationRecord.count({ where }),
      ]);
      const names = await resolveUserNames(db, rows.map((r) => r.recordedById));
      const data = rows.map((r) => ({ ...r, recordedByName: r.recordedById ? names.get(r.recordedById) ?? null : null }));
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('aml:suspiciousOperations:list', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousOperations:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = suspiciousOperationCreateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const reference = await nextReference(db, 'amlSuspiciousOperationRecord', 'OPS');
      const record = await db.amlSuspiciousOperationRecord.create({ data: { reference, ...parsed.data, recordedById: session.userId } });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:suspiciousOperations:create', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousOperations:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      const parsed = suspiciousOperationUpdateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const existing = await db.amlSuspiciousOperationRecord.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Enregistrement introuvable' };
      const record = await db.amlSuspiciousOperationRecord.update({ where: { id: existing.id }, data: parsed.data });
      return ser({ success: true, data: record });
    } catch (error: any) {
      logger.error('aml:suspiciousOperations:update', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('aml:suspiciousOperations:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      const db = getDb();
      await assertRegistersAccess(db, session);
      await db.amlSuspiciousOperationRecord.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('aml:suspiciousOperations:delete', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Tableau de bord ──────────────────────────────────────── */

  ipcMain.handle('aml:dashboard:overview', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkExactRole(session, AML_ROLES);
      const db = getDb();
      const [
        byRiskLevel, pepCount, matchesToVerify, reviewsOpen, reportsByStatus, screeningHitsToVerify, lastScreening,
        alertsCount, screeningRunsCount, screeningHitsCount,
      ] = await Promise.all([
        db.amlProfile.groupBy({ by: ['riskLevel'], where: { deletedAt: null }, _count: true }),
        db.amlProfile.count({ where: { deletedAt: null, isPep: true } }),
        db.amlWatchlistMatch.count({ where: { status: 'A_VERIFIER' } }),
        db.amlTransactionReview.count({ where: { deletedAt: null, status: { in: ['OUVERTE', 'EN_COURS'] } } }),
        db.amlSuspiciousReport.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
        db.amlScreeningHit.count({ where: { status: 'A_VERIFIER', stillMatching: true } }),
        db.amlScreeningRun.findFirst({ orderBy: { startedAt: 'desc' }, select: { startedAt: true, reference: true, trigger: true } }),
        db.amlWatchlistAlert.count({ where: { deletedAt: null } }),
        db.amlScreeningRun.count(),
        db.amlScreeningHit.count({ where: { stillMatching: true } }),
      ]);
      return ser({
        success: true,
        data: {
          byRiskLevel: Object.fromEntries(byRiskLevel.map((r) => [r.riskLevel, r._count])),
          pepCount,
          matchesToVerify,
          reviewsOpen,
          reportsByStatus: Object.fromEntries(reportsByStatus.map((r) => [r.status, r._count])),
          screeningHitsToVerify,
          lastScreeningAt: lastScreening?.startedAt ?? null,
          alertsCount,
          screeningRunsCount,
          screeningHitsCount,
        },
      });
    } catch (error: any) {
      logger.error('aml:dashboard:overview', error.message);
      return { success: false, error: error.message };
    }
  });
}
