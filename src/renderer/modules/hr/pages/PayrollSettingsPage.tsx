import { useEffect, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { Save, Plus, Trash2 } from 'lucide-react';
import { usePayrollRates, useSetPayrollRates } from '../hooks/useHr';

interface Bracket { upTo: number | null; rate: number }
interface RicfEntry { parts: number; monthly: number; annual: number }
interface SalaryCategory { code: string; label?: string; definition?: string; baseSalary: number }
interface Rates {
  cnpsEmployeeRate: number; cnpsEmployerRetirementRate: number; cnpsFamilyRate: number;
  cnpsWorkAccidentRate: number; cnpsCeiling: number; cnpsFamilyCeiling: number; transportExemptCeiling: number;
  cmuEmployee: number; cmuEmployer: number; insuranceRate: number; insuranceBase: number; itsEmployerRate: number;
  fdfpApprenticeshipRate: number; fdfpTrainingRate: number;
  itsBrackets: Bracket[];
  ricf: RicfEntry[];
  salaryCategories: SalaryCategory[];
}

const NUM_FIELDS: { key: keyof Rates; label: string; suffix: string }[] = [
  { key: 'cnpsEmployeeRate', label: 'CNPS retraite — part salarié', suffix: '%' },
  { key: 'cnpsEmployerRetirementRate', label: 'CNPS retraite — part employeur', suffix: '%' },
  { key: 'cnpsFamilyRate', label: 'Prestations familiales (employeur)', suffix: '%' },
  { key: 'cnpsWorkAccidentRate', label: 'Accident du travail (employeur)', suffix: '%' },
  { key: 'cnpsCeiling', label: 'Plafond retraite mensuel', suffix: 'FCFA' },
  { key: 'cnpsFamilyCeiling', label: 'Plafond PF / AT mensuel', suffix: 'FCFA' },
  { key: 'transportExemptCeiling', label: 'Plafond transport non imposable', suffix: 'FCFA' },
  { key: 'cmuEmployee', label: 'CMU — part salarié', suffix: 'FCFA' },
  { key: 'cmuEmployer', label: 'CMU — part employeur', suffix: 'FCFA' },
  { key: 'insuranceRate', label: 'Assurance maladie', suffix: '%' },
  { key: 'insuranceBase', label: 'Base assurance maladie', suffix: 'FCFA' },
  { key: 'itsEmployerRate', label: 'ITS patronale (employeur)', suffix: '%' },
  { key: 'fdfpApprenticeshipRate', label: 'FDFP taxe d\'apprentissage', suffix: '%' },
  { key: 'fdfpTrainingRate', label: 'FDFP formation continue', suffix: '%' },
];

export default function PayrollSettingsPage() {
  const { data: res, isLoading } = usePayrollRates();
  const save = useSetPayrollRates();
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    if (res?.success && res.data) setRates(res.data as Rates);
  }, [res]);

  if (isLoading || !rates) return <PageLayout title="Paramètres de paie"><Card><SkeletonTable rows={6} /></Card></PageLayout>;

  const setNum = (key: keyof Rates, v: string) => setRates({ ...rates, [key]: Number(v) || 0 } as Rates);
  const setBracket = (i: number, field: 'upTo' | 'rate', v: string) => {
    const next = rates.itsBrackets.map((b, idx) => idx === i
      ? { ...b, [field]: field === 'upTo' ? (v === '' ? null : Number(v)) : Number(v) || 0 }
      : b);
    setRates({ ...rates, itsBrackets: next });
  };
  const addBracket = () => setRates({ ...rates, itsBrackets: [...rates.itsBrackets, { upTo: null, rate: 0 }] });
  const removeBracket = (i: number) => setRates({ ...rates, itsBrackets: rates.itsBrackets.filter((_, idx) => idx !== i) });

  const ricf = rates.ricf ?? [];
  const setRicf = (i: number, field: 'parts' | 'monthly' | 'annual', v: string) => {
    const next = ricf.map((r, idx) => idx === i ? { ...r, [field]: Number(v) || 0 } : r);
    setRates({ ...rates, ricf: next });
  };
  const addRicf = () => setRates({ ...rates, ricf: [...ricf, { parts: 1, monthly: 0, annual: 0 }] });
  const removeRicf = (i: number) => setRates({ ...rates, ricf: ricf.filter((_, idx) => idx !== i) });

  const categories = rates.salaryCategories ?? [];
  const norm = (l?: string) => (l && l.trim() ? l.trim() : '');
  const setCategory = (i: number, field: 'code' | 'definition' | 'baseSalary', v: string) => {
    const next = categories.map((c, idx) => idx === i
      ? { ...c, [field]: field === 'baseSalary' ? (Number(v) || 0) : v }
      : c);
    setRates({ ...rates, salaryCategories: next });
  };
  const removeCategory = (i: number) => setRates({ ...rates, salaryCategories: categories.filter((_, idx) => idx !== i) });
  // Renomme un libellé de groupe : applique le nouveau libellé à toutes ses catégories.
  const renameGroup = (groupKey: string, newLabel: string) => {
    const next = categories.map((c) => (norm(c.label) === groupKey ? { ...c, label: newLabel } : c));
    setRates({ ...rates, salaryCategories: next });
  };
  const addCategoryToGroup = (label: string) =>
    setRates({ ...rates, salaryCategories: [...categories, { code: '', label, baseSalary: 0 }] });
  const addGroup = () => setRates({ ...rates, salaryCategories: [...categories, { code: '', label: '', baseSalary: 0 }] });

  // Regroupe les catégories par libellé (clé normalisée), en conservant l'index
  // d'origine pour l'édition.
  const groups: { key: string; items: { cat: SalaryCategory; index: number }[] }[] = [];
  categories.forEach((cat, index) => {
    const key = norm(cat.label);
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push({ cat, index });
  });

  return (
    <PageLayout
      title="Paramètres de paie"
      breadcrumbs={[{ label: 'RH & Paie' }, { label: 'Paie', to: '/hr/payslips' }, { label: 'Paramètres' }]}
      actions={
        <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate(rates)}>
          Enregistrer
        </Button>
      }
    >
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Taux et barèmes de référence (Côte d'Ivoire) — à vérifier et ajuster selon la réglementation
        en vigueur avant exploitation.
      </div>

      <Card className="mb-4">
        <h3 className="mb-3 rounded bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">Cotisations & charges</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NUM_FIELDS.map((f) => (
            <Input
              key={f.key}
              label={`${f.label} (${f.suffix})`}
              type="number"
              step={f.suffix === '%' ? '0.1' : '1000'}
              min="0"
              value={String(rates[f.key] as number)}
              onChange={(e) => setNum(f.key, e.target.value)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between rounded bg-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-800">Barème ITS mensuel (progressif par tranches)</h3>
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addBracket}>Ajouter une tranche</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1">Jusqu'à (FCFA, vide = au-delà)</th>
              <th className="py-1">Taux (%)</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rates.itsBrackets.map((b, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input type="number" step="1000" min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={b.upTo == null ? '' : String(b.upTo)}
                    placeholder="au-delà"
                    onChange={(e) => setBracket(i, 'upTo', e.target.value)} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" step="0.1" min="0"
                    className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={String(b.rate)}
                    onChange={(e) => setBracket(i, 'rate', e.target.value)} />
                </td>
                <td className="py-1">
                  <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeBracket(i)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between rounded bg-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-800">Réduction d'Impôt pour Charges de Famille (RICF)</h3>
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addRicf}>Ajouter une ligne</Button>
        </div>
        <p className="mb-2 text-xs text-slate-400">Réduction d'impôt accordée selon le nombre de parts IGR de l'employé.</p>
        {ricf.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Aucune réduction. Renseignez la réduction mensuelle et annuelle pour chaque nombre de parts.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 w-32">Nombre de parts</th>
                <th className="py-1">Réduction mensuelle (FCFA)</th>
                <th className="py-1">Réduction annuelle (FCFA)</th>
                <th className="py-1 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {ricf.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input type="number" step="0.5" min="0"
                      className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={String(r.parts)} onChange={(e) => setRicf(i, 'parts', e.target.value)} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" step="1" min="0"
                      className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={String(r.monthly)} onChange={(e) => setRicf(i, 'monthly', e.target.value)} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" step="1" min="0"
                      className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={String(r.annual)} onChange={(e) => setRicf(i, 'annual', e.target.value)} />
                  </td>
                  <td className="py-1">
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeRicf(i)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between rounded bg-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-800">Catégories socio-professionnelles</h3>
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addGroup}>Ajouter un libellé</Button>
        </div>
        {categories.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Aucune catégorie. Exemple : « 1A » → 155 475 FCFA de salaire de base.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.items[0].index}>
                {/* Sous-titre = libellé du groupe (éditable : renomme toutes ses catégories) */}
                <div className="mb-2 flex items-center gap-2 rounded bg-slate-200 px-2 py-1">
                  <input
                    type="text"
                    placeholder="Sans libellé (ex: Ouvriers, Employés, Cadres…)"
                    className="flex-1 bg-transparent text-sm font-semibold text-[#1E3A5F] focus:outline-none"
                    value={g.key}
                    onChange={(e) => renameGroup(g.key, e.target.value)}
                  />
                  <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => addCategoryToGroup(g.key)}>
                    Catégorie
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1 w-32">Code</th>
                      <th className="py-1">Définition (optionnel)</th>
                      <th className="py-1 w-44">Salaire de base (FCFA)</th>
                      <th className="py-1 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(({ cat, index }) => (
                      <tr key={index}>
                        <td className="py-1 pr-2 align-top">
                          <input type="text" placeholder="ex: 1A"
                            className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={cat.code} onChange={(e) => setCategory(index, 'code', e.target.value)} />
                        </td>
                        <td className="py-1 pr-2">
                          <input type="text" placeholder="ex: Manœuvre ordinaire"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={cat.definition ?? ''} onChange={(e) => setCategory(index, 'definition', e.target.value)} />
                        </td>
                        <td className="py-1 pr-2 align-top">
                          <input type="number" step="1" min="0"
                            className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={String(cat.baseSalary)} onChange={(e) => setCategory(index, 'baseSalary', e.target.value)} />
                        </td>
                        <td className="py-1 align-top">
                          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => removeCategory(index)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
