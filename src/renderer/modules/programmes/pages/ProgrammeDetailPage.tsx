import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useProgramme, useDeleteProgramme } from '../hooks/useProgrammes';
import { PROGRAMME_STATUT_VARIANT, PROGRAMME_STATUT_LABEL, PROGRAMME_TYPE_LABEL } from './ProgrammesListPage';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, Building, Building2, Landmark } from 'lucide-react';
import EntityCashflowSection from '../../treasury/components/EntityCashflowSection';

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTEMENT: 'Appartement', DUPLEX: 'Duplex', VILLA: 'Villa',
  STUDIO: 'Studio', BUREAU: 'Bureau', PARKING: 'Parking', AUTRE: 'Autre',
};
const PROPERTY_STATUS_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', SOUS_OPTION: 'warning', VENDU: 'default',
  EN_LOCATION: 'info', EN_RENOVATION: 'purple', INDISPONIBLE: 'danger',
};
const TERRAIN_STATUT_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', VENDU: 'default', SOUS_OPTION: 'info',
};
const TERRAIN_STATUT_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible', RESERVE: 'Réservé', VENDU: 'Vendu', SOUS_OPTION: 'Sous option',
};

export default function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useProgramme(Number(id));
  const deleteProgramme = useDeleteProgramme();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const prog = res?.data;
  if (isLoading || !prog) return null;

  const properties: any[] = prog.properties ?? [];
  const terrains: any[] = prog.terrains ?? [];

  return (
    <PageLayout
      title={prog.nom}
      breadcrumbs={[{ label: 'Programmes immobiliers', to: '/programmes' }, { label: prog.nom }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/programmes/${id}/edit`)}>Modifier</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}>Supprimer</Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Building className="h-7 w-7 text-indigo-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{prog.nom}</h2>
                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {prog.reference}
                </span>
                <Badge variant="info">{PROGRAMME_TYPE_LABEL[prog.type] ?? prog.type}</Badge>
                <Badge variant={PROGRAMME_STATUT_VARIANT[prog.statut] ?? 'default'}>
                  {PROGRAMME_STATUT_LABEL[prog.statut] ?? prog.statut}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {[prog.quartier, prog.commune, prog.ville, prog.pays].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        </Card>

        {/* Synthèse */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Biens rattachés', value: properties.length, color: 'text-blue-600' },
            { label: 'Terrains rattachés', value: terrains.length, color: 'text-emerald-600' },
            { label: 'Logements prévus', value: prog.nombreLogements ?? '—', color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            </Card>
          ))}
        </div>

        {/* Détails */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Promoteur', prog.promoteur ?? '—'],
                ['Surface totale', prog.surface ? `${prog.surface} m²` : '—'],
                ['Date de démarrage', prog.dateDebut ? formatDate(prog.dateDebut) : '—'],
                ['Livraison prévue', prog.dateLivraisonPrevue ? formatDate(prog.dateLivraisonPrevue) : '—'],
                ['Commune', prog.commune ?? '—'],
                ['Quartier', prog.quartier ?? '—'],
                ['Créé le', formatDate(prog.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {prog.description && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-2">Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{prog.description}</p>
            </Card>
          )}
        </div>

        {/* Biens rattachés */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Biens ({properties.length})
            </h3>
            <Button size="sm" onClick={() => navigate(`/properties/new?programmeId=${prog.id}`)}>
              + Ajouter un bien
            </Button>
          </div>
          {properties.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun bien rattaché à ce programme.</p>
          ) : (
            <div className="space-y-1">
              {properties.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/properties/${p.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-blue-700 font-semibold">{p.reference}</span>
                    <span className="text-slate-600">{PROPERTY_TYPE_LABEL[p.type] ?? p.type}</span>
                    {p.city && <span className="text-slate-500 text-xs">{p.city}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {p.salePrice ? <span className="text-slate-600">{formatCurrency(Number(p.salePrice))}</span> : null}
                    {!p.salePrice && p.rentPrice ? <span className="text-slate-600">{formatCurrency(Number(p.rentPrice))}/mois</span> : null}
                    <Badge variant={PROPERTY_STATUS_VARIANT[p.status] ?? 'default'}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Flux de trésorerie rattaché à ce programme */}
        <EntityCashflowSection
          entityType="PROGRAMME"
          entityId={Number(id)}
          newOperationQuery={`?programmeId=${id}`}
        />

        {/* Terrains rattachés */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Terrains ({terrains.length})
            </h3>
            <Button size="sm" onClick={() => navigate(`/terrains/new?programmeId=${prog.id}`)}>
              + Ajouter un terrain
            </Button>
          </div>
          {terrains.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun terrain rattaché à ce programme.</p>
          ) : (
            <div className="space-y-1">
              {terrains.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/terrains/${t.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-blue-700 font-semibold">{t.reference}</span>
                    {t.numeroIlot && <span className="text-slate-500 text-xs">Îlot {t.numeroIlot}</span>}
                    {t.numeroParcelle && <span className="text-slate-500 text-xs">Lot {t.numeroParcelle}</span>}
                    {t.surface && <span className="text-slate-600">{t.surface} m²</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {t.prixVente && <span className="text-slate-600">{formatCurrency(Number(t.prixVente))}</span>}
                    <Badge variant={TERRAIN_STATUT_VARIANT[t.statut] ?? 'default'}>
                      {TERRAIN_STATUT_LABEL[t.statut] ?? t.statut}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteProgramme.mutateAsync(Number(id)); navigate('/programmes'); }}
        loading={deleteProgramme.isPending}
        title="Supprimer le programme immobilier"
        message={`Supprimer le programme "${prog.nom}" ? Les biens et terrains rattachés ne sont pas supprimés.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
