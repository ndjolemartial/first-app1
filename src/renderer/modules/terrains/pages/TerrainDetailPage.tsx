import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import LocationMap from '../../../shared/components/LocationMap';
import {
  useTerrain, useDeleteTerrain, useUpdateTerrainStatut,
  useGenerateAcdInvoices, useCancelAcdInvoices,
} from '../hooks/useTerrains';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { toast } from '../../../shared/components/ui/Toast';
import EditAcdInvoicesModal from '../components/EditAcdInvoicesModal';
import { Edit, Trash2, MapPin, Landmark, CheckCircle, FileText, ExternalLink, User, Building, Receipt, PencilLine } from 'lucide-react';

const STATUT_OPTIONS = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'VENDU', label: 'Vendu' },
];

const STATUT_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', VENDU: 'default', SOUS_OPTION: 'info',
};

const STATUT_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible', RESERVE: 'Réservé', VENDU: 'Vendu', SOUS_OPTION: 'Sous option',
};

const CONVENTION_TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
  SOUSCRIPTION: 'Souscription', AVENANT: 'Avenant', RESILIATION: 'Résiliation',
};

const CONVENTION_STATUS_VARIANT: Record<string, any> = {
  ACTIVE: 'success', BROUILLON: 'info', ATTENTE_SIGNATURE: 'warning',
  EXPIRE: 'danger', TERMINER: 'default', ANNULE: 'danger',
};

const INVOICE_STATUS_VARIANT: Record<string, any> = {
  BROUILLON: 'default', ENVOYEE: 'info', PAYEE: 'success',
  PARTIEL: 'warning', EN_RETARD: 'danger', ANNULEE: 'default',
};
const INVOICE_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Validée', PAYEE: 'Payée',
  PARTIEL: 'Partielle', EN_RETARD: 'En retard', ANNULEE: 'Annulée',
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
  const generateAcd = useGenerateAcdInvoices();
  const cancelAcd = useCancelAcdInvoices();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelAcd, setConfirmCancelAcd] = useState(false);
  const [showEditAcdInvoices, setShowEditAcdInvoices] = useState(false);
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
              {t.programme && (
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                  <Building className="h-4 w-4" />
                  <button className="hover:underline text-indigo-600"
                    onClick={() => navigate(`/programmes/${t.programme.id}`)}>
                    {t.programme.reference} — {t.programme.nom}
                  </button>
                </div>
              )}
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

        {/* Frais de démarches ACD */}
        {t.acdDemarchesEnabled && (() => {
          const acdInvoices: any[] = (t.invoices ?? []).filter((i: any) => i.type === 'FRAIS_DEMARCHES_ACD');
          const activeInvoices = acdInvoices.filter((i: any) => i.status !== 'ANNULEE');
          const totalEmis = activeInvoices.reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
          const totalPaid = activeInvoices.reduce(
            (s: number, i: any) => s + (i.payments ?? []).reduce((p: number, x: any) => p + Number(x.amount ?? 0), 0),
            0,
          );
          const remaining = totalEmis - totalPaid;
          const amount = Number(t.acdDemarchesAmount ?? 0);
          const count = t.acdDemarchesInstallmentCount ?? 0;
          const hasActiveInvoices = activeInvoices.length > 0;
          return (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Frais de démarches ACD
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <dl className="space-y-2">
                  {[
                    ['Montant retenu', amount > 0 ? formatCurrency(amount) : '—'],
                    ['Modalité', count === 1 ? 'Comptant' : count > 1 ? `${count} échéances mensuelles` : '—'],
                    ['Date de début', t.acdDemarchesStartDate ? formatDate(t.acdDemarchesStartDate) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="space-y-2">
                  {[
                    ['Factures actives', String(activeInvoices.length)],
                    ['Total encaissé', formatCurrency(totalPaid)],
                    ['Reste dû', formatCurrency(remaining)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="font-medium text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Tableau des factures ACD */}
              {acdInvoices.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Échéance</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Montant</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-600">Payé</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {acdInvoices.map((inv: any) => {
                        const paid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => navigate(`/accounting/invoices/${inv.id}`)}>
                            <td className="px-3 py-2 font-medium text-slate-900">{inv.reference}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(inv.dueDate)}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(Number(inv.total))}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(paid)}</td>
                            <td className="px-3 py-2">
                              <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? 'default'}>
                                {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                {!hasActiveInvoices && (
                  <Button
                    size="sm"
                    loading={generateAcd.isPending}
                    onClick={() => generateAcd.mutate(Number(id))}
                    icon={<Receipt className="h-4 w-4" />}
                  >
                    Générer les factures
                  </Button>
                )}
                {hasActiveInvoices && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<PencilLine className="h-4 w-4" />}
                    onClick={() => setShowEditAcdInvoices(true)}
                  >
                    Modifier les échéances
                  </Button>
                )}
                {hasActiveInvoices && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={cancelAcd.isPending}
                    onClick={() => setConfirmCancelAcd(true)}
                  >
                    Annuler les factures non payées
                  </Button>
                )}
                <p className="text-xs text-slate-500 self-center">
                  {!hasActiveInvoices
                    ? 'Aucune facture active. Générer pour créer les appels de fonds selon les modalités saisies.'
                    : 'Ajustez les dates et montants via « Modifier les échéances ». Annulez pour changer le nombre d\'échéances.'}
                </p>
              </div>
            </Card>
          );
        })()}

        {/* Conventions liées */}
        {(() => {
          const linkedConventions: any[] = (t.conventionLinks ?? [])
            .map((l: any) => l.convention)
            .filter(Boolean);
          if (linkedConventions.length === 0) return null;
          return (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Conventions liées ({linkedConventions.length})
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Client</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Début</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linkedConventions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/conventions/${c.id}`)}>
                      <td className="px-3 py-2 font-medium text-slate-900">{c.reference}</td>
                      <td className="px-3 py-2 text-slate-600">{CONVENTION_TYPE_LABEL[c.type] ?? c.type}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {c.client?.type === 'INDIVIDUEL'
                          ? `${c.client?.firstName ?? ''} ${c.client?.lastName ?? ''}`.trim()
                          : c.client?.entreprise ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(c.startDate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={CONVENTION_STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })()}

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

      <ConfirmDialog
        open={confirmCancelAcd}
        onClose={() => setConfirmCancelAcd(false)}
        onConfirm={async () => { await cancelAcd.mutateAsync(Number(id)); setConfirmCancelAcd(false); }}
        loading={cancelAcd.isPending}
        title="Annuler les factures ACD non payées"
        message="Les factures BROUILLON, ENVOYEE et EN_RETARD passeront au statut ANNULEE. Les factures déjà payées ne seront pas modifiées."
        confirmLabel="Annuler les factures"
      />

      {t.acdDemarchesEnabled && t.acdDemarchesAmount && (
        <EditAcdInvoicesModal
          open={showEditAcdInvoices}
          onClose={() => setShowEditAcdInvoices(false)}
          terrainId={Number(id)}
          invoices={(t.invoices ?? []).filter((i: any) => i.type === 'FRAIS_DEMARCHES_ACD')}
          acdDemarchesAmount={Number(t.acdDemarchesAmount)}
        />
      )}
    </PageLayout>
  );
}
