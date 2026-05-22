import { IpcMainInvokeEvent } from 'electron';
import { getDb } from './db.service';
import { comparePassword, generateToken } from '../utils/crypto';
import logger from '../utils/logger';

interface Session {
  userId: number;
  role: string;
  token: string;
  createdAt: Date;
}

const sessions = new Map<string, Session>();

/**
 * Authentifie un utilisateur et crée une session.
 *
 * @param identifier Adresse email OU login de l'utilisateur.
 */
export async function login(identifier: string, password: string) {
  const db = getDb();
  const user = await db.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: identifier }, { login: identifier }],
    },
    select: {
      id: true, uuid: true, matricule: true, firstName: true, lastName: true,
      email: true, password: true, role: true, isActive: true, avatar: true,
      theme: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Identifiants invalides ou compte inactif');
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new Error('Identifiants invalides');
  }

  const token = generateToken();
  sessions.set(token, { userId: user.id, role: user.role, token, createdAt: new Date() });

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  logger.info(`User ${user.email} logged in`);

  const { password: _, ...safeUser } = user;
  return { user: safeUser, token };
}

/**
 * Invalide la session d'un utilisateur.
 */
export function logout(token: string): void {
  sessions.delete(token);
}

/**
 * Récupère la session associée à un token.
 */
export function getSession(token: string): Session | undefined {
  return sessions.get(token);
}

/**
 * Vérifie qu'un appel IPC provient d'une session valide et retourne la session.
 * Le token est transmis via les headers de la WebContents frame.
 */
export function requireSession(event: IpcMainInvokeEvent): Session {
  const token = (event.sender as any)._authToken as string | undefined;
  if (!token) throw new Error('Non authentifié');
  const session = sessions.get(token);
  if (!session) throw new Error('Session expirée');
  return session;
}

/**
 * Vérifie les permissions d'un rôle pour une action.
 *
 * Équivalence de rôles : les comptables (ACCOUNTANT) ET les assistantes de direction
 * (ASSISTANTE_DIRECTION) disposent des mêmes droits d'accès que les managers
 * (MANAGER). Toute action autorisée à un MANAGER l'est donc automatiquement à ces
 * deux rôles — sans qu'ils obtiennent pour autant les droits réservés aux rôles
 * supérieurs (ADMIN, SUPER_ADMIN).
 */
export function checkRole(session: Session, allowedRoles: string[]): void {
  if (allowedRoles.includes(session.role)) return;
  // ACCOUNTANT et ASSISTANTE_DIRECTION héritent des permissions d'un manager.
  if (
    (session.role === 'ACCOUNTANT' || session.role === 'ASSISTANTE_DIRECTION') &&
    allowedRoles.includes('MANAGER')
  ) return;
  throw new Error('Permission insuffisante');
}
