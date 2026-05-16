import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import LocationMap from '../../../shared/components/LocationMap';
import { useTerrain, useDeleteTerrain, useUpdateTerrainStatut } from '../hooks/useTerrains';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { toast } from '../../../shared/components/ui/Toast';
import { Edit, Trash2, MapPin, Landmark, CheckCircle, FileText, ExternalLink, User } from 'lucide-react';

const STATUT_OPTIONS = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'VENDU', label: 'Vendu' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
];

const STATUT_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', VENDU: 'default', SOUS_OPTION: 'info',
};

const STATUT_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible', RESERVE: 'Réservé', VENDU: 'Vendu', SOUS_OPTION: 'Sous option',
};

const OFFICIAL_DOCS: Array<{ category: string; numberField: string; label: string }> = [
  { category: 'adu_scan',           numberField: 'numeroADU',                    label: 'ADU' },
  { category: 'attribution_scan',   numberField: 'numeroAttestationAttribution',  label: "Attestation d'attribution" },
  { category: 'cession_scan',       numberField: 'numeroAttestationCession',      label: 'Attestation de cession' },
  { category: 'dm_scan',            numberField: 'numeroDM',                      label: 'DM / BM' },
  { category: 'tf_scan',            numberField: 'titreFoncier',                  label: 'Titre Foncier' },
  { category: 'acd_scan',           numberField: 'numeroACD',                     label: 'ACD' },
  { category: 'compulsoires_scan',  numberField: '',                              label: "Compulsoires d'Huissier" },
  { category: 'dossier_technique_scan', numberField: '',                          label: 'Dossier Technique' },
];

export default function TerrainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const { data: res, isLoading } = useTerrain(Number(id));
  const deleteTerrain = useDeleteTerrain();
  const updateStatut = useUpdateTerrainStatut();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<number | null>(null);

  const t = res?.data;
  if (isLoading || !t) return null;

  const clientName = t.client
    ? t.client.type === 'INDIVIDUEL'
      ? `${t.client.firstName ?? ''} ${t.client.lastName ?? ''}`.trim()
      : t.client.entreprise ?? '—'
    : null;

  const docsByCategory: Record<string, any> = {};
  for (const doc of t.documents ?? []) {
    docsByCategory[doc.category] = doc;
  }

  const handleOpenFile = async (doc: any) => {
    setOpeningDoc(doc.id);
    try {
      const r = await window.electron.documents.openFile(token, doc.path);
      if (!r.success) toast.error(r.error as string ?? 'Impossible d\'ouvrir le fichier');
    } finally {
      setOpeningDoc(null);
    }
  };

  const hasAnyDoc = OFFICIAL_DOCS.some(
    ({ category, numberField }) => docsByCategory[category] || (numberField && t[numberField])
  );

  return (
    <PageLayout
      title={`Terrain ${t.reference}`}
      breadcrumbs={[{ label: 'Terrains', to: '/terrains' }, { label: t.reference }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/terrains/${id}/edit`)}>Modifier</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}>Supprimer</Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-emerald-100 flex items-center justify-center">
              <MapPin className="h-7 w-7 text-emerald-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{t.reference}</h2>
                <Badge variant={STATUT_VARIANT[t.statut] ?? 'default'}>
                  {STATUT_LABEL[t.statut] ?? t.statut}
                </Badge>
                {t.viabilise && (
                  <Badge variant="success">
                    <CheckCircle className="h-3 w-3 mr-1 inline" /> Viabilisé
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <Landmark className="h-4 w-4" />
                <button className="hover:underline text-blue-600"
                  onClick={() => navigate(`/lotissements/${t.lotissement?.id}`)}>
                  {t.lotissement?.reference} — {t.lotissement?.nom}
                </button>
                <span>·</span>
                <span>{t.lotissement?.ville}</span>
              </div>
            </div>
            {t.prixVente && (
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(t.prixVente)}</p>
                <p className="text-xs text-slate-500">Prix de vente</p>
              </div>
            )}
          </div>
        </Card>

        {/* Changement de statut rapide */}
        <Card>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 shrink-0">Changer le statut :</label>
            <div className="w-48">
              <Select
                options={STATUT_OPTIONS}
                value={t.statut}
                onChange={(e) => updateStatut.mutate({ id: Number(id), statut: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Caractéristiques */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Caractéristiques</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Surface', t.surface ? `${t.surface} m²` : '—'],
                ['Numéro d\'îlot', t.numeroIlot ?? '—'],
                ['Numéro de parcelle', t.numeroParcelle ?? '—'],
                ['Viabilisé', t.viabilise ? 'Oui' : 'Non'],
                ['Créé le', formatDate(t.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Attributaire */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <User className="h-4 w-4" /> Attributaire
            </h3>
            {clientName ? (
              <div className="space-y-3 text-sm">
                <button
                  className="font-medium text-blue-600 hover:underline text-left"
                  onClick={() => navigate(`/clients/${t.client.id}`)}
                >
                  {clientName}
                </button>
                <dl className="space-y-2">
                  {[
                    ['Type', t.client.type === 'INDIVIDUEL' ? 'Particulier' : 'Entreprise'],
                    ['Téléphone', t.client.phone ?? t.client.mobile ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Aucun attributaire assigné</p>
            )}
          </Card>
        </div>

        {/* Localisation */}
        <LocationMap
          latitude={t.latitude}
          longitude={t.longitude}
          label={`${t.reference}${t.lotissement?.ville ? ` · ${t.lotissement.ville}` : ''}`}
        />

        {/* Documents officiels */}
        {hasAnyDoc && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents officiels
            </h3>
            <div className="divide-y divide-slate-100">
              {OFFICIAL_DOCS.map(({ category, numberField, label }) => {
                const doc = docsByCategory[category];
                const number = numberField ? (t[numberField] as string | undefined) : undefined;
                if (!doc && !number) return null;
                return (
                  <div key={category} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                      {number && (
                        <p className="text-sm font-medium text-slate-800">{number}</p>
                      )}
                      {doc && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {doc.name} · {(doc.size / 1024).toFixed(0)} Ko · {formatDate(doc.uploadedAt)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {doc ? (
                        <Button
                          variant="secondary"
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          loading={openingDoc === doc.id}
                          onClick={() => handleOpenFile(doc)}
                        >
                          Voir / Imprimer
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pas de fichier</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {t.description && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Description</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{t.description}</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteTerrain.mutateAsync(Number(id)); navigate('/terrains'); }}
        loading={deleteTerrain.isPending}
        title="Supprimer le terrain"
        message={`Supprimer le terrain ${t.reference} ?`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
