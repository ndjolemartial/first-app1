import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';

/** Pays issu de la table de référence (code ISO 3166-1 alpha-2 et indicatif). */
export interface Country {
  id: number;
  isoCode: string;
  name: string;
  dialCode: string;
}

/**
 * Récupère la liste de référence des pays.
 *
 * Les données étant statiques, le résultat est mis en cache durablement
 * (`staleTime: Infinity`) pour éviter tout rechargement inutile.
 */
export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: () => window.electron.countries.list(useAuthStore.getState().token!),
    staleTime: Infinity,
  });
}
