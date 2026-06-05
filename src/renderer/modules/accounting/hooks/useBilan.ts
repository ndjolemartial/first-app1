import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = window.electron.bilan;

export type BilanScope = 'global' | 'lotissement' | 'programme' | 'owner';
export type BilanPeriodType = 'month' | 'last-month' | 'quarter' | 'semester' | 'year' | 'custom';

export interface ResultatFilters {
  periodType: BilanPeriodType;
  periodStart?: string;
  periodEnd?:   string;
  scope: BilanScope;
  scopeId?: number;
}

export interface ActifPassifFilters {
  asOfDate?: string;
  scope:     BilanScope;
  scopeId?:  number;
}

/**
 * Charge le compte de résultat sur la période et le périmètre demandés.
 * Activé seulement si le périmètre est compatible (scope=global ou scopeId fourni).
 */
export function useBilanResultat(filters: ResultatFilters) {
  const token = useAuthStore((s) => s.token)!;
  const ready = filters.scope === 'global' || !!filters.scopeId;
  return useQuery({
    queryKey: ['bilan', 'resultat', filters],
    queryFn:  () => ipc.getResultat(token, filters),
    enabled:  ready,
  });
}

/**
 * Charge le bilan Actif/Passif arrêté à `asOfDate` (défaut : aujourd'hui).
 *
 * @param enabled Permet de désactiver explicitement la requête (ex. utilisateur
 *                sans le rôle SUPER_ADMIN/ADMIN qui ne voit pas l'onglet).
 */
export function useBilanActifPassif(filters: ActifPassifFilters, enabled = true) {
  const token = useAuthStore((s) => s.token)!;
  const ready = enabled && (filters.scope === 'global' || !!filters.scopeId);
  return useQuery({
    queryKey: ['bilan', 'actif-passif', filters],
    queryFn:  () => ipc.getActifPassif(token, filters),
    enabled:  ready,
  });
}

/** Exporte le bilan courant en PDF ou Excel. Retour utilisateur via toast. */
export function useExportBilan() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (payload: {
      type:   'resultat' | 'actif-passif';
      format: 'pdf' | 'xlsx';
      data:   unknown;
      meta:   { title: string; subtitle?: string; scope?: string };
    }) => ipc.export(token, payload),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'export");
        return;
      }
      if (res.data?.canceled) return;
      toast.success('Bilan enregistré');
    },
    onError: () => toast.error("Erreur lors de l'export"),
  });
}
