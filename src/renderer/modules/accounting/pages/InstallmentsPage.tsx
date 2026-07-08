import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useOverdueInstallments,
  useUpcomingInstallments,
  useUnpaidInstallments,
  usePaidInstallments,
  useCancelledInstallments,
  useLegacyInstallments,
  usePayInstallment,
  useCancelInstallment,
  useReinstateInstallment,
  usePrintInvoice,
} from '../hooks/useAccounting';
import { formatCurrency, formatDate } from '../../../shared/utils/format';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import TreasuryAccountFields from '../../../shared/components/TreasuryAccountFields';
import { AlertCircle, Clock, CreditCard, CheckCircle2, Ban, Search, Printer, ListTodo, FileClock, FileSignature, Percent, Pencil, FileCheck } from 'lucide-react';
import InstallmentCommissionsModal from '../components/InstallmentCommissionsModal';
import EditLegacyInstallmentModal from '../components/EditLegacyInstallmentModal';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';

// Rôles autorisés à émettre une attestation de solde sur une souscription héritée
// (cf. attestations.ipc — assistante de direction volontairement exclue).
const LEGACY_SOLDE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

// Identifiants des terrains rattachés à une échéance héritée (liaisons multiples,
// avec repli sur le champ terrain direct).
const legacyTerrainIds = (inst: any): number[] => {
  const ids = (inst.terrainLinks ?? []).map((l: any) => l.terrain?.id).filter(Boolean);
  if (ids.length === 0 && inst.terrainId) ids.push(inst.terrainId);
  return ids;
};

type TabKey = 'upcoming' | 'overdue' | 'unpaid' | 'paid' | 'cancelled';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const DAYS_OPTIONS = [
  { value: '15', label: '15 prochains jours' },
  { value: '30', label: '30 prochains jours' },
  { value: '60', label: '60 prochains jours' },
  { value: '90', label: '90 prochains jours' },
  { value: '180', label: '180 prochains jours' },
  { value: '365', label: "Sur l'année" },
  { value: '0', label: 'Toutes les échéances' },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '0', label: 'Toutes les années' },
  ...Array.from({ length: 6 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  }),
];

const SEMESTER_OPTIONS = [
  { value: '0', label: "Toute l'année" },
  { value: '1', label: '1er semestre (janv. – juin)' },
  { value: '2', label: '2e semestre (juil. – déc.)' },
];

const INST_STATUS_LABEL: Record<string, string> = {
  PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', PARTIEL: 'Partiel', EN_RETARD: 'En retard', ANNULE: 'Annulé',
};

// Client de l'échéance : via la convention, ou rattachement direct (héritées).
const instClient = (inst: any): any => inst.convention?.client ?? inst.client ?? null;

const clientLabel = (inst: any): string => {
  const c = instClient(inst);
  if (!c) return '';
  return c.type === 'INDIVIDUEL'
    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    : (c.entreprise ?? '');
};

/** Filtre une échéance sur le client, la convention/terrain, la date d'échéance ou le montant. */
const matchInstallment = (inst: any, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    clientLabel(inst),
    inst.convention?.reference ?? '',
    inst.terrain?.reference ?? '',
    inst.detailsSouscription ?? '',
    formatDate(inst.dueDate),
    String(Number(inst.amount)),
  ]
    .join(' ')
    .toLowerCase()
    .includes(q);
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Convention',       cell: (i) => i.convention?.reference },
  { header: 'Client',           cell: (i) => clientLabel(i) },
  { header: 'N° échéance',      cell: (i) => i.installmentNumber },
  { header: "Date d'échéance",  cell: (i) => formatDate(i.dueDate) },
  { header: 'Montant',          cell: (i) => formatCurrency(Number(i.amount)) },
  { header: 'Statut',           cell: (i) => INST_STATUS_LABEL[i.status] ?? i.status },
];

// Colonnes d'export dédiées aux échéances héritées (souscription + client + terrain).
const LEGACY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Souscription',     cell: (i) => i.detailsSouscription ?? '' },
  { header: 'Client',           cell: (i) => clientLabel(i) },
  { header: 'Terrain',          cell: (i) => i.terrain?.reference ?? '' },
  { header: 'N° échéance',      cell: (i) => i.installmentNumber },
  { header: "Date d'échéance",  cell: (i) => formatDate(i.dueDate) },
  { header: 'Montant',          cell: (i) => formatCurrency(Number(i.amount)) },
  { header: 'Statut',           cell: (i) => INST_STATUS_LABEL[i.status] ?? i.status },
];

