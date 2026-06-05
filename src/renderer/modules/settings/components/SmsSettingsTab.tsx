import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Send } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { useSmsSettings, useUpdateSms, useTestSms, useTestWhatsapp } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';

const SECRET_MASK = '••••••••';

const PROVIDER_OPTIONS = [
  { value: '',       label: '— Aucun fournisseur —' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'ovh',    label: 'OVH SMS' },
  { value: 'brevo',  label: 'Brevo (ex Sendinblue)' },
  { value: 'orange', label: 'Orange Côte d\'Ivoire' },
  { value: 'mtn',    label: 'MTN Côte d\'Ivoire (SMS PRO)' },
];

interface FormData {
  provider:    string;
  accountSid:  string;
  authToken:   string;
  from:        string;
  apiLogin:    string;
  apiPassword: string;
  whatsappEnabled:        boolean;
  whatsappProvider:       'twilio' | 'infobip';
  whatsappFrom:           string;
  whatsappInfobipBaseUrl: string;
  whatsappInfobipApiKey:  string;
  whatsappInfobipFrom:    string;
}

const WHATSAPP_PROVIDER_OPTIONS = [
  { value: 'twilio',  label: 'Twilio' },
  { value: 'infobip', label: 'Infobip' },
];

export default function SmsSettingsTab() {
  const { data: res, isLoading } = useSmsSettings();
  const update = useUpdateSms();
  const testSms = useTestSms();
  const testWhatsapp = useTestWhatsapp();
  const userPhone = useAuthStore((s) => s.user?.mobile ?? s.user?.phone ?? '');
  const [testTo, setTestTo] = useState('');
  const [testWaTo, setTestWaTo] = useState('');

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: {
      provider: '', accountSid: '', authToken: '', from: '', apiLogin: '', apiPassword: '',
      whatsappEnabled: false, whatsappProvider: 'twilio', whatsappFrom: '',
      whatsappInfobipBaseUrl: '', whatsappInfobipApiKey: '', whatsappInfobipFrom: '',
    },
  });

  const provider = watch('provider');
  const whatsappEnabled  = watch('whatsappEnabled');
  const whatsappProvider = watch('whatsappProvider');

  useEffect(() => {
    if (res?.success && res.data) {
      reset({
        provider:    res.data.provider ?? '',
        accountSid:  res.data.accountSid ?? '',
        authToken:   res.data.authTokenSet ? SECRET_MASK : '',
        from:        res.data.from ?? '',
        apiLogin:    res.data.apiLogin ?? '',
        apiPassword: res.data.apiPasswordSet ? SECRET_MASK : '',
        whatsappEnabled:        res.data.whatsappEnabled ?? false,
        whatsappProvider:       res.data.whatsappProvider ?? 'twilio',
        whatsappFrom:           res.data.whatsappFrom ?? '',
        whatsappInfobipBaseUrl: res.data.whatsappInfobipBaseUrl ?? '',
        whatsappInfobipApiKey:  res.data.whatsappInfobipApiKeySet ? SECRET_MASK : '',
        whatsappInfobipFrom:    res.data.whatsappInfobipFrom ?? '',
      });
    }
    if (userPhone) { setTestTo(userPhone); setTestWaTo(userPhone); }
  }, [res, reset, userPhone]);

  const onSubmit = handleSubmit((data) => update.mutate({
    provider:    data.provider,
    accountSid:  data.accountSid,
    authToken:   data.authToken === SECRET_MASK ? undefined : data.authToken,
    from:        data.from,
    apiLogin:    data.apiLogin,
    apiPassword: data.apiPassword === SECRET_MASK ? undefined : data.apiPassword,
    whatsappEnabled:        data.whatsappEnabled,
    whatsappProvider:       data.whatsappProvider,
    whatsappFrom:           data.whatsappFrom,
    whatsappInfobipBaseUrl: data.whatsappInfobipBaseUrl,
    whatsappInfobipApiKey:  data.whatsappInfobipApiKey === SECRET_MASK ? undefined : data.whatsappInfobipApiKey,
    whatsappInfobipFrom:    data.whatsappInfobipFrom,
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

          {provider === 'orange' && (
            <>
              <Input label="Client ID Orange" placeholder="client_id fourni par developer.orange.com" {...register('apiLogin')} />
              <Input label="Client Secret Orange" type="password" placeholder={SECRET_MASK} {...register('apiPassword')} />
              <Input label="Numéro émetteur (From)" placeholder="+2250101020304" {...register('from')} />
              <p className="text-xs text-slate-400">
                Authentification OAuth2 (client_credentials) — le token est mis en cache. Le numéro émetteur doit être celui que vous avez acheté/déclaré sur le portail Orange Developer.
              </p>
            </>
          )}

          {provider === 'mtn' && (
            <>
              <Input label="Identifiant SMS PRO" placeholder="login fourni par MTN CI" {...register('apiLogin')} />
              <Input label="Mot de passe SMS PRO" type="password" placeholder={SECRET_MASK} {...register('apiPassword')} />
              <Input label="Nom émetteur (Sender ID)" placeholder="Afrikimmo" {...register('from')} />
              <p className="text-xs text-slate-400">
                Authentification Basic (login : mot de passe du portail MTN SMS PRO). Le « Sender ID » doit avoir été validé par MTN avant utilisation en production.
              </p>
            </>
          )}

          {!provider && (
            <p className="text-sm text-slate-500">
              Choisissez un fournisseur pour saisir les paramètres correspondants.
            </p>
          )}

          {/* ── Section WhatsApp (Twilio ou Infobip) ──────────────────────── */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="whatsappEnabled"
                {...register('whatsappEnabled')}
                className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="whatsappEnabled" className="text-sm text-slate-700">
                <span className="font-medium">Activer WhatsApp Business</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choisissez votre fournisseur ci-dessous : Twilio (réutilise l'Account SID + Auth Token Twilio configurés au-dessus) ou Infobip (credentials dédiés).
                </p>
              </label>
            </div>
            {whatsappEnabled && (
              <div className="mt-3 space-y-3">
                <Select
                  label="Fournisseur WhatsApp"
                  options={WHATSAPP_PROVIDER_OPTIONS}
                  {...register('whatsappProvider')}
                />

                {whatsappProvider === 'twilio' && (
                  <>
                    <Input
                      label="Numéro émetteur WhatsApp (From)"
                      placeholder="whatsapp:+14155238886 ou +14155238886"
                      {...register('whatsappFrom')}
                    />
                    <p className="text-xs text-slate-400">
                      Sandbox Twilio en développement, numéro Business approuvé en production. Le préfixe <code>whatsapp:</code> est ajouté automatiquement si absent.
                    </p>
                  </>
                )}

                {whatsappProvider === 'infobip' && (
                  <>
                    <Input
                      label="Base URL Infobip"
                      placeholder="xxxxx.api.infobip.com"
                      {...register('whatsappInfobipBaseUrl')}
                    />
                    <Input
                      label="API Key Infobip"
                      type="password"
                      placeholder={SECRET_MASK}
                      {...register('whatsappInfobipApiKey')}
                    />
                    <Input
                      label="Numéro émetteur WhatsApp (From)"
                      placeholder="+2250101020304"
                      {...register('whatsappInfobipFrom')}
                    />
                    <p className="text-xs text-slate-400">
                      Le sous-domaine et la clé API se trouvent dans le portail Infobip. Le sender doit être un numéro WhatsApp Business approuvé et enregistré dans votre compte Infobip.
                    </p>
                  </>
                )}
              </div>
            )}
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

      {whatsappEnabled && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Tester l'envoi WhatsApp</h3>
          <p className="text-sm text-slate-500 mb-3">
            Envoie un message WhatsApp de test. En sandbox Twilio, le destinataire doit avoir au préalable rejoint la sandbox via le code dédié.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Numéro destinataire"
                placeholder="+225xxxxxxxxxx"
                value={testWaTo}
                onChange={(e) => setTestWaTo(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              icon={<Send className="h-4 w-4" />}
              loading={testWhatsapp.isPending}
              onClick={() => testWaTo && testWhatsapp.mutate(testWaTo)}
              disabled={!testWaTo}
            >
              Envoyer un WhatsApp de test
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
