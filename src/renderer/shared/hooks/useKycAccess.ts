import { useMyKycAccess } from '../../modules/settings/hooks/useSettings';

/**
 * Vrai si l'utilisateur connecté peut utiliser les boutons « Fiche KYC » /
 * « Fiche KYC non renseignée » (Clients, Propriétaires, Apporteurs
 * d'affaire). Faux par défaut pendant le chargement — évite un affichage
 * transitoire du bouton pour un rôle restreint (AGENT, AGENT_TECHNIQUE,
 * ASSISTANTE_DIRECTION, READONLY) sans autorisation individuelle
 * (Paramètres → « Fiche KYC — accès »). Tous les autres rôles ont un accès
 * complet, sans restriction — cf. `settings:myKycAccess`.
 */
export function useKycAccess(): boolean {
  const { data } = useMyKycAccess();
  return data?.success ? Boolean(data.data?.hasAccess) : false;
}
