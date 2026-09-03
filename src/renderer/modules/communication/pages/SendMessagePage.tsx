import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import RichTextEditor from '../../../shared/components/ui/RichTextEditor';
import { useSendEmail, useSendSms, useSendWhatsapp, useTemplates } from '../hooks/useCommunication';
import VariablePicker from '../components/VariablePicker';
import TargetSelector, { MessageTarget } from '../components/TargetSelector';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { COMM_VARIABLE_GROUPS_FOR_EDITOR } from '../utils/variables';
import { useConvention } from '../../conventions/hooks/useConventions';
import { useConventionTemplates } from '../../conventions/hooks/useConventionTemplates';
import { useCountries } from '../../../shared/hooks/useCountries';
import {
  filterDefaultConventionTemplates, buildConventionDocumentHtml, conventionExportFileName,
} from '../../conventions/utils/conventionDocument';
import { Mail, MessageSquare, Send, Paperclip, X, Info } from 'lucide-react';

/** Taille totale maximale des pièces jointes (25 Mo). */
const MAX_ATTACH_BYTES = 25 * 1024 * 1024;

/** Formate une taille en octets de façon lisible. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';

const emailSchema = z.object({
  to: z.string().email('Email invalide'),
  subject: z.string().min(1, 'Sujet requis'),
  body: z.string().min(1, 'Message requis'),
});

const phoneSchema = z.object({
  to: z.string().min(8, 'Numéro invalide'),
  body: z.string().min(1, 'Message requis'),
});

/**
 * Remplace les jetons `{{cle}}` par leur valeur résolue. Un jeton sans valeur
 * connue est remplacé par une chaîne vide (aucune variable ne reste visible).
 */
function substituteVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

