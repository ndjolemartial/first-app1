import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../../shared/components/ui/Toast';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useMyHrOverview, useMyPayslips, useMyAttendance, useMyLeaveRequests, useMyReglementInterieur, useMySignedContracts,
} from '../hooks/useHr';
import { CONTRACT_TYPE_LABEL } from '../types/hr.types';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { FileText, ClipboardList, Printer, IdCard, ReceiptText, CalendarDays, Clock, BookOpen, ExternalLink } from 'lucide-react';

type Tab = 'profil' | 'bulletins' | 'conges' | 'pointage' | 'reglement';

const LEAVE_STATUS: Record<string, { label: string; variant: any }> = {
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  APPROUVE: { label: 'Approuvé', variant: 'success' },
  REFUSE: { label: 'Refusé', variant: 'danger' },
  ANNULE: { label: 'Annulé', variant: 'default' },
};
const PAYSLIP_STATUS: Record<string, { label: string; variant: any }> = {
  BROUILLON: { label: 'Brouillon', variant: 'default' },
  VALIDE: { label: 'Validé', variant: 'info' },
  PAYE: { label: 'Payé', variant: 'success' },
  ANNULE: { label: 'Annulé', variant: 'danger' },
};
const ATT_STATUS: Record<string, string> = {
  PRESENT: 'Présent', ABSENT: 'Absent', CONGE: 'Congé', REPOS: 'Repos', FERIE: 'Férié', MALADIE: 'Maladie',
};
const num = (v: any) => (v == null ? '' : String(v));

export default function MyHrPage() {
  const [tab, setTab] = useState<Tab>('profil');
  const { data: res, isLoading } = useMyHrOverview();

  if (isLoading) return <PageLayout title="Mon espace RH & Paie"><Card><SkeletonTable rows={6} /></Card></PageLayout>;

  const employee = res?.data?.employee;
  const leaveBalance = res?.data?.leaveBalance;

  if (!employee) {
    return (
      <PageLayout title="Mon espace RH & Paie" breadcrumbs={[{ label: 'Mon espace RH' }]}>
        <Card>
          <EmptyState
            title="Aucun dossier du personnel"
            description="Votre compte n'est pas encore associé à un membre du personnel. Contactez le service RH."
          />
        </Card>
      </PageLayout>
    );
  }

  const TABS: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'profil', label: 'Profil & contrats', icon: <IdCard className="h-4 w-4" /> },
    { key: 'bulletins', label: 'Bulletins de paie', icon: <ReceiptText className="h-4 w-4" /> },
    { key: 'conges', label: 'Congés & absences', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'pointage', label: 'Pointage', icon: <Clock className="h-4 w-4" /> },
    { key: 'reglement', label: 'Règlement intérieur', icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <PageLayout
      title="Mon espace RH & Paie"
      breadcrumbs={[{ label: 'Mon espace RH' }]}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'primary' : 'secondary'} icon={t.icon}
            onClick={() => setTab(t.key)}>{t.label}</Button>
        ))}
      </div>

      {tab === 'profil' && <ProfilTab employee={employee} />}
      {tab === 'bulletins' && <BulletinsTab />}
      {tab === 'conges' && <CongesTab balance={leaveBalance} />}
      {tab === 'pointage' && <PointageTab />}
      {tab === 'reglement' && <ReglementTab />}
    </PageLayout>
  );
}

