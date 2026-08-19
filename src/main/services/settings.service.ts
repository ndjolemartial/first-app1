import { getDb } from './db.service';
import logger from '../utils/logger';
import { encryptSecret, decryptSecret, isLegacySecret } from '../utils/secretCrypto';

/**
 * Service de paramétrage applicatif.
 *
 * Toutes les valeurs sont persistées en base via le modèle `AppSetting`
 * (clé → valeur). Les secrets (mots de passe SMTP/SMS, jetons API) sont
 * chiffrés avant d'être insérés et déchiffrés uniquement côté main process.
 * Les champs marqués comme secrets ne sont jamais renvoyés en clair au renderer.
 *
 * IMPORTANT — chiffrement PORTABLE.
 * L'application partage une base de données unique entre plusieurs postes.
 * `safeStorage` (Electron) repose sur une clé liée au compte Windows + à la
 * machine (DPAPI) : un secret chiffré sur le poste de l'administrateur est
 * INDÉCHIFFRABLE sur les autres postes → la configuration SMTP/SMS apparaissait
 * vide pour tous les utilisateurs sauf celui qui l'avait saisie, faisant échouer
 * leurs envois. Les secrets sont désormais chiffrés avec une clé symétrique
 * dérivée d'un secret applicatif commun (`APP_SECRET_KEY`, repli sur une
 * constante intégrée), donc déchiffrables sur n'importe quel poste relié à la
 * même base. Les anciennes valeurs `enc:` (safeStorage) restent lisibles sur le
 * poste d'origine et sont automatiquement re-chiffrées au format portable.
 *
 * La primitive de chiffrement elle-même (`encryptSecret`/`decryptSecret`) vit
 * dans `src/main/utils/secretCrypto.ts`, partagée avec tout secret qui n'est
 * pas un simple couple clé/valeur `AppSetting` (ex. `MailAccount.imapPasswordEnc`,
 * un par utilisateur).
 */

/** Marqueur renvoyé au renderer pour indiquer qu'un secret est défini sans le révéler. */
export const SECRET_MASK = '••••••••';

// ── API publique ─────────────────────────────────────────────────────────────

/** Lit une valeur brute de l'AppSetting (chaîne). */
export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Lit un secret (déchiffré). */
export async function getSecret(key: string): Promise<string> {
  const raw = await getSetting(key);
  if (!raw) return '';
  const value = decryptSecret(raw);
  // Auto-migration : un ancien secret safeStorage (enc:) déchiffré avec succès
  // — donc sur le poste qui l'avait saisi — est re-chiffré au format portable
  // pour devenir lisible depuis tous les postes reliés à la même base.
  if (value && isLegacySecret(raw)) {
    try {
      await setSetting(key, encryptSecret(value));
      logger.info(`Secret « ${key} » migré vers le chiffrement portable`);
    } catch (err: any) {
      logger.error(`Échec migration secret « ${key} »`, err.message);
    }
  }
  return value;
}

/** Indique si un secret est défini (sans le révéler). */
export async function hasSecret(key: string): Promise<boolean> {
  const raw = await getSetting(key);
  return !!raw && raw.length > 0;
}

/** Lit plusieurs valeurs en une requête, retourne un dictionnaire { key → value | null }. */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const db = getDb();
  const rows = await db.appSetting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string | null> = {};
  for (const k of keys) map[k] = null;
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/** Écrit ou crée une valeur AppSetting. */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Écrit un secret (chiffré). Une chaîne vide supprime la valeur. */
export async function setSecret(key: string, plain: string): Promise<void> {
  if (!plain) {
    const db = getDb();
    await db.appSetting.deleteMany({ where: { key } });
    return;
  }
  await setSetting(key, encryptSecret(plain));
}

/** Écrit plusieurs paires en une transaction. */
export async function setSettings(entries: Array<{ key: string; value: string }>): Promise<void> {
  if (entries.length === 0) return;
  const db = getDb();
  await db.$transaction(
    entries.map((e) =>
      db.appSetting.upsert({
        where: { key: e.key },
        create: { key: e.key, value: e.value },
        update: { value: e.value },
      }),
    ),
  );
}

