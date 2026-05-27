import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useProspect, useCreateProspect, useUpdateProspect } from '../hooks/useProspects';
import { Save } from 'lucide-react';

// ── Schéma de validation du formulaire ────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName:  z.string().min(1, 'Nom requis'),
  email:     z.string().email('Email invalide').optional().or(z.literal('')),
  phone:     z.string().optional(),
  mobile:    z.string().optional(),
  source:    z.string().optional(),
  status:    z.string().optional(),
  budget:    z.number().positive('Budget invalide').optional(),
  notes:     z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Options de sélection ───────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: 'PROSPECTION',        label: 'Prospection' },
  { value: 'SITE_WEB_AFRIKIMMO', label: 'Site web Afrikimmo' },
  { value: 'RECOMMENDATION',     label: 'Recommandation' },
  { value: 'TELEPHONE',          label: 'Téléphone' },
  { value: 'RESEAUX_SOCIAUX',    label: 'Réseaux sociaux' },
  { value: 'EMAIL',              label: 'Email' },
  { value: 'CONTACT_PERSONNEL',  label: 'Contact personnel' },
  { value: 'AUTRE',              label: 'Autre' },
];

const STATUS_OPTIONS = [
  { value: 'NOUVEAU',              label: 'Nouveau' },
  { value: 'CONTACTE',             label: 'Contacté' },
  { value: 'QUALIFIE',             label: 'Qualifié' },
  { value: 'ENVOI_PROPOSITION',    label: 'Proposition envoyée' },
  { value: 'NEGOCIATION_EN_COURS', label: 'Négociation en cours' },
  { value: 'PERDU',                label: 'Perdu' },
];

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ProspectFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit  = !!id;
  const navigate = useNavigate();

  const { data: res }  = useProspect(isEdit ? Number(id) : 0);
  const create = useCreateProspect();
  const update = useUpdateProspect();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      source: 'PROSPECTION',
      status: 'NOUVEAU',
    },
  });

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (isEdit && res?.data) {
      const p = res.data;
      reset({
        firstName: p.firstName   ?? '',
        lastName:  p.lastName    ?? '',
        email:     p.email       ?? '',
        phone:     p.phone       ?? '',
        mobile:    p.mobile      ?? '',
        source:    p.source      ?? 'PROSPECTION',
        status:    p.status      ?? 'NOUVEAU',
        budget:    p.budget      ? Number(p.budget) : undefined,
        notes:     p.notes       ?? '',
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    // Nettoyer les champs vides avant envoi
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== '' && value !== undefined && value !== null) {
        payload[key] = value;
      }
    }

    let result: any;
    if (isEdit) {
      result = await update.mutateAsync({ id: Number(id), payload });
    } else {
      result = await create.mutateAsync(payload);
    }

    if (result?.success) navigate('/prospects');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le prospect' : 'Nouveau prospect'}
      breadcrumbs={[
        { label: 'Prospects', to: '/prospects' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Identité */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nom"
              required
              error={errors.lastName?.message}
              {...register('lastName')}
            />
            <Input
              label="Prénom"
              required
              error={errors.firstName?.message}
              {...register('firstName')}
            />
          </div>

          {/* Contact */}
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Téléphone 1" {...register('phone')} />
            <Input label="Téléphone 2" {...register('mobile')} />
          </div>

          {/* Pipeline */}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Source"  options={SOURCE_OPTIONS} {...register('source')} />
            <Select label="Statut"  options={STATUS_OPTIONS} {...register('status')} />
          </div>

          {/* Budget */}
          <Input
            label="Budget (FCFA)"
            type="number"
            placeholder="ex : 25 000 000"
            error={errors.budget?.message}
            {...register('budget', {
              setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
            })}
          />

          {/* Notes */}
          <Textarea label="Notes" rows={4} {...register('notes')} />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => navigate('/prospects')}>
              Annuler
            </Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer les modifications' : 'Créer le prospect'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
