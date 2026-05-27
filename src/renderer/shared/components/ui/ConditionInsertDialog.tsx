import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import { buildConditionalSnippet } from '../../utils/templateConditionals';

interface VariableItem {
  token: string;
  label: string;
}
interface VariableGroup {
  group: string;
  items: VariableItem[];
}

interface ConditionInsertDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback : reçoit le bloc `{{#si …}}…{{/si}}` prêt à être inséré. */
  onInsert: (snippet: string) => void;
  /** Variables disponibles (mêmes groupes que le bouton « Variables »). */
  variables: VariableGroup[];
}

const OPERATOR_OPTIONS = [
  { value: '==', label: 'est égale à' },
  { value: '!=', label: 'est différente de' },
];

/**
 * Modale d'insertion d'une condition dans le RichTextEditor.
 *
 * L'utilisateur choisit une variable, un opérateur, une valeur attendue,
 * le texte à afficher si la condition est vraie et — optionnellement — un
 * texte alternatif. La modale produit un bloc `{{#si …}}…{{/si}}` que le
 * moteur de conditions résout au moment du rendu du document.
 */
export default function ConditionInsertDialog({
  open, onClose, onInsert, variables,
}: ConditionInsertDialogProps) {
  const [variable, setVariable] = useState('');
  const [operator, setOperator] = useState<'==' | '!='>('==');
  const [expected, setExpected] = useState('');
  const [trueText, setTrueText] = useState('');
  const [falseText, setFalseText] = useState('');

  // Réinitialise les champs à chaque ouverture.
  useEffect(() => {
    if (open) {
      setVariable(variables[0]?.items[0]?.token ?? '');
      setOperator('==');
      setExpected('');
      setTrueText('');
      setFalseText('');
    }
  }, [open, variables]);

  const canInsert = variable.trim() !== '' && trueText.trim() !== '';

  const handleInsert = () => {
    if (!canInsert) return;
    const snippet = buildConditionalSnippet({
      variable, operator, expected, trueText, falseText,
    });
    onInsert(snippet);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Insérer une condition"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleInsert} disabled={!canInsert}>Insérer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Le texte sera affiché dans le document généré uniquement si la condition est vérifiée.
          Sinon, le texte alternatif (s'il est renseigné) sera utilisé.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Variable</label>
            <select
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {variables.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((it) => (
                    <option key={it.token} value={it.token}>{it.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Select
            label="Opérateur"
            options={OPERATOR_OPTIONS}
            value={operator}
            onChange={(e) => setOperator(e.target.value as '==' | '!=')}
          />
        </div>

        <Input
          label="Valeur attendue"
          placeholder="Ex : MADAME, ENTREPRISE, SOLDE…"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
        <p className="text-xs text-slate-500 -mt-2">
          La comparaison est sensible à la casse. Pour les énumérations
          (civilité, type d'attestation…), utilisez la valeur exacte (ex.
          MADAME et non « Madame »).
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Texte affiché si la condition est vraie *
          </label>
          <textarea
            value={trueText}
            onChange={(e) => setTrueText(e.target.value)}
            placeholder="Ex : Vous avez droit à une remise"
            rows={3}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Texte alternatif (sinon, optionnel)
          </label>
          <textarea
            value={falseText}
            onChange={(e) => setFalseText(e.target.value)}
            placeholder="Laisser vide si rien ne doit s'afficher dans le cas contraire."
            rows={3}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </Modal>
  );
}