/* ─── Règlement intérieur (document ciblé par l'admin, lecture seule) ─── */
function ReglementTab() {
  const { data: res, isLoading } = useMyReglementInterieur();
  const [printing, setPrinting] = useState(false);
  const d = res?.data;

  // Blob URL fiable pour l'aperçu — évite les data-URL volumineux qui restent
  // blancs (cause de l'aperçu vide). Révoqué au démontage / changement.
  const blobUrl = useMemo(() => {
    if (!d?.base64 || !d.mimeType) return '';
    try {
      const bin = atob(d.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: d.mimeType }));
    } catch { return ''; }
  }, [d?.base64, d?.mimeType]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // Impression via la fenêtre d'aperçu native (fiable, indépendante de l'aperçu).
  const print = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setPrinting(true);
    try {
      const r = await window.electron.hr.me.reglementInterieurPrint(token);
      if (!r.success) toast.error(String(r.error));
    } finally { setPrinting(false); }
  };

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = d?.name || 'reglement-interieur';
    a.click();
  };

  if (isLoading) return <Card><SkeletonTable rows={6} /></Card>;
  if (!d || !d.configured) {
    return (
      <Card>
        <EmptyState
          title="Règlement intérieur indisponible"
          description="Le règlement intérieur n'a pas encore été défini. Contactez le service RH / l'administrateur."
        />
      </Card>
    );
  }

  const isPdf = d.mimeType === 'application/pdf';
  const isImage = (d.mimeType ?? '').startsWith('image/');

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{d.name}</span>
        <div className="flex gap-2">
          {blobUrl && (
            <Button variant="secondary" size="sm" onClick={download}>Télécharger</Button>
          )}
          <Button size="sm" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={print}>
            Imprimer
          </Button>
        </div>
      </Card>
      {d.tooLarge || !blobUrl ? (
        <Card>
          <p className="text-sm text-slate-500">
            Aperçu indisponible {d.tooLarge ? '(fichier volumineux)' : ''}. Utilisez « Imprimer » ou « Télécharger ».
          </p>
        </Card>
      ) : isPdf ? (
        <iframe src={blobUrl} title="Règlement intérieur"
          className="w-full rounded-lg border border-slate-200 bg-white" style={{ height: '75vh' }} />
      ) : isImage ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <img src={blobUrl} alt={d.name} className="mx-auto max-w-full" />
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-600">Ce format ne peut pas être prévisualisé ici. Utilisez « Télécharger » ou « Imprimer ».</p>
        </Card>
      )}
    </div>
  );
}

