import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useLotissement, useDeleteLotissement } from '../hooks/useLotissements';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, MapPin, Layers } from 'lucide-react';

const STATUT_VARIANT: Record<string, any> = {
  EN_COURS: 'warning', OUVERT: 'success', PARTIELLEMENT_VENDU: 'info',
  COMPLET: 'default', FERME: 'danger',
};
const STATUT_LABEL: Record<string, string> = {
  EN_COURS: 'En cours', OUVERT: 'Ouvert', PARTIELLEMENT_VENDU: 'Partiellement vendu',
  COMPLET: 'Complet', FERME: 'Fermé',
};
const TERRAIN_STATUT_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', VENDU: 'default', SOUS_OPTION: 'info',
};
const TERRAIN_STATUT_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible', RESERVE: 'Réservé', VENDU: 'Vendu', SOUS_OPTION: 'Sous option',
};

export default function LotissementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useLotissement(Number(id));
  const deleteLot = useDeleteLotissement();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lot = res?.data;
  if (isLoading || !lot) return null;

  const terrains: any[] = lot.terrains ?? [];
  const venduCount = terrains.filter((t: any) => t.statut === 'VENDU').length;
  const dispoCount = terrains.filter((t: any) => t.statut === 'DISPONIBLE').length;

  return (
    <PageLayout
      title={lot.nom}
      breadcrumbs={[{ label: 'Lotissements', to: '/lotissements' }, { label: lot.nom }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/lotissements/${id}/edit`)}>Modifier</Button>
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
                <h2 className="text-xl font-bold text-slate-900">{lot.nom}</h2>
                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {lot.reference}
                </span>
                <Badge variant={STATUT_VARIANT[lot.statut] ?? 'default'}>
                  {STATUT_LABEL[lot.statut] ?? lot.statut}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {[lot.quartier, lot.commune, lot.ville, lot.pays].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        </Card>

        {/* Synthèse */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Parcelles totales', value: lot.nombreParcelles ?? terrains.length },
            { label: 'Disponibles', value: dispoCount, color: 'text-green-600' },
            { label: 'Vendues', value: venduCount, color: 'text-slate-700' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${color ?? 'text-slate-900'}`}>{value}</p>
            </Card>
          ))}
        </div>

        {/* Détails */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Promoteur', lot.promoteur ?? '—'],
                ['Surface totale', lot.surface ? `${lot.surface} m²` : '—'],
                ['Commune', lot.commune ?? '—'],
                ['Quartier', lot.quartier ?? '—'],
                ['Créé le', formatDate(lot.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {lot.description && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-2">Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{lot.description}</p>
            </Card>
          )}
        </div>

        {/* Liste des terrains */}
        {terrains.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Parcelles ({terrains.length})
            </h3>
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
                    <span className="text-slate-600">{t.surface} m²</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {t.prixVente && <span className="text-slate-600">{formatCurrency(t.prixVente)}</span>}
                    <Badge variant={TERRAIN_STATUT_VARIANT[t.statut] ?? 'default'}>
                      {TERRAIN_STATUT_LABEL[t.statut] ?? t.statut}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button size="sm" onClick={() => navigate(`/terrains/new?lotissementId=${lot.id}`)}>
                + Ajouter une parcelle
              </Button>
            </div>
          </Card>
        )}

        {terrains.length === 0 && (
          <Card>
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">Aucune parcelle dans ce lotissement.</p>
              <Button className="mt-3" size="sm"
                onClick={() => navigate(`/terrains/new?lotissementId=${lot.id}`)}>
                Ajouter la première parcelle
              </Button>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteLot.mutateAsync(Number(id)); navigate('/lotissements'); }}
        loading={deleteLot.isPending}
        title="Supprimer le lotissement"
        message={`Supprimer "${lot.nom}" ? Tous les terrains associés devront être supprimés d'abord.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
