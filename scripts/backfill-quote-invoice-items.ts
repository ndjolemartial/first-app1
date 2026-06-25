import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Backfill : crée les lignes de facture (InvoiceItem) manquantes pour les
 * factures issues d'un devis converti avant l'ajout de la reprise des lignes.
 *
 * Idempotent : ne touche que les factures liées à un devis et qui n'ont
 * actuellement AUCUNE ligne. Mapping identique à `quotes:convert`.
 *
 * Usage : npx tsx scripts/backfill-quote-invoice-items.ts
 */
const prisma = new PrismaClient();

async function main() {
  // Devis convertis en facture, avec leurs lignes.
  const quotes = await prisma.quote.findMany({
    where: { convertedInvoiceId: { not: null } },
    include: { items: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const q of quotes) {
    const invoiceId = q.convertedInvoiceId!;
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { _count: { select: { items: true } } },
    });
    if (!invoice) { skipped++; continue; }
    // Ne pas dupliquer : on ne complète que les factures sans aucune ligne.
    if (invoice._count.items > 0) { skipped++; continue; }
    if (!q.items.length) { skipped++; continue; }

    const items = [...q.items]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => ({
        invoiceId,
        description: it.category ? `${it.category} — ${it.designation}` : it.designation,
        quantity: String(Number(it.quantity)) as never,
        unitPrice: String(Number(it.unitPrice)) as never,
        total: String(Number(it.total)) as never,
      }));

    await prisma.invoiceItem.createMany({ data: items });
    updated++;
    console.log(`Facture #${invoiceId} (devis ${q.reference}) : ${items.length} ligne(s) ajoutée(s).`);
  }

  console.log(`\nTerminé. Factures complétées : ${updated} | ignorées : ${skipped} (sur ${quotes.length} devis convertis).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
