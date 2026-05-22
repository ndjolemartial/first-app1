import nodemailer from 'nodemailer';
import { getSettings, getSecret, SettingsKeys } from './settings.service';
import logger from '../utils/logger';

/**
 * Service d'envoi d'emails — paramètres SMTP lus depuis les AppSetting.
 *
 * La configuration peut changer à chaud : on relit les settings à chaque envoi.
 * Pour les envois en volume, un appelant peut récupérer le transporteur via
 * `createTransporter()` et le réutiliser.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

/** Lit la configuration SMTP courante (mot de passe en clair en mémoire). */
export async function loadSmtpConfig(): Promise<SmtpConfig> {
  const map = await getSettings([
    SettingsKeys.emailHost,
    SettingsKeys.emailPort,
    SettingsKeys.emailSecure,
    SettingsKeys.emailUser,
    SettingsKeys.emailFromAddress,
    SettingsKeys.emailFromName,
  ]);
  const password = await getSecret(SettingsKeys.emailPassword);
  return {
    host:        map[SettingsKeys.emailHost] ?? '',
    port:        Number(map[SettingsKeys.emailPort] ?? 587),
    secure:      (map[SettingsKeys.emailSecure] ?? 'false') === 'true',
    user:        map[SettingsKeys.emailUser] ?? '',
    password,
    fromAddress: map[SettingsKeys.emailFromAddress] ?? '',
    fromName:    map[SettingsKeys.emailFromName] ?? '',
  };
}

/** Construit le transporteur Nodemailer à partir de la config courante. */
export async function createTransporter(): Promise<nodemailer.Transporter> {
  const cfg = await loadSmtpConfig();
  if (!cfg.host) throw new Error('SMTP non configuré (host manquant)');
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  });
}

/** Envoie un email de test à l'adresse fournie. */
export async function sendTestEmail(toAddress: string): Promise<{ ok: true; messageId?: string }> {
  const cfg = await loadSmtpConfig();
  if (!cfg.host) throw new Error('SMTP non configuré (host manquant)');
  if (!toAddress) throw new Error('Adresse destinataire manquante');

  const transporter = await createTransporter();
  const fromHeader = cfg.fromName
    ? `"${cfg.fromName}" <${cfg.fromAddress || cfg.user}>`
    : (cfg.fromAddress || cfg.user);

  const info = await transporter.sendMail({
    from:    fromHeader,
    to:      toAddress,
    subject: 'Afrikimmo — test de configuration SMTP',
    text:    "Ceci est un message de test envoyé depuis le module Paramètres de l'application Afrikimmo. Si vous le recevez, la configuration SMTP est opérationnelle.",
    html:    "<p>Ceci est un message de test envoyé depuis le module Paramètres de l'application <strong>Afrikimmo</strong>.</p><p>Si vous le recevez, la configuration SMTP est opérationnelle.</p>",
  });
  logger.info(`SMTP test envoyé à ${toAddress} (messageId=${info.messageId})`);
  return { ok: true, messageId: info.messageId };
}
