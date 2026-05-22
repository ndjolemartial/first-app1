import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Send } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { useEmailSettings, useUpdateEmail, useTestEmail } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';

const SECRET_MASK = '••••••••';

interface FormData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

export default function EmailSettingsTab() {
  const { data: res, isLoading } = useEmailSettings();
  const update = useUpdateEmail();
  const testEmail = useTestEmail();
  const userEmail = useAuthStore((s) => s.user?.email) ?? '';
  const [testTo, setTestTo] = useState('');

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { host: '', port: 587, secure: false, user: '', password: '', fromAddress: '', fromName: '' },
  });

  useEffect(() => {
    if (res?.success && res.data) {
      reset({
        host:        res.data.host ?? '',
        port:        res.data.port ?? 587,
        secure:      !!res.data.secure,
        user:        res.data.user ?? '',
        password:    res.data.passwordSet ? SECRET_MASK : '',
        fromAddress: res.data.fromAddress ?? '',
        fromName:    res.data.fromName ?? '',
      });
    }
    if (userEmail) setTestTo(userEmail);
  }, [res, reset, userEmail]);

  const onSubmit = handleSubmit((data) => update.mutate({
    host:        data.host,
    port:        Number(data.port),
    secure:      Boolean(data.secure),
    user:        data.user,
    password:    data.password === SECRET_MASK ? undefined : data.password,
    fromAddress: data.fromAddress,
    fromName:    data.fromName,
  }));

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">Paramètres SMTP</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input label="Serveur SMTP" placeholder="smtp.exemple.com" {...register('host')} />
            </div>
            <Input label="Port" type="number" min="1" max="65535" {...register('port', { valueAsNumber: true })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('secure')} className="h-4 w-4 rounded border-slate-300" />
            Connexion sécurisée (SSL/TLS, port 465)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Utilisateur" {...register('user')} />
            <Input label="Mot de passe" type="password" placeholder={SECRET_MASK} {...register('password')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Adresse d'envoi (From)" placeholder="noreply@exemple.com" {...register('fromAddress')} />
            <Input label="Nom d'envoi (From)" placeholder="Afrikimmo" {...register('fromName')} />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSubmitting || update.isPending} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">Tester l'envoi</h3>
        <p className="text-sm text-slate-500 mb-3">
          Envoie un email de test pour vérifier la configuration. Enregistrez vos modifications avant de tester.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input label="Adresse destinataire" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            icon={<Send className="h-4 w-4" />}
            loading={testEmail.isPending}
            onClick={() => testTo && testEmail.mutate(testTo)}
            disabled={!testTo}
          >
            Envoyer un email de test
          </Button>
        </div>
      </Card>
    </div>
  );
}
