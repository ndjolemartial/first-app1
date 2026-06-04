import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useShareLocationSettings, useUpdateShareLocation } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { MapPin, Mail, MessageSquare, Save, RotateCcw, Copy } from 'lucide-react';
import { toast } from '../../../shared/components/ui/Toast';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// Variables exposées au modèle. Les variables d'entreprise classiques
// (companyName, signature, …) restent disponibles via renderMessage().
const VARIABLE_GROUPS: Array<{ group: string; items: Array<{ key: string; label: string }> }> = [
  {
    group: 'Entité partagée',
    items: [
      { key: 'entityTitle', label: "Titre de l'entité (nom ou type + adresse)" },
      { key: 'entityType',  label: "Type (Lotissement / Terrain / Bien)" },
      { key: 'reference',   label: 'Référence' },
      { key: 'nom',         label: 'Nom du lotissement (si applicable)' },
    ],
  },
  {
    group: 'Localisation',
    items: [
      { key: 'address',   label: 'Adresse complète' },
      { key: 'ville',     label: 'Ville / Village' },
      { key: 'commune',   label: 'Commune' },
      { key: 'quartier',  label: 'Quartier' },
      { key: 'pays',      label: 'Pays' },
      { key: 'latitude',  label: 'Latitude GPS' },
      { key: 'longitude', label: 'Longitude GPS' },
    ],
  },
  {
    group: 'Liens cartographiques',
    items: [
      { key: 'googleMapsUrl',  label: 'Lien Google Maps' },
      { key: 'googleEarthUrl', label: 'Lien Google Earth' },
      { key: 'osmUrl',         label: 'Lien OpenStreetMap' },
    ],
  },
  {
    group: 'Destinataire',
    items: [
      { key: 'recipientName',      label: 'Nom complet du destinataire' },
      { key: 'recipientFirstName', label: 'Prénom du destinataire' },
      { key: 'recipientLastName',  label: 'Nom du destinataire' },
    ],
  },
  {
    group: 'Entreprise',
    items: [
      { key: 'companyName', label: "Raison sociale" },
      { key: 'signature',   label: "Signature email" },
    ],
  },
];

export default function ShareLocationSettingsTab() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canEdit = ADMIN_ROLES.includes(role);

  const { data: res, isLoading } = useShareLocationSettings();
  const update = useUpdateShareLocation();

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [whatsappBody, setWhatsappBody] = useState('');
  const defaults = res?.data?.defaults;

  useEffect(() => {
    const d = res?.data;
    if (!d) return;
    setEmailSubject(d.emailSubject ?? '');
    setEmailBody(d.emailBody ?? '');
    setWhatsappBody(d.whatsappBody ?? '');
  }, [res]);

  if (isLoading) return <SkeletonTable rows={4} />;

  const handleSave = () => {
    update.mutate({ emailSubject, emailBody, whatsappBody });
  };

  const handleReset = () => {
    if (!defaults) return;
    setEmailSubject(defaults.emailSubject);
    setEmailBody(defaults.emailBody);
    setWhatsappBody(defaults.whatsappBody);
    toast.warning('Modèles restaurés — pensez à enregistrer');
  };

  const copyVariable = async (key: string) => {
    const token = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(`Variable ${token} copiée`);
    } catch {
      // Pas critique si le clipboard est indisponible.
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Partage de localisation GPS</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Modèles utilisés pour partager la localisation d'un lotissement, terrain ou bien
              avec un client, prospect ou apporteur d'affaires. Les variables dynamiques
              ci-dessous sont remplacées au moment de l'envoi.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Email */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" /> Modèle email
            </h3>
            <div className="space-y-3">
              <Input
                label="Sujet"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={!canEdit}
                placeholder="Localisation — {{entityTitle}}"
              />
              <Textarea
                label="Corps du message"
                rows={12}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                disabled={!canEdit}
                placeholder="Bonjour {{recipientName}}…"
              />
            </div>
          </Card>

          {/* WhatsApp */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" /> Modèle WhatsApp
            </h3>
            <Textarea
              label="Corps du message"
              rows={8}
              value={whatsappBody}
              onChange={(e) => setWhatsappBody(e.target.value)}
              disabled={!canEdit}
              placeholder="Bonjour {{recipientName}}, voici la localisation…"
            />
            <p className="text-xs text-slate-500 mt-1">
              Astuce : WhatsApp accepte la mise en forme inline — *gras*, _italique_, ~barré~.
            </p>
          </Card>

          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
                disabled={!defaults}
              >
                Restaurer les valeurs par défaut
              </Button>
              <Button
                icon={<Save className="h-4 w-4" />}
                onClick={handleSave}
                loading={update.isPending}
              >
                Enregistrer
              </Button>
            </div>
          )}
        </div>

        {/* Variables disponibles */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-2">Variables disponibles</h3>
          <p className="text-xs text-slate-500 mb-3">
            Cliquez sur une variable pour la copier, puis collez-la dans le sujet ou le corps.
          </p>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {VARIABLE_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  {g.group}
                </p>
                <ul className="space-y-1">
                  {g.items.map((v) => (
                    <li key={v.key}>
                      <button
                        type="button"
                        onClick={() => copyVariable(v.key)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 group"
                      >
                        <code className="text-xs font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                          {`{{${v.key}}}`}
                        </code>
                        <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{v.label}</span>
                        <Copy className="h-3 w-3 text-slate-300 group-hover:text-slate-500 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
