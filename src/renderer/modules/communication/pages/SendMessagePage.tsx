import { useState, useRef, useEffect } from 'react';
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
import { COMM_VARIABLE_GROUPS_FOR_EDITOR } from '../utils/variables';
import { Mail, MessageSquare, Send } from 'lucide-react';

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

function EmailForm({ target, setTarget, onSuccess }: {
  target:    MessageTarget | null;
  setTarget: (t: MessageTarget | null) => void;
  onSuccess: () => void;
}) {
  const sendEmail = useSendEmail();
  const { data: tmplRes } = useTemplates('EMAIL');
  const templates = (tmplRes?.data ?? []).filter((t: any) => t.isActive);

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
    if (t) {
      if (t.subject) setValue('subject', t.subject);
      setValue('body', t.body);
    }
  };

  const onSubmit = async (data: any) => {
    const r = await sendEmail.mutateAsync({ ...data, ...(target ? target.targets : {}) });
    if (r.success) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TargetSelector channel="EMAIL" value={target} onChange={setTarget} />
      {templates.length > 0 && (
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
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-700">Sujet *</label>
          <VariablePicker onInsert={insertSubjectVariable} />
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
              variables={COMM_VARIABLE_GROUPS_FOR_EDITOR}
              minHeight={300}
              placeholder="Rédigez votre message — barre d'outils pour mise en forme, images, liens…"
            />
          )}
        />
        {errors.body && <p className="text-xs text-red-500 mt-1">{String(errors.body.message)}</p>}
      </div>
      {sendEmail.data && !sendEmail.data.success && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{String(sendEmail.data.error)}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} icon={<Send className="h-4 w-4" />}>Envoyer l'email</Button>
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
    if (t) setValue('body', t.body);
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
      <TargetSelector channel={kind} value={target} onChange={setTarget} />
      {templates.length > 0 && (
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
          <VariablePicker onInsert={insertVariable} />
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
