import { useState, useMemo } from 'react';
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
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import StatusRecap, { type StatusRecapItem } from '../../../shared/components/ui/StatusRecap';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useProjects, useProjectsStatusStats, useProjectTypes } from '../hooks/useProjects';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from '../types/project.types';
import { formatDate } from '../../../shared/utils/format';
import {
  PlusCircle, Eye, Edit, Briefcase, Lightbulb, Play, PauseCircle, CheckCircle2, XCircle,
} from 'lucide-react';

const STATUT_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_PROJET', label: 'En projet' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'SUSPENDU', label: 'Suspendu' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const STATUT_RECAP_ITEMS: StatusRecapItem[] = [
  { key: 'EN_PROJET', label: 'En projet', icon: Lightbulb,    iconBg: 'bg-slate-100',   iconColor: 'text-slate-600',   activeColor: 'text-slate-800' },
  { key: 'EN_COURS',  label: 'En cours',  icon: Play,         iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     activeColor: 'text-sky-700' },
  { key: 'SUSPENDU',  label: 'Suspendus', icon: PauseCircle,  iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   activeColor: 'text-amber-700' },
  { key: 'TERMINE',   label: 'Terminés',  icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', activeColor: 'text-emerald-700' },
  { key: 'ANNULE',    label: 'Annulés',   icon: XCircle,      iconBg: 'bg-red-100',     iconColor: 'text-red-600',     activeColor: 'text-red-700' },
];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',  cell: (p) => p.reference },
  { header: 'Nom',        cell: (p) => p.nom },
  { header: 'Type',       cell: (p) => p.type?.label ?? '' },
  { header: 'Ville',      cell: (p) => p.ville ?? '' },
  { header: 'Commune',    cell: (p) => p.commune ?? '' },
  { header: 'Avancement', cell: (p) => `${p.avancement ?? 0} %` },
  { header: 'Début',      cell: (p) => (p.dateDebutPrevu ? formatDate(p.dateDebutPrevu) : '') },
  { header: 'Fin prévue', cell: (p) => (p.dateFinPrevue ? formatDate(p.dateFinPrevue) : '') },
  { header: 'Statut',     cell: (p) => PROJECT_STATUS_LABEL[p.statut as keyof typeof PROJECT_STATUS_LABEL] ?? p.statut },
  { header: 'Créé le',    cell: (p) => formatDate(p.createdAt) },
];

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState('');
  const [statut, setStatut] = useState('');

  const filters = {
    search: search || undefined,
    typeId: typeId || undefined,
    statut: statut || undefined,
  };

  const { data, isLoading } = useProjects(filters, page, 20);
  const { data: statsRes } = useProjectsStatusStats({
    search: search || undefined,
    typeId: typeId || undefined,
  });
  const stats = statsRes?.success ? (statsRes.data as Record<string, number>) : undefined;

  const { data: typesRes } = useProjectTypes(false);
  const types: any[] = typesRes?.success ? (typesRes.data as any[]) ?? [] : [];

  const typeOptions = useMemo(
    () => [{ value: '', label: 'Tous les types' }, ...types.map((t: any) => ({ value: String(t.id), label: t.label }))],
    [types],
  );

  const filterSummary = [
    search && `Recherche : "${search}"`,
    typeId && `Type : ${types.find((t: any) => String(t.id) === typeId)?.label ?? typeId}`,
    statut && `Statut : ${PROJECT_STATUS_LABEL[statut as keyof typeof PROJECT_STATUS_LABEL] ?? statut}`,
  ].filter(Boolean).join('   —   ') || undefined;

  const projects: any[] = (data?.data as any[]) ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des projets"
      breadcrumbs={[{ label: 'Projets' }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName="projets"
            title="Liste des projets"
            subtitle={filterSummary}
            columns={EXPORT_COLUMNS}
            fetchRows={async () => {
              const r = await window.electron.projects.list(token, filters, 1, 100000);
              return r.success ? (r.data as any[]) ?? [] : [];
            }}
          />
          <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => navigate('/projects/new')}>
            Nouveau projet
          </Button>
        </div>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            label="Rechercher"
            placeholder="Nom, référence, commune, adresse…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-64">
          <Select
            label="Type de projet"
            options={typeOptions}
            value={typeId}
            onChange={(e) => { setTypeId(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-56">
          <Select
            label="Statut"
            options={STATUT_OPTIONS}
            value={statut}
            onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          />
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
        ) : projects.length === 0 ? (
          <EmptyState
            title="Aucun projet trouvé"
            action={{ label: 'Nouveau projet', onClick: () => navigate('/projects/new') }}
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Avancement</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Créé le</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((proj: any) => (
                  <tr key={proj.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {proj.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                        <p className="font-medium text-slate-900">{proj.nom}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{proj.type?.label ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <p>{proj.commune ?? proj.quartier ?? '—'}</p>
                      <p className="text-xs">{proj.ville ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.max(0, proj.avancement ?? 0))}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 w-9 text-right">{proj.avancement ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PROJECT_STATUS_VARIANT[proj.statut as keyof typeof PROJECT_STATUS_VARIANT] ?? 'default'}>
                        {PROJECT_STATUS_LABEL[proj.statut as keyof typeof PROJECT_STATUS_LABEL] ?? proj.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(proj.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/projects/${proj.id}`)} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/projects/${proj.id}/edit`)} />
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
