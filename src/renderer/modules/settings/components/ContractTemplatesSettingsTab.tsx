import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useContractTemplates, useSaveContractTemplate, useDeleteContractTemplate,
  useContractFunctions, useSaveContractFunction, useDeleteContractFunction,
  useContractObjectives, useSaveContractObjective, useDeleteContractObjective,
  useJobDescriptionTemplates, useSaveJobDescriptionTemplate, useDeleteJobDescriptionTemplate,
} from '../../hr/hooks/useHr';
import { CONTRACT_TYPE_LABEL } from '../../hr/types/hr.types';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate } from '../../../shared/utils/format';
import { Plus, Edit, Trash2, FileText, Copy, Save, X, ListChecks, ClipboardList } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(CONTRACT_TYPE_LABEL).map(([value, label]) => ({ value, label })),
];

/**
 * Onglet « Modèles de contrats de travail » (Paramètres → Modèles d'imprimés).
 * Deux vues : les modèles éditables et le référentiel des fonctions de l'employé.
 */
type SubView = 'templates' | 'functions' | 'objectives' | 'fiches';

export default function ContractTemplatesSettingsTab() {
  const [searchParams] = useSearchParams();
  const subParam = searchParams.get('sub');
  const role = useAuthStore((s) => s.user?.role) ?? '';
  // MANAGER n'accède qu'au référentiel « Objectifs assignés » ; la configuration
  // des contrats (modèles, fonctions, fiches de poste) reste réservée admins/RH.
  const canManageContractConfig = ['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT'].includes(role);
  const initial: SubView = !canManageContractConfig
    ? 'objectives'
    : subParam === 'fonctions' ? 'functions'
    : subParam === 'objectifs' ? 'objectives'
    : subParam === 'fiches' ? 'fiches'
    : 'templates';
  const [view, setView] = useState<SubView>(initial);
  // Sécurité UI : un rôle non-config ne peut voir que la vue Objectifs.
  const effectiveView: SubView = canManageContractConfig ? view : 'objectives';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canManageContractConfig && (
          <>
            <Button variant={effectiveView === 'templates' ? 'primary' : 'secondary'} icon={<FileText className="h-4 w-4" />}
              onClick={() => setView('templates')}>Modèles de contrats</Button>
            <Button variant={effectiveView === 'functions' ? 'primary' : 'secondary'} icon={<ListChecks className="h-4 w-4" />}
              onClick={() => setView('functions')}>Fonctions</Button>
          </>
        )}
        <Button variant={effectiveView === 'objectives' ? 'primary' : 'secondary'} icon={<ListChecks className="h-4 w-4" />}
          onClick={() => setView('objectives')}>Objectifs assignés</Button>
        {canManageContractConfig && (
          <Button variant={effectiveView === 'fiches' ? 'primary' : 'secondary'} icon={<ClipboardList className="h-4 w-4" />}
            onClick={() => setView('fiches')}>Fiches de poste</Button>
        )}
      </div>
      {effectiveView === 'templates' && <TemplatesView />}
      {effectiveView === 'functions' && <FunctionsView />}
      {effectiveView === 'objectives' && <ObjectivesView />}
      {effectiveView === 'fiches' && <FichesView />}
    </div>
  );
}

