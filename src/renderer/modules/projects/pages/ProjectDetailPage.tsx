import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useProject, useDeleteProject } from '../hooks/useProjects';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from '../types/project.types';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, Briefcase, MapPin, Calendar, Wallet } from 'lucide-react';
import EntityCashflowSection from '../../treasury/components/EntityCashflowSection';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useProject(Number(id));
  const deleteProject = useDeleteProject();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project: any = res?.data;
  if (isLoading || !project) return null;

  const documents: any[] = project.documents ?? [];

  const clientLabel = project.client
    ? [project.client.firstName, project.client.lastName].filter(Boolean).join(' ')
      || project.client.entreprise
      || `Client #${project.client.id}`
    : null;
  const ownerLabel = project.owner
    ? [project.owner.firstName, project.owner.lastName].filter(Boolean).join(' ')
      || project.owner.companyName
      || `Propriétaire #${project.owner.id}`
    : null;

  return (
    <PageLayout
      title={project.nom}
      breadcrumbs={[{ label: 'Projets', to: '/projects' }, { label: project.nom }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/projects/${id}/edit`)}>Modifier</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}>Supprimer</Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center">
              <Briefcase className="h-7 w-7 text-blue-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{project.nom}</h2>
                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {project.reference}
                </span>
                {project.type && (
                  <Badge variant="info">
                    {project.type.label}
                  </Badge>
                )}
                <Badge variant={PROJECT_STATUS_VARIANT[project.statut as keyof typeof PROJECT_STATUS_VARIANT] ?? 'default'}>
                  {PROJECT_STATUS_LABEL[project.statut as keyof typeof PROJECT_STATUS_LABEL] ?? project.statut}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {[project.quartier, project.commune, project.ville, project.pays].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>

          {/* Barre d'avancement */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">Avancement</span>
              <span className="text-xs font-semibold text-slate-700">{project.avancement ?? 0} %</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, project.avancement ?? 0))}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Détails */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Localisation
            </h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Adresse', project.adresse ?? '—'],
                ['Commune', project.commune ?? '—'],
                ['Quartier', project.quartier ?? '—'],
                ['Ville', project.ville ?? '—'],
                ['Pays', project.pays ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Calendrier
            </h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Démarrage prévu', project.dateDebutPrevu ? formatDate(project.dateDebutPrevu) : '—'],
                ['Démarrage réel',  project.dateDebutReel ? formatDate(project.dateDebutReel) : '—'],
                ['Fin prévue',      project.dateFinPrevue ? formatDate(project.dateFinPrevue) : '—'],
                ['Fin réelle',      project.dateFinReelle ? formatDate(project.dateFinReelle) : '—'],
                ['Créé le',         formatDate(project.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Budget
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Prévu</dt>
                <dd className="font-medium text-slate-900">
                  {project.budgetPrevu != null ? formatCurrency(Number(project.budgetPrevu)) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Réalisé</dt>
                <dd className="font-medium text-slate-900">
                  {project.budgetRealise != null ? formatCurrency(Number(project.budgetRealise)) : '—'}
                </dd>
              </div>
              {project.budgetPrevu != null && project.budgetRealise != null && (
                <div className="flex justify-between border-t border-slate-100 pt-3">
                  <dt className="text-slate-500">Écart</dt>
                  <dd className={`font-semibold ${Number(project.budgetRealise) > Number(project.budgetPrevu) ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(Number(project.budgetRealise) - Number(project.budgetPrevu))}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Rattachements</h3>
            <dl className="space-y-2 text-sm">
              {clientLabel && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Client</dt>
                  <dd>
                    <button className="font-medium text-blue-700 hover:underline"
                      onClick={() => navigate(`/clients/${project.client.id}`)}>{clientLabel}</button>
                  </dd>
                </div>
              )}
              {ownerLabel && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Propriétaire</dt>
                  <dd>
                    <button className="font-medium text-blue-700 hover:underline"
                      onClick={() => navigate(`/owners/${project.owner.id}`)}>{ownerLabel}</button>
                  </dd>
                </div>
              )}
              {project.terrain && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Terrain</dt>
                  <dd>
                    <button className="font-medium text-blue-700 hover:underline"
                      onClick={() => navigate(`/terrains/${project.terrain.id}`)}>{project.terrain.reference}</button>
                  </dd>
                </div>
              )}
              {project.lotissement && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Lotissement</dt>
                  <dd>
                    <button className="font-medium text-blue-700 hover:underline"
                      onClick={() => navigate(`/lotissements/${project.lotissement.id}`)}>
                      {project.lotissement.reference} · {project.lotissement.nom}
                    </button>
                  </dd>
                </div>
              )}
              {project.programme && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Programme</dt>
                  <dd>
                    <button className="font-medium text-blue-700 hover:underline"
                      onClick={() => navigate(`/programmes/${project.programme.id}`)}>
                      {project.programme.reference} · {project.programme.nom}
                    </button>
                  </dd>
                </div>
              )}
              {!clientLabel && !ownerLabel && !project.terrain && !project.lotissement && !project.programme && (
                <p className="text-slate-400 text-sm">Aucun rattachement.</p>
              )}
            </dl>
          </Card>
        </div>

        {project.description && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Description</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.description}</p>
          </Card>
        )}

        {project.notes && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Notes internes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.notes}</p>
          </Card>
        )}

        {/* Flux de trésorerie rattaché à ce projet */}
        <EntityCashflowSection
          entityType="PROJECT"
          entityId={Number(id)}
          newOperationQuery={`?projectId=${id}`}
        />

        <EntityDocumentsCard
          documents={documents}
          defaultLinks={{ projectId: Number(id) }}
          invalidateKey={['project', Number(id)]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteProject.mutateAsync(Number(id)); navigate('/projects'); }}
        loading={deleteProject.isPending}
        title="Supprimer le projet"
        message={`Supprimer le projet "${project.nom}" ? Les rattachements ne sont pas supprimés.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
