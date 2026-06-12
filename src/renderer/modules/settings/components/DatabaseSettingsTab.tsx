import { AlertTriangle } from 'lucide-react';
import Card from '../../../shared/components/ui/Card';
import DbConnectionForm from './DbConnectionForm';

/**
 * Onglet « Connexion BDD » des Paramètres (admin connecté). Réutilise le même
 * formulaire que l'écran pré-login. La modification reconnecte le client Prisma
 * à chaud — un rechargement des données en cours peut être nécessaire.
 */
export default function DatabaseSettingsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-1 font-semibold text-slate-800">Connexion à la base de données</h3>
        <p className="mb-4 text-sm text-slate-500">
          Serveur MySQL / MariaDB utilisé par l'application. Testez la connexion avant d'enregistrer.
        </p>
        <DbConnectionForm />
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Modification sensible</p>
            <p className="mt-1 text-amber-700">
              Changer ces paramètres reconnecte l'application à un autre serveur. Après enregistrement,
              rechargez les pages ouvertes (ou reconnectez-vous) pour rafraîchir les données. Une valeur
              erronée rendra l'application inutilisable jusqu'à correction.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
