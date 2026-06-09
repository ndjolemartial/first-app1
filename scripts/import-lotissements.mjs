import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const p = new PrismaClient();
const now = new Date();

const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (v) => { const s = (v ?? '').toString().trim(); return s === '' ? null : s; };

// ── Référentiel des titres : rapprochement par label + complétion ───────
const titleTypes = await p.lotissementTitleType.findMany({ select: { id: true, label: true } });
const titleByLabel = new Map(titleTypes.map((t) => [norm(t.label), t.id]));
// Alias sémantique : « Arrêté de Concession Définitive » == ACD
const ACD_ID = titleByLabel.get('acd');
if (ACD_ID) titleByLabel.set('arrete de concession definitive', ACD_ID);

async function resolveTitleType(raw) {
  const key = norm(raw);
  if (!key) return null;
  if (titleByLabel.has(key)) return titleByLabel.get(key);
  // Création d'un type manquant (ex. « Certificat Foncier »)
  const code = key.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const created = await p.lotissementTitleType.create({
    data: { code, label: (raw ?? '').toString().trim(), isDefault: false, isActive: true },
  });
  titleByLabel.set(key, created.id);
  console.log(`  + type de titre créé : ${created.label} (id ${created.id})`);
  return created.id;
}

// ── Statut ──────────────────────────────────────────────────────────────
const mapStatut = (n) => (n === 1 ? 'FERME' : 'OUVERT'); // 0/null → OUVERT, 1 → FERME

// ── Source ──────────────────────────────────────────────────────────────
const rows = await p.$queryRawUnsafe('SELECT * FROM `site_from` ORDER BY id');
console.log('Lignes source :', rows.length);

// Vidage préalable (ré-exécutable)
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
await p.$executeRawUnsafe('TRUNCATE TABLE `Lotissement`');
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

// Pré-résout tous les types de titre distincts
const titleMap = new Map();
for (const v of [...new Set(rows.map((r) => r.titleTypeid))]) titleMap.set(v, await resolveTitleType(v));

const seqByYear = {};
const data = rows.map((r) => {
  const created = new Date(r.createdAt);
  const year = created.getFullYear();
  seqByYear[year] = (seqByYear[year] ?? 0) + 1;
  const reference = `LOT-${year}-${String(seqByYear[year]).padStart(4, '0')}`;

  // documentsLivres (rarement renseigné) ajouté à la description
  let description = clean(r.description);
  const docs = clean(r.documentsLivres);
  if (docs) description = (description ? description + '\n' : '') + `Documents livrés : ${docs}`;

  return {
    id: Number(r.id),
    uuid: randomUUID(),
    reference,
    nom: clean(r.nom) ?? `Site #${r.id}`,
    ville: clean(r.Ville) ?? '—',
    pays: 'CI',
    statut: mapStatut(r.statut),
    titleTypeId: titleMap.get(r.titleTypeid) ?? null,
    titleNumber: clean(r.titleNumber),
    description,
    createdAt: created,
    updatedAt: now,
  };
});

console.log('Références par année :', seqByYear);
const res = await p.lotissement.createMany({ data });
console.log('Insérés :', res.count);

const maxId = data.reduce((m, d) => Math.max(m, d.id), 0);
await p.$executeRawUnsafe(`ALTER TABLE \`Lotissement\` AUTO_INCREMENT = ${maxId + 1}`);
console.log('Total lotissement :', await p.lotissement.count(), '— AUTO_INCREMENT ->', maxId + 1);
await p.$disconnect();
