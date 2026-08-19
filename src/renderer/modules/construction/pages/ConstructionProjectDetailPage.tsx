import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useConstructionProject, useDeleteConstructionProject } from '../hooks/useConstructionProjects';
import { useConstructionEstimates, useDeleteEstimate } from '../hooks/useConstructionEstimates';
import GenerateEstimateModal from '../components/GenerateEstimateModal';
import { formatCurrency, formatDate, formatPersonName } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  BUILDING_TYPE_LABELS, STANDING_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANT,
  ROOF_TYPE_LABELS, JOINERY_TYPE_LABELS, FLOORING_TYPE_LABELS, AC_TYPE_LABELS, KITCHEN_TYPE_LABELS,
  TERRAIN_TYPE_LABELS, SANITATION_TYPE_LABELS, ESTIMATE_STATUS_LABELS, PRECISION_LEVEL_LABELS, PROJECT_SCOPE_LABELS,
  FENCE_POST_TYPE_LABELS,
} from '../utils/constructionLabels';
import { Pencil, Plus, FileText, ArrowRight, Trash2 } from 'lucide-react';

/** Suppression d'un projet ou d'une estimation : réservée à SUPER_ADMIN/ADMIN/MANAGER (même liste que côté IPC, `DELETE_ROLES` dans `construction-projects.ipc.ts`). */
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
/** Modification / génération d'estimation : réservée à SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT (même liste que côté IPC, `WRITE_ROLES` dans `construction-projects.ipc.ts`). */
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{value ?? '—'}</div>
    </div>
  );
}

export default function ConstructionProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const projectId = Number(id);
  const { data: res, isLoading } = useConstructionProject(projectId);
  const { data: estimatesRes } = useConstructionEstimates(projectId);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [estimateToDelete, setEstimateToDelete] = useState<any>(null);

  const role = useAuthStore((s) => s.user?.role);
  const canDelete = !!role && DELETE_ROLES.includes(role);
  const canWrite = !!role && WRITE_ROLES.includes(role);
  const deleteProject = useDeleteConstructionProject();
  const deleteEstimate = useDeleteEstimate();

  const project = res?.data;
  const estimates = estimatesRes?.data ?? [];

  if (isLoading || !project) {
    return <PageLayout title="Projet de construction" breadcrumbs={[{ label: 'Devis construction', to: '/construction' }]}><div className="p-6 text-slate-400">Chargement…</div></PageLayout>;
  }

  return (
    <PageLayout
      title={project.nom}
      breadcrumbs={[{ label: 'Devis construction', to: '/construction' }, { label: project.reference }]}
      actions={<>
        {canWrite && (
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/construction/projects/${projectId}/edit`)}>Modifier</Button>
        )}
        {canWrite && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGenerateOpen(true)}>Générer une estimation</Button>
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
            <Field label="Type de devis" value={PROJECT_SCOPE_LABELS[project.scope] ?? 'Maison complète'} />
            {project.scope === 'COMPLET' && (
              <>
                <Field label="Type de bâtiment" value={BUILDING_TYPE_LABELS[project.buildingType]} />
                <Field label="Standing" value={STANDING_LABELS[project.standing]} />
                <Field label="Niveaux" value={project.levels} />
                <Field label="Pièces" value={project.roomCount} />
                <Field label="Chambres" value={project.bedroomCount} />
                <Field label="SDB / SDE / WC" value={`${project.bathroomCount} / ${project.showerRoomCount} / ${project.wcCount}`} />
                <Field label="Surface habitable" value={`${Number(project.surfaceHabitable)} m²`} />
                <Field label="Surface construite" value={project.surfaceConstruite ? `${Number(project.surfaceConstruite)} m²` : '—'} />
                <Field label="Cuisine" value={KITCHEN_TYPE_LABELS[project.kitchenType]} />
                <Field label="Toiture" value={ROOF_TYPE_LABELS[project.roofType]} />
                <Field label="Menuiserie" value={JOINERY_TYPE_LABELS[project.joineryType]} />
                <Field label="Revêtement de sol" value={FLOORING_TYPE_LABELS[project.flooringType]} />
                <Field label="Climatisation" value={AC_TYPE_LABELS[project.acType]} />
                <Field label="Terrain" value={TERRAIN_TYPE_LABELS[project.terrainType]} />
              </>
            )}
            <Field label="Localité" value={project.locality?.label ?? project.ville ?? '—'} />
            {project.scope === 'COMPLET' && <Field label="Assainissement" value={SANITATION_TYPE_LABELS[project.sanitationType]} />}
            {project.scope !== 'PISCINE_SEULE' && (
              <Field label="Clôture" value={project.fenceLength ? `${Number(project.fenceLength)} ml × ${project.fenceHeight ? Number(project.fenceHeight) : 2} m${project.gateCount ? ` · ${project.gateCount} portail(s)` : ''} · ${FENCE_POST_TYPE_LABELS[project.fencePostType] ?? project.fencePostType}${project.fenceHasCrepissage ? ' · Crépie' : ' · Brute'}${project.fenceHasChainageHaut ? ' · Chaînage haut' : ''}` : '—'} />
            )}
            {project.scope !== 'CLOTURE_SEULE' && (
              <Field label="Piscine" value={project.hasPool ? `Oui (${project.poolSurface ? Number(project.poolSurface) + ' m²' : '—'})` : 'Non'} />
            )}
            {project.scope === 'COMPLET' && <Field label="Aménagements extérieurs" value={project.hasExteriorLayout ? 'Oui' : 'Non'} />}
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
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Niveau</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600">Total HT</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/construction/estimates/${e.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-indigo-600">{e.reference}</td>
                    <td className="px-4 py-2.5 text-slate-500">v{e.version}</td>
                    <td className="px-4 py-2.5 text-slate-500">{PRECISION_LEVEL_LABELS[e.precisionLevel]}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(Number(e.totalHT))}</td>
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

      <GenerateEstimateModal open={generateOpen} onClose={() => setGenerateOpen(false)} project={project} />

      <ConfirmDialog open={deleteProjectOpen} title="Supprimer le projet"
        message={`Supprimer le projet ${project.reference} et toutes ses estimations ?`}
        confirmLabel="Supprimer" loading={deleteProject.isPending}
        onConfirm={async () => { const r = await deleteProject.mutateAsync(project.id); if (r.success) navigate('/construction'); }}
        onClose={() => setDeleteProjectOpen(false)} />

      <ConfirmDialog open={!!estimateToDelete} title="Supprimer l'estimation"
        message={`Supprimer l'estimation ${estimateToDelete?.reference ?? ''} ?`}
        confirmLabel="Supprimer" loading={deleteEstimate.isPending}
        onConfirm={async () => { await deleteEstimate.mutateAsync(estimateToDelete.id); setEstimateToDelete(null); }}
        onClose={() => setEstimateToDelete(null)} />
    </PageLayout>
  );
}
