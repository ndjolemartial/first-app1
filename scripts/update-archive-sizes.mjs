import { PrismaClient } from '@prisma/client';
import { stat } from 'node:fs/promises';
const p = new PrismaClient();

const CONCURRENCY = 24;
const STAT_TIMEOUT_MS = 20000;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const docs = await p.document.findMany({ where: { size: 0 }, select: { id: true, path: true } });
console.log('À traiter :', docs.length);

let updated = 0, missing = 0, done = 0, bytes = 0;
const missingList = [];

async function worker(slice) {
  for (const d of slice) {
    try {
      const st = await withTimeout(stat(d.path), STAT_TIMEOUT_MS);
      const size = Number(st.size);
      if (size > 0) {
        await p.document.update({ where: { id: d.id }, data: { size } });
        updated++; bytes += size;
      } else { missing++; missingList.push(`#${d.id} (0 o réel)`); }
    } catch (e) {
      missing++; if (missingList.length < 40) missingList.push(`#${d.id} ${e.code || e.message}`);
    }
    if (++done % 200 === 0) console.log(`  ${done}/${docs.length} — maj:${updated} manquants:${missing}`);
  }
}

// Répartition round-robin entre N workers
const buckets = Array.from({ length: CONCURRENCY }, () => []);
docs.forEach((d, i) => buckets[i % CONCURRENCY].push(d));
await Promise.all(buckets.map(worker));

console.log('\n=== Terminé ===');
console.log('Mis à jour :', updated);
console.log('Non résolus (laissés à 0) :', missing);
console.log('Volume total renseigné :', (bytes / (1024 * 1024)).toFixed(1), 'Mo');
if (missingList.length) console.log('Échantillon non résolus :', missingList.slice(0, 40).join(', '));
console.log('Reste à 0 en base :', await p.document.count({ where: { size: 0 } }));
await p.$disconnect();