// ── Clés et helpers de groupage ──────────────────────────────────────────────

export const SettingsKeys = {
  // Entreprise
  companyName:            'company.name',
  companyDenomination:    'company.denomination',
  companyLegalRepEmployeeId: 'company.legalRepEmployeeId', // employé représentant légal
  hrReglementInterieurDocId: 'hr.reglementInterieur.documentId', // document GED ciblé (règlement intérieur)
  companySlogan:          'company.slogan',
  companyLogo:            'company.logoPath',         // chemin relatif dans STORAGE_PATH
  companyRegistre:        'company.registreCommerce',
  companyContribuable:    'company.compteContribuable',
  companyPhoneFixed:      'company.phone.fixed',
  companyPhoneMobile1:    'company.phone.mobile1',
  companyPhoneMobile2:    'company.phone.mobile2',
  companyWebsite:         'company.website',
  companyAddress:         'company.address',
  companyEmail:           'company.email',

  // Stockage
  storagePath:            'storage.path',
  storageMaxFileSizeMb:   'storage.maxFileSizeMb',

  // Email (SMTP)
  emailHost:              'email.smtp.host',
  emailPort:              'email.smtp.port',
  emailSecure:            'email.smtp.secure',         // 'true' | 'false'
  emailUser:              'email.smtp.user',
  emailPassword:          'email.smtp.password',       // secret
  emailFromAddress:       'email.from.address',
  emailFromName:          'email.from.name',
  emailSignature:         'email.signature',           // HTML — bloc de signature ajouté en pied via {{signature}}

  // SMS
  smsProvider:            'sms.provider',              // twilio | ovh | brevo
  smsAccountSid:          'sms.twilio.accountSid',
  smsAuthToken:           'sms.twilio.authToken',      // secret
  smsFrom:                'sms.from',
  smsApiLogin:            'sms.api.login',             // OVH/Brevo
  smsApiPassword:         'sms.api.password',          // secret OVH/Brevo

  // WhatsApp — deux providers supportés :
  //   - twilio  : réutilise sms.twilio.accountSid/authToken, sender préfixé `whatsapp:`
  //   - infobip : credentials dédiés (base URL d'API + API key + sender E.164)
  whatsappEnabled:           'whatsapp.enabled',                // 'true' | 'false'
  whatsappProvider:          'whatsapp.provider',               // 'twilio' | 'infobip'
  whatsappFrom:              'whatsapp.from',                   // sender Twilio (`whatsapp:+...`) ou numéro approuvé
  whatsappInfobipBaseUrl:    'whatsapp.infobip.baseUrl',        // ex. 'xxxxx.api.infobip.com' (sans https://)
  whatsappInfobipApiKey:     'whatsapp.infobip.apiKey',         // secret
  whatsappInfobipFrom:       'whatsapp.infobip.from',           // sender Infobip (numéro E.164 sans `whatsapp:`)

  // Slideshow dashboard (JSON array)
  dashboardSlideshow:     'dashboard.slideshow',
  // Rôles autorisés à voir le slideshow du tableau de bord (JSON array de UserRole)
  dashboardSlideshowRoles: 'dashboard.slideshow.allowedRoles',

  // Politique de relance (communication automatique)
  remindersEnabled:        'reminders.enabled',           // 'true' | 'false'
  remindersQuietStart:     'reminders.quietHours.start',  // 'HH:MM' (par défaut 08:00)
  remindersQuietEnd:       'reminders.quietHours.end',    // 'HH:MM' (par défaut 20:00)
  remindersQuietDays:      'reminders.quietDays',         // JSON array de 0..6 (0=dimanche)

  // Partage de localisation GPS — modèles de message pour Lotissement / Terrain / Bien.
  // Un seul modèle par canal couvre les 3 types d'entités : les variables qui ne
  // s'appliquent pas à l'entité courante sont substituées par chaîne vide.
  shareLocationEmailSubject:  'share.location.email.subject',
  shareLocationEmailBody:     'share.location.email.body',
  shareLocationWhatsappBody:  'share.location.whatsapp.body',

  // Conditions particulières (liste de textes multi-lignes, JSON array) — proposées
  // dans le formulaire de convention pour les types hérités.
  conventionConditionsParticulieres: 'conventions.conditionsParticulieres',

  // Trésorerie — compte par défaut à débiter lors du paiement des salaires (RH/Paie).
  // Identifiant de BankAccount (commun et actif) ; vide = aucun compte par défaut.
  payrollDefaultAccountId: 'treasury.defaultSalaryAccount',

  // Pointage par QR Code — app web autonome (dossier web/ sur le serveur local).
  attendanceQrEnabled:     'attendance.qr.enabled',        // 'true' | 'false'
  attendanceQrBaseUrl:     'attendance.qr.baseUrl',        // URL de l'app web encodée dans le QR (ex. http://192.168.1.10/pointage/)
  attendanceQrAllowedRoles:'attendance.qr.allowedRoles',   // rôles voyant le QR au tableau de bord (JSON array)
  attendanceQrModel:       'attendance.qr.model',          // modèle visuel du QR ('1' | '2' | '3')
  attendanceExpectedArrival:   'attendance.expectedArrival',   // 'HH:MM' seuil de retard (défaut 08:00)
  attendanceExpectedDeparture: 'attendance.expectedDeparture', // 'HH:MM' seuil de départ anticipé (défaut 17:00)

  // Retards & Départs précipités — par défaut, les employés liés à un compte
  // SUPER_ADMIN/ADMIN/MANAGER ne sont ni calculés ni affichés. Ce commutateur
  // permet de les réintégrer.
  latenessIncludeManagementRoles: 'hr.lateness.includeManagementRoles', // 'true' | 'false' (défaut false = exclus)
  // Limite (en minutes) en deçà de laquelle une journée de retard/départ
  // précipité peut être marquée « Tolérée » par SUPER_ADMIN/ADMIN/MANAGER.
  latenessToleranceMinutes: 'hr.lateness.toleranceMinutes', // nombre (défaut 15)

  // QR Visiteurs — app web autonome (dossier web-visiteurs/ sur le serveur local).
  visitorQrEnabled:     'visitors.qr.enabled',        // 'true' | 'false'
  visitorQrBaseUrl:     'visitors.qr.baseUrl',        // URL de l'app web visiteurs (ex. http://192.168.1.10/visiteurs/)
  visitorQrAllowedRoles:'visitors.qr.allowedRoles',   // rôles voyant le QR au tableau de bord (JSON array)
  visitorQrModel:       'visitors.qr.model',          // modèle visuel du QR ('1' | '2' | '3')

  // Modèles de messages (Communication) — utilisateurs désignés (en plus de
  // SUPER_ADMIN/ADMIN, toujours en accès complet) autorisés à consulter et
  // gérer les modèles de type « manuel » (jamais les modèles « auto »).
  commTemplateManualEditorIds: 'communication.templates.manualEditorUserIds', // JSON array d'ids User

  // Fiche KYC (Clients, Propriétaires, Apporteurs d'affaire) — utilisateurs
  // désignés autorisés, en plus des rôles à plein accès par défaut, à voir et
  // utiliser les boutons « Fiche KYC » / « Fiche KYC non renseignée » alors
  // que leur rôle (AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY) en
  // est par défaut exclu.
  kycAuthorizedUserIds: 'kyc.authorizedUserIds', // JSON array d'ids User
} as const;

/** Liste des clés correspondant à des secrets chiffrés. */
export const SECRET_KEYS = new Set<string>([
  SettingsKeys.emailPassword,
  SettingsKeys.smsAuthToken,
  SettingsKeys.smsApiPassword,
  SettingsKeys.whatsappInfobipApiKey,
]);
