import { useEffect, useState } from 'react';
import { Save, QrCode } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import QrCodeBox, { QR_MODELS } from '../../../shared/components/QrCodeBox';
import { useAttendanceQrSettings, useUpdateAttendanceQr } from '../hooks/useSettings';

/** Normalise l'adresse en URL complète (ajoute http:// si le schéma est absent). */
function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    return new URL(s).toString();
  } catch {
    return s;
  }
}

const isLoopback = (url: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'SUPER_ADMIN',          label: 'Super administrateur' },
  { value: 'ADMIN',                label: 'Administrateur' },
  { value: 'MANAGER',              label: 'Manager' },
  { value: 'ACCOUNTANT',           label: 'Comptable' },
  { value: 'ASSISTANTE_DIRECTION', label: 'Assistante de direction' },
  { value: 'RH',                   label: 'Ressources humaines' },
  { value: 'AGENT_TECHNIQUE',      label: 'Agent Technique' },
  { value: 'AGENT',                label: 'Agent' },
  { value: 'READONLY',             label: 'Lecture seule' },
];

export default function AttendanceQrSettingsTab() {
  const { data: res, isLoading } = useAttendanceQrSettings();
  const update = useUpdateAttendanceQr();

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [model, setModel] = useState('1');
  const [expectedArrival, setExpectedArrival] = useState('08:00');
  const [expectedDeparture, setExpectedDeparture] = useState('17:00');
  const [localIps, setLocalIps] = useState<string[]>([]);

  useEffect(() => {
    if (res?.success && res.data) {
      const d = res.data;
      setEnabled(d.enabled);
      setBaseUrl(d.baseUrl);
      setAllowedRoles(d.allowedRoles ?? []);
      setModel(d.model ?? '1');
      setExpectedArrival(d.expectedArrival);
      setExpectedDeparture(d.expectedDeparture);
      setLocalIps(d.localIps ?? []);
    }
  }, [res]);

  const toggleRole = (role: string) =>
    setAllowedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  // URL effective (normalisée) encodée dans le QR.
  const pointageUrl = normalizeBaseUrl(baseUrl);

  const save = () => {
    if (pointageUrl !== baseUrl) setBaseUrl(pointageUrl);
    update.mutate({ enabled, baseUrl: pointageUrl, allowedRoles, model, expectedArrival, expectedDeparture });
  };

  // URL d'exemple pour prévisualiser les modèles même sans URL saisie.
  const previewUrl = pointageUrl || 'http://exemple.local/pointage/';

  if (isLoading) return <Card>Chargement…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-slate-500" />
          <h3 className="font-semibold text-slate-700">Pointage du personnel par QR Code</h3>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Le pointage est servi par une <strong>application web autonome</strong> (dossier <code>web/</code>)
          à déposer sur le serveur web local de l'entreprise (Apache / XAMPP / WAMP).
          Les employés scannent le QR Code, s'authentifient avec leur compte, puis pointent leur arrivée
          ou leur départ — <strong>même si l'application de bureau n'est pas lancée</strong>.
          Indiquez ci-dessous l'URL où le dossier est déployé.
        </p>

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-700">Activer le pointage QR (afficher le QR au tableau de bord)</span>
        </label>

        <Input
          label="Adresse de l'application web de pointage (URL encodée dans le QR)"
          placeholder="http://192.168.1.10/pointage/"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />

        {enabled && !pointageUrl && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Le pointage QR est activé mais <strong>aucune adresse n'est renseignée</strong> : aucun QR n'est généré
            (ni dans l'aperçu, ni sur le tableau de bord). Saisissez l'URL de l'application web déployée ci-dessus.
          </p>
        )}
        {pointageUrl && (
          <p className="mt-2 text-xs text-slate-500">
            URL encodée dans le QR : <span className="font-mono text-slate-700">{pointageUrl}</span>
          </p>
        )}
        {pointageUrl && isLoopback(pointageUrl) && (
          <p className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ <strong>localhost / 127.0.0.1</strong> ne fonctionne que sur le poste qui héberge le serveur web.
            Pour un scan depuis un téléphone, utilisez l'adresse réseau du serveur.
          </p>
        )}

        {localIps.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Adresses IP détectées sur ce poste :{' '}
            {localIps.map((ip) => (
              <button
                key={ip}
                type="button"
                onClick={() => setBaseUrl(`http://${ip}/pointage/`)}
                className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 hover:bg-slate-200"
              >
                {ip}
              </button>
            ))}
            <span className="block mt-1">Si le serveur web est sur ce poste, cliquez une adresse pour pré-remplir l'URL (à ajuster selon le sous-dossier).</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:w-1/2">
          <Input label="Heure limite d'arrivée" type="time" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} />
          <Input label="Heure de départ" type="time" value={expectedDeparture} onChange={(e) => setExpectedDeparture(e.target.value)} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Un avertissement s'affiche au pointage si l'arrivée dépasse l'heure limite ou si le départ la précède.
          (Ces seuils sont lus par l'application web depuis la base.)
        </p>

        <div className="flex justify-end pt-4">
          <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-slate-700">Visibilité du QR sur le tableau de bord</h3>
        <p className="mb-4 text-sm text-slate-600">
          Rôles autorisés à voir, télécharger et imprimer le QR Code depuis leur tableau de bord.
          Si aucun rôle n'est coché, le QR reste accessible uniquement ici.
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
        <p className="mb-4 text-sm text-slate-600">
          Choisissez le style du QR Code. Les modèles « avec logo » insèrent le logo de l'entreprise
          au centre (défini dans Paramètres → Entreprise).
        </p>
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
              <QrCodeBox value={previewUrl} model={key} size={120} hideActions />
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
        <QrCodeBox value={pointageUrl} model={model} downloadName="qr-pointage" printTitle="Pointage du personnel — Afrikimmo" />
      </Card>
    </div>
  );
}
