import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Card from '../../../shared/components/ui/Card';
import { useUser, useCreateUser, useUpdateUser } from '../hooks/useUsers';
import { Save } from 'lucide-react';

const schema = z.object({
  matricule: z.string().min(1, 'Matricule requis'),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Min. 6 caractères').optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY']),
  phone: z.string().optional(),
  mobile: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'ACCOUNTANT', label: 'Comptable' },
  { value: 'READONLY', label: 'Lecture seule' },
];

export default function UserFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: userRes } = useUser(isEdit ? Number(id) : 0);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'AGENT' },
  });

  useEffect(() => {
    if (isEdit && userRes?.data) {
      const u = userRes.data;
      reset({ ...u, password: '' });
    }
  }, [userRes, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = { ...data };
    if (!payload.password) delete (payload as any).password;

    let res;
    if (isEdit) {
      res = await updateUser.mutateAsync({ id: Number(id), payload });
    } else {
      if (!payload.password) return;
      res = await createUser.mutateAsync(payload);
    }
    if (res.success) navigate('/users');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}
      breadcrumbs={[
        { label: 'Utilisateurs', to: '/users' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom" required error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Nom" required error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Matricule" required error={errors.matricule?.message} {...register('matricule')} />
            <Select label="Rôle" required options={ROLE_OPTIONS} {...register('role')} />
          </div>
          <Input label="Email" type="email" required error={errors.email?.message} {...register('email')} />
          <Input
            label={isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
            type="password"
            required={!isEdit}
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Téléphone" error={errors.phone?.message} {...register('phone')} />
            <Input label="Mobile" error={errors.mobile?.message} {...register('mobile')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/users')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
