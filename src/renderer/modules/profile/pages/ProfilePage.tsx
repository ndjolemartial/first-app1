import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, KeyRound, Lock, Palette, Check } from 'lucide-react';
import { clsx } from 'clsx';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Card from '../../../shared/components/ui/Card';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';
import { THEME_PREVIEWS, THEME_KEYS, normalizeTheme, applyTheme, type ThemeKey } from '../../../shared/theme/themes';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  login: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  idNumber: z.string().optional(),
  civilite: z.string().optional(),
  statutConjugal: z.string().optional(),
  residence: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(6, 'Min. 6 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

const CIVILITE_OPTIONS = [
  { value: '', label: '— Civilité —' },
  { value: 'MONSIEUR', label: 'Monsieur' },
  { value: 'MADAME', label: 'Madame' },
  { value: 'MADEMOISELLE', label: 'Mademoiselle' },
];

const STATUT_CONJUGAL_OPTIONS = [
  { value: '', label: '— Situation matrimoniale —' },
  { value: 'CELIBATAIRE', label: 'Célibataire' },
  { value: 'MARIEE', label: 'Marié(e)' },
  { value: 'CONCUBINAGE', label: 'Concubinage' },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Comptable',
  ASSISTANTE_DIRECTION: 'Assistante de Direction',
  AGENT: 'Agent',
  READONLY: 'Lecture seule',
};

export default function ProfilePage() {
  const { user, token, updateUser } = useAuthStore();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [savingTheme, setSavingTheme] = useState<ThemeKey | null>(null);
  const currentTheme = normalizeTheme(user?.theme);

  async function handleSelectTheme(key: ThemeKey) {
    if (!token || key === currentTheme) return;
    setSavingTheme(key);
    // Aperçu immédiat : on applique le thème avant la persistance pour le ressenti.
    applyTheme(key);
    try {
      const res = await window.electron.auth.updateTheme(token, key);
      if (res.success && res.data) {
        updateUser(res.data);
        toast.success('Thème appliqué');
      } else {
        // En cas d'échec, on restaure le thème précédent.
        applyTheme(currentTheme);
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur de mise à jour du thème');
      }
    } finally {
      setSavingTheme(null);
    }
  }

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '', login: '', phone: '', mobile: '',
      idNumber: '', civilite: '', statutConjugal: '', residence: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      login: user.login ?? '',
      phone: user.phone ?? '',
      mobile: user.mobile ?? '',
      idNumber: user.idNumber ?? '',
      civilite: user.civilite ?? '',
      statutConjugal: user.statutConjugal ?? '',
      residence: user.residence ?? '',
    });
  }, [user, profileForm]);

  const onSubmitProfile = async (data: ProfileFormData) => {
    if (!token) return;
    const payload: Record<string, unknown> = { ...data };
    // Les énumérations vides ne doivent pas transiter (valeurs invalides côté Zod main).
    if (!payload.civilite) delete payload.civilite;
    if (!payload.statutConjugal) delete payload.statutConjugal;
    if (!payload.login) delete payload.login;

    setSavingProfile(true);
    try {
      const res = await window.electron.auth.updateProfile(token, payload);
      if (res.success && res.data) {
        updateUser(res.data);
        toast.success('Profil mis à jour');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur de mise à jour');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const onSubmitPassword = async (data: PasswordFormData) => {
    if (!token) return;
    setChangingPwd(true);
    try {
      const res = await window.electron.auth.changePassword(token, data.currentPassword, data.newPassword);
      if (res.success) {
        toast.success('Mot de passe modifié');
        passwordForm.reset();
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur de changement de mot de passe');
      }
    } finally {
      setChangingPwd(false);
    }
  };

  if (!user) return null;

  return (
    <PageLayout
      title="Mon profil"
      breadcrumbs={[{ label: 'Mon profil' }]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Informations verrouillées — gérées par les administrateurs */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">
              Informations administratives (lecture seule)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Ces champs ne peuvent être modifiés que par un administrateur depuis le module Utilisateurs.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Matricule" value={user.matricule ?? ''} readOnly disabled />
            <Input label="Rôle" value={ROLE_LABELS[user.role] ?? user.role} readOnly disabled />
            <Input label="Fonction" value={user.fonction ?? ''} readOnly disabled />
            <Input label="Numéro CNPS" value={user.cnpsNumber ?? ''} readOnly disabled />
            <Input
              label="Date d'embauche"
              value={user.hireDate ? String(user.hireDate).slice(0, 10) : ''}
              readOnly
              disabled
            />
          </div>
        </Card>

        {/* Informations personnelles modifiables */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Mes informations personnelles</h2>
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Civilité" options={CIVILITE_OPTIONS} {...profileForm.register('civilite')} />
              <Select
                label="Situation matrimoniale"
                options={STATUT_CONJUGAL_OPTIONS}
                {...profileForm.register('statutConjugal')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Prénom"
                required
                error={profileForm.formState.errors.firstName?.message}
                {...profileForm.register('firstName')}
              />
              <Input
                label="Nom"
                required
                error={profileForm.formState.errors.lastName?.message}
                {...profileForm.register('lastName')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                required
                error={profileForm.formState.errors.email?.message}
                {...profileForm.register('email')}
              />
              <Input
                label="Login"
                placeholder="Identifiant de connexion"
                error={profileForm.formState.errors.login?.message}
                {...profileForm.register('login')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Téléphone 1" {...profileForm.register('phone')} />
              <Input label="Téléphone 2" {...profileForm.register('mobile')} />
            </div>
            <Input label="Numéro de pièce d'identité" {...profileForm.register('idNumber')} />
            <Input
              label="Lieu d'habitation"
              placeholder="Quartier, commune, ville…"
              {...profileForm.register('residence')}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={savingProfile || profileForm.formState.isSubmitting}
                icon={<Save className="h-4 w-4" />}
              >
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>

        {/* Apparence : thème graphique */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Apparence</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Choisissez le thème graphique appliqué à votre interface et à vos impressions.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {THEME_KEYS.map((key) => {
              const t = THEME_PREVIEWS[key];
              const isActive = currentTheme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectTheme(key)}
                  disabled={!!savingTheme}
                  className={clsx(
                    'relative text-left rounded-lg border-2 p-3 transition-all',
                    isActive
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-slate-300',
                    savingTheme && savingTheme !== key && 'opacity-60',
                  )}
                >
                  {/* Aperçu visuel : mini-cadre simulant la fenêtre */}
                  <div
                    className="h-20 rounded mb-3 overflow-hidden border border-slate-200 flex"
                    style={{ background: t.background }}
                  >
                    <div className="w-1/4" style={{ background: t.primary }} />
                    <div className="flex-1 p-2 flex flex-col gap-1">
                      <div className="h-1.5 rounded" style={{ background: t.accent, width: '70%' }} />
                      <div className="h-1.5 rounded" style={{ background: t.text, opacity: 0.4, width: '90%' }} />
                      <div className="h-1.5 rounded" style={{ background: t.text, opacity: 0.4, width: '60%' }} />
                      <div className="mt-auto h-3 w-12 rounded" style={{ background: t.accent }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'inherit' }}>{t.label}</p>
                    {isActive && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t.hint}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Changement de mot de passe */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Changer mon mot de passe</h2>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-4">
            <Input
              label="Mot de passe actuel"
              type="password"
              required
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nouveau mot de passe"
                type="password"
                required
                error={passwordForm.formState.errors.newPassword?.message}
                {...passwordForm.register('newPassword')}
              />
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                required
                error={passwordForm.formState.errors.confirmPassword?.message}
                {...passwordForm.register('confirmPassword')}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={changingPwd || passwordForm.formState.isSubmitting}
                icon={<KeyRound className="h-4 w-4" />}
              >
                Modifier le mot de passe
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
