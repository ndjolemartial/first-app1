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
import Modal from '../../../shared/components/ui/Modal';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useMyHrOverview, useMyPayslips, useMyAttendance, useMyLeaveRequests, useMyReglementInterieur, useMySignedContracts,
  useMyCareerProfile,
} from '../hooks/useHr';
import { CONTRACT_TYPE_LABEL } from '../types/hr.types';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { FileText, ClipboardList, Printer, IdCard, ReceiptText, CalendarDays, Clock, BookOpen, Eye, Trophy, Target, Check, TrendingUp, Briefcase, GraduationCap, Gift, Award, X, Crown, MapPin, ChevronRight } from 'lucide-react';
import { useMyPerformance, useMySignEvaluation } from '../../performance/hooks/usePerformance';
import { EVAL_STATUS_LABEL, EVAL_STATUS_VARIANT, OBJECTIVE_STATUS_LABEL, OBJECTIVE_STATUS_VARIANT, type Evaluation, type Objective } from '../../performance/types/performance.types';

type Tab = 'profil' | 'bulletins' | 'conges' | 'pointage' | 'performances' | 'carriere' | 'reglement';

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
    { key: 'performances', label: 'Performances', icon: <Trophy className="h-4 w-4" /> },
    { key: 'carriere', label: 'Profil de carrière', icon: <TrendingUp className="h-4 w-4" /> },
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
      {tab === 'performances' && <PerformancesTab />}
      {tab === 'carriere' && <CarriereTab />}
      {tab === 'reglement' && <ReglementTab />}
    </PageLayout>
  );
}

/* ─── Mes performances (objectifs, évaluations à signer, classement) ─── */

