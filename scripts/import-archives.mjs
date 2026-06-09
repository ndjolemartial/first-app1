import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const now = new Date();

// ── Helpers ─────────────────────────────────────────────────────────────
const MIME = {
  pdf: 'application/pdf', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
function mimeOf(empl) {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec((empl ?? '').trim());
  return m ? (MIME[m[1].toLowerCase()] ?? 'application/octet-stream') : 'application/octet-stream';
}
// UNC : conserve le \\ initial, réduit les \\ internes en \ simple.
function normPath(s) {
  if (!s) return s;
  let lead = '';
  if (s.startsWith('\\\\')) { lead = '\\\\'; s = s.slice(2); }
  return lead + s.replace(/\\+/g, '\\');
}
const clean = (v) => { const s = (v ?? '').toString().trim(); return s === '' ? null : s; };

// ── Nettoyage préalable (ré-exécutable) ─────────────────────────────────
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
for (const t of ['DocumentAuditLog', 'DocumentTag', 'Document', 'DocumentFolder', 'DocumentCategory']) {
  await p.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
}
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

// ── Source ──────────────────────────────────────────────────────────────
const rows = await p.$queryRawUnsafe('SELECT * FROM `archives_from` ORDER BY ID');
console.log('Lignes source :', rows.length);

// ── 1. Catégories (Objet) ───────────────────────────────────────────────
const objets = [...new Set(rows.map((r) => r.Objet))];
await p.documentCategory.createMany({ data: objets.map((name) => ({ name })) });
const cats = await p.documentCategory.findMany({ select: { id: true, name: true } });
const catId = new Map(cats.map((c) => [c.name, c.id]));
console.log('Catégories créées :', cats.length);

// ── 2. Dossiers (Rangement) ─────────────────────────────────────────────
const rangs = [...new Set(rows.map((r) => r.Rangement))];
await p.documentFolder.createMany({ data: rangs.map((name) => ({ name })) });
const folders = await p.documentFolder.findMany({ select: { id: true, name: true } });
const folderId = new Map(folders.map((f) => [f.name, f.id]));
console.log('Dossiers créés :', folders.length);

// ── 3. Clients existants (pour les liens valides) ───────────────────────
const existingClients = new Set((await p.client.findMany({ select: { id: true } })).map((c) => c.id));

// ── 4. Construction des documents ───────────────────────────────────────
const seqByYear = {};
let orphanClient = 0, withClient = 0;
const data = rows.map((r) => {
  const date = new Date(r.Date);
  const year = date.getFullYear();
  seqByYear[year] = (seqByYear[year] ?? 0) + 1;
  const numeroArchive = `ARC-${year}-${String(seqByYear[year]).padStart(4, '0')}`;

  const linkClient = r.Client > 0 && existingClients.has(r.Client);
  if (r.Client > 0) { linkClient ? withClient++ : orphanClient++; }

  // Métadonnées héritées conservées en description
  const meta = [`Archive héritée — ancien ID #${r.ID}`];
  if (clean(r.Details_emplacement)) meta.push(`Emplacement physique : ${clean(r.Details_emplacement)}`);
  if (r.Site > 0) meta.push(`Ancien site #${r.Site}`);
  if (r.Fournisseur > 0) meta.push(`Ancien fournisseur #${r.Fournisseur}`);
  if (r.Client > 0 && !linkClient) meta.push(`Ancien client #${r.Client} (non rapproché)`);

  return {
    name: clean(r.Designation) ?? `Archive #${r.ID}`,
    type: mimeOf(r.Emplacement),
    path: normPath(r.Emplacement),
    size: 0,
    numeroArchive,
    category: r.Objet,                 // champ legacy
    categoryId: catId.get(r.Objet) ?? null,
    folderId: folderId.get(r.Rangement) ?? null,
    description: meta.join('\n'),
    uploadedById: r.Utilisateur || null,
    isPhysical: true,
    physBureau: clean(r.Rangement),
    physCarton: clean(r.Details_emplacement),
    clientId: linkClient ? r.Client : null,
    uploadedAt: date,
    updatedAt: now,
  };
});

console.log('Numéros par année :', seqByYear);
console.log(`Liens client : ${withClient} valides, ${orphanClient} orphelins (→ null)`);

// ── 5. Insertion ────────────────────────────────────────────────────────
const res = await p.document.createMany({ data });
console.log('Documents insérés :', res.count);

// ── 6. Journal d'audit (IMPORT) par document ────────────────────────────
const docs = await p.document.findMany({ select: { id: true } });
await p.documentAuditLog.createMany({
  data: docs.map((d) => ({
    documentId: d.id, action: 'IMPORT', userId: null,
    detail: 'Import en masse depuis archives_from',
  })),
});
console.log('Entrées audit IMPORT :', docs.length);

console.log('Total Document :', await p.document.count());
await p.$disconnect();
