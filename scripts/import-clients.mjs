import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const p = new PrismaClient();
const norm = (s) => (s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire accents
  .toLowerCase().replace(/[\s\-']/g, '').trim();

// ── Mapping pays (nom source -> code ISO) ───────────────────────────────
const countries = await p.country.findMany({ select: { isoCode: true, name: true } });
const byName = new Map(countries.map((c) => [norm(c.name), c.isoCode]));
// Overrides pour les libellés sources non standard
// Clés sous forme normalisée (norm() retire accents/espaces/tirets/apostrophes)
const OVERRIDES = {
  'etatsunis': 'US',
  'angleterre': 'GB',
  'burkinafasso': 'BF',
};
function resolveCountry(src) {
  if (!src) return 'CI';
  const o = OVERRIDES[norm(src)];
  if (o) return o;
  return byName.get(norm(src)) ?? null;
}

// ── Vérification résolution pays ────────────────────────────────────────
const distinct = await p.$queryRawUnsafe(
  "SELECT country v FROM `client_from` GROUP BY country");
const unresolved = [];
for (const { v } of distinct) {
  if (resolveCountry(v) === null) unresolved.push(v);
}
if (unresolved.length) {
  console.error('Pays non résolus, import annulé :', unresolved);
  await p.$disconnect();
  process.exit(1);
}

// ── Mappings enums ──────────────────────────────────────────────────────
const CIV = { monsieur: 'MONSIEUR', madame: 'MADAME', mademoiselle: 'MADEMOISELLE' };
const civ = (v) => CIV[norm(v)] ?? 'MONSIEUR';
const SC = { celibataire: 'CELIBATAIRE', mariee: 'MARIEE', 'marie(e)': 'MARIEE', concubinage: 'CONCUBINAGE' };
const sc = (v) => SC[norm(v)] ?? 'CELIBATAIRE';

const nn = (v) => { const s = (v ?? '').toString().trim(); return s === '' || s === '-1' ? null : s; };

// ── Chargement source trié par id : la séquence de référence suit l'ordre des id ──
const rows = await p.$queryRawUnsafe(
  'SELECT * FROM `client_from` ORDER BY Id');

const seqByYear = {};
const now = new Date();
const data = rows.map((r) => {
  const created = new Date(r.createdAt);
  const year = created.getFullYear();
  seqByYear[year] = (seqByYear[year] ?? 0) + 1;
  const reference = `CLI-${year}-${String(seqByYear[year]).padStart(4, '0')}`;
  const idTypeId = nn(r.idTypeId) ? parseInt(r.idTypeId, 10) : null;
  return {
    id: Number(r.Id),          // conserve l'identifiant d'origine
    uuid: randomUUID(),
    reference,
    type: 'INDIVIDUEL',
    civilite: civ(r.civilite),
    statutConjugal: sc(r.statutconjugal),
    firstName: nn(r.firstName),
    lastName: nn(r.lastName),
    email: nn(r.email),
    phone: nn(r.phone),
    mobile: nn(r.mobile),
    address: nn(r.address),
    commune: nn(r.commune),
    city: nn(r.city),
    country: resolveCountry(r.country),
    birthDate: r.birthDate ? new Date(r.birthDate) : null,
    birthPlace: nn(r.birthPlace),
    idNumber: nn(r.idNumber),
    idTypeId: Number.isFinite(idTypeId) ? idTypeId : null,
    profession: nn(r.profession),
    entreprise: nn(r.entreprise),
    registre_de_commerce: nn(r.registre_de_commerce),
    compte_contribuable: nn(r.compte_contribuable),
    companyActivity: nn(r.companyActivity),
    website: nn(r.website),
    assignedToId: r.assignedToId != null ? Number(r.assignedToId) : null,
    status: 'ACTIF',
    isActive: true,
    smsOptOut: false,
    emailOptOut: false,
    createdAt: created,
    updatedAt: now,
  };
});

console.log('Lignes à importer :', data.length);
console.log('Références par année :', seqByYear);

// Vidage préalable (import précédent à reprendre) + ré-import en conservant l'id.
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
await p.$executeRawUnsafe('TRUNCATE TABLE `Client`');
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

const res = await p.client.createMany({ data });
console.log('Insérées :', res.count);

// Recale l'AUTO_INCREMENT au-delà du plus grand id importé.
const maxId = data.reduce((m, d) => Math.max(m, d.id), 0);
await p.$executeRawUnsafe(`ALTER TABLE \`Client\` AUTO_INCREMENT = ${maxId + 1}`);

const total = await p.client.count();
console.log('Total table client :', total, '— AUTO_INCREMENT ->', maxId + 1);
await p.$disconnect();