function EmailForm({ target, setTarget, onSuccess }: {
  target:    MessageTarget | null;
  setTarget: (t: MessageTarget | null) => void;
  onSuccess: () => void;
}) {
  const sendEmail = useSendEmail();
  const { data: tmplRes } = useTemplates('EMAIL');
  const templates = (tmplRes?.data ?? []).filter((t: any) => t.isActive);
  // Onglet « Particulier » (saisie libre) : pas d'entité → on masque l'insertion
  // de variables (sujet et corps), aucune variable ne pouvant être résolue.
  const [isParticulier, setIsParticulier] = useState(false);
  // Modèle appliqué (« Utiliser un modèle ») — transmis au serveur pour qu'il
  // sache que le message est issu d'un modèle (conserve alors la signature
  // SMTP existante au lieu de la signature personnelle, cf. communication.ipc.ts).
  const [templateId, setTemplateId] = useState<number | null>(null);
  // En mode Particulier, l'envoi se fait « en tant que » l'utilisateur connecté.
  const me = useAuthStore((s) => s.user);
  const senderName = (me?.nomCommercial || `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim()) || '—';
  const senderEmail = me?.email ?? '';
  // Pièces jointes (mode Particulier uniquement), total ≤ 25 Mo.
  const [files, setFiles] = useState<File[]>([]);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const tooBig = totalBytes > MAX_ATTACH_BYTES;
  // Force le remontage de l'input fichier natif à chaque sélection (cf. son
  // onChange) plutôt que de compter sur la seule réinitialisation de `value`.
  const [fileInputKey, setFileInputKey] = useState(0);
  // Erreur de résolution du chemin disque d'une pièce jointe (voir onSubmit) —
  // distincte de l'erreur d'envoi renvoyée par l'IPC.
  const [attachError, setAttachError] = useState<string | null>(null);
  // Copie (CC) / copie cachée (BCC) — mode Particulier uniquement.
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const token = useAuthStore((s) => s.token);

  // Cible « Convention » : le PDF du document est joint automatiquement à
  // l'email (mêmes modèle/variables que « Conventions → Document »).
  const conventionId = target?.targets?.conventionId;
  const { data: conventionRes } = useConvention(conventionId ?? 0);
  const { data: conventionTemplatesRes } = useConventionTemplates();
  const { data: countriesRes } = useCountries();
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const c of list) map[c.isoCode] = c.name;
    return map;
  }, [countriesRes]);

  const { register, handleSubmit, setValue, getValues, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { to: '', subject: '', body: '' },
  });

  // Pré-remplit (et verrouille) le champ `to` quand une cible est sélectionnée.
  useEffect(() => {
    if (target) setValue('to', target.to, { shouldValidate: true });
  }, [target, setValue]);

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const subjectReg = register('subject');

  const insertSubjectVariable = (token: string) => {
    const el = subjectRef.current;
    const current = String(getValues('subject') ?? '');
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setValue('subject', current.slice(0, start) + token + current.slice(end), { shouldValidate: true, shouldDirty: true });
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((t: any) => String(t.id) === id);
    if (!t) return;
    // Si une entité est ciblée, on substitue immédiatement les variables par
    // leurs valeurs (l'utilisateur voit les valeurs, pas les {{variables}}).
    const vars = target?.variables;
    if (t.subject) setValue('subject', vars ? substituteVariables(t.subject, vars) : t.subject);
    setValue('body', vars ? substituteVariables(t.body, vars) : t.body);
    setTemplateId(t.id);
  };

  const onSubmit = async (data: any) => {
    if (tooBig) return;
    setAttachError(null);
    // Pièces jointes transmises par chemin de fichier local. `pathForFile`
    // (Electron webUtils) peut renvoyer une chaîne vide si le fichier n'est
    // pas réellement présent sur le disque (ex. sélection non aboutie) —
    // on bloque l'envoi plutôt que de transmettre un chemin invalide.
    let attachments: { path: string; name: string }[] | undefined;
    if (files.length) {
      attachments = files.map((f) => ({ path: window.electron.documents.pathForFile(f), name: f.name }));
      const unresolved = attachments.find((a) => !a.path);
      if (unresolved) {
        setAttachError(`Impossible de localiser le fichier « ${unresolved.name} » sur le disque. Retirez-le puis rajoutez-le.`);
        return;
      }
    }

    // Cible « Convention » : génère le PDF du document (même modèle/variables
    // que « Conventions → Document ») et le joint à l'email.
    let conventionAttachment: { name: string; base64: string } | undefined;
    if (conventionId) {
      const convention = conventionRes?.data;
      if (!convention) {
        setAttachError("Convention introuvable — impossible de générer la pièce jointe.");
        return;
      }
      const candidateTemplates = filterDefaultConventionTemplates(conventionTemplatesRes?.data ?? [], convention);
      const conventionTemplate = candidateTemplates[0] ?? null;
      if (!conventionTemplate) {
        setAttachError("Aucun modèle par défaut n'est défini pour cette convention — configurez-en un (Conventions → Modèles) pour pouvoir joindre le document.");
        return;
      }
      const { bodyHtml, headerTemplate, footerTemplate, headerMm, footerMm } =
        buildConventionDocumentHtml(convention, conventionTemplate, countriesMap);
      const fileName = conventionExportFileName(convention);
      const rendered = await window.electron.documentExport.renderDocumentPdf(token!, {
        fileName, bodyHtml, headerTemplate, footerTemplate, headerMm, footerMm,
      });
      if (!rendered.success || !rendered.data) {
        setAttachError(`Échec de la génération du PDF de la convention : ${String(rendered.error ?? 'erreur inconnue')}`);
        return;
      }
      conventionAttachment = { name: `${fileName}.pdf`, base64: rendered.data.base64 };
    }

    const r = await sendEmail.mutateAsync({
      ...data,
      ...(target ? target.targets : {}),
      ...(conventionAttachment ? { conventionAttachment } : {}),
      // Particulier : envoi avec l'identité (email + nom commercial) de l'utilisateur.
      ...(isParticulier ? { senderSelf: true } : {}),
      ...(templateId ? { templateId } : {}),
      ...(attachments ? { attachments } : {}),
      ...(cc.trim() ? { cc } : {}),
      ...(bcc.trim() ? { bcc } : {}),
    });
    if (r.success) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TargetSelector
        channel="EMAIL"
        value={target}
        onChange={setTarget}
        onParticulierChange={setIsParticulier}
      />
      {conventionId && (
        <p className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          Le document PDF de la convention sera joint automatiquement à l'email.
        </p>
      )}
      {isParticulier && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Expéditeur</label>
          <input
            readOnly
            value={senderEmail ? `${senderName} <${senderEmail}>` : senderName}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            Le message sera envoyé avec votre adresse et votre nom commercial.
          </p>
        </div>
      )}
      {!isParticulier && templates.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Utiliser un modèle</label>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
          >
            <option value="">— Choisir un modèle (optionnel) —</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Destinataire *</label>
        <input
          type="email"
          {...register('to')}
          readOnly={!!target}
          placeholder="email@exemple.com"
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${target ? 'bg-slate-50 text-slate-500' : ''}`}
        />
        {errors.to && <p className="text-xs text-red-500 mt-1">{String(errors.to.message)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Copie (Cc)</label>
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="adresses séparées par , ou ;"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Copie cachée (Cci)</label>
          <input
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="adresses séparées par , ou ;"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">Sujet *</label>
          {!isParticulier && <VariablePicker onInsert={insertSubjectVariable} />}
        </div>
        <input
          {...subjectReg}
          ref={(el) => { subjectReg.ref(el); subjectRef.current = el; }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.subject && <p className="text-xs text-red-500 mt-1">{String(errors.subject.message)}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Message * <span className="ml-2 text-slate-400 font-normal">(HTML — mise en forme, images, liens)</span>
        </label>
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <RichTextEditor
              value={field.value || ''}
              onChange={field.onChange}
              variables={isParticulier ? undefined : COMM_VARIABLE_GROUPS_FOR_EDITOR}
              minHeight={300}
              placeholder="Rédigez votre message — barre d'outils pour mise en forme, images, liens…"
            />
          )}
        />
        {errors.body && <p className="text-xs text-red-500 mt-1">{String(errors.body.message)}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">Pièces jointes</label>
            <span className={`text-xs ${tooBig ? 'text-red-500' : 'text-slate-400'}`}>
              {formatBytes(totalBytes)} / 25 Mo max
            </span>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:bg-slate-50">
            <Paperclip className="h-4 w-4" />
            Ajouter des fichiers
            <input
              key={fileInputKey}
              type="file"
              multiple
              tabIndex={-1}
              className="hidden"
              onChange={(e) => {
                // `e.target.files` est une référence live vers l'input : la
                // matérialiser immédiatement (pas dans le callback différé de
                // `setFiles`) — le remontage ci-dessous (nouvelle key) ne doit
                // pas risquer de la vider avant que `Array.from` ne s'exécute.
                if (e.target.files?.length) {
                  const captured = Array.from(e.target.files);
                  setFiles((prev) => [...prev, ...captured]);
                }
                // Remonte un input natif « vierge » plutôt que de réinitialiser
                // `e.target.value` : après un retrait de fichier (bouton
                // Retirer), l'ancien input pouvait rester bloqué (le dialogue
                // de sélection ne se rouvrait plus) sans rafraîchir la page.
                setFileInputKey((k) => k + 1);
              }}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-sm">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-500"
                    aria-label="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {tooBig && (
            <p className="text-xs text-red-500 mt-1">La taille totale des pièces jointes dépasse 25 Mo.</p>
          )}
      </div>
      {attachError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{attachError}</p>
      )}
      {sendEmail.data && !sendEmail.data.success && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{String(sendEmail.data.error)}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={tooBig} icon={<Send className="h-4 w-4" />}>Envoyer l'email</Button>
      </div>
    </form>
  );
}

