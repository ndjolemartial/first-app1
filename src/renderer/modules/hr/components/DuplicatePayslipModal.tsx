import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Modal from '../../../shared/components/ui/Modal';
import { useEmployees, useDuplicatePayslip } from '../hooks/useHr';
import { MONTH_OPTIONS, type Payslip, type Employee } from '../types/hr.types';

const now = new Date();
// Inclut l'année suivante (+1) : nécessaire pour dupliquer un bulletin de
// décembre vers janvier de l'année suivante.
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => {
  const y = now.getFullYear() + 1 - i;
  return { value: String(y), label: String(y) };
});

/** Mois/année suivant une période (1-12, année) — préremplit la cible d'une duplication. */
function nextPeriod(periodYear: number, periodMonth: number): { year: number; month: number } {
  return periodMonth >= 12 ? { year: periodYear + 1, month: 1 } : { year: periodYear, month: periodMonth + 1 };
}

/**
 * Duplique un bulletin existant vers un autre employé et/ou une autre
 * période (par défaut : le même employé, le mois suivant). Reprend les
 * entrées ajustables du bulletin source (sursalaire, prime imposable,
 * indemnité transport, heures supplémentaires) et les recalcule entièrement
 * côté serveur pour la cible — jamais une simple copie des montants.
 */
export default function DuplicatePayslipModal({ source, onClose }: { source: Payslip; onClose: () => void }) {
  const duplicate = useDuplicatePayslip();
  // Pas de filtre de statut : l'employé du bulletin source doit rester
  // sélectionnable par défaut même s'il n'est plus ACTIF aujourd'hui
  // (congé, suspendu, sorti…).
  const { data: empRes } = useEmployees({}, 1, 1000);
  const employees: Employee[] = empRes?.data ?? [];
  const target = nextPeriod(source.periodYear, source.periodMonth);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      employeeId: String(source.employeeId),
      periodYear: String(target.year),
      periodMonth: String(target.month),
    },
  });

  // Les employés sont chargés de façon asynchrone : au premier rendu, la
  // liste d'options est vide et le <select> ne peut pas encore refléter la
  // valeur par défaut. On réapplique explicitement la sélection dès que les
  // options sont disponibles.
  useEffect(() => {
    if (employees.length) {
      reset({ employeeId: String(source.employeeId), periodYear: String(target.year), periodMonth: String(target.month) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length]);

  const onSubmit = async (d: any) => {
    const r = await duplicate.mutateAsync({
      sourceId: source.id,
      employeeId: Number(d.employeeId),
      periodYear: Number(d.periodYear),
      periodMonth: Number(d.periodMonth),
    });
    if (r.success) onClose();
  };

  const empOptions = employees.map((e) => ({ value: String(e.id), label: `${e.matricule} — ${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() }));

  return (
    <Modal
      open onClose={onClose} title={`Dupliquer le bulletin ${source.reference}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Dupliquer</Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Reprend le sursalaire, la prime imposable, l'indemnité de transport, les commissions sur vente et l'option
        heures supplémentaires de ce bulletin, et recalcule entièrement (CNPS, ITS, CMU, charges) pour l'employé et
        la période choisis.
        Un seul bulletin est autorisé par employé et par période.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Select label="Employé" options={empOptions} {...register('employeeId', { required: true })} />
        </div>
        <Select label="Mois" options={MONTH_OPTIONS} {...register('periodMonth')} />
        <Select label="Année" options={YEAR_OPTIONS} {...register('periodYear')} />
      </div>
    </Modal>
  );
}
