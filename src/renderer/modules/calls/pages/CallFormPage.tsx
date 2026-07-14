import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Button from '../../../shared/components/ui/Button';
import { FormSearchSelect, type SearchSelectOption } from '../../../shared/components/ui/SearchSelect';
import PhoneLineModal from '../components/PhoneLineModal';
import { Save, Plus } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCall, useCreateCall, useUpdateCall, usePhoneLines } from '../hooks/useCalls';
import { DIRECTION_LABEL, STATUS_LABEL } from '../types/calls.types';

interface FormData {
  direction: 'ENTRANT' | 'SORTANT';
  ligne: string;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  objet: string;
  details: string;
  duration: string;
  status: 'ABOUTI' | 'MANQUE' | 'OCCUPE' | 'MESSAGE_LAISSE';
  calledAt: string;
  clientId: string;
  prospectId: string;
}

/** Date/heure courante au format attendu par un `<input type="datetime-local">`. */
function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return nowLocal();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return nowLocal();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const EMPTY: FormData = {
  direction: 'ENTRANT', ligne: '', firstName: '', lastName: '', company: '', phone: '', email: '',
  objet: '', details: '', duration: '', status: 'ABOUTI', calledAt: nowLocal(), clientId: '', prospectId: '',
};

export default function CallFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const callId = Number(id);

  const { data: res } = useCall(isEdit ? callId : 0);
  const create = useCreateCall();
  const update = useUpdateCall();

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: EMPTY,
  });

  const { data: lignesRes } = usePhoneLines();
  const [ligneModalOpen, setLigneModalOpen] = useState(false);
  const ligneOptions = [
    { value: '', label: '— Sélectionner une ligne —' },
    ...((lignesRes?.success && lignesRes.data ? lignesRes.data : []).map((l: any) => ({
      value: l.label,
      label: l.label,
    }))),
  ];

  useEffect(() => {
    if (isEdit && res?.success && res.data) {
      const c = res.data;
      reset({
        direction: c.direction,
        ligne: c.ligne ?? '',
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        company: c.company ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        objet: c.objet ?? '',
        details: c.details ?? '',
        duration: c.duration != null ? String(c.duration) : '',
        status: c.status,
        calledAt: toLocalInput(c.calledAt),
        clientId: c.clientId ? String(c.clientId) : '',
        prospectId: c.prospectId ? String(c.prospectId) : '',
      });
    }
  }, [res, isEdit, reset]);

  // Recherche volontairement non filtrée par affectation (assignedToId) :
  // quel que soit le rôle connecté, la liste complète des clients/prospects
  // est accessible pour ce simple rattachement de contexte (`calls:searchClients`
  // / `calls:searchProspects`, distincts de `clients:list` / `prospects:list`
  // qui appliquent le périmètre habituel de visibilité).
  const searchClients = async (query: string): Promise<SearchSelectOption[]> => {
    const token = useAuthStore.getState().token;
    if (!token) return [];
    const r = await window.electron.calls.searchClients(token, query);
    if (!r.success) return [];
    return (r.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.type === 'ENTREPRISE' ? (c.entreprise ?? '') : `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim(),
    }));
  };

  const searchProspects = async (query: string): Promise<SearchSelectOption[]> => {
    const token = useAuthStore.getState().token;
    if (!token) return [];
    const r = await window.electron.calls.searchProspects(token, query);
    if (!r.success) return [];
    return (r.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim(),
    }));
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      duration: data.duration === '' ? undefined : Number(data.duration),
      calledAt: new Date(data.calledAt).toISOString(),
      clientId: data.clientId || undefined,
      prospectId: data.prospectId || undefined,
    };
    if (isEdit) {
      const r = await update.mutateAsync({ id: callId, payload });
      if (r.success) navigate('/calls');
    } else {
      const r = await create.mutateAsync(payload);
      if (r.success) navigate('/calls');
    }
  };

  return (
    <PageLayout
      title={isEdit ? "Modifier l'appel" : 'Nouvel appel'}
      breadcrumbs={[{ label: 'Gestion des appels', to: '/calls' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-4">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Appel</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Sens" required options={Object.entries(DIRECTION_LABEL).map(([value, label]) => ({ value, label }))}
              {...register('direction', { required: true })} />
            <Input label="Date / heure de l'appel" type="datetime-local" required {...register('calledAt', { required: true })} />
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Ligne téléphonique</label>
                <button
                  type="button"
                  onClick={() => setLigneModalOpen(true)}
                  title="Gérer les lignes téléphoniques"
                  className="flex items-center gap-1 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Gérer
                </button>
              </div>
              <FormSearchSelect control={control} name="ligne" options={ligneOptions} placeholder="Rechercher une ligne téléphonique…" />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Correspondant</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nom" {...register('lastName')} />
            <Input label="Prénoms" {...register('firstName')} />
            <Input label="Entreprise" {...register('company')} />
            <Input label="Téléphone" required error={errors.phone?.message} {...register('phone', { required: 'Téléphone requis' })} />
            <Input label="Adresse mail" type="email" error={errors.email?.message}
              {...register('email', {
                validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Adresse mail invalide',
              })} />
          </div>
          <p className="mt-3 mb-2 text-xs text-slate-500">
            Rattachement optionnel à une fiche existante (contexte de l'appel) — au choix, un client
            <strong> ou </strong> un prospect, jamais les deux à la fois :
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormSearchSelect
              control={control}
              name="clientId"
              label="Client concerné"
              options={[]}
              placeholder="Rechercher un client…"
              onSearch={searchClients}
              onValueChange={(v) => { if (v) setValue('prospectId', ''); }}
            />
            <FormSearchSelect
              control={control}
              name="prospectId"
              label="Prospect concerné"
              options={[]}
              placeholder="Rechercher un prospect…"
              onSearch={searchProspects}
              onValueChange={(v) => { if (v) setValue('clientId', ''); }}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Détails</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Objet de l'appel" required error={errors.objet?.message} {...register('objet', { required: "Objet requis" })} />
            <Select label="Statut" required options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              {...register('status', { required: true })} />
            <Input label="Durée (minutes)" type="number" min={0} {...register('duration')} />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={4}
              {...register('details')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/calls')}>Annuler</Button>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : "Enregistrer l'appel"}
          </Button>
        </div>
      </form>

      <PhoneLineModal
        open={ligneModalOpen}
        onClose={() => setLigneModalOpen(false)}
        onCreated={(label) => setValue('ligne', label)}
      />
    </PageLayout>
  );
}
