import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useInvoice, useCreateInvoice } from '../hooks/useAccounting';
import { useClients } from '../../clients/hooks/useClients';
import { useConventions } from '../../conventions/hooks/useConventions';
import { formatPersonName } from '../../../shared/utils/format';
import { Save, Plus, Trash2 } from 'lucide-react';

const itemSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().positive('Quantité invalide'),
  unitPrice: z.coerce.number().positive('Prix requis'),
});

const schema = z.object({
  type: z.enum(['VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'AVANCE', 'CAUTION', 'OTHER']),
  clientId: z.coerce.number().int().optional(),
  conventionId: z.coerce.number().int().optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Au moins une ligne requise'),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'FRAIS_AGENCE', label: 'Frais agence' },
  { value: 'FRAIS_DE_GESTION', label: 'Frais de gestion' },
  { value: 'AVANCE', label: 'Avance' },
  { value: 'CAUTION', label: 'Caution' },
  { value: 'VENTE', label: 'Vente comptant' },
  { value: 'ECHEANCE_VENTE', label: 'Échéance vente' },
  { value: 'OTHER', label: 'Autre' },
];

function toDateInput(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function InvoiceFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useInvoice(isEdit ? Number(id) : 0);
  const create = useCreateInvoice();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: conventionsRes } = useConventions({}, 1, 500);

  const today = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'FRAIS_AGENCE',
      taxRate: 0,
      issueDate: today,
      dueDate: today,
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');
  const watchTaxRate = watch('taxRate');

  const subtotal = watchItems?.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) ?? 0;
  const taxAmount = subtotal * (Number(watchTaxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  const clientOptions = [
    { value: '', label: '— Client (optionnel) —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: formatPersonName(c, ''),
    })),
  ];

  const conventionOptions = [
    { value: '', label: '— Convention (optionnel) —' },
    ...(conventionsRes?.data ?? []).map((cv: any) => {
      const clientName = formatPersonName(cv.client, '');
      return {
        value: String(cv.id),
        label: clientName ? `${cv.reference} — ${clientName}` : cv.reference,
      };
    }),
  ];

  useEffect(() => {
    if (isEdit && res?.data) {
      const inv = res.data;
      reset({
        type: inv.type,
        clientId: inv.clientId ?? undefined,
        conventionId: inv.conventionId ?? undefined,
        taxRate: Number(inv.taxRate),
        issueDate: toDateInput(inv.issueDate),
        dueDate: toDateInput(inv.dueDate),
        notes: inv.notes ?? '',
        items: inv.items?.map((item: any) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })) ?? [{ description: '', quantity: 1, unitPrice: 0 }],
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = {
      ...data,
      issueDate: new Date(data.issueDate).toISOString(),
      dueDate: new Date(data.dueDate).toISOString(),
    };
    if (!payload.clientId) delete payload.clientId;
    if (!payload.conventionId) delete payload.conventionId;

    const r = await create.mutateAsync(payload);
    if (r.success) navigate(`/accounting/invoices/${r.data?.id ?? ''}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier la facture' : 'Nouvelle facture'}
      breadcrumbs={[
        { label: 'Comptabilité', to: '/accounting' },
        { label: 'Factures', to: '/accounting/invoices' },
        { label: isEdit ? 'Modifier' : 'Nouvelle' },
      ]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
        {/* En-tête */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Informations générales</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type de facture *" options={TYPE_OPTIONS} {...register('type')} />
            <Input label="Taux de TVA (%)" type="number" step="0.01" min="0" max="100" {...register('taxRate')} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Date d'émission *" type="date" error={errors.issueDate?.message} {...register('issueDate')} />
            <Input label="Date d'échéance *" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormSearchSelect control={control} name="clientId" label="Client" options={clientOptions} />
            <FormSearchSelect control={control} name="conventionId" label="Convention liée" options={conventionOptions} />
          </div>
        </Card>

        {/* Lignes */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">Lignes de facturation</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
            >
              Ajouter une ligne
            </Button>
          </div>
          {errors.items?.root && (
            <p className="text-xs text-red-500 mb-2">{errors.items.root.message}</p>
          )}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-6">
                  <Input
                    placeholder="Description"
                    error={(errors.items?.[index]?.description as any)?.message}
                    {...register(`items.${index}.description`)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    placeholder="Qté"
                    min="0.01"
                    step="0.01"
                    error={(errors.items?.[index]?.quantity as any)?.message}
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    placeholder="Prix unitaire"
                    min="0"
                    step="100"
                    error={(errors.items?.[index]?.unitPrice as any)?.message}
                    {...register(`items.${index}.unitPrice`)}
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30"
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total HT</span>
              <span className="font-medium">{subtotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>TVA ({Number(watchTaxRate) || 0}%)</span>
              <span className="font-medium">{taxAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-base pt-1 border-t border-slate-100">
              <span>Total TTC</span>
              <span>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Notes</h3>
          <Textarea label="Observations" rows={3} {...register('notes')} />
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/accounting/invoices')}>Annuler</Button>
          <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Enregistrer' : 'Créer la facture'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
