import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Modal from '../../../shared/components/ui/Modal';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, PlusCircle, FileText, Trash2, Printer, ClipboardList, Upload, ExternalLink } from 'lucide-react';
import { toast } from '../../../shared/components/ui/Toast';
import {
  useEmployee, useEmployees, useCreateContract, useUpdateContract, useDeleteContract, useDeleteEmployee,
  useEssaiCategories, useContractFunctions, useContractObjectives, useCommissionActivities,
  useSignedContracts, useUploadSignedContract, useDeleteSignedContract,
} from '../hooks/useHr';
import {
  EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT,
  CONTRACT_TYPE_OPTIONS, CONTRACT_TYPE_LABEL,
  CONTRACT_STATUS_OPTIONS, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_VARIANT,
  type EmploymentContract, type ActivityCommission, type CommissionActivityOption,
} from '../types/hr.types';

// Écriture opérationnelle : admins/RH + MANAGER & ASSISTANTE_DIRECTION (ces
// derniers restreints côté IPC aux employés dont le contrat en cours n'est pas CDI).
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER']);
const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

interface ContractForm {
  type: string; status: string; poste: string; categorie: string;
  startDate: string; endDate: string; trialEndDate: string;
  weeklyHours: string; baseSalary: string; notes: string;
  sursalaire: string; primeAnciennete: string; grossSalary: string;
  its: string; cnps: string; cmu: string; totalDeductions: string; transportAllowance: string; netSalary: string;
  parentContractId: string;
  responsibleAuthorityId: string;
  functionId: string;
  objectiveId: string;
}

const numOrEmpty = (v: unknown) => (v == null ? '' : String(v));

