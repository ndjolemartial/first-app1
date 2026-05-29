import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  UserSearch,
  Home,
  TreePine,
  Building2,
  Map,
  Building,
} from 'lucide-react';
import PageLayout from '../../shared/components/layout/PageLayout';
import Card from '../../shared/components/ui/Card';
import { useAuthStore } from '../../shared/stores/auth.store';
import DashboardSlideshow, { type SlideshowItem } from './components/DashboardSlideshow';

interface DashboardData {
  isPrivileged: boolean;
  counts: {
    prospects: number;
    clients: number | null;
    owners: number | null;
    availableTerrains: number | null;
    availableProperties: number | null;
    lotissements: number | null;
    programmes: number | null;
  };
  slideshow: SlideshowItem[];
}

interface StatTile {
  key: string;
  label: string;
  value: number | null;
  to: string;
  icon: ReactNode;
  iconBg: string;
  privileged: boolean;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAD = user?.role === 'ASSISTANTE_DIRECTION';

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    window.electron.dashboard
      .getStats(token)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) {
          setData(r.data);
          setError(null);
        } else {
          setError(typeof r.error === 'string' ? r.error : 'Erreur de chargement');
        }
      })
      .catch((e) => !cancelled && setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tiles: StatTile[] = data
    ? [
        {
          key: 'prospects',
          label: 'Prospects',
          value: data.counts.prospects,
          to: '/prospects',
          icon: <UserSearch className="h-6 w-6 text-purple-600" />,
          iconBg: 'bg-purple-50',
          privileged: false,
        },
        {
          key: 'clients',
          label: 'Clients',
          value: data.counts.clients,
          to: '/clients',
          icon: <UserCheck className="h-6 w-6 text-green-600" />,
          iconBg: 'bg-green-50',
          privileged: true,
        },
        {
          key: 'owners',
          label: 'Propriétaires',
          value: data.counts.owners,
          to: '/owners',
          icon: <Home className="h-6 w-6 text-orange-600" />,
          iconBg: 'bg-orange-50',
          privileged: true,
        },
        {
          key: 'availableTerrains',
          label: 'Terrains disponibles',
          value: data.counts.availableTerrains,
          to: '/terrains',
          icon: <TreePine className="h-6 w-6 text-emerald-600" />,
          iconBg: 'bg-emerald-50',
          privileged: true,
        },
        {
          key: 'availableProperties',
          label: 'Biens disponibles',
          value: data.counts.availableProperties,
          to: '/properties',
          icon: <Building2 className="h-6 w-6 text-blue-600" />,
          iconBg: 'bg-blue-50',
          privileged: true,
        },
        {
          key: 'lotissements',
          label: 'Lotissements',
          value: data.counts.lotissements,
          to: '/lotissements',
          icon: <Map className="h-6 w-6 text-amber-600" />,
          iconBg: 'bg-amber-50',
          privileged: true,
        },
        {
          key: 'programmes',
          label: 'Programmes immobiliers',
          value: data.counts.programmes,
          to: '/programmes',
          icon: <Building className="h-6 w-6 text-indigo-600" />,
          iconBg: 'bg-indigo-50',
          privileged: true,
        },
      ].filter((t) => !t.privileged || data.isPrivileged)
    : [];

  return (
    <PageLayout title="Tableau de bord" breadcrumbs={[{ label: 'Accueil' }]}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Bonjour, {user?.firstName} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-1">Bienvenue sur Afrikimmo-App</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.slideshow.length > 0 && (
        <div className={isAD ? 'mb-2' : 'mb-8'}>
          <DashboardSlideshow items={data.slideshow} />
        </div>
      )}

      {!isAD && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="flex items-center gap-4">
                  <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                </Card>
              ))
            : tiles.map((tile) => (
                <Link
                  key={tile.key}
                  to={tile.to}
                  className="block transition-transform hover:-translate-y-0.5"
                >
                  <Card className="flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition">
                    <div className={`rounded-xl p-3 ${tile.iconBg}`}>{tile.icon}</div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {tile.value ?? '—'}
                      </p>
                      <p className="text-sm text-slate-500">{tile.label}</p>
                    </div>
                  </Card>
                </Link>
              ))}
        </div>
      )}

    </PageLayout>
  );
}
