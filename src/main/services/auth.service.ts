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
 */
export async function login(email: string, password: string) {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email, deletedAt: null },
    select: {
      id: true, uuid: true, matricule: true, firstName: true, lastName: true,
      email: true, password: true, role: true, isActive: true, avatar: true,
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
 */
export function checkRole(session: Session, allowedRoles: string[]): void {
  if (!allowedRoles.includes(session.role)) {
    throw new Error('Permission insuffisante');
  }
}