/* ─── Profil & contrats ───────────────────────────────────────── */
function ProfilTab({ employee }: { employee: any }) {
  const navigate = useNavigate();
  const contracts: any[] = employee.contracts ?? [];
  const info: Array<[string, any]> = [
    ['Matricule', employee.matricule],
    ['Nom', `${employee.lastName ?? ''} ${employee.firstName ?? ''}`.trim()],
    ['Poste', employee.poste || '—'],
    ['Département', employee.departement || '—'],
    ['E-mail', employee.email || '—'],
    ['Téléphone', employee.phone || employee.mobile || '—'],
    ['N° CNPS', employee.cnpsNumber || '—'],
    ['N° CMU', employee.cmuNumber || '—'],
    ['Date d\'embauche', employee.hireDate ? formatDate(employee.hireDate) : '—'],
    ['Statut', employee.status || '—'],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Mes informations</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {info.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-slate-100 py-1 text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-800">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <h3 className="px-4 pt-4 text-sm font-semibold text-slate-800">Mes contrats</h3>
        {contracts.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Aucun contrat enregistré.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Référence</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Période</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Salaire de base</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900">{c.reference}</td>
                  <td className="px-4 py-2 text-slate-600">{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {formatDate(c.startDate)}{c.endDate ? ` → ${formatDate(c.endDate)}` : ''}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{c.baseSalary != null ? formatCurrency(Number(c.baseSalary)) : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<FileText className="h-4 w-4" />} title="Voir le contrat"
                        onClick={() => navigate(`/my-hr/contracts/${c.id}/document`)} />
                      <Button variant="ghost" size="sm" icon={<ClipboardList className="h-4 w-4" />} title="Fiche de poste"
                        onClick={() => navigate(`/my-hr/contracts/${c.id}/job-description`)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <MySignedContractsCard />
    </div>
  );
}

/* ─── Contrats signés (lecture seule) ─────────────────────────── */
function MySignedContractsCard() {
  const { data: res, isLoading } = useMySignedContracts();
  const list: any[] = res?.data ?? [];
  const open = async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const r = await window.electron.hr.me.signedContractOpen(token, id);
    if (!r.success) toast.error(String(r.error));
  };
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Contrats signés</h3>
      {isLoading ? (
        <SkeletonTable rows={2} />
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun contrat signé disponible.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => open(s.id)}>
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-sm text-slate-800">{s.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(s.uploadedAt)}</span>
              </button>
              <Button variant="ghost" size="sm" icon={<ExternalLink className="h-4 w-4" />} title="Ouvrir"
                onClick={() => open(s.id)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─── Bulletins de paie ───────────────────────────────────────── */
function BulletinsTab() {
  const { data: res, isLoading } = useMyPayslips();
  const payslips: any[] = res?.data ?? [];
  const [printing, setPrinting] = useState<number | null>(null);

  const print = async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setPrinting(id);
    try { await window.electron.hr.me.payslipPrint(token, id); } finally { setPrinting(null); }
  };

  if (isLoading) return <Card><SkeletonTable rows={5} /></Card>;
  if (payslips.length === 0) return <Card><EmptyState title="Aucun bulletin" description="Aucun bulletin de paie disponible." /></Card>;

  const monthLabel = (y: number, m: number) => `${String(m).padStart(2, '0')}/${y}`;
  return (
    <Card padding={false}>
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Période</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Référence</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">Net à payer</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Statut</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payslips.map((p) => {
            const st = PAYSLIP_STATUS[p.status] ?? { label: p.status, variant: 'default' };
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-900">{monthLabel(p.periodYear, p.periodMonth)}</td>
                <td className="px-4 py-2 text-slate-600">{p.reference}</td>
                <td className="px-4 py-2 text-right text-slate-700">{p.netSalary != null ? formatCurrency(Number(p.netSalary)) : '—'}</td>
                <td className="px-4 py-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" icon={<Printer className="h-4 w-4" />} title="Aperçu / Imprimer"
                      loading={printing === p.id} onClick={() => print(p.id)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ─── Congés & absences ───────────────────────────────────────── */
function CongesTab({ balance }: { balance: any }) {
  const { data: res, isLoading } = useMyLeaveRequests();
  const requests: any[] = res?.data ?? [];

  return (
    <div className="space-y-4">
      {balance && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="flex flex-col"><span className="text-xs text-slate-500">Jours acquis</span><span className="text-xl font-bold text-slate-900">{num(balance.acquired ?? balance.acquis)}</span></Card>
          <Card className="flex flex-col"><span className="text-xs text-slate-500">Jours pris</span><span className="text-xl font-bold text-slate-900">{num(balance.taken ?? balance.pris)}</span></Card>
          <Card className="flex flex-col"><span className="text-xs text-slate-500">Solde restant</span><span className="text-xl font-bold text-emerald-700">{num(balance.remaining ?? balance.solde)}</span></Card>
        </div>
      )}
      <Card padding={false}>
        {isLoading ? <div className="p-6"><SkeletonTable rows={5} /></div> : requests.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Aucune demande de congé.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Période</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Jours</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => {
                const st = LEAVE_STATUS[r.status] ?? { label: r.status, variant: 'default' };
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{r.type?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{formatDate(r.startDate)} → {formatDate(r.endDate)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{num(r.days)}</td>
                    <td className="px-4 py-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ─── Pointage ────────────────────────────────────────────────── */
function PointageTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: res, isLoading } = useMyAttendance(year, month);
  const records: any[] = res?.data ?? [];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }));
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <div className="w-28"><Select label="Mois" options={monthOptions} value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} /></div>
        <div className="w-28"><Select label="Année" options={yearOptions} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} /></div>
      </Card>
      <Card padding={false}>
        {isLoading ? <div className="p-6"><SkeletonTable rows={6} /></div> : records.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Aucun pointage pour ce mois.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Date</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Statut</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Arrivée</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Départ</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Heures</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Heures sup.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 text-slate-600">{ATT_STATUS[r.status] ?? r.status}</td>
                  <td className="px-4 py-2 text-slate-600">{r.arrivalTime || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{r.departureTime || '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{num(r.hoursWorked)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{num(r.overtimeHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