function PerformancesTab() {
  const currentYear = new Date().getFullYear();
  const { data: res, isLoading } = useMyPerformance(currentYear);
  const sign = useMySignEvaluation();

  if (isLoading) return <Card><SkeletonTable rows={5} /></Card>;
  const d = res?.success ? res.data : null;
  const objectives: Objective[] = d?.objectives ?? [];
  const evaluations: Evaluation[] = d?.evaluations ?? [];

  return (
    <div className="space-y-4">
      <Card padding={false}>
        <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100"><Target className="h-4 w-4" /> Mes objectifs {currentYear}</div>
        {objectives.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-400">Aucun objectif fixé pour cette année.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Objectif</th><th className="px-4 py-2">Cycle</th><th className="px-4 py-2">Avancement</th><th className="px-4 py-2">Statut</th></tr></thead>
            <tbody>
              {objectives.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{o.title}{o.poste && <Badge variant="purple" className="ml-2">Poste</Badge>}</td>
                  <td className="px-4 py-2 text-slate-600">{o.cycleType === 'TRIMESTRIEL' ? `T${o.quarter}` : 'Annuel'}</td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{o.progress}%</td>
                  <td className="px-4 py-2"><Badge variant={OBJECTIVE_STATUS_VARIANT[o.status]}>{OBJECTIVE_STATUS_LABEL[o.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card padding={false}>
        <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100"><ClipboardList className="h-4 w-4" /> Mes évaluations</div>
        {evaluations.length === 0 ? (
          <div className="px-4 py-4 text-sm text-slate-400">Aucune évaluation.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Référence</th><th className="px-4 py-2">Cycle</th><th className="px-4 py-2 text-right">Note</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 text-right">Action</th></tr></thead>
            <tbody>
              {evaluations.map((ev) => (
                <tr key={ev.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{ev.reference}</td>
                  <td className="px-4 py-2 text-slate-600">{ev.cycleType === 'TRIMESTRIEL' ? `T${ev.quarter} ${ev.year}` : `Année ${ev.year}`}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{ev.globalScore != null ? Number(ev.globalScore).toFixed(1) : '—'}</td>
                  <td className="px-4 py-2"><Badge variant={EVAL_STATUS_VARIANT[ev.status]}>{EVAL_STATUS_LABEL[ev.status]}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    {ev.status === 'VALIDEE_RESPONSABLE'
                      ? <Button size="sm" icon={<Check className="h-4 w-4" />} loading={sign.isPending} onClick={() => sign.mutate(ev.id)}>Signer</Button>
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
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

/* ─── Profil de carrière rattaché à mon poste ─────────────────── */

function CarriereTab() {
  const { data: res, isLoading } = useMyCareerProfile();
  const [zoomStep, setZoomStep] = useState<{ step: any; index: number } | null>(null);

  if (isLoading) return <Card><SkeletonTable rows={3} /></Card>;

  const data = res?.data;
  // Un employé n'appartient qu'à une seule filière à la fois (rattachement
  // explicite sur sa fiche, à défaut repli sur son poste actuel côté IPC).
  const profile: any = data?.profile ?? null;
  const currentPoste: string | null | undefined = data?.currentPoste;
  const steps: any[] = profile?.steps ?? [];
  const currentIndex = steps.findIndex((s) => s.poste === currentPoste);

  return (
    <>
    <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 shadow-lg mb-4">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-400/10" />
      <div className="absolute -left-6 -bottom-8 h-24 w-24 rounded-full bg-amber-400/10" />
      <div className="relative flex items-start gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <p className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-sm font-semibold leading-relaxed text-transparent">
          Les promotions dans l'entreprise prennent en compte plusieurs paramètres que sont : Ancienneté + compétences +
          performances/KPI + niveau d'autonomie + responsabilités + capacité managériale + formation/diplôme.
        </p>
      </div>
    </div>

    {!profile ? (
      <Card>
        <EmptyState
          title="Aucun profil de carrière"
          description="Vous n'êtes rattaché à aucune filière de carrière pour le moment."
        />
      </Card>
    ) : (
      <Card padding={false} className="overflow-hidden">
        {/* En-tête de la filière */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 px-5 py-5 text-white">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -left-6 -bottom-10 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-tight">{profile.name}</h3>
              {profile.description && <p className="mt-1 text-sm text-white/80">{profile.description}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                  {steps.length} niveau{steps.length > 1 ? 'x' : ''}
                </span>
                {currentIndex >= 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2.5 py-0.5 text-xs font-semibold text-emerald-950">
                    <MapPin className="h-3 w-3" /> Niveau {currentIndex + 1} / {steps.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Étapes de la filière, présentées en frise verticale */}
        <div className="px-5 py-5">
          <ol>
            {steps.map((s, idx) => {
              const isCurrent = s.poste === currentPoste;
              const isPast = currentIndex >= 0 && idx < currentIndex;
              const isLast = idx === steps.length - 1;
              return (
                <li key={s.id} className="relative">
                  {!isLast && (
                    <span
                      aria-hidden
                      className={`absolute left-4 top-9 h-[calc(100%-0.5rem)] w-px ${
                        isPast || isCurrent ? 'bg-blue-300' : 'bg-slate-200'
                      }`}
                    />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setZoomStep({ step: s, index: idx })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoomStep({ step: s, index: idx }); } }}
                    className={`group relative mb-3 flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all hover:shadow-md ${
                      isCurrent
                        ? 'border-2 border-blue-400 bg-blue-100/70 shadow-lg shadow-blue-200/60 ring-2 ring-blue-300 ring-offset-2 ring-offset-white'
                        : isPast
                          ? 'border-slate-200 bg-slate-50/70 hover:border-blue-200'
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    {isCurrent && (
                      <span aria-hidden className="absolute -left-1.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-pulse rounded-full bg-blue-500 ring-4 ring-blue-100" />
                    )}
                    <span
                      className={`relative z-10 mt-0.5 flex shrink-0 items-center justify-center rounded-full font-bold ring-4 ring-white ${
                        isCurrent ? 'h-9 w-9 bg-blue-600 text-sm text-white' : isPast ? 'h-8 w-8 bg-blue-100 text-xs text-blue-700' : 'h-8 w-8 bg-slate-100 text-xs text-slate-500'
                      }`}
                    >
                      {isPast ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={isCurrent ? 'text-base font-bold text-blue-900' : 'font-semibold text-slate-800'}>{s.poste}</span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                            <MapPin className="h-3 w-3" /> Vous êtes ici
                          </span>
                        )}
                        {s.categorieSocioPro && (
                          <Badge variant="default">
                            {s.categorieSocioPro}
                            {s.categorieCode ? ` (Catégorie ${s.categorieCode})` : ''}
                          </Badge>
                        )}
                      </div>
                      {s.rolePrincipal && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{s.rolePrincipal}</p>}
                      {(s.competencesDiplomes || s.avantages) && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {s.competencesDiplomes && (
                            <span className="inline-flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" /> Compétences & diplômes
                            </span>
                          )}
                          {s.avantages && (
                            <span className="inline-flex items-center gap-1">
                              <Gift className="h-3.5 w-3.5" /> Avantages
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>
    )}

    <Modal
      open={!!zoomStep}
      onClose={() => setZoomStep(null)}
      size="md"
    >
      {zoomStep && (
        <div className="-mx-6 -mt-4">
          {/* Bandeau d'en-tête coloré */}
          <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 px-6 py-5 text-white">
            <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-white/10" />
            <div className="relative flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold backdrop-blur-sm">
                {zoomStep.index + 1}
              </span>
              <div className="min-w-0 pr-8">
                <h3 className="text-lg font-semibold leading-tight">{zoomStep.step.poste}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {zoomStep.step.poste === currentPoste && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 px-2.5 py-0.5 text-xs font-medium text-emerald-950">
                      <Check className="h-3 w-3" /> Poste actuel
                    </span>
                  )}
                  {zoomStep.step.categorieSocioPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      <Award className="h-3 w-3" />
                      {zoomStep.step.categorieSocioPro}
                      {zoomStep.step.categorieCode ? ` (Catégorie ${zoomStep.step.categorieCode})` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Rendu après le contenu pour rester au-dessus du conteneur flex
                pleine largeur (sinon sa zone vide capte le clic à sa place). */}
            <button
              onClick={() => setZoomStep(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Contenu détaillé en cartes colorées */}
          <div className="space-y-3 px-6 py-5">
            {zoomStep.step.rolePrincipal && (
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Rôle principal</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{zoomStep.step.rolePrincipal}</p>
                </div>
              </div>
            )}
            {zoomStep.step.competencesDiplomes && (
              <div className="flex gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Compétences et diplômes requis</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{zoomStep.step.competencesDiplomes}</p>
                </div>
              </div>
            )}
            {zoomStep.step.avantages && (
              <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Avantages</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{zoomStep.step.avantages}</p>
                </div>
              </div>
            )}
            {!zoomStep.step.rolePrincipal && !zoomStep.step.competencesDiplomes && !zoomStep.step.avantages && (
              <p className="text-sm text-slate-400">Aucune information complémentaire renseignée pour ce poste.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}

/* ─── Contrats signés (lecture seule : visualiser + imprimer) ──── */
function MySignedContractsCard() {
  const { data: res, isLoading } = useMySignedContracts();
  const list: any[] = res?.data ?? [];
  const [viewing, setViewing] = useState<{ id: number; name: string } | null>(null);

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
              <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => setViewing(s)}>
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate text-sm text-slate-800">{s.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(s.uploadedAt)}</span>
              </button>
              <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />} title="Visualiser"
                onClick={() => setViewing(s)} />
            </li>
          ))}
        </ul>
      )}
      {viewing && <SignedContractViewer id={viewing.id} name={viewing.name} onClose={() => setViewing(null)} />}
    </Card>
  );
}

/** Visualiseur (lecture seule) d'un contrat signé : aperçu + impression + téléchargement. */
function SignedContractViewer({ id, name, onClose }: { id: number; name: string; onClose: () => void }) {
  const [data, setData] = useState<{ mimeType?: string; base64?: string; tooLarge?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = useAuthStore.getState().token;
      if (!token) return;
      setLoading(true);
      try {
        const r = await window.electron.hr.me.signedContractFile(token, id);
        if (!cancelled) setData(r.success ? (r.data as any) : null);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const blobUrl = useMemo(() => {
    if (!data?.base64 || !data.mimeType) return '';
    try {
      const bin = atob(data.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
    } catch { return ''; }
  }, [data?.base64, data?.mimeType]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const print = async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setPrinting(true);
    try { const r = await window.electron.hr.me.signedContractPrint(token, id); if (!r.success) toast.error(String(r.error)); }
    finally { setPrinting(false); }
  };
  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a'); a.href = blobUrl; a.download = name; a.click();
  };

  const isPdf = data?.mimeType === 'application/pdf';
  const isImage = (data?.mimeType ?? '').startsWith('image/');

  return (
    <Modal open onClose={onClose} title={name} size="content" footer={
      <>
        {blobUrl && <Button variant="secondary" onClick={download}>Télécharger</Button>}
        <Button icon={<Printer className="h-4 w-4" />} loading={printing} onClick={print}>Imprimer</Button>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </>
    }>
      {loading ? (
        <SkeletonTable rows={8} />
      ) : !data ? (
        <p className="text-sm text-slate-500">Fichier indisponible.</p>
      ) : data.tooLarge || !blobUrl ? (
        <p className="text-sm text-slate-500">Aperçu indisponible {data.tooLarge ? '(fichier volumineux)' : ''}. Utilisez « Imprimer » ou « Télécharger ».</p>
      ) : isPdf ? (
        <iframe src={blobUrl} title={name} className="h-full w-full rounded-lg border border-slate-200 bg-white" style={{ minHeight: '70vh' }} />
      ) : isImage ? (
        <div className="text-center"><img src={blobUrl} alt={name} className="mx-auto max-w-full" /></div>
      ) : (
        <p className="text-sm text-slate-600">Ce format ne peut pas être prévisualisé. Utilisez « Télécharger » ou « Imprimer ».</p>
      )}
    </Modal>
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
