import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const p = new PrismaClient();
const now = new Date();

const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (v) => { const s = (v ?? '').toString().trim(); return s === '' ? null : s; };

// ── Mapping source → ProspectSource ─────────────────────────────────────
function mapSource(raw) {
  const s = norm(raw).replace(/\./g, '');
  if (s === '') return 'PROSPECTION';
  if (s.includes('facebook')) return 'RESEAUX_SOCIAUX';
  if (s.includes('whatsap') || s.includes('whatasp')) return 'RESEAUX_SOCIAUX';
  if (s.includes('recommandation')) return 'RECOMMENDATION';
  if (s.includes('contact personnel') || s.includes('conatct personnel')) return 'CONTACT_PERSONNEL';
  if (s.includes('telephon')) return 'TELEPHONE';
  if (s.includes('connaissance') || s === 'ami' || s === 'famille') return 'RECOMMENDATION';
  if (s.includes('formulaire')) return 'SITE_WEB_AFRIKIMMO';
  if (s.includes('cliente')) return 'AUTRE';
  if (s.includes('prospection') || s.includes('clientele')) return 'PROSPECTION';
  return 'AUTRE';
}

// ── Statut → ProspectStatus ─────────────────────────────────────────────
const mapStatut = (n) => ({ 0: 'NOUVEAU', 1: 'CONTACTE', 2: 'CONVERTI' }[n] ?? 'NOUVEAU');

// ── Découpage nom : retrait civilité, 1er mot = nom, reste = prénoms ─────
const CIVILITES = new Set(['mr', 'mme', 'mlle', 'm', 'dr', 'monsieur', 'madame', 'mademoiselle']);
function splitName(raw) {
  let tokens = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && CIVILITES.has(norm(tokens[0]).replace(/\./g, ''))) tokens.shift();
  if (tokens.length === 0) return { lastName: clean(raw) ?? '—', firstName: '' };
  return { lastName: tokens[0], firstName: tokens.slice(1).join(' ') };
}

// ── Source ──────────────────────────────────────────────────────────────
const rows = await p.$queryRawUnsafe('SELECT * FROM `liste_web_from` ORDER BY Num');
console.log('Lignes source :', rows.length);
const existingClients = new Set((await p.client.findMany({ select: { id: true } })).map((c) => c.id));

// ── Vidage préalable (ré-exécutable) ────────────────────────────────────
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
await p.$executeRawUnsafe('TRUNCATE TABLE `Prospect`');
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

// ── Construction ────────────────────────────────────────────────────────
const seqByYear = {};
const seenClientIds = new Set();
let dupClient = 0, orphanClient = 0, emptyFirst = 0;
const data = rows.map((r) => {
  const created = new Date(r.createdAt);
  const year = created.getFullYear();
  seqByYear[year] = (seqByYear[year] ?? 0) + 1;
  const reference = `PSP-${year}-${String(seqByYear[year]).padStart(4, '0')}`;
  const { lastName, firstName } = splitName(r.lastName_and_firstName);
  if (!firstName) emptyFirst++;

  // clientId : doit exister et rester unique (contrainte @unique sur Prospect)
  let clientId = null;
  if (r.clientId > 0) {
    if (!existingClients.has(r.clientId)) orphanClient++;
    else if (seenClientIds.has(r.clientId)) dupClient++;
    else { clientId = r.clientId; seenClientIds.add(r.clientId); }
  }

  return {
    id: Number(r.Num),
    uuid: randomUUID(),
    reference,
    firstName,
    lastName,
    email: clean(r.email),
    phone: clean(r.phone),
    source: mapSource(r.source),
    status: mapStatut(r.Statut),
    notes: clean(r.notes),
    assignedToId: r.assignedToId > 0 ? Number(r.assignedToId) : null,
    convertedAt: r.convertedAt ? new Date(r.convertedAt) : null,
    clientId,
    createdAt: created,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : created,
  };
});

console.log('Références par année :', seqByYear);
console.log(`Prénoms vides : ${emptyFirst} | clients orphelins : ${orphanClient} | clientId dupliqués (→ null) : ${dupClient}`);

const res = await p.prospect.createMany({ data });
console.log('Insérés :', res.count);

const maxId = data.reduce((m, d) => Math.max(m, d.id), 0);
await p.$executeRawUnsafe(`ALTER TABLE \`Prospect\` AUTO_INCREMENT = ${maxId + 1}`);

console.log('Total prospect :', await p.prospect.count(), '— AUTO_INCREMENT ->', maxId + 1);
await p.$disconnect();