/** Vue : modèles de contrats de travail (zones, variables, import). */
function TemplatesView() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const { data, isLoading } = useContractTemplates();
  const deleteTemplate = useDeleteContractTemplate();
  const saveTemplate = useSaveContractTemplate();
  const [toDelete, setToDelete] = useState<any>(null);

  const templates: any[] = useMemo(() => {
    const all: any[] = data?.data ?? [];
    return type ? all.filter((t) => t.type === type) : all;
  }, [data, type]);

  const handleDelete = async () => {
    if (toDelete) await deleteTemplate.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  /** Crée une copie indépendante d'un modèle (sans son flag « par défaut »). */
  const handleDuplicate = async (t: any) => {
    await saveTemplate.mutateAsync({
      payload: {
        name: `Copie de ${t.name}`,
        type: t.type,
        header: t.header ?? '',
        headerWidth: t.headerWidth ?? 100,
        headerHeight: t.headerHeight ?? 140,
        body: t.body ?? '',
        footer: t.footer ?? '',
        footerWidth: t.footerWidth ?? 100,
        footerHeight: t.footerHeight ?? 140,
        footerBgColor: t.footerBgColor ?? null,
        endOfDocument: t.endOfDocument ?? '',
        endOfDocumentWidth: t.endOfDocumentWidth ?? 100,
        endOfDocumentHeight: t.endOfDocumentHeight ?? 140,
        endOfDocumentBgColor: t.endOfDocumentBgColor ?? null,
        isActive: t.isActive ?? true,
        isDefault: false,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/hr/contracts/templates/new')}>
          Nouveau modèle
        </Button>
      </div>

      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-56">
          <Select label="Type de contrat" options={TYPE_OPTIONS} value={type}
            onChange={(e) => setType(e.target.value)} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Aucun modèle"
            description="Créez un modèle de contrat de travail enrichi avec en-tête, corps, fin du document, pied de page et variables dynamiques."
            action={{ label: 'Nouveau modèle', onClick: () => navigate('/hr/contracts/templates/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type de contrat</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Par défaut</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modifié le</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{CONTRACT_TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="px-4 py-3">
                    {t.isDefault
                      ? <Badge variant="success">Par défaut</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                        title="Modifier"
                        onClick={() => navigate(`/hr/contracts/templates/${t.id}/edit`)} />
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />}
                        title="Dupliquer"
                        loading={saveTemplate.isPending}
                        onClick={() => handleDuplicate(t)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />}
                        title="Supprimer"
                        onClick={() => setToDelete(t)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le modèle"
        message={`Supprimer le modèle « ${toDelete?.name ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

interface FnEditState { id?: number; titre: string; contenu: string; isActive: boolean }

/**
 * Vue : référentiel des « Fonctions de l'employé ». Chaque fonction a un titre
 * et un contenu (une ligne = un élément, affiché en liste à puces). Le contenu
 * alimente la variable {{contrat.fonction.contenu}} des contrats.
 */
function FunctionsView() {
  const { data, isLoading } = useContractFunctions(true);
  const save = useSaveContractFunction();
  const del = useDeleteContractFunction();
  const functions: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<FnEditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ titre: '', contenu: '', isActive: true });
  const startEdit = (f: any) => setEditing({ id: f.id, titre: f.titre, contenu: f.contenu ?? '', isActive: f.isActive });

  const onSave = async () => {
    if (!editing || !editing.titre.trim()) return;
    const payload = { titre: editing.titre.trim(), contenu: editing.contenu, isActive: editing.isActive };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    if (toDelete) await del.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  const previewItems = (txt: string) => txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Fonctions sélectionnables sur un contrat. Le contenu (une ligne = un élément) s'affiche en liste à puces.
        </p>
        {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouvelle fonction</Button>}
      </div>

      {editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier la fonction' : 'Nouvelle fonction'}</h3>
          <Input label="Titre *" value={editing.titre}
            onChange={(e) => setEditing({ ...editing, titre: e.target.value })}
            placeholder="Ex : Comptable, Chef de projet…" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Textarea
              label="Contenu (une ligne = un élément de liste)"
              rows={8}
              value={editing.contenu}
              onChange={(e) => setEditing({ ...editing, contenu: e.target.value })}
              placeholder={'Tenir la comptabilité générale\nÉtablir les états financiers\nSuivre la trésorerie'}
            />
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Aperçu</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[8rem]">
                {previewItems(editing.contenu).length ? (
                  <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                    {previewItems(editing.contenu).map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                ) : <p className="text-sm text-slate-400">La liste apparaîtra ici.</p>}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive}
              onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : functions.length === 0 ? (
          <EmptyState title="Aucune fonction"
            description="Créez des fonctions (titre + contenu en liste) sélectionnables sur les contrats."
            action={{ label: 'Nouvelle fonction', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Titre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Éléments</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {functions.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{f.titre}</td>
                  <td className="px-4 py-3 text-slate-500">{previewItems(f.contenu ?? '').length} élément(s)</td>
                  <td className="px-4 py-3">
                    {f.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} title="Modifier" onClick={() => startEdit(f)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} title="Supprimer" onClick={() => setToDelete(f)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la fonction"
        message={`Supprimer la fonction « ${toDelete?.titre ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

/**
 * Vue : référentiel des « Objectifs assignés ». Même principe que les fonctions
 * (titre + contenu en liste). Le contenu alimente la variable
 * {{contrat.objectifs.contenu}} des contrats et fiches de poste.
 */
function ObjectivesView() {
  const { data, isLoading } = useContractObjectives(true);
  const save = useSaveContractObjective();
  const del = useDeleteContractObjective();
  const objectives: any[] = data?.data ?? [];

  const [editing, setEditing] = useState<FnEditState | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);

  const startNew = () => setEditing({ titre: '', contenu: '', isActive: true });
  const startEdit = (o: any) => setEditing({ id: o.id, titre: o.titre, contenu: o.contenu ?? '', isActive: o.isActive });

  const onSave = async () => {
    if (!editing || !editing.titre.trim()) return;
    const payload = { titre: editing.titre.trim(), contenu: editing.contenu, isActive: editing.isActive };
    const r = await save.mutateAsync({ id: editing.id, payload });
    if (r.success) setEditing(null);
  };

  const handleDelete = async () => {
    if (toDelete) await del.mutateAsync(toDelete.id);
    setToDelete(null);
  };

  const previewItems = (txt: string) => txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Objectifs sélectionnables sur un contrat. Le contenu (une ligne = un élément) s'affiche en liste à puces.
        </p>
        {!editing && <Button icon={<Plus className="h-4 w-4" />} onClick={startNew}>Nouveaux objectifs</Button>}
      </div>

      {editing && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Modifier les objectifs' : 'Nouveaux objectifs'}</h3>
          <Input label="Titre *" value={editing.titre}
            onChange={(e) => setEditing({ ...editing, titre: e.target.value })}
            placeholder="Ex : Objectifs commerciaux, Objectifs de production…" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Textarea
              label="Contenu (une ligne = un élément de liste)"
              rows={8}
              value={editing.contenu}
              onChange={(e) => setEditing({ ...editing, contenu: e.target.value })}
              placeholder={'Atteindre 20 ventes par mois\nFidéliser le portefeuille client\nRespecter les délais de livraison'}
            />
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Aperçu</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[8rem]">
                {previewItems(editing.contenu).length ? (
                  <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                    {previewItems(editing.contenu).map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                ) : <p className="text-sm text-slate-400">La liste apparaîtra ici.</p>}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editing.isActive}
              onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Actifs
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setEditing(null)}>Annuler</Button>
            <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={onSave}>Enregistrer</Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : objectives.length === 0 ? (
          <EmptyState title="Aucun objectif"
            description="Créez des objectifs (titre + contenu en liste) sélectionnables sur les contrats."
            action={{ label: 'Nouveaux objectifs', onClick: startNew }} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Titre</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Éléments</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objectives.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{o.titre}</td>
                  <td className="px-4 py-3 text-slate-500">{previewItems(o.contenu ?? '').length} élément(s)</td>
                  <td className="px-4 py-3">
                    {o.isActive ? <Badge variant="success">Actifs</Badge> : <Badge variant="default">Inactifs</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} title="Modifier" onClick={() => startEdit(o)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} title="Supprimer" onClick={() => setToDelete(o)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer les objectifs"
        message={`Supprimer « ${toDelete?.titre ?? ''} » ?`}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

/** Vue : modèles de fiche de poste (zones, variables, import — comme les contrats). */
function FichesView() {
  const navigate = useNavigate();
  const { data, isLoading } = useJobDescriptionTemplates();
  const save = useSaveJobDescriptionTemplate();
  const del = useDeleteJobDescriptionTemplate();
  const templates: any[] = data?.data ?? [];
  const [toDelete, setToDelete] = useState<any>(null);

  const handleDuplicate = async (t: any) => {
    await save.mutateAsync({
      payload: {
        name: `Copie de ${t.name}`,
        header: t.header ?? '', headerWidth: t.headerWidth ?? 100, headerHeight: t.headerHeight ?? 140,
        body: t.body ?? '',
        footer: t.footer ?? '', footerWidth: t.footerWidth ?? 100, footerHeight: t.footerHeight ?? 140, footerBgColor: t.footerBgColor ?? null,
        endOfDocument: t.endOfDocument ?? '', endOfDocumentWidth: t.endOfDocumentWidth ?? 100,
        endOfDocumentHeight: t.endOfDocumentHeight ?? 140, endOfDocumentBgColor: t.endOfDocumentBgColor ?? null,
        isActive: t.isActive ?? true, isDefault: false,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/hr/job-descriptions/templates/new')}>
          Nouveau modèle
        </Button>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="Aucun modèle de fiche de poste"
            description="Créez un modèle de fiche de poste (en-tête, corps, fin, pied de page et variables du contrat)."
            action={{ label: 'Nouveau modèle', onClick: () => navigate('/hr/job-descriptions/templates/new') }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Par défaut</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modifié le</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <ClipboardList className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.isDefault ? <Badge variant="success">Par défaut</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />} title="Modifier"
                        onClick={() => navigate(`/hr/job-descriptions/templates/${t.id}/edit`)} />
                      <Button variant="ghost" size="sm" icon={<Copy className="h-4 w-4" />} title="Dupliquer"
                        loading={save.isPending} onClick={() => handleDuplicate(t)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} title="Supprimer"
                        onClick={() => setToDelete(t)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le modèle"
        message={`Supprimer le modèle « ${toDelete?.name ?? ''} » ?`}
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
