import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Backfill : génère/aligne les commissions d'APPORT INITIAL pour les conventions
 * déjà enregistrées dont la facture d'apport a été encaissée AVANT l'ajout de
 * l'accrual automatique sur ce type de facture.
 *
 * Reproduit fidèlement la logique de `accrueCollectionCommission`
 * (src/main/services/commission.service.ts) : assiette = montant réellement
 * encaissé sur la facture d'apport, une seule commission ouverte (A_PAYER) par
 * facture/bénéficiaire, anti-doublon avec une commission manuelle, déduction des
 * commissions déjà PAYÉES. Idempotent : peut être relancé sans créer de doublon.
 *
 * Usage : npx tsx scripts/backfill-apport-commissions.ts
 */

const prisma = new PrismaClient();

const RENTAL_TYPES = ['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'COMMERCIAL_LEASE'];
const round2 = (n: number) => Math.round(n * 100) / 100;

async function getDefaultRates() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ['commission.defaultRateSale', 'commission.defaultRateRental', 'commission.defaultRateDossier'] } },
  });
  const map = new Map(rows.map((s) => [s.key, s.value]));
  const sale = Number(map.get('commission.defaultRateSale'));
  const rental = Number(map.get('commission.defaultRateRental'));
  return {
    saleRate: Number.isFinite(sale) ? sale : 5,
    rentalRate: Number.isFinite(rental) ? rental : 50,
  };
}

function commissionTypeAndRate(type: string, rates: { saleRate: number; rentalRate: number }):
  { transactionType: 'VENTE' | 'LOCATION' | 'SOUSCRIPTION'; rate: number } | null {
  if (type === 'SALE') return { transactionType: 'VENTE', rate: rates.saleRate };
  if (type === 'SOUSCRIPTION') return { transactionType: 'SOUSCRIPTION', rate: rates.saleRate };
  if (RENTAL_TYPES.includes(type)) return { transactionType: 'LOCATION', rate: rates.rentalRate };
  return null;
}

async function nextCommissionRef(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.commission.findFirst({
    where: { reference: { startsWith: `COM-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `COM-${year}-${String(seq).padStart(4, '0')}`;
}

/** Réplique accrueCollectionCommission pour une facture (unité = invoiceId). */
async function accrue(params: {
  conventionId: number; invoiceId: number; beneficiaryUserId: number;
  transactionType: 'VENTE' | 'LOCATION' | 'SOUSCRIPTION'; rate: number; collectedTotal: number;
}): Promise<'created' | 'updated' | 'noop'> {
  const collectedTotal = round2(params.collectedTotal);
  if (!(collectedTotal > 0) || !params.beneficiaryUserId) return 'noop';

  // Anti-doublon : commission manuelle de même nature sur la convention.
  const manual = await prisma.commission.findFirst({
    where: {
      conventionId: params.conventionId, transactionType: params.transactionType,
      beneficiaryType: 'USER', userId: params.beneficiaryUserId, source: 'MANUEL',
      deletedAt: null, status: { not: 'ANNULEE' },
    },
    select: { id: true },
  });
  if (manual) return 'noop';

  const existing = await prisma.commission.findMany({
    where: {
      invoiceId: params.invoiceId, beneficiaryType: 'USER', userId: params.beneficiaryUserId,
      transactionType: params.transactionType, source: 'AUTOMATIQUE', deletedAt: null, status: { not: 'ANNULEE' },
    },
    select: { id: true, status: true, baseAmount: true },
  });
  const lockedBase = existing.filter((c) => c.status === 'PAYEE').reduce((s, c) => s + Number(c.baseAmount), 0);
  const open = existing.find((c) => c.status === 'A_PAYER') ?? null;

  const desiredOpenBase = round2(collectedTotal - lockedBase);
  if (desiredOpenBase <= 0) return 'noop';
  const amount = round2(desiredOpenBase * (params.rate / 100));

  if (open) {
    await prisma.commission.update({
      where: { id: open.id },
      data: { baseAmount: desiredOpenBase as any, rate: params.rate as any, amount: amount as any },
    });
    return 'updated';
  }
  const reference = await nextCommissionRef();
  await prisma.commission.create({
    data: {
      reference, conventionId: params.conventionId, invoiceId: params.invoiceId,
      beneficiaryType: 'USER', userId: params.beneficiaryUserId, transactionType: params.transactionType,
      baseAmount: desiredOpenBase as any, rate: params.rate as any, amount: amount as any,
      status: 'A_PAYER', source: 'AUTOMATIQUE',
    },
  });
  return 'created';
}

async function main() {
  const rates = await getDefaultRates();
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, type: 'APPORT_INITIAL', conventionId: { not: null } },
    include: {
      payments: { select: { amount: true } },
      convention: { select: { type: true, agentId: true, client: { select: { assignedToId: true } } } },
    },
  });

  let created = 0, updated = 0, skipped = 0;
  for (const inv of invoices) {
    if (!inv.convention) { skipped++; continue; }
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const collected = paid > 0 ? paid : (inv.status === 'PAYEE' ? Number(inv.total) : 0);
    if (collected <= 0) { skipped++; continue; }
    const tr = commissionTypeAndRate(inv.convention.type, rates);
    const beneficiaryUserId = inv.convention.agentId ?? inv.convention.client?.assignedToId ?? null;
    if (!tr || !beneficiaryUserId) { skipped++; continue; }

    const res = await accrue({
      conventionId: inv.conventionId!, invoiceId: inv.id, beneficiaryUserId,
      transactionType: tr.transactionType, rate: tr.rate, collectedTotal: collected,
    });
    if (res === 'created') { created++; console.log(`Apport ${inv.reference} (conv #${inv.conventionId}) : commission créée — assiette ${collected}`); }
    else if (res === 'updated') { updated++; console.log(`Apport ${inv.reference} (conv #${inv.conventionId}) : commission alignée — assiette ${collected}`); }
    else skipped++;
  }

  console.log(`\nTerminé. Créées : ${created} | alignées : ${updated} | ignorées : ${skipped} (sur ${invoices.length} factures d'apport).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
