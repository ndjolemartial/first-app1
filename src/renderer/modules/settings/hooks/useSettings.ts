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

// ── Paie : compte par défaut à débiter pour les salaires ─────────────────────

export function usePayrollAccountSetting() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'payrollAccount'],
    queryFn:  () => ipc().getPayrollAccount(token),
    enabled:  !!token,
  });
}

export function useUpdatePayrollAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { accountId: number | null }) => ipc().updatePayrollAccount(token, payload),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'payrollAccount'] });
        qc.invalidateQueries({ queryKey: ['payslip-pay-accounts'] });
        toast.success('Compte de paie par défaut enregistré');
      } else toast.error(String(res.error));
    },
  });
}

// ── Pointage par QR Code ─────────────────────────────────────────────────────

export function useAttendanceQrSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'attendanceQr'],
    queryFn:  () => ipc().getAttendanceQr(token),
    enabled:  !!token,
  });
}

interface AttendanceQrPayload {
  enabled: boolean;
  baseUrl: string;
  allowedRoles: string[];
  model: string;
  expectedArrival: string;
  expectedDeparture: string;
}

export function useUpdateAttendanceQr() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttendanceQrPayload) => ipc().updateAttendanceQr(token, payload),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'attendanceQr'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success('Pointage QR enregistré');
      } else toast.error(String(res.error));
    },
  });
}

// ── Modèles de messages — utilisateurs désignés (accès manuel) ──────────────

export function useManualTemplateEditors() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'manualTemplateEditors'],
    queryFn:  () => ipc().getManualTemplateEditors(token),
    enabled:  !!token,
  });
}

export function useUpdateManualTemplateEditors() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => ipc().updateManualTemplateEditors(token, userIds),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'manualTemplateEditors'] });
        qc.invalidateQueries({ queryKey: ['comm-templates', 'my-permissions'] });
        toast.success('Utilisateurs autorisés enregistrés');
      } else toast.error(String(res.error));
    },
  });
}

// ── Retards & Départs précipités ─────────────────────────────────────────────

export function useLatenessSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'lateness'],
    queryFn:  () => ipc().getLatenessSettings(token),
    enabled:  !!token,
  });
}

export function useUpdateLatenessSettings() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { includeManagementRoles: boolean; toleranceMinutes: number }) => ipc().updateLatenessSettings(token, payload),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'lateness'] });
        qc.invalidateQueries({ queryKey: ['lateness'] });
        toast.success('Paramètre enregistré');
      } else toast.error(String(res.error));
    },
  });
}

interface VisitorQrPayload {
  enabled: boolean;
  baseUrl: string;
  allowedRoles: string[];
  model: string;
}

export function useVisitorQrSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'visitorQr'],
    queryFn:  () => ipc().getVisitorQr(token),
    enabled:  !!token,
  });
}

export function useUpdateVisitorQr() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VisitorQrPayload) => ipc().updateVisitorQr(token, payload),
    onSuccess:  (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'visitorQr'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success('QR Visiteurs enregistré');
      } else toast.error(String(res.error));
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

export function useTestWhatsapp() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (to: string) => ipc().testWhatsapp(token, to),
    onSuccess:  (res) => {
      if (res.success) toast.success('WhatsApp de test envoyé');
      else toast.error(String(res.error));
    },
  });
}

// ── Partage de localisation GPS ─────────────────────────────────────────────

export function useShareLocationSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'shareLocation'],
    queryFn:  () => ipc().getShareLocation(token),
    enabled:  !!token,
  });
}

export function useUpdateShareLocation() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { emailSubject?: string; emailBody?: string; whatsappBody?: string }) =>
      ipc().updateShareLocation(token, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'shareLocation'] });
        toast.success('Modèles de partage enregistrés');
      } else toast.error(String(res.error));
    },
  });
}

// ── Conditions particulières (conventions héritées) ──────────────────────────

export function useConditionsParticulieres() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'conditionsParticulieres'],
    queryFn:  () => ipc().getConditionsParticulieres(token),
    enabled:  !!token,
  });
}

export function useUpdateConditionsParticulieres() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ title: string; text: string }>) => ipc().updateConditionsParticulieres(token, items),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['settings', 'conditionsParticulieres'] }); toast.success('Informations particulières enregistrées'); }
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

export function useSlideshowVisibility() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['settings', 'slideshowVisibility'],
    queryFn:  () => ipc().getSlideshowVisibility(token),
    enabled:  !!token,
  });
}

export function useUpdateSlideshowVisibility() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allowedRoles: string[]) => ipc().updateSlideshowVisibility(token, { allowedRoles }),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['settings', 'slideshowVisibility'] });
        toast.success('Visibilité du slideshow enregistrée');
      } else toast.error(String(res.error));
    },
  });
}
