import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.settings;

// ── Entreprise ──────────────────────────────────────────────────────────────

export function useCompanySettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'company'],
    queryFn:  () => ipc().getCompany(token),
    enabled:  !!token,
  });
}

export function useUpdateCompany() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().updateCompany(token, payload),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'company'] }); toast.success('Paramètres entreprise enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUploadLogo() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { fileName: string; fileType: string; fileSize: number; fileData: string }) =>
      ipc().uploadLogo(token, payload),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'company'] });
        qc.invalidateQueries({ queryKey: ['settings', 'logo'] });
        toast.success('Logo mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useLogoData() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'logo'],
    queryFn:  () => ipc().getLogoData(token),
    enabled:  !!token,
  });
}

export function useDeleteLogo() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ipc().deleteLogo(token),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'company'] });
        qc.invalidateQueries({ queryKey: ['settings', 'logo'] });
        toast.success('Logo supprimé');
      } else toast.error(String(res.error));
    },
  });
}

// ── Stockage ────────────────────────────────────────────────────────────────

export function useStorageSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'storage'],
    queryFn:  () => ipc().getStorage(token),
    enabled:  !!token,
  });
}

export function useUpdateStorage() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().updateStorage(token, payload),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'storage'] }); toast.success('Paramètres de stockage enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

// ── Email ───────────────────────────────────────────────────────────────────

export function useEmailSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'email'],
    queryFn:  () => ipc().getEmail(token),
    enabled:  !!token,
  });
}

export function useUpdateEmail() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().updateEmail(token, payload),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'email'] }); toast.success('Paramètres SMTP enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

export function useTestEmail() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (to: string) => ipc().testEmail(token, to),
    onSuccess:  (res) => {
      if (res.success) toast.success('Email de test envoyé');
      else toast.error(String(res.error));
    },
  });
}

// ── SMS ─────────────────────────────────────────────────────────────────────

export function useSmsSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'sms'],
    queryFn:  () => ipc().getSms(token),
    enabled:  !!token,
  });
}

export function useUpdateSms() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().updateSms(token, payload),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'sms'] }); toast.success('Paramètres SMS enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

export function useTestSms() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (to: string) => ipc().testSms(token, to),
    onSuccess:  (res) => {
      if (res.success) toast.success('SMS de test envoyé');
      else toast.error(String(res.error));
    },
  });
}

// ── Slideshow ───────────────────────────────────────────────────────────────

export function useSlideshowSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'slideshow'],
    queryFn:  () => ipc().getSlideshow(token),
    enabled:  !!token,
  });
}

export function useUpdateSlideshow() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: object[]) => ipc().updateSlideshow(token, items),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'slideshow'] }); toast.success('Slideshow enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUploadSlideshowMedia() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (payload: { fileName: string; fileType: string; fileSize: number; fileData: string }) =>
      ipc().uploadSlideshowMedia(token, payload),
    onSuccess:  (res) => {
      if (!res.success) toast.error(String(res.error));
    },
  });
}
