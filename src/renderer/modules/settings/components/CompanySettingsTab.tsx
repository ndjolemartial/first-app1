import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Upload, ImagePlus, Trash2 } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useCompanySettings, useUpdateCompany, useUploadLogo, useLogoData, useDeleteLogo,
} from '../hooks/useSettings';
import { useEmployees } from '../../hr/hooks/useHr';

interface FormData {
  name: string;
  denomination: string;
  legalRepEmployeeId: string;
  slogan: string;
  registreCommerce: string;
  compteContribuable: string;
  phoneFixed: string;
  phoneMobile1: string;
  phoneMobile2: string;
  website: string;
  address: string;
  email: string;
}

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_MB = 5;

export default function CompanySettingsTab() {
  const { data: companyRes, isLoading } = useCompanySettings();
  const { data: empRes } = useEmployees({}, 1, 1000);
  const employees: any[] = empRes?.data ?? [];
  const empOptions = [
    { value: '', label: '— Aucun —' },
    ...employees.map((e) => ({
      value: String(e.id),
      label: `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() + (e.matricule ? ` (${e.matricule})` : ''),
    })),
  ];
  const { data: logoRes } = useLogoData();
  const update = useUpdateCompany();
  const uploadLogo = useUploadLogo();
  const deleteLogo = useDeleteLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: '', denomination: '', legalRepEmployeeId: '', slogan: '', registreCommerce: '', compteContribuable: '',
      phoneFixed: '', phoneMobile1: '', phoneMobile2: '', website: '', address: '', email: '',
    },
  });

  useEffect(() => {
    if (companyRes?.success && companyRes.data) {
      reset({
        name:               companyRes.data.name ?? '',
        denomination:       companyRes.data.denomination ?? '',
        legalRepEmployeeId: companyRes.data.legalRepEmployeeId ?? '',
        slogan:             companyRes.data.slogan ?? '',
        registreCommerce:   companyRes.data.registreCommerce ?? '',
        compteContribuable: companyRes.data.compteContribuable ?? '',
        phoneFixed:         companyRes.data.phoneFixed ?? '',
        phoneMobile1:       companyRes.data.phoneMobile1 ?? '',
        phoneMobile2:       companyRes.data.phoneMobile2 ?? '',
        website:            companyRes.data.website ?? '',
        address:            companyRes.data.address ?? '',
        email:              companyRes.data.email ?? '',
      });
    }
  }, [companyRes, reset]);

  const onSubmit = handleSubmit((data) => update.mutate(data));

  const logoSrc = logoRes?.success && logoRes.data
    ? `data:${logoRes.data.mimeType};base64,${logoRes.data.base64}`
    : null;

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Format non accepté (PNG, JPEG, WEBP ou SVG).');
      return;
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setLogoError(`Fichier trop volumineux (max ${MAX_LOGO_MB} Mo).`);
      return;
    }
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await uploadLogo.mutateAsync({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">Logo</h3>
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo entreprise" className="max-h-full max-w-full object-contain" />
            ) : (
              <ImagePlus className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              className="hidden"
              onChange={handleLogoChange}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
                loading={uploadLogo.isPending}
              >
                {logoSrc ? 'Remplacer le logo' : 'Téléverser un logo'}
              </Button>
              {logoSrc && (
                <Button
                  type="button"
                  variant="danger"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setConfirmDelete(true)}
                  loading={deleteLogo.isPending}
                >
                  Supprimer
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">PNG, JPEG, WEBP ou SVG — max {MAX_LOGO_MB} Mo.</p>
            {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-4">Identité</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nom de l'entreprise (Sigle)" {...register('name')} />
                <Input label="Dénomination sociale de l'entreprise" {...register('denomination')} />
              </div>
              <Input label="Slogan" {...register('slogan')} />
              <div>
                <Select
                  label="Représentant légal de l'entreprise"
                  options={empOptions}
                  {...register('legalRepEmployeeId')}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Membre du personnel signataire au nom de l'entreprise (utilisé dans les contrats de travail).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="N° registre de commerce" {...register('registreCommerce')} />
                <Input label="N° compte contribuable" {...register('compteContribuable')} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-700 mb-4">Coordonnées</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Téléphone fixe"
                  type="tel"
                  placeholder="+225 27 …"
                  {...register('phoneFixed')}
                />
                <Input
                  label="Mobile 1"
                  type="tel"
                  placeholder="+225 07 …"
                  {...register('phoneMobile1')}
                />
                <Input
                  label="Mobile 2"
                  type="tel"
                  placeholder="+225 05 …"
                  {...register('phoneMobile2')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Site web"
                  type="url"
                  placeholder="https://www.afrikimmo.ci"
                  helper="URL complète avec https://"
                  {...register('website')}
                />
                <Input
                  label="Adresse mail"
                  type="email"
                  placeholder="contact@afrikimmo.ci"
                  {...register('email')}
                />
              </div>
              <Textarea
                label="Adresse"
                placeholder="Numéro, rue, quartier, commune, ville…"
                rows={3}
                {...register('address')}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button type="submit" loading={isSubmitting || update.isPending} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteLogo.mutateAsync(); setConfirmDelete(false); }}
        loading={deleteLogo.isPending}
        title="Supprimer le logo"
        message="Le logo actuel sera supprimé du serveur. La page de connexion et les autres écrans afficheront l'icône par défaut. Confirmer ?"
        confirmLabel="Supprimer"
      />
    </div>
  );
}
