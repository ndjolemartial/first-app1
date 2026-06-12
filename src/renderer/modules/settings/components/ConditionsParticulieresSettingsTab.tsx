import { useEffect, useState } from 'react';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useConditionsParticulieres, useUpdateConditionsParticulieres } from '../hooks/useSettings';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { FileText, Plus, Trash2, Save } from 'lucide-react';

// Édition accessible aux admins, managers et comptables.
const EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

interface InfoItem { title: string; text: string }

/**
 * Paramétrage des « Informations particulières » : une liste d'éléments (titre +
 * texte multi-lignes) proposés dans le formulaire de convention (types hérités)
 * via un sélecteur avec recherche (par titre ou par contenu). La valeur choisie
 * (le texte) est ensuite disponible comme variable de modèle
 * ({{convention.conditionsParticulieres}}) pour les conventions et attestations.
 */
export default function ConditionsParticulieresSettingsTab() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canEdit = EDIT_ROLES.includes(role);

  const { data: res, isLoading } = useConditionsParticulieres();
  const update = useUpdateConditionsParticulieres();

  const [items, setItems] = useState<InfoItem[]>([]);

  useEffect(() => {
    if (res?.success && Array.isArray(res.data)) setItems(res.data as InfoItem[]);
  }, [res]);

  if (isLoading) return <SkeletonTable rows={4} />;

  const patchItem = (idx: number, patch: Partial<InfoItem>) =>
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeItem = (idx: number) => setItems((xs) => xs.filter((_, i) => i !== idx));
  const addItem = () => setItems((xs) => [...xs, { title: '', text: '' }]);

  const handleSave = () => {
    // On retire les entrées sans texte avant l'enregistrement.
    update.mutate(
      items
        .map((it) => ({ title: it.title.trim(), text: it.text.trim() }))
        .filter((it) => it.text.length > 0),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Informations particulières</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Liste de textes (multi-lignes) proposés dans le formulaire de convention pour
              les conventions héritées. L'utilisateur en sélectionne un via un champ de
              recherche.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune information particulière définie pour l'instant.</p>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 border border-slate-100 rounded-lg p-3">
                <span className="mt-2 text-xs font-medium text-slate-400 w-6 text-right">{idx + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={item.title}
                    onChange={(e) => patchItem(idx, { title: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Titre (utilisé pour la recherche)…"
                  />
                  <Textarea
                    rows={4}
                    value={item.text}
                    onChange={(e) => patchItem(idx, { text: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Texte de l'information particulière (plusieurs lignes possibles)…"
                  />
                </div>
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Supprimer"
                    onClick={() => removeItem(idx)}
                    className="mt-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}

          {canEdit && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={addItem}>
                Ajouter une information
              </Button>
              <Button icon={<Save className="h-4 w-4" />} onClick={handleSave} loading={update.isPending}>
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
