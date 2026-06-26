import type { SearchSelectOption } from '../components/ui/SearchSelect';

/**
 * Construit une fonction `onSearch` pour un `SearchSelect` / `FormSearchSelect`,
 * qui interroge un endpoint `*:list` **côté serveur** via `{ search }`.
 *
 * Objectif : l'élément recherché s'affiche **quel que soit le volume** de la
 * base — le filtrage n'est plus borné à une page préchargée côté client (cause
 * des entrées « manquantes » dans les menus déroulants quand le total dépasse
 * la limite de pagination).
 *
 * @param list        Appel IPC `(filters, page, limit) => Promise<{ data?: any[] }>`
 *                    (le token doit déjà être capturé par l'appelant).
 * @param toOption    Transforme un enregistrement en option `{ value, label }`.
 * @param baseFilters Filtres serveur conservés à chaque requête (ex. visibilité
 *                    par rôle, `isActive`, `assignedToId`…).
 * @param pageSize    Nombre de résultats renvoyés par requête (défaut 50).
 */
export function makeEntitySearch(
  list: (filters: any, page: number, limit: number) => Promise<{ data?: any[] } | undefined>,
  toOption: (item: any) => SearchSelectOption,
  baseFilters: Record<string, unknown> = {},
  pageSize = 50,
): (query: string) => Promise<SearchSelectOption[]> {
  return async (query: string) => {
    const filters = query ? { ...baseFilters, search: query } : { ...baseFilters };
    const res = await list(filters, 1, pageSize);
    return (res?.data ?? []).map(toOption);
  };
}
