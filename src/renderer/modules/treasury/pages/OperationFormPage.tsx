import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Textarea from '../../../shared/components/ui/Textarea';
import { useTreasuryAccounts, useTreasuryCategories, useCreateTreasuryOperation, useTreasuryThirdParties } from '../hooks/useTreasury';
import TreasuryThirdPartyModal from '../components/TreasuryThirdPartyModal';
import { useAccessibleBudgetLines } from '../../budget/hooks/useBudget';
import { DIRECTION_OPTIONS, PAYMENT_METHOD_OPTIONS, categoryLabel } from '../utils/treasury.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Save, Briefcase, Map, Building, UploadCloud, File as FileIcon, X, Plus, AlertTriangle, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { formatBytes } from '../../archiving/utils/gedTree';
import FundAccountModal from '../../../shared/components/FundAccountModal';

interface FormData {
  bankAccountId: string;
  linkedAccountId: string;
  direction: string;
  amount: string;
  operationDate: string;
  categoryId: string;
  thirdPartyId: string;
  label: string;
  paymentMethod: string;
  paymentRef: string;
  budgetLineId: string;
  imputationKind: 'NONE' | 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME';
  projectId: string;
  lotissementId: string;
  programmeId: string;
  notes: string;
}

type SelectOption = { value: string; label: string };

