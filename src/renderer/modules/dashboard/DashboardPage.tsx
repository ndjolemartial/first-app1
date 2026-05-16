import PageLayout from '../../shared/components/layout/PageLayout';
import Card from '../../shared/components/ui/Card';
import { Users, UserSearch, UserCheck, Home } from 'lucide-react';
import { useAuthStore } from '../../shared/stores/auth.store';

const stats = [
  { label: 'Utilisateurs', icon: <Users className="h-6 w-6 text-blue-600" />, value: '—', to: '/users' },
  { label: 'Prospects', icon: <UserSearch className="h-6 w-6 text-purple-600" />, value: '—', to: '/prospects' },
  { label: 'Clients', icon: <UserCheck className="h-6 w-6 text-green-600" />, value: '—', to: '/clients' },
  { label: 'Propriétaires', icon: <Home className="h-6 w-6 text-orange-600" />, value: '—', to: '/owners' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <PageLayout title="Tableau de bord" breadcrumbs={[{ label: 'Accueil' }]}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Bonjour, {user?.firstName} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-1">Bienvenue sur Afrikimmo-App</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className="rounded-xl bg-slate-50 p-3">{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
}
