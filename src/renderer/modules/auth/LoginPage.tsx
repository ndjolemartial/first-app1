import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../shared/stores/auth.store';
import Button from '../../shared/components/ui/Button';
import Input from '../../shared/components/ui/Input';
import { LogIn } from 'lucide-react';

const schema = z.object({
  identifier: z.string().min(1, 'Email ou login requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  // Logo configuré dans Paramètres → Entreprise (s'il existe).
  // L'IPC `settings:getLogoData` est accessible sans session.
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    window.electron.settings.getLogoData('').then((r) => {
      if (cancelled) return;
      if (r.success && r.data) setLogoSrc(`data:${r.data.mimeType};base64,${r.data.base64}`);
    }).catch(() => { /* logo absent : on garde le placeholder */ });
    return () => { cancelled = true; };
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await window.electron.auth.login(data.identifier, data.password);
      if (!res.success || !res.data) {
        setError(res.error as string ?? 'Connexion échouée');
        return;
      }
      setAuth(res.data.user, res.data.token);
      navigate('/', { replace: true });
    } catch {
      setError('Erreur de connexion au serveur');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2563EB] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="h-16 max-w-[220px] object-contain mb-4" />
          ) : (
            <div className="login-placeholder h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl mb-4">A</div>
          )}
          <h1 className="login-title text-2xl font-bold text-slate-900">Afrikimmo-App</h1>
          <p className="text-slate-500 text-sm mt-1">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email ou login"
            type="text"
            placeholder="vous@example.com ou votre login"
            error={errors.identifier?.message}
            {...register('identifier')}
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting} icon={<LogIn className="h-4 w-4" />}>
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
