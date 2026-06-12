import { useNavigate } from 'react-router-dom';
import { Database, ArrowLeft } from 'lucide-react';
import DbConnectionForm from '../components/DbConnectionForm';

/**
 * Écran de configuration de la connexion à la base de données.
 * Accessible AVANT authentification (route publique `/db-settings`) : permet de
 * paramétrer / corriger la connexion après installation, sans recompiler.
 */
export default function DbConnectionPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5">
            <Database className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Connexion à la base de données</h1>
            <p className="text-sm text-slate-500">Paramètres du serveur MySQL / MariaDB</p>
          </div>
        </div>

        <DbConnectionForm onSaved={() => navigate('/login')} />

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la connexion
        </button>
      </div>
    </div>
  );
}
