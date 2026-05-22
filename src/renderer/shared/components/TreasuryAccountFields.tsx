import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';

interface TreasuryAccountFieldsProps {
  /** Fonction `register` du formulaire react-hook-form parent. */
  register: any;
  /** Sens du mouvement : ENTREE pour un encaissement, SORTIE pour un paiement. */
  direction: 'ENTREE' | 'SORTIE';
  /** `watch` du formulaire parent — active le compte par défaut selon le mode de paiement. */
  watch?: any;
  /** `setValue` du formulaire parent — requis avec `watch` pour appliquer le compte par défaut. */
  setValue?: any;
}

const selectClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * Compte de trésorerie pré-sélectionné par défaut selon le mode de paiement
 * (recherche par mot-clé dans le libellé du compte) :
 *  - Espèces            → « CAISSE PRINCIPALE »
 *  - Chèque / Virement  → « CORIS BANK »
 */
const DEFAULT_ACCOUNT_KEYWORD_BY_METHOD: Record<string, string> = {
  ESPECE: 'CAISSE PRINCIPALE',
  CHEQUE: 'CORIS BANK',
  VIREMENT: 'CORIS BANK',
};

/**
 * Objet d'opération pré-sélectionné par défaut selon le mode de paiement
 * (recherche par numéro de compte comptable ou mot-clé du libellé) :
 *  - Espèces → « Versement » (compte comptable 585)
 */
const DEFAULT_CATEGORY_BY_METHOD: Record<string, { code: string; label: string }> = {
  ESPECE: { code: '585', label: 'VERSEMENT' },
};

/** Libellé d'un objet d'opération avec son numéro de compte comptable. */
function categoryLabel(c: any): string {
  return c.accountingCode ? `${c.label} (${c.accountingCode})` : c.label;
}

/**
 * Champs de rattachement d'un règlement à la trésorerie : compte concerné et
 * objet d'opération. Les deux champs sont facultatifs — sans compte choisi,
 * aucun mouvement de trésorerie n'est créé. À insérer dans un formulaire
 * react-hook-form ; expose les champs `bankAccountId` et `categoryId`.
 *
 * Si `watch` et `setValue` sont fournis et que le sens est ENTREE, le compte
 * est pré-rempli automatiquement selon le mode de paiement choisi.
 */
export default function TreasuryAccountFields({ register, direction, watch, setValue }: TreasuryAccountFieldsProps) {
  const token = useAuthStore((s) => s.token)!;

  const { data: accountsRes } = useQuery({
    queryKey: ['treasury', 'accounts', { isActive: 'true' }],
    queryFn: () => window.electron.treasury.listAccounts(token, { isActive: 'true' }),
  });
  const { data: categoriesRes } = useQuery({
    queryKey: ['treasury', 'categories', { direction, isActive: 'true' }],
    queryFn: () => window.electron.treasury.listCategories(token, { direction, isActive: 'true' }),
  });

  const accounts = useMemo(
    () => (accountsRes?.success ? accountsRes.data ?? [] : []),
    [accountsRes],
  );
  const categories = useMemo(
    () => (categoriesRes?.success ? categoriesRes.data ?? [] : []),
    [categoriesRes],
  );

  // Mode de paiement courant — suivi pour appliquer les valeurs par défaut.
  const method = watch ? watch('method') : undefined;

  // Pré-sélectionne le compte et l'objet d'opération par défaut selon le mode de paiement.
  useEffect(() => {
    if (direction !== 'ENTREE' || !watch || !setValue || !method) return;
    // Compte encaissé par défaut.
    const accountKeyword = DEFAULT_ACCOUNT_KEYWORD_BY_METHOD[method];
    if (accountKeyword) {
      const match = accounts.find((a: any) => String(a.name).toUpperCase().includes(accountKeyword));
      if (match) setValue('bankAccountId', String(match.id));
    }
    // Objet d'opération par défaut.
    const categoryTarget = DEFAULT_CATEGORY_BY_METHOD[method];
    if (categoryTarget) {
      const match = categories.find((c: any) =>
        String(c.accountingCode ?? '') === categoryTarget.code ||
        String(c.label).toUpperCase().includes(categoryTarget.label),
      );
      if (match) setValue('categoryId', String(match.id));
    }
  }, [method, accounts, categories, direction, watch, setValue]);

  return (
    <div className="border-t border-slate-100 pt-4 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trésorerie</p>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {direction === 'ENTREE' ? 'Compte encaissé' : 'Compte débité'}
        </label>
        <select {...register('bankAccountId')} className={selectClass}>
          <option value="">— Ne pas affecter à un compte —</option>
          {accounts.map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {accounts.length === 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Aucun compte de trésorerie. Créez-en un depuis le module Trésorerie.
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Objet d'opération (facultatif)</label>
        <select {...register('categoryId')} className={selectClass}>
          <option value="">— Aucun —</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{categoryLabel(c)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
