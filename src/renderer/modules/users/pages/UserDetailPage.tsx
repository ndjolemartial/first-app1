import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Modal from '../../../shared/components/ui/Modal';
import Input from '../../../shared/components/ui/Input';
import { useUser, useResetPassword, useToggleUserActive } from '../hooks/useUsers';
import { formatDate, formatDateTime } from '../../../shared/utils/format';
import { Edit, KeyRound, Power } from 'lucide-react';

const ROLE_VARIANT: Record<string, any> = {
  SUPER_ADMIN: 'danger', ADMIN: 'info', MANAGER: 'purple',
  ACCOUNTANT: 'warning', ASSISTANTE_DIRECTION: 'warning',
  AGENT: 'success', READONLY: 'default',
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useUser(Number(id));
  const resetPwd = useResetPassword();
  const toggleActive = useToggleUserActive();
  const [resetOpen, setResetOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ newPassword: string }>();

  const user = res?.data;
  if (isLoading) return <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Utilisateurs', to: '/users' }, { label: '…' }]}><div /></PageLayout>;
  if (!user) return null;

  const handleReset = async ({ newPassword }: { newPassword: string }) => {
    const res = await resetPwd.mutateAsync({ id: Number(id), newPassword });
    if (res.success) { setResetOpen(false); reset(); }
  };

  return (
    <PageLayout
      title={`${user.lastName} ${user.firstName}`}
      breadcrumbs={[{ label: 'Utilisateurs', to: '/users' }, { label: `${user.lastName} ${user.firstName}` }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Power className="h-4 w-4" />}
            loading={toggleActive.isPending} onClick={() => toggleActive.mutate(user.id)}>
            {user.isActive ? 'Désactiver' : 'Activer'}
          </Button>
          <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setResetOpen(true)}>
            Réinitialiser MDP
          </Button>
          <Button icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/users/${id}/edit`)}>
            Modifier
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{user.lastName} {user.firstName}</h2>
                <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Actif' : 'Inactif'}</Badge>
              </div>
              <p className="text-slate-500 mt-1">{user.email}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Matricule', user.matricule],
                ['Téléphone', user.phone ?? '—'],
                ['Mobile', user.mobile ?? '—'],
                ['Créé le', formatDate(user.createdAt)],
                ['Dernière connexion', formatDateTime(user.lastLoginAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Réinitialiser le mot de passe" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>Annuler</Button>
            <Button form="reset-form" type="submit" loading={resetPwd.isPending}>Réinitialiser</Button>
          </>
        }
      >
        <form id="reset-form" onSubmit={handleSubmit(handleReset)}>
          <Input
            label="Nouveau mot de passe"
            type="password"
            required
            error={errors.newPassword?.message}
            {...register('newPassword', { required: 'Requis', minLength: { value: 6, message: 'Min. 6 caractères' } })}
          />
        </form>
      </Modal>
    </PageLayout>
  );
}
