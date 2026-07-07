// Reprise des bulletins existants : recalcule l'ancienneté à la FIN de la
// période de paie (au lieu de la date de génération) et met à jour l'ensemble
// du bulletin (lignes + agrégats) via computePayroll — cascade CNPS/ITS/net/charges.
// Ne touche que les bulletins dont le taux d'ancienneté change ; ignore les annulés.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { computePayroll, computePrimeAnciennete, getPayrollRates } from '../src/main/services/payroll.service';

const prisma = new PrismaClient();

async function main() {
  const rates = await getPayrollRates(prisma as any);
  const payslips = await prisma.payslip.findMany({
    where: { deletedAt: null, status: { not: 'ANNULE' } },
    include: { lines: true, employee: { select: { hireDate: true, igrParts: true } } },
  });

  let touched = 0;
  for (const ps of payslips) {
    const amt = (type: string, label: string) =>
      Number(ps.lines.find((l) => l.type === type && l.label === label)?.amount ?? 0);
    const oldPrime = ps.lines.find((l) => l.type === 'GAIN' && l.label === "Prime d'ancienneté");
    const oldRate = oldPrime ? Number(oldPrime.rate ?? 0) : 0;

    const baseSalary = Number(ps.baseSalary);
    const periodEnd = new Date(ps.periodYear, ps.periodMonth, 0); // dernier jour du mois de paie
    const prime = computePrimeAnciennete(baseSalary, ps.employee.hireDate, periodEnd);
    if (prime.rate === oldRate) continue; // ancienneté inchangée → on ne touche pas

    const input = {
      baseSalary,
      igrParts: Number(ps.employee.igrParts ?? 1),
      sursalaire: amt('GAIN', 'Sursalaire'),
      primeAnciennete: prime.amount,
      senioriteRate: prime.rate,
      taxablePrime: amt('GAIN', 'Primes imposables'),
      overtimeAmount: amt('GAIN', 'Heures supplémentaires'),
      transportAllowance:
        amt('GAIN', 'Indemnité de transport (non imposable)') +
        amt('GAIN', 'Indemnité de transport (part imposable)'),
      otherDeductions: amt('RETENUE', 'Autres retenues'),
    };
    const result = computePayroll(input, rates);
    const lineData = result.lines.map((l) => ({
      type: l.type, label: l.label,
      base: (l.base ?? null) as any, rate: (l.rate ?? null) as any,
      amount: l.amount as any, order: l.order,
    }));

    await prisma.$transaction([
      prisma.payslipLine.deleteMany({ where: { payslipId: ps.id } }),
      prisma.payslip.update({
        where: { id: ps.id },
        data: {
          baseSalary: result.baseSalary as any,
          grossTaxable: result.grossTaxable as any,
          totalGains: result.totalGains as any,
          cnpsEmployee: result.cnpsEmployee as any,
          its: result.its as any,
          cmuEmployee: result.cmuEmployee as any,
          otherDeductions: result.otherDeductions as any,
          totalDeductions: result.totalDeductions as any,
          netSalary: result.netSalary as any,
          employerCharges: result.employerCharges as any,
          employerCost: result.employerCost as any,
          lines: { create: lineData },
        },
      }),
    ]);
    touched++;
    console.log(
      `  ${ps.reference} | ancienneté ${oldRate}% → ${prime.rate}% (prime ${input.primeAnciennete}) | ` +
      `net ${Number(ps.netSalary)} → ${result.netSalary}`,
    );
  }
  console.log(`---\nBulletins scannés : ${payslips.length} | corrigés (ancienneté) : ${touched}`);
}

main().catch((e) => console.error('ERR', e)).finally(() => prisma.$disconnect());
