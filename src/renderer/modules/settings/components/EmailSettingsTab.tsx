import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, Send } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import { useEmailSettings, useUpdateEmail, useTestEmail } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const SECRET_MASK = '••••••••';

interface FormData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
  signature: string;
}

export default function EmailSettingsTab() {
  const { data: res, isLoading } = useEmailSettings();
  const update = useUpdateEmail();
  const testEmail = useTestEmail();
  const userEmail = useAuthStore((s) => s.user?.email) ?? '';
  const [testTo, setTestTo] = useState('');

  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { host: '', port: 587, secure: false, user: '', password: '', fromAddress: '', fromName: '', signature: '' },
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
        signature:   res.data.signature ?? '',
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
    signature:   data.signature,
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

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Signature email</label>
            <p className="text-xs text-slate-500 mb-2">
              Bloc HTML inséré dans les emails via la variable <code className="px-1 py-0.5 bg-slate-100 rounded font-mono">{'{{signature}}'}</code>.
              Logo, coordonnées, mentions légales… tout y est admis.
            </p>
            <Controller
              control={control}
              name="signature"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  minHeight={220}
                />
              )}
            />
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

      <EmailTrackingCard />
    </div>
  );
}

/**
 * Configuration du suivi d'ouverture des emails. L'application injecte dans le
 * corps HTML de chaque email un pixel 1×1 pointant vers `track.php` (déposé avec
 * l'app web sur le serveur local). Quand le destinataire ouvre le message, le
 * chargement du pixel horodate l'ouverture (`Communication.openedAt`), visible
 * dans l'aperçu du message.
 */
function EmailTrackingCard() {
  const token = useAuthStore((s) => s.token)!;
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    window.electron.communication.getTracking(token).then((r) => {
      if (alive && r.success) setBaseUrl(r.data?.baseUrl ?? '');
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [token]);

  const save = async () => {
    setSaving(true);
    const r = await window.electron.communication.updateTracking(token, baseUrl.trim());
    setSaving(false);
    if (r.success) toast.success('URL de suivi enregistrée');
    else toast.error(typeof r.error === 'string' ? r.error : "Échec de l'enregistrement");
  };

  return (
    <Card>
      <h3 className="font-semibold text-slate-700 mb-2">Suivi d'ouverture des emails</h3>
      <p className="text-sm text-slate-500 mb-3">
        URL du script <code className="px-1 py-0.5 bg-slate-100 rounded font-mono">track.php</code> déposé
        avec l'application web sur le serveur local (ex.{' '}
        <code className="px-1 py-0.5 bg-slate-100 rounded font-mono">http://192.168.1.10/pointage/track.php</code>).
        Laissez vide pour désactiver le suivi. Un pixel invisible est alors ajouté à chaque email pour
        détecter sa remise et son ouverture.
      </p>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label="URL de suivi d'ouverture"
            placeholder="http://serveur/pointage/track.php"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button icon={<Save className="h-4 w-4" />} loading={saving} onClick={save} disabled={loading}>
          Enregistrer
        </Button>
      </div>
    </Card>
  );
}
