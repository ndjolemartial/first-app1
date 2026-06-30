import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Button from '../../../shared/components/ui/Button';
import { Save } from 'lucide-react';
import { useEmployee, useCreateEmployee, useUpdateEmployee, useLinkableUsers } from '../hooks/useHr';
import {
  CIVILITE_OPTIONS, SEXE_OPTIONS, MARITAL_OPTIONS, EMPLOYEE_STATUS_OPTIONS,
} from '../types/hr.types';

const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

interface FormData {
  matricule: string;
  civilite: string;
  firstName: string;
  lastName: string;
  sexe: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  maritalStatus: string;
  childrenCount: number | string;
  igrParts: number | string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  idNumber: string;
  cnpsNumber: string;
  cmuNumber: string;
  bankName: string;
  bankRib: string;
  poste: string;
  departement: string;
  userId: string;
  status: string;
  hireDate: string;
  exitDate: string;
  exitReason: string;
  notes: string;
}

const EMPTY: FormData = {
  matricule: '', civilite: '', firstName: '', lastName: '', sexe: '', birthDate: '', birthPlace: '',
  nationality: 'CI', maritalStatus: '', childrenCount: 0, igrParts: 1, email: '', phone: '', mobile: '',
  address: '', city: '', idNumber: '', cnpsNumber: '', cmuNumber: '', bankName: '', bankRib: '',
  poste: '', departement: '', userId: '', status: 'ACTIF', hireDate: '', exitDate: '', exitReason: '', notes: '',
};

export default function EmployeeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const employeeId = Number(id);

  const { data: res } = useEmployee(isEdit ? employeeId : 0);
  const { data: usersRes } = useLinkableUsers(isEdit ? employeeId : undefined);
  const create = useCreateEmployee();
  const update = useUpdateEmployee();

  const userOptions = [
    { value: '', label: '— Aucun compte lié —' },
    ...((usersRes?.success && usersRes.data ? usersRes.data : []).map((u: any) => ({
      value: String(u.id),
      label: `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim()
        + (u.matricule ? ` (${u.matricule})` : '')
        + (u.role ? ` — ${u.role}` : ''),
    }))),
  ];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (isEdit && res?.success && res.data) {
      const e = res.data;
      reset({
        ...EMPTY,
        matricule: e.matricule ?? '',
        civilite: e.civilite ?? '',
        firstName: e.firstName ?? '',
        lastName: e.lastName ?? '',
        sexe: e.sexe ?? '',
        birthDate: toDateInput(e.birthDate),
        birthPlace: e.birthPlace ?? '',
        nationality: e.nationality ?? 'CI',
        maritalStatus: e.maritalStatus ?? '',
        childrenCount: e.childrenCount ?? 0,
        igrParts: e.igrParts != null ? Number(e.igrParts) : 1,
        email: e.email ?? '',
        phone: e.phone ?? '',
        mobile: e.mobile ?? '',
        address: e.address ?? '',
        city: e.city ?? '',
        idNumber: e.idNumber ?? '',
        cnpsNumber: e.cnpsNumber ?? '',
        cmuNumber: e.cmuNumber ?? '',
        bankName: e.bankName ?? '',
        bankRib: e.bankRib ?? '',
        poste: e.poste ?? '',
        departement: e.departement ?? '',
        userId: e.userId != null ? String(e.userId) : '',
        status: e.status ?? 'ACTIF',
        hireDate: toDateInput(e.hireDate),
        exitDate: toDateInput(e.exitDate),
        exitReason: e.exitReason ?? '',
        notes: e.notes ?? '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = { ...data, matricule: data.matricule?.trim() || undefined, childrenCount: Number(data.childrenCount) || 0, igrParts: Number(data.igrParts) || 1 };
    if (isEdit) {
      const r = await update.mutateAsync({ id: employeeId, payload });
      if (r.success) navigate(`/hr/employees/${employeeId}`);
    } else {
      const r = await create.mutateAsync(payload);
      if (r.success) navigate(`/hr/employees/${r.data.id}`);
    }
  };

  return (
    <PageLayout
      title={isEdit ? "Modifier l'employé" : 'Nouvel employé'}
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Personnel', to: '/hr/employees' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-4">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">État civil</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label="Civilité" options={CIVILITE_OPTIONS} {...register('civilite')} />
            <Input label="Nom" required error={errors.lastName?.message} {...register('lastName', { required: 'Nom requis' })} />
            <Input label="Prénoms" required error={errors.firstName?.message} {...register('firstName', { required: 'Prénoms requis' })} />
            <Select label="Sexe" options={SEXE_OPTIONS} {...register('sexe')} />
            <Input label="Date de naissance" type="date" {...register('birthDate')} />
            <Input label="Lieu de naissance" {...register('birthPlace')} />
            <Input label="Nationalité" {...register('nationality')} />
            <Select label="Situation familiale" options={MARITAL_OPTIONS} {...register('maritalStatus')} />
            <Input label="Nombre d'enfants" type="number" min="0" {...register('childrenCount')} />
            <Input label="Nombre de parts IGR" type="number" step="0.5" min="0" {...register('igrParts')} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Coordonnées</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Email" type="email" {...register('email')} />
            <Input label="Téléphone" {...register('phone')} />
            <Input label="Mobile" {...register('mobile')} />
            <Input label="Adresse" className="sm:col-span-2" {...register('address')} />
            <Input label="Ville" {...register('city')} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Identité & protection sociale</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="N° pièce d'identité" {...register('idNumber')} />
            <Input label="N° CNPS" {...register('cnpsNumber')} />
            <Input label="N° CMU" {...register('cmuNumber')} />
            <Input label="Banque" {...register('bankName')} />
            <Input label="RIB / IBAN" className="sm:col-span-2" {...register('bankRib')} />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Poste & emploi</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Matricule"
              placeholder={isEdit ? '' : 'Auto : AF-AAAA-0001 si laissé vide'}
              {...register('matricule')}
            />
            <Input label="Poste" {...register('poste')} />
            <Input label="Département / service" {...register('departement')} />
            <Select label="Statut" options={EMPLOYEE_STATUS_OPTIONS} {...register('status')} />
            <Input label="Date d'embauche" type="date" {...register('hireDate')} />
            <Input label="Date de sortie" type="date" {...register('exitDate')} />
            <Input label="Motif de sortie" {...register('exitReason')} />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              {...register('notes')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Compte utilisateur lié</h3>
          <p className="mb-3 text-xs text-slate-500">
            Rattachez ce membre du personnel à un compte de connexion de l'application.
            Seuls les comptes actifs non déjà liés à un autre employé sont proposés.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Utilisateur de l'application" options={userOptions} {...register('userId')} />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/hr/employees')}>Annuler</Button>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : "Créer l'employé"}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
