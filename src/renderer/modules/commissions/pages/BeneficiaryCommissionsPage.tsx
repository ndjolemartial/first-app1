import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useBeneficiarySummary } from '../hooks/useCommissions';
import CommissionTable from '../components/CommissionTable';
import { PayCommissionModal, EditCommissionModal, CancelCommissionModal } from '../components/CommissionModals';
import {
  BENEFICIARY_TYPE_LABEL, COMMISSION_WRITE_ROLES,
  COMMISSION_STATUS_LABEL, transactionLabel, commissionTotals,
} from '../utils/commissions.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { roleLabel } from '../../../shared/utils/roleLabel';
import ExportMenu, { ExportColumn } from '../../../shared/components/ExportMenu';
import { Wallet, CheckCircle, Ban, Printer } from 'lucide-react';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Référence',   cell: (c) => c.reference },
  { header: 'Convention',  cell: (c) => c.convention?.reference ?? '' },
  { header: 'Transaction', cell: (c) => transactionLabel(c) },
  { header: 'Assiette',    cell: (c) => formatCurrency(Number(c.baseAmount)) },
  { header: 'Taux',        cell: (c) => `${Number(c.rate)} %` },
  { header: 'Montant',     cell: (c) => formatCurrency(Number(c.amount)) },
  { header: 'Statut',      cell: (c) => COMMISSION_STATUS_LABEL[c.status] ?? c.status },
];

/**
 * Ligne de total du tableau exporté/imprimé : nombre de lignes, somme des
 * assiettes (colonne 4) et somme des montants (colonne 6). L'ordre suit
 * EXPORT_COLUMNS (7 colonnes).
 */
function buildTotalRow(rows: any[]): string[] {
  const t = commissionTotals(rows);
  return [
    `TOTAL (${t.count} ligne${t.count > 1 ? 's' : ''})`,
    '', '',
    formatCurrency(t.base),
    '',
    formatCurrency(t.amount),
    '',
  ];
}

type Tab = 'A_PAYER' | 'PAYEE' | 'ANNULEE';

const TABS: { value: Tab; label: string }[] = [
  { value: 'A_PAYER', label: 'À payer' },
  { value: 'PAYEE', label: 'Payées' },
  { value: 'ANNULEE', label: 'Annulées' },
];

export default function BeneficiaryCommissionsPage() {
  const { type = '', id = '0' } = useParams<{ type: string; id: string }>();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const token = useAuthStore((s) => s.token)!;
  const canManage = COMMISSION_WRITE_ROLES.includes(role);

  const [tab, setTab] = useState<Tab>('A_PAYER');
  const [printing, setPrinting] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const { data: res, isLoading } = useBeneficiarySummary(type, Number(id));
  const d = res?.data;

  const beneficiary = d?.beneficiary;
  const commissions: any[] = d?.commissions ?? [];
  const totals = d?.totals ?? { aPayerAmount: 0, aPayerCount: 0, payeAmount: 0, payeCount: 0, annuleeCount: 0 };

  const isUser = type === 'USER';
  const name = beneficiary
    ? (isUser
        ? `${beneficiary.lastName ?? ''} ${beneficiary.firstName ?? ''}`.trim()
        : (beneficiary.companyName || `${beneficiary.firstName ?? ''} ${beneficiary.lastName ?? ''}`.trim()))
    : 'Bénéficiaire';

  const filtered = commissions.filter((c) => c.status === tab);
  const tabLabel = TABS.find((t) => t.value === tab)?.label ?? tab;

  // Impression de l'onglet courant avec aperçu avant impression (comme pour les
  // conventions) : construit la matrice depuis les colonnes d'export, ajoute la
  // ligne de total et ouvre l'aperçu.
  const handlePrint = async () => {
    if (filtered.length === 0) { toast.error('Aucune commission à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = filtered.map((row) =>
        EXPORT_COLUMNS.map((c) => {
          const v = c.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName: `commissions-${name.replace(/\s+/g, '-').toLowerCase()}`,
        title: `Commissions de ${name}`,
        subtitle: tabLabel,
        headers: EXPORT_COLUMNS.map((c) => c.header),
        rows: matrix,
        totalRow: buildTotalRow(filtered),
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PageLayout
      title={`Commissions — ${name}`}
      breadcrumbs={[{ label: 'Commissions', to: '/commissions' }, { label: name }]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName={`commissions-${name.replace(/\s+/g, '-').toLowerCase()}`}
            title={`Commissions de ${name}`}
            subtitle={tabLabel}
            columns={EXPORT_COLUMNS}
            totalRow={buildTotalRow}
            fetchRows={async () => filtered}
          />
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>
            Imprimer
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="p-8"><SkeletonTable rows={6} /></div>
      ) : !d ? (
        <div className="p-8 text-slate-500">
          {res && !res.success && typeof res.error === 'string' ? res.error : 'Bénéficiaire introuvable.'}
        </div>
      ) : (
        <>
          {/* Fiche bénéficiaire */}
          <Card className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-slate-900">{name}</h2>
                  <Badge variant={isUser ? 'info' : 'purple'}>
                    {BENEFICIARY_TYPE_LABEL[type] ?? type}
                  </Badge>
                </div>
                <div className="text-sm text-slate-500 space-y-0.5">
                  {isUser ? (
                    <>
                      <p>Rôle : {roleLabel(beneficiary.role)} · Matricule : {beneficiary.matricule ?? '—'}</p>
                      <p>{beneficiary.email ?? '—'} · {beneficiary.phone || beneficiary.mobile || '—'}</p>
                    </>
                  ) : (
                    <>
                      {beneficiary.companyName && <p>Contact : {beneficiary.firstName} {beneficiary.lastName}</p>}
                      <p>{beneficiary.email ?? '—'} · {beneficiary.phone || beneficiary.mobile || '—'}</p>
                      {beneficiary.bankIban && <p>IBAN : {beneficiary.bankIban}</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Synthèse */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-50 p-3">
                <Wallet className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">À payer</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.aPayerAmount)}</p>
                <p className="text-xs text-slate-400">{totals.aPayerCount} commission(s)</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-green-50 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Déjà payé</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totals.payeAmount)}</p>
                <p className="text-xs text-slate-400">{totals.payeCount} commission(s)</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-3">
                <Ban className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Annulées</p>
                <p className="text-xl font-bold text-slate-900">{totals.annuleeCount}</p>
              </div>
            </Card>
          </div>

          {/* Tableau de commissions */}
          <Card padding={false}>
            <div className="flex gap-1 p-3 border-b border-slate-100">
              {TABS.map((t) => {
                const count = commissions.filter((c) => c.status === t.value).length;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      tab === t.value ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                    <span className={`ml-2 text-xs ${tab === t.value ? 'text-blue-100' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <CommissionTable
              commissions={filtered}
              showBeneficiary={false}
              canManage={canManage}
              onPay={setPayTarget}
              onEdit={setEditTarget}
              onCancel={setCancelTarget}
              emptyMessage="Aucune commission dans cette catégorie."
            />
          </Card>
        </>
      )}

      {payTarget && (
        <PayCommissionModal
          commission={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => setPayTarget(null)}
        />
      )}
      {editTarget && (
        <EditCommissionModal
          commission={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      )}
      {cancelTarget && (
        <CancelCommissionModal
          commission={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => setCancelTarget(null)}
        />
      )}
    </PageLayout>
  );
}