function PayModal({ installment, onClose, onSuccess }: { installment: any; onClose: () => void; onSuccess: () => void }) {
  const payInstallment = usePayInstallment();
  // Paiement partiel autorisé sur toutes les échéances (convention ou héritées) :
  // l'utilisateur peut saisir un montant inférieur au reste dû ; l'échéance passe
  // alors en PARTIEL jusqu'à son solde complet.
  const totalAmount = Number(installment.amount);
  const paidAmount = Number(installment.paidAmount ?? 0);
  const remaining = Math.round((totalAmount - paidAmount) * 100) / 100;
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { method: 'ESPECE', paymentRef: '', notes: '', amount: remaining },
  });
  const enteredAmount = Number(watch('amount')) || 0;

  const onSubmit = async (data: any) => {
    const amt = Number(data.amount);
    if (!(amt > 0)) { toast.error('Montant à encaisser invalide'); return; }
    // Le surplus au-delà du reste dû de cette échéance est reporté sur les
    // échéances suivantes (cascade) ; la validation du plafond global (total des
    // échéances restantes) est faite côté serveur.
    const r = await payInstallment.mutateAsync({
      installmentId: installment.id,
      payload: {
        method: data.method,
        paymentRef: data.paymentRef,
        notes: data.notes,
        // Montant encaissé — paiement partiel, intégral ou avec report sur les
        // échéances suivantes selon le montant saisi.
        amount: amt,
        bankAccountId: data.bankAccountId ? Number(data.bankAccountId) : undefined,
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      },
    });
    if (r.success) {
      const covered = Number(r.data?.coveredCount ?? 1);
      if (covered > 1) toast.success(`Encaissement réparti sur ${covered} échéances.`);
      else toast.success('Encaissement enregistré.');
      onSuccess();
    } else {
      toast.error(typeof r.error === 'string' ? r.error : 'Échec de l\'encaissement de l\'échéance');
    }
  };

  const clientName = clientLabel(installment) || '—';
  // Rattachement affiché : convention si présente, sinon détails de souscription
  // ou terrain (échéances héritées).
  const refLabel =
    installment.convention?.reference ??
    installment.detailsSouscription ??
    installment.terrain?.reference ??
    'Échéance héritée';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Encaisser l'échéance</h2>
        <p className="text-sm text-slate-500 mb-4">
          {refLabel} — {clientName} — Échéance n°{installment.installmentNumber}
        </p>

        <div className="bg-blue-50 rounded-lg p-3 mb-4 space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Montant de l'échéance</span>
            <span className="font-medium text-slate-800">{formatCurrency(totalAmount)}</span>
          </div>
          {paidAmount > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Déjà encaissé</span>
              <span className="font-medium text-slate-800">{formatCurrency(paidAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Reste dû</span>
            <span className="text-xl font-bold text-slate-900">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Montant à encaisser</label>
            <input
              type="number" step="1" min="0"
              {...register('amount')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {enteredAmount > 0 && enteredAmount < remaining && (
              <p className="mt-1 text-xs text-amber-700">Paiement partiel — restera {formatCurrency(remaining - enteredAmount)} après encaissement.</p>
            )}
            {enteredAmount - remaining > 0.001 && (
              <p className="mt-1 text-xs text-emerald-700">
                Solde cette échéance ; le surplus de {formatCurrency(enteredAmount - remaining)} sera reporté sur les échéances suivantes.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mode de paiement</label>
            <select
              {...register('method')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Référence (chèque, virement…)</label>
            <input
              type="text"
              {...register('paymentRef')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea
              rows={2}
              {...register('notes')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <TreasuryAccountFields register={register} watch={watch} setValue={setValue} direction="ENTREE" />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting} icon={<CreditCard className="h-4 w-4" />}>
              Confirmer l'encaissement
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstallmentTable({
  installments,
  isLoading,
  onPay,
  onCancel,
  onReinstate,
  onPrint,
  onCommission,
  onEdit,
  onSolde,
  soldeEligibleIds,
  variant = 'convention',
}: {
  installments: any[];
  isLoading: boolean;
  onPay: (inst: any) => void;
  onCancel?: (inst: any) => void;
  onReinstate?: (inst: any) => void;
  onPrint?: (inst: any) => void;
  onCommission?: (inst: any) => void;
  onEdit?: (inst: any) => void;
  onSolde?: (inst: any) => void;
  soldeEligibleIds?: Set<number>;
  variant?: 'convention' | 'legacy';
}) {
  const navigate = useNavigate();
  const isLegacy = variant === 'legacy';
  if (isLoading) return <div className="p-4"><SkeletonTable rows={5} /></div>;
  if (installments.length === 0) return <p className="p-4 text-sm text-slate-400">Aucune échéance.</p>;

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-600">{isLegacy ? 'Souscription' : 'Convention'}</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">N°</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Échéance</th>
          <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
          <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {installments.map((inst: any) => {
          const clientName = clientLabel(inst) || '—';
          const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
            PAYE: 'success', EN_ATTENTE: 'info', A_REGLER: 'warning', PARTIEL: 'warning', EN_RETARD: 'danger', ANNULE: 'default',
          };
          const statusLabel: Record<string, string> = {
            PAYE: 'Payé', EN_ATTENTE: 'En attente', A_REGLER: 'À régler', PARTIEL: 'Partiel', EN_RETARD: 'En retard', ANNULE: 'Annulé',
          };
          return (
            <tr key={inst.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                {isLegacy ? (
                  <div className="flex flex-col">
                    <span className="text-slate-700">
                      {inst.detailsSouscription || <span className="text-slate-400">—</span>}
                    </span>
                    {(inst.terrainLinks ?? []).length > 0 && (
                      <span className="text-xs text-slate-500 mt-0.5">
                        {inst.terrainLinks.map((l: any, i: number) => (
                          <span key={l.terrain.id}>
                            {i > 0 && ', '}
                            <button
                              className="text-indigo-600 hover:underline"
                              onClick={() => navigate(`/terrains/${l.terrain.id}`)}
                            >
                              {l.terrain.reference}
                            </button>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    className="font-medium text-indigo-600 hover:underline"
                    onClick={() => navigate(`/conventions/${inst.conventionId}`)}
                  >
                    {inst.convention?.reference}
                  </button>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{clientName}</td>
              <td className="px-4 py-3 text-slate-500">{inst.installmentNumber}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(inst.dueDate)}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(Number(inst.amount))}
                {Number(inst.paidAmount ?? 0) > 0 && Number(inst.paidAmount) < Number(inst.amount) && (
                  <div className="text-xs font-normal text-amber-700">
                    Reste {formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[inst.status] ?? 'default'}>
                  {statusLabel[inst.status] ?? inst.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {onSolde && soldeEligibleIds?.has(inst.id) && (
                    <Button size="sm" variant="secondary" icon={<FileCheck className="h-4 w-4" />} onClick={() => onSolde(inst)}>
                      Attestation de solde
                    </Button>
                  )}
                  {onEdit && (
                    <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(inst)}>
                      Modifier
                    </Button>
                  )}
                  {onCommission && (
                    <Button size="sm" variant="secondary" icon={<Percent className="h-4 w-4" />} onClick={() => onCommission(inst)}>
                      Commissions
                    </Button>
                  )}
                  {inst.status !== 'PAYE' && inst.status !== 'ANNULE' && (
                    <>
                      <Button size="sm" onClick={() => onPay(inst)}>
                        Encaisser
                      </Button>
                      {onCancel && (
                        <Button size="sm" variant="secondary" onClick={() => onCancel(inst)}>
                          Annuler
                        </Button>
                      )}
                    </>
                  )}
                  {inst.status === 'ANNULE' && onReinstate && (
                    <Button size="sm" variant="secondary" onClick={() => onReinstate(inst)}>
                      Réintégrer
                    </Button>
                  )}
                  {(inst.status === 'PAYE' || inst.status === 'PARTIEL') && inst.invoiceId && onPrint && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Printer className="h-4 w-4" />}
                      onClick={() => onPrint(inst)}
                    >
                      Facture
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function InstallmentsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey =
    tabParam === 'overdue' ? 'overdue'
      : tabParam === 'unpaid' ? 'unpaid'
        : tabParam === 'paid' ? 'paid'
          : tabParam === 'cancelled' ? 'cancelled'
            : 'upcoming';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  // Source des échéances : issues d'une convention, ou héritées (sans convention).
  const [source, setSource] = useState<'convention' | 'legacy'>('convention');
  const [legacyStatus, setLegacyStatus] = useState<'all' | TabKey>('all');
  // Filtre par utilisateur référent (0 = tous).
  const [legacyUser, setLegacyUser] = useState<number>(0);
  const [days, setDays] = useState(30);
  const [paidYear, setPaidYear] = useState(0);
  const [paidSemester, setPaidSemester] = useState(0);
  const [payingInstallment, setPayingInstallment] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [commissionTarget, setCommissionTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  // Émission d'attestation de solde héritée : réservée aux admin / manager /
  // comptable (assistante de direction exclue).
  const userRole = useAuthStore((s) => s.user?.role);
  const canEmitLegacySolde = !!userRole && LEGACY_SOLDE_ROLES.includes(userRole);

  const { data: upcomingRes, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingInstallments(days);
  const { data: overdueRes, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueInstallments();
  const { data: unpaidRes, isLoading: unpaidLoading, refetch: refetchUnpaid } = useUnpaidInstallments();
  const { data: paidRes, isLoading: paidLoading, refetch: refetchPaid } = usePaidInstallments(paidYear, paidSemester);
  const { data: cancelledRes, isLoading: cancelledLoading } = useCancelledInstallments();
  const { data: legacyRes, isLoading: legacyLoading, refetch: refetchLegacy } = useLegacyInstallments();
  const cancelInstallment = useCancelInstallment();
  const reinstateInstallment = useReinstateInstallment();
  const printInvoice = usePrintInvoice();

  // Recherche appliquée à l'onglet courant : client, convention, date d'échéance ou montant.
  const upcoming = (upcomingRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const overdue = (overdueRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const unpaid = (unpaidRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const paid = (paidRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  const cancelled = (cancelledRes?.data ?? []).filter((i: any) => matchInstallment(i, search));
  // Échéances héritées (un seul endpoint, tous statuts) : filtrage par recherche,
  // par utilisateur référent du client, puis par statut côté client.
  const todayMidnight = new Date(new Date().toDateString());
  const legacyData = legacyRes?.data ?? [];

  // Solde des souscriptions héritées, agrégé par couple (client, terrain) : pour
  // chaque terrain on cumule le reste dû de toutes les échéances héritées non
  // annulées du client. Une attestation de solde n'est proposée que lorsque tous
  // les terrains d'une souscription (client + même jeu de terrains) sont soldés.
  // On dédoublonne le bouton sur l'échéance représentative (n° le plus élevé).
  const soldeEligibleIds = (() => {
    const ids = new Set<number>();
    if (!canEmitLegacySolde) return ids;
    // Reste dû NET cumulé (peut être ≤ 0 : règlement intégral ou trop-perçu) —
    // cohérent avec la garde serveur qui autorise dès que le solde est ≤ 0.
    // Par terrain `${clientId}|${terrainId}` et, à part, par client pour les
    // échéances SANS terrain rattaché.
    const balanceByKey = new Map<string, number>();
    const noTerrainBalance = new Map<number, number>();
    for (const i of legacyData) {
      if (i.status === 'ANNULE') continue;
      const cId = i.clientId ?? i.client?.id;
      if (!cId) continue;
      const remaining = Number(i.amount) - Number(i.paidAmount ?? 0);
      const tIds = legacyTerrainIds(i);
      if (tIds.length === 0) {
        noTerrainBalance.set(cId, (noTerrainBalance.get(cId) ?? 0) + remaining);
      } else {
        for (const tId of tIds) {
          const key = `${cId}|${tId}`;
          balanceByKey.set(key, (balanceByKey.get(key) ?? 0) + remaining);
        }
      }
    }
    // Regroupement par souscription = client + jeu de terrains, ou client seul
    // (souscription héritée sans terrain rattaché).
    const groups = new Map<string, { cId: number; terrainIds: number[]; items: any[]; noTerrain: boolean }>();
    for (const i of legacyData) {
      if (i.status === 'ANNULE') continue;
      const cId = i.clientId ?? i.client?.id;
      if (!cId) continue;
      const tIds = legacyTerrainIds(i);
      const noTerrain = tIds.length === 0;
      const key = noTerrain ? `${cId}|__no_terrain__` : `${cId}|${[...tIds].sort((a, b) => a - b).join(',')}`;
      if (!groups.has(key)) groups.set(key, { cId, terrainIds: tIds, items: [], noTerrain });
      groups.get(key)!.items.push(i);
    }
    for (const g of groups.values()) {
      const settled = g.noTerrain
        ? (Math.round((noTerrainBalance.get(g.cId) ?? 0) * 100) / 100) <= 0.005
        : g.terrainIds.every((t) => (balanceByKey.get(`${g.cId}|${t}`) ?? 0) <= 0.005);
      const hasPaid = g.items.some((i) => i.status === 'PAYE');
      if (settled && hasPaid) {
        const rep = g.items.reduce((a, b) => (b.installmentNumber > a.installmentNumber ? b : a));
        ids.add(rep.id);
      }
    }
    return ids;
  })();

  // Ouvre le formulaire d'attestation de solde pré-rempli (client + terrain) en
  // mode hérité. Le solde est revérifié côté serveur à l'émission.
  const handleSolde = (inst: any) => {
    const cId = inst.clientId ?? inst.client?.id;
    if (!cId) return;
    // Terrain optionnel : la souscription héritée peut n'être rattachée à aucun terrain.
    const tId = legacyTerrainIds(inst)[0];
    const url = tId
      ? `/conventions/attestations/new?legacy=1&type=SOLDE&clientId=${cId}&terrainId=${tId}`
      : `/conventions/attestations/new?legacy=1&type=SOLDE&clientId=${cId}`;
    navigate(url);
  };
  // Options du filtre utilisateur : référents distincts présents dans les données.
  const legacyUserOptions = (() => {
    const map = new Map<number, string>();
    for (const i of legacyData) {
      const u = i.client?.assignedTo;
      if (u?.id) map.set(u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || `Utilisateur #${u.id}`);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();
  const legacy = legacyData
    .filter((i: any) => matchInstallment(i, search))
    .filter((i: any) => (legacyUser === 0 ? true : i.client?.assignedTo?.id === legacyUser))
    .filter((i: any) => {
      switch (legacyStatus) {
        case 'upcoming':  return ['EN_ATTENTE', 'A_REGLER'].includes(i.status) && new Date(i.dueDate) >= todayMidnight;
        case 'overdue':   return i.status === 'EN_RETARD';
        case 'unpaid':    return ['EN_ATTENTE', 'A_REGLER', 'EN_RETARD', 'PARTIEL'].includes(i.status);
        case 'paid':      return i.status === 'PAYE';
        case 'cancelled': return i.status === 'ANNULE';
        default:          return true;
      }
    });
  const legacyTotal = legacy.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const paidTotal = paid.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const upcomingTotal = upcoming.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const overdueTotal = overdue.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const unpaidTotal = unpaid.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const cancelledTotal = cancelled.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const paidFilterLabel =
    paidYear === 0
      ? 'toutes périodes'
      : paidSemester === 1
        ? `1er semestre ${paidYear}`
        : paidSemester === 2
          ? `2e semestre ${paidYear}`
          : `année ${paidYear}`;
  const upcomingPeriodLabel =
    DAYS_OPTIONS.find((o) => Number(o.value) === days)?.label ?? `${days} prochains jours`;

  // Ligne de solde reprise en pied des fichiers exportés (PDF / Excel).
  const exportTotalRow: string[] =
    activeTab === 'upcoming'
      ? [`Solde à venir — ${upcoming.length} échéance(s)`, '', '', '', formatCurrency(upcomingTotal), '']
      : activeTab === 'overdue'
        ? [`Solde en retard — ${overdue.length} échéance(s)`, '', '', '', formatCurrency(overdueTotal), '']
        : activeTab === 'unpaid'
          ? [`Total impayé — ${unpaid.length} échéance(s)`, '', '', '', formatCurrency(unpaidTotal), '']
          : activeTab === 'paid'
            ? [`Solde encaissé — ${paid.length} échéance(s)`, '', '', '', formatCurrency(paidTotal), '']
            : [`Total annulé — ${cancelled.length} échéance(s)`, '', '', '', formatCurrency(cancelledTotal), ''];

  const handlePaySuccess = () => {
    setPayingInstallment(null);
    refetchUpcoming();
    refetchOverdue();
    refetchUnpaid();
    refetchPaid();
    refetchLegacy();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    await cancelInstallment.mutateAsync(cancelTarget.id);
    setCancelTarget(null);
  };

  const handleReinstate = (inst: any) => {
    reinstateInstallment.mutate(inst.id);
  };

  return (
    <PageLayout
      title="Échéances de vente"
      breadcrumbs={[{ label: 'Comptabilité', to: '/accounting' }, { label: 'Échéances' }]}
      actions={
        source === 'legacy' ? (
          <ExportMenu
            fileName="echeances-heritees"
            title="Échéances héritées"
            columns={LEGACY_EXPORT_COLUMNS}
            totalRow={[`Total — ${legacy.length} échéance(s)`, '', '', '', '', formatCurrency(legacyTotal), '']}
            fetchRows={async () => legacy}
          />
        ) : (
          <ExportMenu
            fileName={
              activeTab === 'upcoming' ? 'echeances-a-venir'
                : activeTab === 'overdue' ? 'echeances-en-retard'
                  : activeTab === 'unpaid' ? 'echeances-impayees'
                    : activeTab === 'paid' ? 'echeances-payees'
                      : 'echeances-annulees'
            }
            title={
              activeTab === 'upcoming' ? 'Échéances de vente à venir'
                : activeTab === 'overdue' ? 'Échéances de vente en retard'
                  : activeTab === 'unpaid' ? 'Échéances de vente impayées'
                    : activeTab === 'paid' ? 'Échéances de vente payées'
                      : 'Échéances de vente annulées'
            }
            subtitle={
              activeTab === 'upcoming' ? upcomingPeriodLabel
                : activeTab === 'paid' ? paidFilterLabel
                  : undefined
            }
            columns={EXPORT_COLUMNS}
            totalRow={exportTotalRow}
            fetchRows={async () => (
              activeTab === 'upcoming' ? upcoming
                : activeTab === 'overdue' ? overdue
                  : activeTab === 'unpaid' ? unpaid
                    : activeTab === 'paid' ? paid
                      : cancelled
            )}
          />
        )
      }
    >
      {/* Source : échéances de convention vs échéances héritées */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setSource('convention')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            source === 'convention' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSignature className="h-4 w-4" /> Échéances de convention
        </button>
        <button
          onClick={() => setSource('legacy')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            source === 'legacy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileClock className="h-4 w-4" /> Échéances héritées
          {legacy.length > 0 && (
            <span className="ml-1 bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {legacy.length}
            </span>
          )}
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par client, convention, date d'échéance ou montant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tabs (échéances de convention) */}
      {source === 'convention' && (
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4 w-4" /> À venir
          {upcoming.length > 0 && (
            <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'overdue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="h-4 w-4" /> En retard
          {overdue.length > 0 && (
            <span className="ml-1 bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {overdue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('unpaid')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'unpaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListTodo className="h-4 w-4" /> Toutes impayées
          {unpaid.length > 0 && (
            <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {unpaid.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> Payées
          {paid.length > 0 && (
            <span className="ml-1 bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {paid.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            activeTab === 'cancelled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Ban className="h-4 w-4" /> Annulées
          {cancelled.length > 0 && (
            <span className="ml-1 bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-xs font-semibold">
              {cancelled.length}
            </span>
          )}
        </button>
      </div>
      )}

      {/* Upcoming Tab */}
      {source === 'convention' && activeTab === 'upcoming' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Prochaines échéances</h3>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DAYS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <InstallmentTable
            installments={upcoming}
            isLoading={upcomingLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!upcomingLoading && upcoming.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde à venir ({upcomingPeriodLabel}) — {upcoming.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(upcomingTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Overdue Tab */}
      {source === 'convention' && activeTab === 'overdue' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Échéances en retard
            </h3>
          </div>
          <InstallmentTable
            installments={overdue}
            isLoading={overdueLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!overdueLoading && overdue.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde en retard — {overdue.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(overdueTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Unpaid Tab — toutes les échéances impayées (en attente + à régler + en retard) */}
      {source === 'convention' && activeTab === 'unpaid' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-amber-600" /> Toutes les échéances impayées
            </h3>
          </div>
          <InstallmentTable
            installments={unpaid}
            isLoading={unpaidLoading}
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
          />
          {!unpaidLoading && unpaid.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Total impayé — {unpaid.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-amber-700">{formatCurrency(unpaidTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Paid Tab */}
      {source === 'convention' && activeTab === 'paid' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Échéances payées
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={paidYear}
                onChange={(e) => setPaidYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {YEAR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={paidSemester}
                onChange={(e) => setPaidSemester(Number(e.target.value))}
                disabled={paidYear === 0}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {SEMESTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <InstallmentTable
            installments={paid}
            isLoading={paidLoading}
            onPay={setPayingInstallment}
            onPrint={(inst) => printInvoice(inst.invoiceId)}
          />
          {!paidLoading && paid.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Solde encaissé ({paidFilterLabel}) — {paid.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(paidTotal)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Cancelled Tab */}
      {source === 'convention' && activeTab === 'cancelled' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Ban className="h-4 w-4 text-slate-500" /> Échéances annulées
            </h3>
          </div>
          <InstallmentTable
            installments={cancelled}
            isLoading={cancelledLoading}
            onPay={setPayingInstallment}
            onReinstate={handleReinstate}
          />
          {!cancelledLoading && cancelled.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Total annulé — {cancelled.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-slate-500">{formatCurrency(cancelledTotal)}</span>
            </div>
          )}
          {!cancelledLoading && cancelled.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Une échéance annulée peut être réintégrée au calendrier des règlements.
            </p>
          )}
        </Card>
      )}

      {/* Échéances héritées (sans convention) */}
      {source === 'legacy' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileClock className="h-4 w-4 text-slate-500" /> Échéances héritées
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={legacyUser}
                onChange={(e) => setLegacyUser(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={0}>Tous les utilisateurs</option>
                {legacyUserOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select
                value={legacyStatus}
                onChange={(e) => setLegacyStatus(e.target.value as 'all' | TabKey)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="upcoming">À venir</option>
                <option value="overdue">En retard</option>
                <option value="unpaid">Toutes impayées</option>
                <option value="paid">Payées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
          </div>
          <InstallmentTable
            installments={legacy}
            isLoading={legacyLoading}
            variant="legacy"
            onPay={setPayingInstallment}
            onCancel={setCancelTarget}
            onReinstate={handleReinstate}
            onPrint={(inst) => printInvoice(inst.invoiceId)}
            onCommission={setCommissionTarget}
            onEdit={setEditTarget}
            onSolde={canEmitLegacySolde ? handleSolde : undefined}
            soldeEligibleIds={soldeEligibleIds}
          />
          {!legacyLoading && legacy.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Total — {legacy.length} échéance(s)
              </span>
              <span className="text-lg font-bold text-slate-900">{formatCurrency(legacyTotal)}</span>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Paiements échelonnés importés de l'ancienne application, rattachés directement au client
            (et au terrain), sans convention signée.
          </p>
        </Card>
      )}

      {payingInstallment && (
        <PayModal
          installment={payingInstallment}
          onClose={() => setPayingInstallment(null)}
          onSuccess={handlePaySuccess}
        />
      )}

      {commissionTarget && (
        <InstallmentCommissionsModal
          installment={commissionTarget}
          onClose={() => setCommissionTarget(null)}
        />
      )}

      {editTarget && (
        <EditLegacyInstallmentModal
          installment={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Annuler l'échéance"
        message={
          cancelTarget
            ? `Annuler l'échéance n°${cancelTarget.installmentNumber} ${
                cancelTarget.convention?.reference
                  ? `de la convention ${cancelTarget.convention.reference}`
                  : cancelTarget.terrain?.reference
                    ? `du terrain ${cancelTarget.terrain.reference}`
                    : `de ${clientLabel(cancelTarget) || 'ce client'}`
              } (${formatCurrency(Number(cancelTarget.amount))}) ? Elle pourra être réintégrée par la suite.`
            : ''
        }
        confirmLabel="Annuler l'échéance"
        loading={cancelInstallment.isPending}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelTarget(null)}
      />
    </PageLayout>
  );
}
