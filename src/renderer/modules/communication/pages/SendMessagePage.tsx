import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import { useSendEmail, useSendSms, useTemplates } from '../hooks/useCommunication';
import { Send } from 'lucide-react';

const emailSchema = z.object({
  to: z.string().email('Email invalide'),
  subject: z.string().min(1, 'Sujet requis'),
  body: z.string().min(1, 'Message requis'),
});

const smsSchema = z.object({
  to: z.string().min(8, 'Numéro invalide'),
  body: z.string().min(1, 'Message requis'),
});

function EmailForm({ onSuccess }: { onSuccess: () => void }) {
  const sendEmail = useSendEmail();
  const { data: tmplRes } = useTemplates('EMAIL');
  const templates = (tmplRes?.data ?? []).filter((t: any) => t.isActive);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(emailSchema),
  });

  const applyTemplate = (id: string) => {
    const t = templates.find((t: any) => String(t.id) === id);
    if (t) {
      if (t.subject) setValue('subject', t.subject);
      setValue('body', t.body);
    }
  };

  const onSubmit = async (data: any) => {
    const r = await sendEmail.mutateAsync(data);
    if (r.success) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {templates.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Utiliser un template</label>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
          >
            <option value="">— Choisir un template (optionnel) —</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Destinataire *</label>
        <input type="email" {...register('to')} placeholder="email@exemple.com"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.to && <p className="text-xs text-red-500 mt-1">{String(errors.to.message)}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Sujet *</label>
        <input {...register('subject')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.subject && <p className="text-xs text-red-500 mt-1">{String(errors.subject.message)}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Message *</label>
        <textarea rows={8} {...register('body')}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

function SmsForm({ onSuccess }: { onSuccess: () => void }) {
  const sendSms = useSendSms();
  const { data: tmplRes } = useTemplates('SMS');
  const templates = (tmplRes?.data ?? []).filter((t: any) => t.isActive);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(smsSchema),
  });

  const applyTemplate = (id: string) => {
    const t = templates.find((t: any) => String(t.id) === id);
    if (t) setValue('body', t.body);
  };

  const onSubmit = async (data: any) => {
    const r = await sendSms.mutateAsync(data);
    if (r.success) onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {templates.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Utiliser un template</label>
          <select
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
          >
            <option value="">— Choisir un template (optionnel) —</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Numéro de téléphone *</label>
        <input {...register('to')} placeholder="+2250701234567"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.to && <p className="text-xs text-red-500 mt-1">{String(errors.to.message)}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Message *</label>
        <textarea rows={4} {...register('body')} maxLength={160}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {errors.body && <p className="text-xs text-red-500 mt-1">{String(errors.body.message)}</p>}
        <p className="text-xs text-slate-400 mt-1">Max 160 caractères pour un SMS standard.</p>
      </div>
      {sendSms.data && !sendSms.data.success && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{String(sendSms.data.error)}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} icon={<Send className="h-4 w-4" />}>Envoyer le SMS</Button>
      </div>
    </form>
  );
}

export default function SendMessagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialChannel = searchParams.get('channel') === 'SMS' ? 'SMS' : 'EMAIL';
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>(initialChannel as 'EMAIL' | 'SMS');
  const [sent, setSent] = useState(false);

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
          {(['EMAIL', 'SMS'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                channel === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <Card>
          {channel === 'EMAIL'
            ? <EmailForm onSuccess={() => setSent(true)} />
            : <SmsForm onSuccess={() => setSent(true)} />}
        </Card>
      </div>
    </PageLayout>
  );
}
