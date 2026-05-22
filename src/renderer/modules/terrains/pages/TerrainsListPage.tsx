import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useTerrains } from '../hooks/useTerrains';
import { useLotissements } from '../../lotissements/hooks/useLotissements';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { PlusCircle, Eye, Edit, Landmark } from 'lucide-react';

/** Rôles habilités à créer/modifier un terrain. */
const WRITE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']);

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
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

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',     cell: (t) => t.reference },
  { header: 'Lotissement',   cell: (t) => (t.lotissement ? `${t.lotissement.reference} — ${t.lotissement.nom}` : '') },
  { header: 'Îlot',          cell: (t) => t.numeroIlot },
  { header: 'Parcelle',      cell: (t) => t.numeroParcelle },
  { header: 'Surface (m²)',  cell: (t) => t.surface ?? '' },
  { header: 'Prix de vente', cell: (t) => (t.prixVente != null ? formatCurrency(Number(t.prixVente)) : '') },
  { header: 'Attributaire',  cell: (t) => (t.client ? (t.client.type === 'INDIVIDUEL' ? `${t.client.firstName ?? ''} ${t.client.lastName ?? ''}`.trim() : (t.client.entreprise ?? '')) : '') },
  { header: 'Viabilisé',     cell: (t) => (t.viabilise ? 'Oui' : 'Non') },
  { header: 'Statut',        cell: (t) => STATUT_LABEL[t.statut] ?? t.statut },
  { header: 'Créé le',       cell: (t) => formatDate(t.createdAt) },
];

export default function TerrainsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role  = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = WRITE_ROLES.has(role);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [lotissementId, setLotissementId] = useState('');
  const filters = {
    search: search || undefined,
    statut: statut || undefined,
    lotissementId: lotissementId || undefined,
  };
  const { data, isLoading } = useTerrains(filters, page, 20);
  const { data: lotsRes } = useLotissements({}, 1, 200);

  const terrains: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const lotOptions = [
    { value: '', label: 'Tous les lotissements' },
    ...(lotsRes?.data ?? []).map((l: any) => ({ value: String(l.id), label: `${l.reference} — ${l.nom}` })),
  ];

  const filterSummary = [
    search && `Recherche : "${search}"`,
    statut && `Statut : ${STATUT_LABEL[statut] ?? statut}`,
    lotissementId && `Lotissement : ${lotOptions.find((o) => o.value === lotissementId)?.label ?? lotissementId}`,
  ].filter(Boolean).join('   —   ') || undefined;

  return (
    <PageLayout
      title="Gestion des terrains"
      breadcrumbs={[{ label: 'Terrains' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="terrains"
            title="Liste des terrains"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.terrains.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          {canWrite && (
            <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/terrains/new')}>
              Nouveau terrain
            </Button>
          )}
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <Input label="Rechercher" placeholder="Référence, parcelle, îlot, titre foncier, attributaire…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-56">
          <Select label="Lotissement" options={lotOptions} value={lotissementId}
            onChange={(e) => { setLotissementId(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Statut" options={STATUT_OPTIONS} value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : terrains.length === 0 ? (
          <EmptyState
            title="Aucun terrain trouvé"
            action={canWrite ? { label: 'Nouveau terrain', onClick: () => navigate('/terrains/new') } : undefined}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Lotissement</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Îlot</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Lot</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Surface</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Attributaire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Viabilisé</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Créé le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terrains.map((t: any) => {
                  const attributaireName = t.client
                    ? t.client.type === 'INDIVIDUEL'
                      ? `${t.client.firstName ?? ''} ${t.client.lastName ?? ''}`.trim()
                      : t.client.entreprise ?? '—'
                    : '—';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-medium text-slate-900 text-xs">{t.lotissement?.reference}</p>
                            <p className="text-xs text-slate-500">{t.lotissement?.nom}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.numeroIlot ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{t.numeroParcelle ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{t.surface} m²</td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.prixVente ? formatCurrency(t.prixVente) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{attributaireName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.viabilise ? 'success' : 'default'}>{t.viabilise ? 'Oui' : 'Non'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUT_VARIANT[t.statut] ?? 'default'}>
                          {STATUT_LABEL[t.statut] ?? t.statut}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                            onClick={() => navigate(`/terrains/${t.id}`)} />
                          {canWrite && (
                            <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                              onClick={() => navigate(`/terrains/${t.id}/edit`)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