function ContractModal({
  employeeId, contract, contracts, onClose,
}: { employeeId: number; contract: EmploymentContract | null; contracts: EmploymentContract[]; onClose: () => void }) {
  const create = useCreateContract();
  const update = useUpdateContract(employeeId);
  const isEdit = !!contract;
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ContractForm>({
    defaultValues: {
      type: contract?.type ?? 'CDI',
      status: contract?.status ?? 'ACTIF',
      poste: contract?.poste ?? '',
      categorie: contract?.categorie ?? '',
      startDate: toDateInput(contract?.startDate),
      endDate: toDateInput(contract?.endDate),
      trialEndDate: toDateInput(contract?.trialEndDate),
      weeklyHours: contract?.weeklyHours != null ? String(contract.weeklyHours) : '',
      baseSalary: contract?.baseSalary != null ? String(contract.baseSalary) : '',
      sursalaire: numOrEmpty(contract?.sursalaire),
      primeAnciennete: numOrEmpty(contract?.primeAnciennete),
      grossSalary: numOrEmpty(contract?.grossSalary),
      its: numOrEmpty(contract?.its),
      cnps: numOrEmpty(contract?.cnps),
      cmu: numOrEmpty(contract?.cmu),
      totalDeductions: numOrEmpty(contract?.totalDeductions),
      transportAllowance: numOrEmpty(contract?.transportAllowance),
      netSalary: numOrEmpty(contract?.netSalary),
      parentContractId: contract?.parentContractId != null ? String(contract.parentContractId) : '',
      responsibleAuthorityId: contract?.responsibleAuthorityId != null ? String(contract.responsibleAuthorityId) : '',
      functionId: contract?.functionId != null ? String(contract.functionId) : '',
      objectiveId: contract?.objectiveId != null ? String(contract.objectiveId) : '',
      notes: contract?.notes ?? '',
    },
  });

  // Référentiel des fonctions de l'employé (titre + contenu en liste).
  const { data: fnRes } = useContractFunctions();
  const functions: any[] = fnRes?.data ?? [];
  const functionOptions = [
    { value: '', label: '— Aucune —' },
    ...functions.map((f) => ({ value: String(f.id), label: f.titre })),
  ];

  // Référentiel des objectifs assignés (titre + contenu en liste).
  const { data: objRes } = useContractObjectives();
  const objectives: any[] = objRes?.data ?? [];
  const objectiveOptions = [
    { value: '', label: '— Aucun —' },
    ...objectives.map((o) => ({ value: String(o.id), label: o.titre })),
  ];

  // Tout le personnel (sélecteur « Autorité responsable »).
  const { data: allEmpRes } = useEmployees({}, 1, 1000);
  const allEmployees: any[] = allEmpRes?.data ?? [];
  const authorityOptions = [
    { value: '', label: '— Aucune —' },
    ...allEmployees.map((e) => ({
      value: String(e.id),
      label: `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() + (e.poste ? ` — ${e.poste}` : ''),
    })),
  ];
  // Commissions sur activité : catalogue (avec taux par défaut) + sélection courante.
  const { data: commActRes } = useCommissionActivities();
  const commissionCatalog: CommissionActivityOption[] = commActRes?.data ?? [];
  const [activityCommissions, setActivityCommissions] = useState<ActivityCommission[]>(
    Array.isArray(contract?.activityCommissions) ? contract!.activityCommissions! : [],
  );
  const isCommissionSelected = (key: string) => activityCommissions.some((c) => c.key === key);
  const toggleCommission = (opt: CommissionActivityOption) => {
    setActivityCommissions((prev) =>
      prev.some((c) => c.key === opt.key)
        ? prev.filter((c) => c.key !== opt.key)
        : [...prev, { key: opt.key, label: opt.label, rate: opt.defaultRate }],
    );
  };
  const setCommissionRate = (key: string, rate: number) =>
    setActivityCommissions((prev) => prev.map((c) => (c.key === key ? { ...c, rate } : c)));

  const type = watch('type');
  const showRemuneration = ['CDI', 'CDD', 'AVENANT_CDD', 'ESSAI', 'RENOUVELLEMENT_ESSAI'].includes(type);
  const isAvenant = type === 'AVENANT_CDD';
  const isRenouvellement = type === 'RENOUVELLEMENT_ESSAI';
  const isEssai = type === 'ESSAI';

  // Catégories socio-professionnelles configurées (délais d'essai).
  const { data: catsRes } = useEssaiCategories();
  const categories: import('../types/hr.types').EssaiCategory[] = catsRes?.data ?? [];

  // CDD amendables (avenant) / ESSAI renouvelables — hors le contrat en cours d'édition.
  const parentOptions = (kind: 'CDD' | 'ESSAI') => contracts
    .filter((c) => c.type === kind && c.id !== contract?.id)
    .map((c) => ({
      value: String(c.id),
      label: `${c.reference} (${toDateInput(c.startDate)}${c.endDate ? ' → ' + toDateInput(c.endDate) : ''})`,
    }));
  const cddOptions = parentOptions('CDD');
  const essaiOptions = parentOptions('ESSAI');

  // ── Helpers de dates ───────────────────────────────────────────
  const fmt = (d: Date) => (isNaN(d.getTime()) ? ''
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  const parse = (iso: string) => new Date(iso + 'T00:00:00');
  const dayDiff = (a: string | Date, b: string | Date) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

  /**
   * ESSAI : déduit la **fin de période d'essai** (trialEndDate) depuis la
   * catégorie choisie et la date de début. La date de fin (CDD/stage) n'est pas
   * utilisée pour un essai.
   */
  const autofillEssaiEnd = (catLabel: string, startStr: string) => {
    if (!startStr) return;
    const cat = categories.find((c) => c.label === catLabel && c.isActive);
    if (!cat) return;
    const d = parse(startStr);
    if (cat.durationUnit === 'MOIS') d.setMonth(d.getMonth() + cat.durationValue);
    else d.setDate(d.getDate() + cat.durationValue);
    setValue('trialEndDate', fmt(d));
  };

  /** Fin effective d'un essai : la fin de période d'essai, à défaut la date de fin. */
  const essaiEnd = (c?: EmploymentContract | null) =>
    (c?.trialEndDate || c?.endDate) ?? null;

  /** RENOUVELLEMENT_ESSAI : date de fin = début + durée de l'essai initial (verrouillée). */
  const autofillRenewalEnd = (parentId: string, startStr: string) => {
    const parent = contracts.find((c) => String(c.id) === parentId);
    const pEnd = essaiEnd(parent);
    if (!parent || !pEnd || !startStr) return;
    const dur = dayDiff(parent.startDate, pEnd);
    setValue('endDate', fmt(new Date(parse(startStr).getTime() + dur * 86_400_000)));
  };

  /** Au choix de l'essai initial : pré-remplit le début (lendemain de la fin) puis la fin. */
  const onPickRenewalParent = (parentId: string) => {
    const parent = contracts.find((c) => String(c.id) === parentId);
    const pEnd = essaiEnd(parent);
    let startStr = watch('startDate');
    if (pEnd && !startStr) {
      startStr = fmt(new Date(new Date(pEnd).getTime() + 86_400_000));
      setValue('startDate', startStr);
    }
    autofillRenewalEnd(parentId, startStr);
  };

  const onSubmit = async (data: ContractForm) => {
    const num = (v: string) => (v === '' ? null : Number(v));
    const payload: any = {
      ...data,
      employeeId,
      weeklyHours: data.weeklyHours === '' ? null : Number(data.weeklyHours),
      baseSalary: Number(data.baseSalary) || 0,
      endDate: data.endDate || null,
      trialEndDate: data.trialEndDate || null,
      sursalaire: num(data.sursalaire),
      primeAnciennete: num(data.primeAnciennete),
      grossSalary: num(data.grossSalary),
      its: num(data.its),
      cnps: num(data.cnps),
      cmu: num(data.cmu),
      totalDeductions: num(data.totalDeductions),
      transportAllowance: num(data.transportAllowance),
      netSalary: num(data.netSalary),
      parentContractId: (data.type === 'AVENANT_CDD' || data.type === 'RENOUVELLEMENT_ESSAI') ? num(data.parentContractId) : null,
      responsibleAuthorityId: num(data.responsibleAuthorityId),
      functionId: num(data.functionId),
      objectiveId: num(data.objectiveId),
      activityCommissions,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: contract!.id, payload })
      : await create.mutateAsync(payload);
    if (r.success) onClose();
  };

  const catReg = register('categorie');
  const startReg = register('startDate');
  const parentReg = register('parentContractId');
  const itsReg = register('its');
  const cnpsReg = register('cnps');
  const cmuReg = register('cmu');

  /** Total des retenues = ITS + CNPS salarié + CMU (auto, modifiable ensuite). */
  const recomputeDeductions = (changed?: { its?: string; cnps?: string; cmu?: string }) => {
    const n = (v: string) => Number(v) || 0;
    const total = n(changed?.its ?? watch('its')) + n(changed?.cnps ?? watch('cnps')) + n(changed?.cmu ?? watch('cmu'));
    setValue('totalDeductions', String(total));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Type de contrat" options={CONTRACT_TYPE_OPTIONS} {...register('type')} />
        <Select label="Statut" options={CONTRACT_STATUS_OPTIONS} {...register('status')} />
        <Input label="Poste" {...register('poste')} />
        <Input
          label="Catégorie / classification" list="essai-cats" {...catReg}
          onChange={(e) => { catReg.onChange(e); if (isEssai) autofillEssaiEnd(e.target.value, watch('startDate')); }}
        />
        <Input
          label="Date de début" type="date" required {...startReg}
          onChange={(e) => {
            startReg.onChange(e);
            if (isEssai) autofillEssaiEnd(watch('categorie'), e.target.value);
            if (isRenouvellement) autofillRenewalEnd(watch('parentContractId'), e.target.value);
          }}
        />
        {!isEssai && (
          <Input
            label={isRenouvellement ? 'Date de fin (calculée)' : 'Date de fin (CDD/stage)'}
            type="date" readOnly={isRenouvellement} {...register('endDate')}
          />
        )}
        <Input
          label={isEssai ? "Fin de période d'essai (calculée selon la catégorie)" : "Fin de période d'essai"}
          type="date" {...register('trialEndDate')}
        />
        <Input label="Heures / semaine" type="number" step="0.5" min="0" {...register('weeklyHours')} />
        <Input label="Salaire de base mensuel (FCFA)" type="number" step="1000" min="0" required {...register('baseSalary')} />
        <Select label="Autorité responsable" options={authorityOptions} {...register('responsibleAuthorityId')} />
        <Select label="Fonction de l'employé" options={functionOptions} {...register('functionId')} />
        <Select label="Objectifs assignés" options={objectiveOptions} {...register('objectiveId')} />
      </div>
      <datalist id="essai-cats">
        {categories.map((c) => <option key={c.id} value={c.label} />)}
      </datalist>
      {(() => {
        const fn = functions.find((f) => String(f.id) === watch('functionId'));
        const items = String(fn?.contenu ?? '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
        if (!items.length) return null;
        return (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-medium text-slate-600">Contenu de la fonction</p>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
              {items.map((it: string, i: number) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        );
      })()}
      {(() => {
        const obj = objectives.find((o) => String(o.id) === watch('objectiveId'));
        const items = String(obj?.contenu ?? '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
        if (!items.length) return null;
        return (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-medium text-slate-600">Objectifs assignés</p>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
              {items.map((it: string, i: number) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        );
      })()}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">Commissions sur activité</p>
        <p className="mb-2 text-xs text-slate-400">
          Sélectionnez les activités ouvrant droit à commission pour ce contrat et ajustez les taux.
        </p>
        <div className="space-y-2">
          {commissionCatalog.map((opt) => {
            const selected = isCommissionSelected(opt.key);
            const current = activityCommissions.find((c) => c.key === opt.key);
            return (
              <div key={opt.key} className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selected} onChange={() => toggleCommission(opt)} className="rounded" />
                  <span className="truncate">{opt.label}</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="0.5" min="0" max="100"
                    value={current ? String(current.rate) : String(opt.defaultRate)}
                    disabled={!selected}
                    onChange={(e) => setCommissionRate(opt.key, Number(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            );
          })}
          {commissionCatalog.length === 0 && (
            <p className="text-xs text-slate-400">Chargement du catalogue…</p>
          )}
        </div>
      </div>

      {isAvenant && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Select
            label="Contrat CDD à amender *"
            options={[{ value: '', label: '— Sélectionner le CDD initial —' }, ...cddOptions]}
            {...register('parentContractId')}
          />
          {cddOptions.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Aucun contrat CDD enregistré pour cet employé : créez d'abord le CDD initial.
            </p>
          )}
          <p className="mt-2 text-xs text-amber-700">
            L'avenant prolonge le CDD initial via sa <strong>date de fin</strong>. Le délai cumulé
            (CDD initial + avenants) ne peut excéder <strong>2 ans</strong> à compter du début du CDD.
          </p>
        </div>
      )}

      {isRenouvellement && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <Select
            label="Contrat ESSAI à renouveler *"
            options={[{ value: '', label: "— Sélectionner l'essai initial —" }, ...essaiOptions]}
            {...parentReg}
            onChange={(e) => { parentReg.onChange(e); onPickRenewalParent(e.target.value); }}
          />
          {essaiOptions.length === 0 && (
            <p className="mt-1 text-xs text-indigo-700">
              Aucun contrat ESSAI enregistré pour cet employé : créez d'abord le contrat à l'essai.
            </p>
          )}
          <p className="mt-2 text-xs text-indigo-700">
            Le renouvellement a la <strong>même durée</strong> que l'essai initial : la date de début est
            pré-remplie au lendemain de la fin de l'essai et la date de fin est <strong>calculée automatiquement</strong>.
          </p>
        </div>
      )}

      {showRemuneration && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Rémunération (clause du contrat)</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Sursalaire (FCFA)" type="number" step="1" min="0" {...register('sursalaire')} />
            <Input label="Prime d'ancienneté (FCFA)" type="number" step="1" min="0" {...register('primeAnciennete')} />
            <Input label="Salaire brut (FCFA)" type="number" step="1" min="0" {...register('grossSalary')} />
            <Input label="ITS (FCFA)" type="number" step="1" min="0" {...itsReg}
              onChange={(e) => { itsReg.onChange(e); recomputeDeductions({ its: e.target.value }); }} />
            <Input label="CNPS salarié (FCFA)" type="number" step="1" min="0" {...cnpsReg}
              onChange={(e) => { cnpsReg.onChange(e); recomputeDeductions({ cnps: e.target.value }); }} />
            <Input label="CMU salarié (FCFA)" type="number" step="1" min="0" {...cmuReg}
              onChange={(e) => { cmuReg.onChange(e); recomputeDeductions({ cmu: e.target.value }); }} />
            <Input label="Total des retenues (FCFA)" type="number" step="1" min="0" {...register('totalDeductions')} />
            <Input label="Prime de transport (FCFA)" type="number" step="1" min="0" {...register('transportAllowance')} />
            <Input label="Salaire net à payer (FCFA)" type="number" step="1" min="0" {...register('netSalary')} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Salaire brut = salaire de base + sursalaire + prime d'ancienneté. Total des retenues = ITS + CNPS salarié + CMU
            (calculé automatiquement, modifiable). Net à payer = brut − total des retenues + transport.
          </p>
        </div>
      )}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          rows={2}
          {...register('notes')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </Modal>
  );
}

export default function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const employeeId = Number(id);
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);

  const { data: res, isLoading } = useEmployee(employeeId);
  const deleteContract = useDeleteContract(employeeId);
  const deleteEmployee = useDeleteEmployee();

  const [contractModal, setContractModal] = useState<{ open: boolean; contract: EmploymentContract | null }>({ open: false, contract: null });
  const [contractToDelete, setContractToDelete] = useState<EmploymentContract | null>(null);
  const [confirmEmployeeDelete, setConfirmEmployeeDelete] = useState(false);

  if (isLoading) return <PageLayout title="Employé"><Card><SkeletonTable rows={6} /></Card></PageLayout>;
  if (!res?.success || !res.data) {
    return <PageLayout title="Employé"><Card>Employé introuvable.</Card></PageLayout>;
  }

  const e = res.data;
  const name = `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim();
  const contracts: EmploymentContract[] = e.contracts ?? [];

  return (
    <PageLayout
      title={name || e.matricule}
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Personnel', to: '/hr/employees' }, { label: name || e.matricule }]}
      actions={
        canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/hr/employees/${employeeId}/edit`)}>
              Modifier
            </Button>
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmEmployeeDelete(true)}>
              Archiver
            </Button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500">{e.matricule}</span>
            <Badge variant={(EMPLOYEE_STATUS_VARIANT[e.status] ?? 'default') as any}>
              {EMPLOYEE_STATUS_LABEL[e.status] ?? e.status}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{name}</h2>
          <p className="mb-4 text-sm text-slate-500">{e.poste ?? '—'}{e.departement ? ` · ${e.departement}` : ''}</p>
          <dl className="space-y-3">
            <Field label="Téléphone" value={e.mobile || e.phone} />
            <Field label="Email" value={e.email} />
            <Field label="Adresse" value={[e.address, e.city].filter(Boolean).join(', ') || null} />
            <Field label="Date d'embauche" value={e.hireDate ? formatDate(e.hireDate) : null} />
            <Field
              label="Compte utilisateur lié"
              value={e.user ? `${e.user.lastName ?? ''} ${e.user.firstName ?? ''}`.trim() + (e.user.role ? ` · ${e.user.role}` : '') : null}
            />
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">État civil & social</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Date de naissance" value={e.birthDate ? formatDate(e.birthDate) : null} />
              <Field label="Lieu de naissance" value={e.birthPlace} />
              <Field label="Nationalité" value={e.nationality} />
              <Field label="Situation familiale" value={e.maritalStatus} />
              <Field label="Enfants" value={e.childrenCount} />
              <Field label="N° pièce d'identité" value={e.idNumber} />
              <Field label="N° CNPS" value={e.cnpsNumber} />
              <Field label="N° CMU" value={e.cmuNumber} />
              <Field label="Banque" value={e.bankName} />
              <Field label="RIB / IBAN" value={e.bankRib} />
            </dl>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Contrats de travail</h3>
              {canWrite && (
                <Button size="sm" icon={<PlusCircle className="h-4 w-4" />} onClick={() => setContractModal({ open: true, contract: null })}>
                  Nouveau contrat
                </Button>
              )}
            </div>
            {contracts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucun contrat enregistré.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2">Référence</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Période</th>
                    <th className="py-2">Salaire de base</th>
                    <th className="py-2">Statut</th>
                    {canWrite && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contracts.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />{c.reference}
                        </span>
                      </td>
                      <td className="py-2 text-slate-600">{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</td>
                      <td className="py-2 text-slate-600">
                        {formatDate(c.startDate)}{c.endDate ? ` → ${formatDate(c.endDate)}` : ''}
                      </td>
                      <td className="py-2 text-slate-700">{formatCurrency(Number(c.baseSalary))}</td>
                      <td className="py-2">
                        <Badge variant={(CONTRACT_STATUS_VARIANT[c.status] ?? 'default') as any}>
                          {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="py-2">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Document / Imprimer" icon={<Printer className="h-4 w-4" />}
                              onClick={() => navigate(`/hr/contracts/${c.id}/document`)} />
                            <Button variant="ghost" size="sm" title="Fiche de poste" icon={<ClipboardList className="h-4 w-4" />}
                              onClick={() => navigate(`/hr/contracts/${c.id}/job-description`)} />
                            <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                              onClick={() => setContractModal({ open: true, contract: c })} />
                            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => setContractToDelete(c)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <SignedContractsCard employeeId={employeeId} canWrite={canWrite} />

          {e.notes && (
            <Card>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{e.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {contractModal.open && (
        <ContractModal
          employeeId={employeeId}
          contract={contractModal.contract}
          contracts={contracts}
          onClose={() => setContractModal({ open: false, contract: null })}
        />
      )}

      <ConfirmDialog
        open={!!contractToDelete}
        title="Supprimer le contrat"
        message={contractToDelete ? `Supprimer le contrat ${contractToDelete.reference} ?` : ''}
        confirmLabel="Supprimer"
        loading={deleteContract.isPending}
        onClose={() => setContractToDelete(null)}
        onConfirm={async () => {
          if (contractToDelete) {
            const r = await deleteContract.mutateAsync(contractToDelete.id);
            if (r.success) setContractToDelete(null);
          }
        }}
      />

      <ConfirmDialog
        open={confirmEmployeeDelete}
        title="Archiver l'employé"
        message={`Archiver l'employé ${name} ? Il n'apparaîtra plus dans la liste du personnel.`}
        confirmLabel="Archiver"
        loading={deleteEmployee.isPending}
        onClose={() => setConfirmEmployeeDelete(false)}
        onConfirm={async () => {
          const r = await deleteEmployee.mutateAsync(employeeId);
          if (r.success) navigate('/hr/employees');
        }}
      />
    </PageLayout>
  );
}

/** Contrats signés : téléversement de fichiers signés rattachés à l'employé. */
function SignedContractsCard({ employeeId, canWrite }: { employeeId: number; canWrite: boolean }) {
  const { data: res, isLoading } = useSignedContracts(employeeId);
  const upload = useUploadSignedContract(employeeId);
  const del = useDeleteSignedContract(employeeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const list: any[] = res?.data ?? [];

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await upload.mutateAsync({
      employeeId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataBase64,
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const open = async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const r = await window.electron.hr.signedContracts.open(token, id);
    if (!r.success) toast.error(String(r.error));
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Contrats signés</h3>
        {canWrite && (
          <>
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={onFile} />
            <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />}
              loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              Téléverser
            </Button>
          </>
        )}
      </div>
      {isLoading ? (
        <SkeletonTable rows={2} />
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun contrat signé téléversé.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => open(s.id)}>
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-sm text-slate-800">{s.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(s.uploadedAt)}</span>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" icon={<ExternalLink className="h-4 w-4" />} title="Ouvrir"
                  onClick={() => open(s.id)} />
                {canWrite && (
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} title="Supprimer"
                    onClick={() => setToDelete(s)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le contrat signé"
        message={`Supprimer « ${toDelete?.name ?? ''} » ?`}
        confirmLabel="Supprimer"
        loading={del.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) { const r = await del.mutateAsync(toDelete.id); if (r.success) setToDelete(null); } }}
      />
    </Card>
  );
}
