import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  usePermitProject, useDeletePermitProject, usePermitEstimates, useGeneratePermitEstimate, useDeletePermitEstimate,
} from '../hooks/usePermitProjects';
import { formatCurrency, formatDate, formatPersonName } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  NATURE_LABELS, STANDING_LABELS, ZONE_TYPE_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANT,
  ESTIMATE_STATUS_LABELS, MISSION_PHASE_LABELS, formatFcfa,
} from '../utils/permitLabels';
import { Pencil, Plus, FileText, ArrowRight, Trash2 } from 'lucide-react';

/** Mêmes rôles que côté IPC (`permit-projects.ipc.ts`) — DELETE_ROLES / WRITE_ROLES. */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value ?? '—'}</div>
    </div>
  );
}

export default function PermitProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projectId = Number(id);
  const { data: res, isLoading } = usePermitProject(projectId);
  const { data: estimatesRes } = usePermitEstimates(projectId);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [estimateToDelete, setEstimateToDelete] = useState<any>(null);

  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const deleteProject = useDeletePermitProject();
  const deleteEstimate = useDeletePermitEstimate();
  const generateEstimate = useGeneratePermitEstimate();

  const project = res?.data;
  const estimates = estimatesRes?.data ?? [];

  if (isLoading || !project) {
    return <PageLayout title="Projet de permis de construire" breadcrumbs={[{ label: 'Devis permis de construire', to: '/permits' }]}><div className="p-6 text-slate-400">Chargement…</div></PageLayout>;
  }

  const handleGenerate = async () => {
    const r = await generateEstimate.mutateAsync(projectId);
    if (r.success) navigate(`/permits/estimates/${r.data.id}`);
  };

  return (
    <PageLayout
      title={project.nom}
      breadcrumbs={[{ label: 'Devis permis de construire', to: '/permits' }, { label: project.reference }]}
      actions={<>
        {canWrite && (
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/permits/projects/${projectId}/edit`)}>Modifier</Button>
        )}
        {canWrite && (
          <Button icon={<Plus className="h-4 w-4" />} loading={generateEstimate.isPending} onClick={handleGenerate}>Générer une estimation</Button>
        )}
        {canDelete && (
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteProjectOpen(true)}>Supprimer</Button>
        )}
      </>}
    >
      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Synthèse du projet</h3>
            <Badge variant={PROJECT_STATUS_VARIANT[project.status] ?? 'default'}>{PROJECT_STATUS_LABELS[project.status] ?? project.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Référence" value={project.reference} />
            <Field label="Destinataire" value={project.client ? formatPersonName(project.client, '') : project.prospect ? `${project.prospect.firstName} ${project.prospect.lastName}` : '—'} />
            <Field label="Agent" value={project.agent ? formatPersonName(project.agent, '') : '—'} />
            <Field label="Nature" value={NATURE_LABELS[project.nature]} />
            <Field label="Standing" value={STANDING_LABELS[project.standing]} />
            <Field label="Commune" value={project.commune?.nom ?? '—'} />
            <Field label="Zone" value={project.zoneType ? ZONE_TYPE_LABELS[project.zoneType] : (project.commune ? ZONE_TYPE_LABELS[project.commune.zoneType] : '—')} />
            <Field label="Superficie du terrain" value={project.terrainSurface ? `${Number(project.terrainSurface)} m²` : '—'} />
            <Field label="Surface bâtie" value={`${Number(project.surfaceBatie)} m²`} />
            <Field label="Niveaux" value={project.levels} />
            <Field label="Bâtiments" value={project.nombreBatiments} />
            <Field label="Sous-sol" value={project.hasSousSol ? 'Oui' : 'Non'} />
            <Field label="Coût prévisionnel des travaux" value={project.coutPrevisionnelTravaux != null ? formatFcfa(Number(project.coutPrevisionnelTravaux)) : '—'} />
            <Field label="Projet de construction lié" value={project.constructionProject ? `${project.constructionProject.reference} — ${project.constructionProject.nom}` : '—'} />
            <Field label="Caractéristiques" value={[
              project.hasPiscine && 'Piscine', project.hasAscenseur && 'Ascenseur', project.hasGroupeElectrogene && 'Groupe électrogène',
              project.hasForage && 'Forage', project.hasCloture && 'Clôture', project.hasVoirieInterieure && 'Voirie intérieure',
            ].filter(Boolean).join(', ') || 'Aucune'} />
            <div className="col-span-3">
              <Field label="Niveau de prestation" value={(project.missionPhases ?? []).map((p: string) => MISSION_PHASE_LABELS[p] ?? p).join(', ') || '—'} />
            </div>
          </div>
          {project.description && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-400 mb-1">Description</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">{project.description}</div>
            </div>
          )}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Estimations générées</h3>
          </div>
          {estimates.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Aucune estimation générée pour ce projet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Version</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total TTC</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/permits/estimates/${e.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-indigo-600">{e.reference}</td>
                    <td className="px-4 py-2.5 text-slate-500">v{e.version}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(Number(e.totalTTC))}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(e.generatedAt)}</td>
                    <td className="px-4 py-2.5"><Badge variant={e.status === 'CONVERTI' ? 'success' : 'default'}>{ESTIMATE_STATUS_LABELS[e.status]}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canDelete && (
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={(ev) => { ev.stopPropagation(); setEstimateToDelete(e); }} />
                        )}
                        <ArrowRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{project.notes || '—'}</p>
        </Card>
      </div>

      <ConfirmDialog open={deleteProjectOpen} title="Supprimer le projet"
        message={`Supprimer le projet ${project.reference} et toutes ses estimations ?`}
        confirmLabel="Supprimer" loading={deleteProject.isPending}
        onConfirm={async () => { const r = await deleteProject.mutateAsync(project.id); if (r.success) navigate('/permits'); }}
        onClose={() => setDeleteProjectOpen(false)} />

      <ConfirmDialog open={!!estimateToDelete} title="Supprimer l'estimation"
        message={`Supprimer l'estimation ${estimateToDelete?.reference ?? ''} ?`}
        confirmLabel="Supprimer" loading={deleteEstimate.isPending}
        onConfirm={async () => { await deleteEstimate.mutateAsync(estimateToDelete.id); setEstimateToDelete(null); }}
        onClose={() => setEstimateToDelete(null)} />
    </PageLayout>
  );
}
