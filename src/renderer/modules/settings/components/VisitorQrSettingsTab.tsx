import { useEffect, useState } from 'react';
import { Save, QrCode } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import QrCodeBox, { QR_MODELS } from '../../../shared/components/QrCodeBox';
import { useVisitorQrSettings, useUpdateVisitorQr } from '../hooks/useSettings';

/** Normalise l'adresse en URL complète (ajoute http:// si le schéma est absent). */
function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try { return new URL(s).toString(); } catch { return s; }
}

const isLoopback = (url: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

/** Vrai si l'hôte de l'URL est une adresse IPv4 nue (sans nom d'hôte). */
const isBareIpUrl = (url: string): boolean => {
  try { return /^\d{1,3}(\.\d{1,3}){3}$/.test(new URL(url).hostname); }
  catch { return false; }
};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SUPER_ADMIN',          label: 'Super administrateur' },
  { value: 'ADMIN',                label: 'Administrateur' },
  { value: 'MANAGER',              label: 'Manager' },
  { value: 'ACCOUNTANT',           label: 'Comptable' },
  { value: 'ASSISTANTE_DIRECTION', label: 'Assistante de direction' },
  { value: 'RH',                   label: 'Ressources humaines' },
  { value: 'AGENT_TECHNIQUE',      label: 'Agent Technique' },
  { value: 'AGENT',                label: 'Agent' },
  { value: 'READONLY',             label: 'WELCOME' },
];

export default function VisitorQrSettingsTab() {
  const { data: res, isLoading } = useVisitorQrSettings();
  const update = useUpdateVisitorQr();

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [model, setModel] = useState('1');
  const [localIps, setLocalIps] = useState<string[]>([]);

  useEffect(() => {
    if (res?.success && res.data) {
      const d = res.data;
      setEnabled(d.enabled);
      setBaseUrl(d.baseUrl);
      setAllowedRoles(d.allowedRoles ?? []);
      setModel(d.model ?? '1');
      setLocalIps(d.localIps ?? []);
    }
  }, [res]);

  const toggleRole = (role: string) =>
    setAllowedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const visitorUrl = normalizeBaseUrl(baseUrl);
  const previewUrl = visitorUrl || 'http://exemple.local/visiteurs/';

  const save = () => {
    if (visitorUrl !== baseUrl) setBaseUrl(visitorUrl);
    update.mutate({ enabled, baseUrl: visitorUrl, allowedRoles, model });
  };

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-700">QR Code Visiteurs</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Le formulaire visiteur est servi par une <strong>application web autonome</strong> (dossier <code>web-visiteurs/</code>)
          à déposer sur le serveur web local. Les visiteurs scannent le QR Code et renseignent directement leurs informations
          (sans connexion). Indiquez ci-dessous l'URL où le dossier est déployé.
        </p>

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-700">Activer le QR Visiteurs (afficher au tableau de bord)</span>
        </label>

        <Input
          label="Adresse de l'application web visiteurs (URL encodée dans le QR)"
          placeholder="http://192.168.1.10/visiteurs/"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />

        {enabled && !visitorUrl && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Le QR Visiteurs est activé mais <strong>aucune adresse n'est renseignée</strong> : aucun QR n'est généré
            (ni dans l'aperçu, ni sur le tableau de bord). Saisissez l'URL de l'application web déployée ci-dessus.
          </p>
        )}
        {visitorUrl && (
          <p className="mt-2 text-xs text-slate-500">
            URL encodée dans le QR : <span className="font-mono text-slate-700">{visitorUrl}</span>
          </p>
        )}
        {visitorUrl && isLoopback(visitorUrl) && (
          <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ <strong>localhost / 127.0.0.1</strong> ne fonctionne que sur le poste hébergeant le serveur web.
            Pour un scan depuis un téléphone, utilisez l'adresse réseau du serveur.
          </p>
        )}
        {visitorUrl && isBareIpUrl(visitorUrl) && (
          <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Certains téléphones (Tecno, Infinix…) <strong>n'ouvrent pas les adresses IP</strong> au scan : ils
            affichent « Résultat de recherche » avec un bouton <em>Copier</em> au lieu d'un lien cliquable.
            Pour un lien ouvrable sur tous les téléphones, faites pointer le QR vers un <strong>nom d'hôte</strong>
            (ex. <span className="font-mono">http://visiteurs.lan/visiteurs/</span>) via une entrée DNS locale
            (routeur) ou le fichier <span className="font-mono">hosts</span>, vers {' '}
            <span className="font-mono">{(() => { try { return new URL(visitorUrl).host; } catch { return 'cette adresse'; } })()}</span>.
          </p>
        )}
        {localIps.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Adresses IP détectées :{' '}
            {localIps.map((ip) => (
              <button
                key={ip}
                type="button"
                onClick={() => setBaseUrl(`http://${ip}/visiteurs/`)}
                className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 hover:bg-slate-200"
              >
                {ip}
              </button>
            ))}
          </p>
        )}

        <div className="flex justify-end pt-4">
          <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>Enregistrer</Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Visibilité du QR sur le tableau de bord</h3>
        <p className="mb-4 text-sm text-slate-600">
          Rôles autorisés à voir, télécharger et imprimer le QR Visiteurs depuis leur tableau de bord.
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={allowedRoles.includes(opt.value)}
                onChange={() => toggleRole(opt.value)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
            Enregistrer la visibilité
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 font-semibold text-slate-700">Modèle de QR Code</h3>
        <p className="mb-4 text-sm text-slate-600">Choisissez le style du QR Code (logo de l'entreprise au centre pour les modèles « avec logo »).</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(QR_MODELS).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setModel(key)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
                model === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <QrCodeBox value={previewUrl} model={key} size={120} hideActions caption="VISITEURS" />
              <span className="text-sm font-medium text-slate-700">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
            Enregistrer le modèle
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Aperçu du QR Code</h3>
        <QrCodeBox value={visitorUrl} model={model} downloadName="qr-visiteurs" printTitle="Enregistrement des visiteurs — Afrikimmo" caption="VISITEURS" />
      </Card>
    </div>
  );
}
