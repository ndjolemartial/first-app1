import { useEffect, useState } from 'react';
import { Save, PlugZap, Loader2 } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { toast } from '../../../shared/components/ui/Toast';

export interface DbForm {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

const EMPTY: DbForm = { host: '', port: '3306', database: '', user: '', password: '' };

interface Props {
  /** Appelé après un enregistrement réussi (ex. navigation vers /login). */
  onSaved?: () => void;
  /** Affiche le chemin du fichier de configuration sous le formulaire. */
  showEnvFile?: boolean;
}

/**
 * Formulaire de configuration de la connexion BDD, réutilisé par l'écran
 * pré-login (`DbConnectionPage`) et par l'onglet Paramètres (`DatabaseSettingsTab`).
 * Lit / teste / enregistre la config via les handlers `config:*` (sans jeton).
 */
export default function DbConnectionForm({ onSaved, showEnvFile = true }: Props) {
  const [form, setForm] = useState<DbForm>(EMPTY);
  const [envFile, setEnvFile] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.electron.config
      .getDb()
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) {
          setForm({
            host: r.data.host || '',
            port: r.data.port || '3306',
            database: r.data.database || '',
            user: r.data.user || '',
            password: r.data.password || '',
          });
          setEnvFile(r.data.envFile || '');
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof DbForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = !!(form.host.trim() && form.database.trim() && form.user.trim());

  const handleTest = async () => {
    if (!valid) {
      toast.error('Hôte, base et utilisateur sont requis.');
      return;
    }
    setTesting(true);
    try {
      const r = await window.electron.config.testDb(form);
      if (r.success) toast.success('Connexion réussie ✓');
      else toast.error(`Échec : ${typeof r.error === 'string' ? r.error : 'connexion impossible'}`);
    } catch {
      toast.error('Échec du test de connexion.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!valid) {
      toast.error('Hôte, base et utilisateur sont requis.');
      return;
    }
    setSaving(true);
    try {
      const r = await window.electron.config.saveDb(form);
      if (r.success) {
        toast.success('Configuration enregistrée. Reconnexion effectuée.');
        onSaved?.();
      } else {
        toast.error(`Échec : ${typeof r.error === 'string' ? r.error : "impossible d'enregistrer"}`);
      }
    } catch {
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Hôte" placeholder="192.168.1.200 ou localhost" value={form.host} onChange={set('host')} />
        </div>
        <Input label="Port" placeholder="3306" value={form.port} onChange={set('port')} />
      </div>
      <Input label="Base de données" placeholder="afrikimmo_app" value={form.database} onChange={set('database')} />
      <Input label="Utilisateur" placeholder="afrikimmo_admin" value={form.user} onChange={set('user')} />
      <Input label="Mot de passe" type="password" value={form.password} onChange={set('password')} />

      <div className="flex gap-2 pt-1">
        <Button
          variant="secondary"
          className="flex-1"
          icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          disabled={testing || saving}
          onClick={handleTest}
        >
          Tester la connexion
        </Button>
        <Button
          className="flex-1"
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          disabled={testing || saving}
          onClick={handleSave}
        >
          Enregistrer
        </Button>
      </div>

      {showEnvFile && envFile && (
        <p className="break-all pt-1 text-xs text-slate-400">
          Fichier de configuration : <span className="font-mono">{envFile}</span>
        </p>
      )}
    </div>
  );
}