/**
 * Formulaire texte court — partagé entre SMS et WhatsApp (même structure,
 * juste le canal/le libellé et la limite de caractères changent).
 */
function PhoneForm({ kind, target, setTarget, onSuccess }: {
  kind:      'SMS' | 'WHATSAPP';
  target:    MessageTarget | null;
  setTarget: (t: MessageTarget | null) => void;
  onSuccess: () => void;
}) {
  const sendSms = useSendSms();
  const sendWhatsapp = useSendWhatsapp();
  const sendMutation = kind === 'WHATSAPP' ? sendWhatsapp : sendSms;
  const { data: tmplRes } = useTemplates(kind);
  const templates = (tmplRes?.data ?? []).filter((t: any) => t.isActive);
  // Onglet « Particulier » (saisie libre) : masque l'insertion de variables.
  const [isParticulier, setIsParticulier] = useState(false);

  const { register, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { to: '', body: '' },
  });

  useEffect(() => {
    if (target) setValue('to', target.to, { shouldValidate: true });
  }, [target, setValue]);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyReg = register('body');

  const insertVariable = (token: string) => {
    const el = bodyRef.current;
    const current = String(getValues('body') ?? '');
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setValue('body', current.slice(0, start) + token + current.slice(end), { shouldValidate: true, shouldDirty: true });
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }
    });
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((t: any) => String(t.id) === id);
    if (!t) return;
    // Substitution immédiate des variables si une entité est ciblée.
    const vars = target?.variables;
    setValue('body', vars ? substituteVariables(t.body, vars) : t.body);
  };

  const onSubmit = async (data: any) => {
    const r = await sendMutation.mutateAsync({ ...data, ...(target ? target.targets : {}) });
    if (r.success) onSuccess();
  };

  const maxLen = kind === 'SMS' ? 160 : 1000;
  const ctaLabel = kind === 'WHATSAPP' ? 'Envoyer le WhatsApp' : 'Envoyer le SMS';
  const hint     = kind === 'WHATSAPP'
    ? 'WhatsApp accepte des messages plus longs (texte libre dans la fenêtre 24h, sinon template approuvé).'
    : 'Max 160 caractères pour un SMS standard.';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TargetSelector channel={kind} value={target} onChange={setTarget} onParticulierChange={setIsParticulier} />
      {kind === 'WHATSAPP' && target?.targets?.conventionId && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Le document PDF de la convention n'est pas encore joint aux envois WhatsApp (nécessite un hébergement public des fichiers, non disponible actuellement) — seul le message sera envoyé.
        </p>
      )}
      {!isParticulier && templates.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Utiliser un modèle</label>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
          >
            <option value="">— Choisir un modèle (optionnel) —</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Numéro de téléphone *</label>
        <input
          {...register('to')}
          readOnly={!!target}
          placeholder="+2250701234567"
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${target ? 'bg-slate-50 text-slate-500' : ''}`}
        />
        {errors.to && <p className="text-xs text-red-500 mt-1">{String(errors.to.message)}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">Message *</label>
          {!isParticulier && <VariablePicker onInsert={insertVariable} />}
        </div>
        <textarea
          rows={4}
          {...bodyReg}
          maxLength={maxLen}
          ref={(el) => { bodyReg.ref(el); bodyRef.current = el; }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.body && <p className="text-xs text-red-500 mt-1">{String(errors.body.message)}</p>}
        <p className="text-xs text-slate-400 mt-1">{hint}</p>
      </div>
      {sendMutation.data && !sendMutation.data.success && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{String(sendMutation.data.error)}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} icon={<Send className="h-4 w-4" />}>{ctaLabel}</Button>
      </div>
    </form>
  );
}

const CHANNEL_TABS: Array<{ value: Channel; label: string; icon: any }> = [
  { value: 'EMAIL',    label: 'Email',    icon: Mail },
  { value: 'SMS',      label: 'SMS',      icon: MessageSquare },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
];

export default function SendMessagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialParam = (searchParams.get('channel') || '').toUpperCase();
  const initialChannel: Channel = initialParam === 'SMS' ? 'SMS' : initialParam === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [sent, setSent] = useState(false);
  // Cible courante — partagée entre les onglets. Lorsque l'utilisateur change
  // de canal, on ré-évalue : la même entité peut être incompatible (ex. pas
  // d'email) → on remet à zéro pour forcer une nouvelle résolution.
  const [target, setTarget] = useState<MessageTarget | null>(null);
  useEffect(() => { setTarget(null); }, [channel]);

  if (sent) {
    return (
      <PageLayout title="Message envoyé" breadcrumbs={[{ label: 'Communication', to: '/communication' }, { label: 'Envoi' }]}>
        <div className="max-w-md mx-auto text-center py-16">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Send className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Message envoyé !</h2>
          <p className="text-slate-500 mb-6">Le message a été enregistré et transmis.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => setSent(false)}>Envoyer un autre</Button>
            <Button onClick={() => navigate('/communication')}>Voir l'historique</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Envoyer un message"
      breadcrumbs={[{ label: 'Communication', to: '/communication' }, { label: 'Envoi' }]}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          {CHANNEL_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setChannel(value)}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                channel === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <Card>
          {channel === 'EMAIL' && (
            <EmailForm target={target} setTarget={setTarget} onSuccess={() => setSent(true)} />
          )}
          {channel === 'SMS' && (
            <PhoneForm kind="SMS" target={target} setTarget={setTarget} onSuccess={() => setSent(true)} />
          )}
          {channel === 'WHATSAPP' && (
            <PhoneForm kind="WHATSAPP" target={target} setTarget={setTarget} onSuccess={() => setSent(true)} />
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
