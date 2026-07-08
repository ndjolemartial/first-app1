import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useQuote, useCreateQuote, useUpdateQuote, useQuoteUnits } from '../hooks/useQuotes';
import QuoteUnitModal from '../components/QuoteUnitModal';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { useProperties } from '../../properties/hooks/useProperties';
import { QUOTE_TYPE_LABELS } from '../utils/quoteTemplate';
import { formatCurrency, formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';
import CatalogPicker, { CatalogPick } from '../../../shared/components/CatalogPicker';
import { useCatalog } from '../../../shared/hooks/useCatalog';
import { Save, Plus, Trash2 } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(QUOTE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const MODALITES_OPTIONS = [
  { value: 'CASH', label: 'Comptant' },
  { value: 'SUR_3_MOIS', label: 'Sur 3 mois' },
  { value: 'SUR_6_MOIS', label: 'Sur 6 mois' },
  { value: 'SUR_9_MOIS', label: 'Sur 9 mois' },
  { value: 'SUR_12_MOIS', label: 'Sur 12 mois' },
  { value: 'SUR_24_MOIS', label: 'Sur 24 mois' },
  { value: 'SUR_36_MOIS', label: 'Sur 36 mois' },
  { value: 'SUR_48_MOIS', label: 'Sur 48 mois' },
  { value: 'SUR_60_MOIS', label: 'Sur 60 mois' },
  { value: 'SUR_PLUS_60_MOIS', label: 'Plus de 60 mois' },
];

interface Line { designation: string; category: string; quantity: string; unit: string; unitPrice: string; }

function toDateInput(v?: string | Date | null): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Champ montant pouvant être saisi en valeur fixe (XOF) ou en pourcentage.
 * Le basculement XOF/% est affiché à droite du libellé ; `hint` indique
 * l'équivalent calculé (ex. « = 50 000 FCFA »).
 */
function AmountPercentField({ label, isPercent, onModeChange, value, onValueChange, hint }: {
  label: string;
  isPercent: boolean;
  onModeChange: (percent: boolean) => void;
  value: string;
  onValueChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-slate-700">{label}</label>
        <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
          <button type="button" onClick={() => onModeChange(false)}
            className={`px-2 py-0.5 text-xs transition-colors ${!isPercent ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>XOF</button>
          <button type="button" onClick={() => onModeChange(true)}
            className={`px-2 py-0.5 text-xs transition-colors ${isPercent ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>%</button>
        </div>
      </div>
      <div className="relative">
        <input
          type="number" min="0" step={isPercent ? '0.01' : '1'} max={isPercent ? '100' : undefined}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{isPercent ? '%' : 'XOF'}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function QuoteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token)!;

  const { data: res } = useQuote(isEdit ? Number(id) : 0);
  const create = useCreateQuote();
  const update = useUpdateQuote();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);

  const [recipientType, setRecipientType] = useState<'CLIENT' | 'PROSPECT'>('CLIENT');
  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  const [prospectId, setProspectId] = useState(searchParams.get('prospectId') ?? '');
  const [type, setType] = useState('PRESTATION');
  const [objet, setObjet] = useState('');
  const [assetType, setAssetType] = useState<'NONE' | 'TERRAIN' | 'PROPERTY'>('NONE');
  const [terrainId, setTerrainId] = useState(searchParams.get('terrainId') ?? '');
  const [propertyId, setPropertyId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [depositExpected, setDepositExpected] = useState('');
  const [depositIsPercent, setDepositIsPercent] = useState(false);
  const [depositPercent, setDepositPercent] = useState('');
  const [paymentModalites, setPaymentModalites] = useState('CASH');
  const [installmentCount, setInstallmentCount] = useState('');
  const [notes, setNotes] = useState('');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<Line[]>([{ designation: '', category: '', quantity: '1', unit: '', unitPrice: '0' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const { data: unitsRes } = useQuoteUnits();
  const unitOptions = [
    { value: '', label: '— Aucune —' },
    ...((unitsRes?.success && unitsRes.data ? unitsRes.data : []).map((u: any) => ({ value: u.label, label: u.label }))),
  ];

  useEffect(() => {
    if (searchParams.get('prospectId')) setRecipientType('PROSPECT');
    if (searchParams.get('terrainId')) setAssetType('TERRAIN');
  }, [searchParams]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const q = res.data;
      setRecipientType(q.clientId ? 'CLIENT' : 'PROSPECT');
      setClientId(q.clientId ? String(q.clientId) : '');
      setProspectId(q.prospectId ? String(q.prospectId) : '');
      setType(q.type ?? 'VENTE_TERRAIN');
      setObjet(q.objet ?? '');
      if (q.terrainId) { setAssetType('TERRAIN'); setTerrainId(String(q.terrainId)); }
      else if (q.propertyId) { setAssetType('PROPERTY'); setPropertyId(String(q.propertyId)); }
      setValidUntil(toDateInput(q.validUntil));
      setDiscountAmount(String(Number(q.discountAmount ?? 0)));
      setDiscountIsPercent(Boolean(q.discountIsPercent));
      setDiscountPercent(q.discountPercent != null ? String(Number(q.discountPercent)) : '0');
      setTaxRate(String(Number(q.taxRate ?? 0)));
      setDepositExpected(q.depositExpected != null ? String(Number(q.depositExpected)) : '');
      setDepositIsPercent(Boolean(q.depositIsPercent));
      setDepositPercent(q.depositPercent != null ? String(Number(q.depositPercent)) : '');
      setPaymentModalites(q.paymentModalites ?? 'CASH');
      setInstallmentCount(q.installmentCount != null ? String(q.installmentCount) : '');
      setNotes(q.notes ?? '');
      setConditions(q.conditions ?? '');
      setItems((q.items ?? []).length
        ? q.items.map((it: any) => ({ designation: it.designation, category: it.category ?? '', quantity: String(Number(it.quantity)), unit: it.unit ?? '', unitPrice: String(Number(it.unitPrice)) }))
        : [{ designation: '', category: '', quantity: '1', unit: '', unitPrice: '0' }]);
    }
  }, [res, isEdit]);

  const totals = useMemo(() => {
    const lines = items.map((i) => Math.round((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) * 100) / 100);
    const subtotal = lines.reduce((s, l) => s + l, 0);
    // Remise : montant fixe (XOF) ou pourcentage du sous-total.
    const effectiveDiscount = discountIsPercent
      ? Math.round(subtotal * ((Number(discountPercent) || 0) / 100) * 100) / 100
      : (Number(discountAmount) || 0);
    const base = Math.max(0, subtotal - effectiveDiscount);
    const taxAmount = Math.round(base * (Number(taxRate) || 0)) / 100;
    const total = Math.round((base + taxAmount) * 100) / 100;
    // Acompte : montant fixe (XOF) ou pourcentage du total TTC.
    const effectiveDeposit = depositIsPercent
      ? Math.round(total * ((Number(depositPercent) || 0) / 100) * 100) / 100
      : (depositExpected !== '' ? Number(depositExpected) || 0 : null);
    return { subtotal, taxAmount, total, lines, effectiveDiscount, effectiveDeposit };
  }, [items, discountAmount, discountIsPercent, discountPercent, taxRate, depositExpected, depositIsPercent, depositPercent]);

  // Catégories suggérées (datalist) : celles du catalogue + celles déjà saisies.
  const { data: catalogRes } = useCatalog({});
  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of (catalogRes?.data ?? [])) if (c.category) set.add(String(c.category));
    for (const l of items) if (l.category?.trim()) set.add(l.category.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalogRes, items]);

  const clientOptions = [{ value: '', label: '— Choisir un client —' }, ...(clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: formatPersonName(c, '') }))];
  const prospectOptions = [{ value: '', label: '— Choisir un prospect —' }, ...(prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() }))];
  const terrainOptions = [{ value: '', label: '— Choisir un terrain —' }, ...(terrainsRes?.data ?? []).map((t: any) => ({ value: String(t.id), label: `${t.reference}${t.numeroParcelle ? ` — parc. ${t.numeroParcelle}` : ''}` }))];
  const propertyOptions = [{ value: '', label: '— Choisir un bien —' }, ...(propertiesRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: `${p.reference} — ${p.address ?? ''}` }))];

  // Recherche côté serveur : l'élément s'affiche quel que soit le volume.
  const searchClients = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.clients.list(token, filters, page, limit),
        (c: any) => ({ value: String(c.id), label: formatPersonName(c, '') }),
      ),
    [token],
  );
  const searchProspects = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.prospects.list(token, filters, page, limit),
        (p: any) => ({ value: String(p.id), label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() }),
      ),
    [token],
  );
  const searchTerrains = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.terrains.list(token, filters, page, limit),
        (t: any) => ({ value: String(t.id), label: `${t.reference}${t.numeroParcelle ? ` — parc. ${t.numeroParcelle}` : ''}` }),
      ),
    [token],
  );
  const searchProperties = useMemo(
    () =>
      makeEntitySearch(
        (filters, page, limit) => window.electron.properties.list(token, filters, page, limit),
        (p: any) => ({ value: String(p.id), label: `${p.reference} — ${p.address ?? ''}` }),
      ),
    [token],
  );

  const setLine = (idx: number, patch: Partial<Line>) =>
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setItems((prev) => [...prev, { designation: '', category: '', quantity: '1', unit: '', unitPrice: '0' }]);
  const removeLine = (idx: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  // Ajout depuis le catalogue : remplit la dernière ligne vide ou en ajoute une.
  const addFromCatalog = (it: CatalogPick) => setItems((prev) => {
    const line = { designation: it.designation, category: it.category ?? '', quantity: '1', unit: '', unitPrice: String(Math.round(it.unitPrice)) };
    const last = prev[prev.length - 1];
    if (last && !last.designation.trim() && (!last.unitPrice || Number(last.unitPrice) === 0)) {
      return prev.map((l, i) => (i === prev.length - 1 ? line : l));
    }
    return [...prev, line];
  });

  const handleSave = async () => {
    setError('');
    if (recipientType === 'CLIENT' && !clientId) { setError('Sélectionnez un client'); return; }
    if (recipientType === 'PROSPECT' && !prospectId) { setError('Sélectionnez un prospect'); return; }
    const validItems = items.filter((i) => i.designation.trim());
    if (validItems.length === 0) { setError('Ajoutez au moins une ligne au devis'); return; }

    setSaving(true);
    const payload: any = {
      type,
      objet: objet.trim() || null,
      clientId: recipientType === 'CLIENT' && clientId ? Number(clientId) : null,
      prospectId: recipientType === 'PROSPECT' && prospectId ? Number(prospectId) : null,
      terrainId: assetType === 'TERRAIN' && terrainId ? Number(terrainId) : null,
      propertyId: assetType === 'PROPERTY' && propertyId ? Number(propertyId) : null,
      agentId: currentUserId ?? null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      discountIsPercent,
      discountPercent: discountIsPercent ? (Number(discountPercent) || 0) : null,
      discountAmount: discountIsPercent ? 0 : (Number(discountAmount) || 0),
      taxRate: Number(taxRate) || 0,
      depositIsPercent,
      depositPercent: depositIsPercent ? (Number(depositPercent) || 0) : null,
      depositExpected: depositIsPercent ? null : (depositExpected ? Number(depositExpected) : null),
      paymentModalites,
      installmentCount: paymentModalites !== 'CASH' && installmentCount ? Number(installmentCount) : null,
      notes: notes || undefined,
      conditions: conditions || undefined,
      items: validItems.map((i) => ({ designation: i.designation.trim(), category: i.category.trim() || null, quantity: Number(i.quantity) || 1, unit: i.unit.trim() || null, unitPrice: Number(i.unitPrice) || 0 })),
    };
    const r = isEdit ? await update.mutateAsync({ id: Number(id), payload }) : await create.mutateAsync(payload);
    setSaving(false);
    if (r.success) navigate(`/quotes/${r.data?.id ?? id}`);
    else setError(typeof r.error === 'string' ? r.error : 'Échec de l\'enregistrement');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le devis' : 'Nouveau devis'}
      breadcrumbs={[{ label: 'Devis', to: '/quotes' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Destinataire & objet</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type de destinataire" value={recipientType}
              options={[{ value: 'CLIENT', label: 'Client' }, { value: 'PROSPECT', label: 'Prospect' }]}
              onChange={(e) => setRecipientType(e.target.value as any)} />
            {recipientType === 'CLIENT'
              ? <SearchSelect label="Client *" options={clientOptions} value={clientId} onChange={setClientId} onSearch={searchClients} placeholder="Rechercher un client…" />
              : <SearchSelect label="Prospect *" options={prospectOptions} value={prospectId} onChange={setProspectId} onSearch={searchProspects} placeholder="Rechercher un prospect…" />}
            <Select label="Type de devis *" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
            <Input label="Validité (jusqu'au)" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <Select label="Bien concerné" value={assetType}
              options={[{ value: 'NONE', label: 'Aucun' }, { value: 'TERRAIN', label: 'Un terrain' }, { value: 'PROPERTY', label: 'Un bien' }]}
              onChange={(e) => setAssetType(e.target.value as any)} />
            <Input label="Objet du devis" value={objet} onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex. : Aménagement de villa, Étude de viabilisation…" maxLength={255} />
            {assetType === 'TERRAIN' && <SearchSelect label="Terrain" options={terrainOptions} value={terrainId} onChange={setTerrainId} onSearch={searchTerrains} placeholder="Rechercher un terrain…" />}
            {assetType === 'PROPERTY' && <SearchSelect label="Bien" options={propertyOptions} value={propertyId} onChange={setPropertyId} onSearch={searchProperties} placeholder="Rechercher un bien…" />}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-slate-800">Lignes du devis</h3>
            <div className="flex items-end gap-2">
              <div className="w-72"><CatalogPicker onPick={addFromCatalog} placeholder="Ajouter depuis le catalogue…" /></div>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setUnitModalOpen(true)}>Gérer les unités</Button>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addLine}>Ligne vide</Button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-44">Catégorie</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Désignation</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-24">Qté</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 w-36">Unité</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-40">Prix unitaire</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600 w-40">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((line, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <input className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="(facultatif)" list="quote-categories"
                      value={line.category} onChange={(e) => setLine(idx, { category: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <input className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" placeholder="Désignation"
                      value={line.designation} onChange={(e) => setLine(idx, { designation: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="1" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                      value={line.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <SearchSelect options={unitOptions} value={line.unit} onChange={(v) => setLine(idx, { unit: v })} placeholder="(facultatif)" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="1" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                      value={line.unitPrice} onChange={(e) => setLine(idx, { unitPrice: e.target.value })} />
                  </td>
                  <td className="px-2 py-2 text-right font-medium">{formatCurrency(totals.lines[idx] ?? 0)}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="quote-categories">
            {knownCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <p className="mt-3 text-xs text-slate-400">
            Renseignez une catégorie sur les lignes pour disposer le devis par blocs avec un sous-total par catégorie.
          </p>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Montants & modalités</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <AmountPercentField
              label="Remise"
              isPercent={discountIsPercent}
              onModeChange={setDiscountIsPercent}
              value={discountIsPercent ? discountPercent : discountAmount}
              onValueChange={discountIsPercent ? setDiscountPercent : setDiscountAmount}
              hint={discountIsPercent ? `= ${formatCurrency(totals.effectiveDiscount)}` : undefined}
            />
            <Input label="TVA (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            <AmountPercentField
              label="Acompte attendu"
              isPercent={depositIsPercent}
              onModeChange={setDepositIsPercent}
              value={depositIsPercent ? depositPercent : depositExpected}
              onValueChange={depositIsPercent ? setDepositPercent : setDepositExpected}
              hint={depositIsPercent && totals.effectiveDeposit != null ? `= ${formatCurrency(totals.effectiveDeposit)}` : undefined}
            />
            <Select label="Modalités de paiement" options={MODALITES_OPTIONS} value={paymentModalites} onChange={(e) => setPaymentModalites(e.target.value)} />
            {paymentModalites !== 'CASH' && (
              <Input label="Nombre d'échéances" type="number" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8"><span className="text-slate-500">Sous-total</span><span className="font-medium w-40 text-right">{formatCurrency(totals.subtotal)}</span></div>
            {totals.effectiveDiscount > 0 && (
              <div className="flex gap-8"><span className="text-slate-500">Remise{discountIsPercent ? ` (${Number(discountPercent) || 0} %)` : ''}</span><span className="font-medium w-40 text-right text-red-600">− {formatCurrency(totals.effectiveDiscount)}</span></div>
            )}
            <div className="flex gap-8"><span className="text-slate-500">TVA</span><span className="font-medium w-40 text-right">{formatCurrency(totals.taxAmount)}</span></div>
            <div className="flex gap-8 text-base"><span className="font-semibold text-slate-700">TOTAL</span><span className="font-bold w-40 text-right">{formatCurrency(totals.total)}</span></div>
            {totals.effectiveDeposit != null && totals.effectiveDeposit > 0 && (
              <div className="flex gap-8"><span className="text-slate-500">Acompte attendu{depositIsPercent ? ` (${Number(depositPercent) || 0} %)` : ''}</span><span className="font-medium w-40 text-right">{formatCurrency(totals.effectiveDeposit)}</span></div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Conditions & notes</h3>
          <div className="space-y-4">
            <Textarea label="Conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} placeholder="Conditions particulières (facultatif)" />
            <Textarea label="Notes internes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (facultatif)" />
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/quotes')}>Annuler</Button>
          <Button type="button" loading={saving} icon={<Save className="h-4 w-4" />} onClick={handleSave}>
            {isEdit ? 'Enregistrer' : 'Créer le devis'}
          </Button>
        </div>
      </div>

      <QuoteUnitModal open={unitModalOpen} onClose={() => setUnitModalOpen(false)} />
    </PageLayout>
  );
}