/** Charge une liste IPC au montage et la mappe en options { value, label }. */
function useEntityOptions(
  loader: () => Promise<{ success?: boolean; data?: any[] }>,
  labelOf: (item: any) => string,
): SelectOption[] {
  const [options, setOptions] = useState<SelectOption[]>([]);
  useEffect(() => {
    loader().then((r) => {
      const list: any[] = r?.success ? (r.data as any[]) ?? [] : [];
      setOptions(list.map((i) => ({ value: String(i.id), label: labelOf(i) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return options;
}

const today = () => new Date().toISOString().slice(0, 10);

const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,video/*,audio/*';

export default function OperationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAccount = searchParams.get('accountId') ?? '';
  const presetDirection = searchParams.get('direction') ?? '';
  // Pré-remplissage de l'imputation analytique depuis la page d'origine
  // (ex : /treasury/operations/new?projectId=12).
  const presetProjectId     = searchParams.get('projectId') ?? '';
  const presetLotissementId = searchParams.get('lotissementId') ?? '';
  const presetProgrammeId   = searchParams.get('programmeId') ?? '';
  const presetImputation: FormData['imputationKind'] =
    presetProjectId ? 'PROJECT'
    : presetLotissementId ? 'LOTISSEMENT'
    : presetProgrammeId ? 'PROGRAMME'
    : 'NONE';

  const create = useCreateTreasuryOperation();
  const { data: accountsRes } = useTreasuryAccounts({ isActive: 'true' });
  const accounts = accountsRes?.data ?? [];
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token)!;

  // Tiers (bénéficiaire / émetteur) : liste paramétrable + fenêtre d'édition.
  const { data: thirdPartiesRes } = useTreasuryThirdParties();
  const thirdParties = thirdPartiesRes?.data ?? [];
  const [thirdPartyModalOpen, setThirdPartyModalOpen] = useState(false);

  // Pièces jointes à archiver et rattacher à l'opération créée.
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | File[]) => {
    // `list` peut être un FileList — référence live vers l'input, vidée dès
    // que l'appelant réinitialise `input.value` juste après cet appel. La
    // matérialiser immédiatement plutôt que dans le callback (différé) de
    // `setFiles` évite de lire un FileList déjà vidé.
    const captured = Array.from(list);
    setFiles((prev) => [...prev, ...captured]);
  };

  // Devient vrai dès que l'utilisateur choisit un compte manuellement : on cesse
  // alors de reprendre automatiquement le compte par défaut au changement de sens.
  const accountTouchedRef = useRef(false);

  // Listes pour les selects d'imputation analytique (chargées une fois).
  const projectOptions = useEntityOptions(
    () => window.electron.projects.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );
  const lotissementOptions = useEntityOptions(
    () => window.electron.lotissements.list(token, {}, 1, 500),
    (l) => `${l.reference} · ${l.nom}`,
  );
  const programmeOptions = useEntityOptions(
    () => window.electron.programmes.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      bankAccountId: presetAccount,
      linkedAccountId: '',
      direction: presetDirection || 'SORTIE',
      amount: '',
      operationDate: today(),
      categoryId: '',
      thirdPartyId: '',
      label: '',
      paymentMethod: 'ESPECE',
      paymentRef: '',
      budgetLineId: '',
      imputationKind: presetImputation,
      projectId: presetProjectId,
      lotissementId: presetLotissementId,
      programmeId: presetProgrammeId,
      notes: '',
    },
  });

  const direction = watch('direction');
  const watchedAccountId = watch('bankAccountId');
  const watchedLinkedAccountId = watch('linkedAccountId');
  const watchedAmount = watch('amount');
  // Approvisionnement d'un compte ne couvrant pas le montant avant une SORTIE.
  const [funding, setFunding] = useState(false);
  const selectedAccount = accounts.find((a: any) => String(a.id) === watchedAccountId) ?? null;
  const linkedAccount = accounts.find((a: any) => String(a.id) === watchedLinkedAccountId) ?? null;
  const accountBalance = selectedAccount ? Number(selectedAccount.balance ?? 0) : null;
  const operationAmount = Number(watchedAmount) || 0;
  // Compte réellement débité par l'opération : le compte principal pour une
  // SORTIE (« Compte débit »), ou — si un virement interne est renseigné — le
  // « Compte débit » lié pour une ENTREE (le « Compte crédit » principal n'est
  // lui que crédité, sans condition de solde).
  const debitedAccount = direction === 'SORTIE' ? selectedAccount : (watchedLinkedAccountId ? linkedAccount : null);
  const debitedBalance = debitedAccount ? Number(debitedAccount.balance ?? 0) : null;
  // Compte débité dont le solde ne couvre pas le montant : enregistrement bloqué
  // tant qu'il n'est pas approvisionné à hauteur du montant (solde ≥ montant).
  // Restreint aux comptes « Caisse interne » (CAISSE_CENTRALE) — un solde
  // négatif est désormais autorisé sur tous les autres types de comptes.
  const insufficientFunds =
    debitedAccount != null && debitedBalance != null
    && debitedAccount.type === 'CAISSE_CENTRALE'
    && operationAmount > 0 && debitedBalance < operationAmount;

  // Préremplit le champ « Compte » selon le sens choisi : compte par défaut
  // « entrée » ou « sortie » configuré sur la fiche de l'utilisateur connecté.
  // Ignoré si un compte est imposé via l'URL ou si l'utilisateur a déjà choisi un
  // compte manuellement. Repli sur le compte privé rattaché à l'utilisateur.
  useEffect(() => {
    if (presetAccount) return;
    if (accountTouchedRef.current) return;
    if (!currentUser || accounts.length === 0) return;
    const wantedId = direction === 'ENTREE'
      ? currentUser.defaultAccountEntreeId
      : currentUser.defaultAccountSortieId;
    const target =
      (wantedId != null && accounts.find((a: any) => a.id === wantedId)) ||
      accounts.find((a: any) => a.linkedUserId === currentUser.id);
    setValue('bankAccountId', target ? String(target.id) : '');
  }, [direction, presetAccount, currentUser, accounts, setValue]);

  // Le compte lié (virement interne) doit rester distinct du compte principal :
  // le désélectionne s'il devient identique suite à un changement du compte principal.
  useEffect(() => {
    if (watchedLinkedAccountId && watchedLinkedAccountId === watchedAccountId) {
      setValue('linkedAccountId', '');
    }
  }, [watchedAccountId, watchedLinkedAccountId, setValue]);

  const { data: categoriesRes } = useTreasuryCategories({ direction, isActive: 'true' });
  const categories = categoriesRes?.data ?? [];
  // Lignes budgétaires utilisables par l'utilisateur courant pour une sortie.
  const { data: budgetLinesRes } = useAccessibleBudgetLines();
  const budgetLines = budgetLinesRes?.data ?? [];

  // Le compte de destination est obligatoire : redirige si aucun n'existe.
  useEffect(() => {
    if (accountsRes && accounts.length === 0) {
      // Aucun compte actif : on laisse l'utilisateur en créer un.
    }
  }, [accountsRes, accounts.length]);

  const apiError = create.data && !create.data.success ? create.data.error : null;

  const onSubmit = async (data: FormData) => {
    // Garde-fou : une SORTIE sur un compte au solde ≤ 0 est bloquée.
    if (insufficientFunds) return;
    // Imputation analytique : on n'envoie qu'UN seul des trois IDs selon le type choisi.
    const projectId     = data.imputationKind === 'PROJECT'     && data.projectId     ? Number(data.projectId)     : null;
    const lotissementId = data.imputationKind === 'LOTISSEMENT' && data.lotissementId ? Number(data.lotissementId) : null;
    const programmeId   = data.imputationKind === 'PROGRAMME'   && data.programmeId   ? Number(data.programmeId)   : null;
    const payload = {
      bankAccountId: Number(data.bankAccountId),
      linkedAccountId: data.linkedAccountId ? Number(data.linkedAccountId) : null,
      direction: data.direction,
      amount: Number(data.amount),
      operationDate: new Date(`${data.operationDate}T12:00:00`).toISOString(),
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      thirdPartyId: data.thirdPartyId ? Number(data.thirdPartyId) : null,
      label: data.label || undefined,
      paymentMethod: data.paymentMethod || undefined,
      paymentRef: data.paymentRef || undefined,
      // Imputation budgétaire : valide uniquement pour les sorties.
      budgetLineId:
        data.direction === 'SORTIE' && data.budgetLineId ? Number(data.budgetLineId) : undefined,
      projectId,
      lotissementId,
      programmeId,
      notes: data.notes || undefined,
    };
    const r = await create.mutateAsync(payload);
    if (!r.success) return;

    // Archivage des pièces jointes : importées dans la GED et rattachées à
    // l'opération créée. Un échec d'archivage n'annule pas l'opération.
    const operationId = (r.data as any)?.id;
    if (operationId && files.length > 0) {
      try {
        await window.electron.documents.import(token, {
          files: files.map((f) => ({
            sourcePath: window.electron.documents.pathForFile(f),
            originalName: f.name,
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
          })),
          treasuryOperationId: operationId,
        });
      } catch {
        // L'opération est créée ; on n'interrompt pas la navigation si
        // l'archivage des pièces échoue.
      }
    }

    navigate(`/treasury/accounts/${payload.bankAccountId}`);
  };

  const imputationKind = watch('imputationKind');

  const accountOptions = accounts.map((a: any) => ({ value: String(a.id), label: a.name }));
  // Second compte d'un virement interne : exclut le compte principal déjà choisi.
  const linkedAccountOptions = accounts
    .filter((a: any) => String(a.id) !== watchedAccountId)
    .map((a: any) => ({ value: String(a.id), label: a.name }));
  const categoryOptions = categories.map((c: any) => ({ value: String(c.id), label: categoryLabel(c) }));
  const thirdPartyOptions = thirdParties.map((t: any) => ({
    value: String(t.id),
    label: t.contacts ? `${t.fullName} — ${t.contacts}` : t.fullName,
  }));
  // Libellé du champ tiers selon le sens de l'opération.
  const thirdPartyLabel = direction === 'SORTIE' ? 'À destination de' : 'En provenance de';
  // Le compte principal est le compte crédité sur une entrée, débité sur une
  // sortie ; le second compte (virement interne, optionnel) est l'inverse.
  const primaryAccountLabel = direction === 'ENTREE' ? 'Compte crédit' : 'Compte débit';
  const linkedAccountLabel  = direction === 'ENTREE' ? 'Compte débit'  : 'Compte crédit';

  return (
    <PageLayout
      title="Nouvelle opération de trésorerie"
      breadcrumbs={[{ label: 'Trésorerie', to: '/treasury' }, { label: 'Nouvelle opération' }]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 mb-4">
                Aucun compte de trésorerie actif. Créez d'abord un compte pour enregistrer des opérations.
              </p>
              <Button onClick={() => navigate('/treasury/accounts/new')}>Créer un compte</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Opération</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Sens" required options={DIRECTION_OPTIONS} {...register('direction')} />
                  {(() => {
                    const reg = register('bankAccountId', { required: true });
                    return (
                      <Select
                        label={primaryAccountLabel}
                        required
                        options={accountOptions}
                        placeholder="Choisir un compte"
                        error={errors.bankAccountId && `${primaryAccountLabel} requis`}
                        {...reg}
                        onChange={(e) => { accountTouchedRef.current = true; reg.onChange(e); }}
                      />
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormSearchSelect
                      control={control}
                      name="linkedAccountId"
                      label={linkedAccountLabel}
                      options={[{ value: '', label: '— Aucun (opération simple) —' }, ...linkedAccountOptions]}
                      placeholder="Rechercher un compte…"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {direction === 'ENTREE'
                        ? `Si les fonds proviennent d'un autre compte de trésorerie (plutôt que de « ${thirdPartyLabel} »), sélectionnez-le ici : une écriture de débit y sera également passée.`
                        : `Si les fonds sont transférés vers un autre compte de trésorerie (plutôt que « ${thirdPartyLabel} »), sélectionnez-le ici : une écriture de crédit y sera également passée.`}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">{thirdPartyLabel}</label>
                      <button
                        type="button"
                        onClick={() => setThirdPartyModalOpen(true)}
                        title="Gérer les tiers"
                        className="flex items-center gap-1 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Gérer
                      </button>
                    </div>
                    <FormSearchSelect
                      control={control}
                      name="thirdPartyId"
                      options={[{ value: '', label: '— Aucun —' }, ...thirdPartyOptions]}
                      placeholder="Rechercher un tiers…"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Facultatif — bénéficiaire ou émetteur de l'opération.
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">Règlement</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Montant"
                      type="number"
                      step="0.01"
                      required
                      error={errors.amount && 'Montant requis'}
                      {...register('amount', { required: true, validate: (v) => Number(v) > 0 })}
                    />
                    <Input label="Date de l'opération" type="date" {...register('operationDate')} />
                  </div>

                  {/* Solde du compte débité (compte principal en SORTIE, ou compte débit
                      lié en ENTREE) + blocage si insuffisant. */}
                  {debitedAccount && (
                    <>
                      <p className="-mt-2 text-xs text-slate-500">
                        Solde du compte {debitedAccount.name} :{' '}
                        <span className={`font-semibold ${insufficientFunds ? 'text-red-600' : 'text-slate-700'}`}>
                          {formatCurrency(debitedBalance ?? 0)}
                        </span>
                      </p>
                      {insufficientFunds && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-700">Solde insuffisant</p>
                              <p className="mt-0.5 text-xs text-red-600">
                                Le solde du compte {debitedAccount.name} ({formatCurrency(debitedBalance ?? 0)}) ne couvre pas le montant de l'opération ({formatCurrency(operationAmount)}). Approvisionnez-le pour pouvoir enregistrer cette opération.
                              </p>
                              <Button size="sm" variant="secondary" type="button" className="mt-2" icon={<Wallet className="h-4 w-4" />}
                                onClick={() => setFunding(true)}>
                                Approvisionner le compte
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Mode de règlement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
                    <Input label="Référence (chèque, virement…)" {...register('paymentRef')} />
                  </div>
                </div>

                <div>
                  <FormSearchSelect
                    control={control}
                    name="categoryId"
                    label="Objet d'opération (compte comptable)"
                    required
                    options={categoryOptions}
                    placeholder="Rechercher un objet…"
                    rules={{ required: 'Objet requis' }}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Nature de l'opération rattachée à un numéro de compte comptable.
                  </p>
                </div>
                <Input
                  label="Libellé"
                  placeholder="Ex : Encaissement loyer mai, Achat fournitures…"
                  {...register('label')}
                />
              </div>

              {direction === 'SORTIE' && (
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Imputation budgétaire</h3>
                  <Select
                    label="Ligne budgétaire (optionnel)"
                    options={[
                      { value: '', label: '— Aucune imputation budgétaire —' },
                      ...budgetLines.map((l: any) => ({
                        value: String(l.id),
                        label: `${l.budget?.reference ?? ''} · ${l.label} — solde ${formatCurrency(l.remaining)}`,
                      })),
                    ]}
                    {...register('budgetLineId')}
                  />
                  <p className="text-xs text-slate-500">
                    Seules les lignes actives des budgets ouverts dont vous êtes gestionnaire (ou
                    administrateur) apparaissent ici.
                  </p>
                </div>
              )}

              {/* ─── Imputation analytique : Projet / Lotissement / Programme ─── */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Imputation analytique</h3>
                  <p className="text-xs text-slate-500">
                    Rattachez cette opération à un projet, un lotissement ou un programme immobilier
                    pour pouvoir tracer le flux de trésorerie associé.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'NONE',        label: 'Aucune',      icon: null },
                    { value: 'PROJECT',     label: 'Projet',      icon: <Briefcase className="h-4 w-4" /> },
                    { value: 'LOTISSEMENT', label: 'Lotissement', icon: <Map className="h-4 w-4" /> },
                    { value: 'PROGRAMME',   label: 'Programme',   icon: <Building className="h-4 w-4" /> },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                        imputationKind === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        className="sr-only"
                        {...register('imputationKind')}
                      />
                      {opt.icon}
                      {opt.label}
                    </label>
                  ))}
                </div>
                {imputationKind === 'PROJECT' && (
                  <Select
                    label="Projet"
                    options={[{ value: '', label: '— Choisir un projet —' }, ...projectOptions]}
                    {...register('projectId')}
                  />
                )}
                {imputationKind === 'LOTISSEMENT' && (
                  <Select
                    label="Lotissement"
                    options={[{ value: '', label: '— Choisir un lotissement —' }, ...lotissementOptions]}
                    {...register('lotissementId')}
                  />
                )}
                {imputationKind === 'PROGRAMME' && (
                  <Select
                    label="Programme immobilier"
                    options={[{ value: '', label: '— Choisir un programme —' }, ...programmeOptions]}
                    {...register('programmeId')}
                  />
                )}
              </div>

              <Textarea label="Notes" rows={3} {...register('notes')} />

              {/* ─── Pièces jointes : archivées dans la GED et rattachées à l'opération ─── */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Pièces jointes</h3>
                  <p className="text-xs text-slate-500">
                    Joignez des justificatifs (reçu, chèque, facture…). Ils seront archivés
                    dans la GED et rattachés à cette opération.
                  </p>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors',
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50',
                  )}
                >
                  <UploadCloud className="h-7 w-7 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">Glissez des fichiers ici ou cliquez pour parcourir</p>
                  <p className="text-xs text-slate-400">PDF, Word, Excel, images, vidéos, audios</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={FILE_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>
                {files.length > 0 && (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                        <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {apiError && (
                <p className="text-sm text-red-600">
                  {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => navigate('/treasury')}>
                  Annuler
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={insufficientFunds} icon={<Save className="h-4 w-4" />}>
                  Enregistrer l'opération
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <TreasuryThirdPartyModal
        open={thirdPartyModalOpen}
        onClose={() => setThirdPartyModalOpen(false)}
        onCreated={(id) => setValue('thirdPartyId', String(id))}
      />

      {funding && debitedAccount && (
        <FundAccountModal account={debitedAccount} onClose={() => setFunding(false)} />
      )}
    </PageLayout>
  );
}
