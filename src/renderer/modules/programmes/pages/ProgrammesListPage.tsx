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
import { useProgrammes, useProgrammesStatusStats } from '../hooks/useProgrammes';
import { formatDate } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import StatusRecap, { type StatusRecapItem } from '../../../shared/components/ui/StatusRecap';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { PlusCircle, Eye, Edit, Building, Lightbulb, HardHat, Megaphone, PackageCheck, Archive } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'RESIDENTIEL', label: 'Résidentiel' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXTE', label: 'Mixte' },
];

export const PROGRAMME_TYPE_LABEL: Record<string, string> = {
  RESIDENTIEL: 'Résidentiel',
  COMMERCIAL: 'Commercial',
  MIXTE: 'Mixte',
};

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_PROJET', label: 'En projet' },
  { value: 'EN_CONSTRUCTION', label: 'En construction' },
  { value: 'EN_COMMERCIALISATION', label: 'En commercialisation' },
  { value: 'LIVRE', label: 'Livré' },
  { value: 'CLOTURE', label: 'Clôturé' },
];

export const PROGRAMME_STATUT_VARIANT: Record<string, any> = {
  EN_PROJET: 'default',
  EN_CONSTRUCTION: 'warning',
  EN_COMMERCIALISATION: 'info',
  LIVRE: 'success',
  CLOTURE: 'danger',
};

export const PROGRAMME_STATUT_LABEL: Record<string, string> = {
  EN_PROJET: 'En projet',
  EN_CONSTRUCTION: 'En construction',
  EN_COMMERCIALISATION: 'En commercialisation',
  LIVRE: 'Livré',
  CLOTURE: 'Clôturé',
};

const STATUT_RECAP_ITEMS: StatusRecapItem[] = [
  { key: 'EN_PROJET',            label: 'En projet',     icon: Lightbulb,    iconBg: 'bg-slate-100',   iconColor: 'text-slate-600',   activeColor: 'text-slate-800' },
  { key: 'EN_CONSTRUCTION',      label: 'Construction',  icon: HardHat,      iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   activeColor: 'text-amber-700' },
  { key: 'EN_COMMERCIALISATION', label: 'Commercial.',   icon: Megaphone,    iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     activeColor: 'text-sky-700' },
  { key: 'LIVRE',                label: 'Livrés',        icon: PackageCheck, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', activeColor: 'text-emerald-700' },
  { key: 'CLOTURE',              label: 'Clôturés',      icon: Archive,      iconBg: 'bg-red-100',     iconColor: 'text-red-600',     activeColor: 'text-red-700' },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence', cell: (p) => p.reference },
  { header: 'Nom',       cell: (p) => p.nom },
  { header: 'Type',      cell: (p) => PROGRAMME_TYPE_LABEL[p.type] ?? p.type },
  { header: 'Commune',   cell: (p) => p.commune },
  { header: 'Ville',     cell: (p) => p.ville },
  { header: 'Promoteur', cell: (p) => p.promoteur },
  { header: 'Logements', cell: (p) => p.nombreLogements ?? '' },
  { header: 'Biens',     cell: (p) => p._count?.properties ?? 0 },
  { header: 'Terrains',  cell: (p) => p._count?.terrains ?? 0 },
  { header: 'Statut',    cell: (p) => PROGRAMME_STATUT_LABEL[p.statut] ?? p.statut },
  { header: 'Créé le',   cell: (p) => formatDate(p.createdAt) },
];

export default function ProgrammesListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [statut, setStatut] = useState('');
  const filters = { search: search || undefined, type: type || undefined, statut: statut || undefined };
  const { data, isLoading } = useProgrammes(filters, page, 20);
  // Stats : mêmes filtres SAUF le statut.
  const { data: statsRes } = useProgrammesStatusStats({
    search: search || undefined,
    type: type || undefined,
  });
  const stats = statsRes?.success ? statsRes.data : undefined;

  const filterSummary = [
    search && `Recherche : "${search}"`,
    type && `Type : ${PROGRAMME_TYPE_LABEL[type] ?? type}`,
    statut && `Statut : ${PROGRAMME_STATUT_LABEL[statut] ?? statut}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const programmes: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des programmes immobiliers"
      breadcrumbs={[{ label: 'Programmes immobiliers' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="programmes-immobiliers"
            title="Liste des programmes immobiliers"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.programmes.list(token, filters, 1, 100000);
              return r.success ? r.data ?? [] : [];
            }}
          />
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/programmes/new')}>
            Nouveau programme
          </Button>
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Nom, référence, commune, promoteur…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Type" options={TYPE_OPTIONS} value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-56">
          <Select label="Statut" options={STATUT_OPTIONS} value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <div className="mb-4">
        <StatusRecap
          items={STATUT_RECAP_ITEMS}
          stats={stats}
          total={stats?.total}
          activeKey={statut}
          onSelect={(k) => { setStatut(k); setPage(1); }}
        />
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : programmes.length === 0 ? (
          <EmptyState
            title="Aucun programme immobilier trouvé"
            action={{ label: 'Nouveau programme', onClick: () => navigate('/programmes/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Localisation</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Promoteur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Biens / Terrains</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Créé le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programmes.map((prog: any) => (
                  <tr key={prog.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {prog.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-slate-400 shrink-0" />
                        <p className="font-medium text-slate-900">{prog.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{PROGRAMME_TYPE_LABEL[prog.type] ?? prog.type}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <p>{prog.commune ?? prog.quartier ?? '—'}</p>
                      <p className="text-xs">{prog.ville}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{prog.promoteur ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {prog._count?.properties ?? 0} bien(s) · {prog._count?.terrains ?? 0} terrain(s)
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PROGRAMME_STATUT_VARIANT[prog.statut] ?? 'default'}>
                        {PROGRAMME_STATUT_LABEL[prog.statut] ?? prog.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(prog.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/programmes/${prog.id}`)} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/programmes/${prog.id}/edit`)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
