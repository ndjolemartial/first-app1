import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Send } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { useSmsSettings, useUpdateSms, useTestSms } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';

const SECRET_MASK = '••••••••';

const PROVIDER_OPTIONS = [
  { value: '',       label: '— Aucun fournisseur —' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'ovh',    label: 'OVH SMS' },
  { value: 'brevo',  label: 'Brevo (ex Sendinblue)' },
];

interface FormData {
  provider:    string;
  accountSid:  string;
  authToken:   string;
  from:        string;
  apiLogin:    string;
  apiPassword: string;
}

export default function SmsSettingsTab() {
  const { data: res, isLoading } = useSmsSettings();
  const update = useUpdateSms();
  const testSms = useTestSms();
  const userPhone = useAuthStore((s) => s.user?.mobile ?? s.user?.phone ?? '');
  const [testTo, setTestTo] = useState('');

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { provider: '', accountSid: '', authToken: '', from: '', apiLogin: '', apiPassword: '' },
  });

  const provider = watch('provider');

  useEffect(() => {
    if (res?.success && res.data) {
      reset({
        provider:    res.data.provider ?? '',
        accountSid:  res.data.accountSid ?? '',
        authToken:   res.data.authTokenSet ? SECRET_MASK : '',
        from:        res.data.from ?? '',
        apiLogin:    res.data.apiLogin ?? '',
        apiPassword: res.data.apiPasswordSet ? SECRET_MASK : '',
      });
    }
    if (userPhone) setTestTo(userPhone);
  }, [res, reset, userPhone]);

  const onSubmit = handleSubmit((data) => update.mutate({
    provider:    data.provider,
    accountSid:  data.accountSid,
    authToken:   data.authToken === SECRET_MASK ? undefined : data.authToken,
    from:        data.from,
    apiLogin:    data.apiLogin,
    apiPassword: data.apiPassword === SECRET_MASK ? undefined : data.apiPassword,
  }));

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">Paramètres SMS</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <Select label="Fournisseur" options={PROVIDER_OPTIONS} {...register('provider')} />

          {provider === 'twilio' && (
            <>
              <Input label="Account SID" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...register('accountSid')} />
              <Input label="Auth Token" type="password" placeholder={SECRET_MASK} {...register('authToken')} />
              <Input label="Numéro émetteur (From)" placeholder="+33xxxxxxxxx" {...register('from')} />
            </>
          )}

          {provider === 'ovh' && (
            <>
              <Input label="Login OVH SMS" {...register('apiLogin')} />
              <Input label="Mot de passe OVH SMS" type="password" placeholder={SECRET_MASK} {...register('apiPassword')} />
              <Input label="Nom émetteur (From)" placeholder="Afrikimmo" {...register('from')} />
            </>
          )}

          {provider === 'brevo' && (
            <>
              <Input label="Clé API Brevo" {...register('apiLogin')} />
              <Input label="Nom émetteur (From)" placeholder="Afrikimmo" {...register('from')} />
            </>
          )}

          {!provider && (
            <p className="text-sm text-slate-500">
              Choisissez un fournisseur pour saisir les paramètres correspondants.
            </p>
          )}

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
          Envoie un SMS de test au numéro indiqué. Enregistrez vos modifications avant de tester.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input label="Numéro destinataire" placeholder="+225xxxxxxxxxx" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            icon={<Send className="h-4 w-4" />}
            loading={testSms.isPending}
            onClick={() => testTo && testSms.mutate(testTo)}
            disabled={!testTo || !provider}
          >
            Envoyer un SMS de test
          </Button>
        </div>
      </Card>
    </div>
  );
}
