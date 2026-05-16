import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Pagination from '../../../shared/components/ui/Pagination';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { useProperties } from '../hooks/useProperties';
import { formatCurrency } from '../../../shared/utils/format';
import { Plus, Eye, Edit, Building2 } from 'lucide-react';

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'APARTEMENT', label: 'Appartement' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'BUREAU', label: 'Bureau' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'AUTRE', label: 'Autre' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'INDISPONIBLE', label: 'Indisponible' },
  { value: 'EN_LOCATION', label: 'En location' },
  { value: 'SOLDE', label: 'Soldé' },
  { value: 'SOUS_OPTION', label: 'Sous option' },
  { value: 'EN_RENOVATION', label: 'En rénovation' },
];

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default' | 'purple'> = {
  DISPONIBLE: 'success',
  INDISPONIBLE: 'danger',
  EN_LOCATION: 'info',
  SOLDE: 'default',
  SOUS_OPTION: 'warning',
  EN_RENOVATION: 'purple',
};

const STATUS_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  INDISPONIBLE: 'Indisponible',
  EN_LOCATION: 'En location',
  SOLDE: 'Soldé',
  SOUS_OPTION: 'Sous option',
  EN_RENOVATION: 'En rénovation',
};

const TYPE_LABEL: Record<string, string> = {
  APARTEMENT: 'Appartement', DUPLEX: 'Duplex',
  VILLA: 'Villa', STUDIO: 'Studio', BUREAU: 'Bureau', PARKING: 'Parking', AUTRE: 'Autre',
};

export default function PropertiesListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const filters = {
    search: search || undefined,
    type: type || undefined,
    status: status || undefined,
  };
  const { data, isLoading } = useProperties(filters, page, 20);
  const properties: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  return (
    <PageLayout
      title="Gestion des biens"
      breadcrumbs={[{ label: 'Biens' }]}
      actions={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/properties/new')}>
          Nouveau bien
        </Button>
      }
    >
      <Card className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input label="Rechercher" placeholder="Référence, adresse, ville…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Type" options={TYPE_OPTIONS} value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-44">
          <Select label="Statut" options={STATUS_OPTIONS} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
      </Card>

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : properties.length === 0 ? (
          <EmptyState
            title="Aucun bien trouvé"
            description="Commencez par référencer un bien immobilier."
            action={{ label: 'Nouveau bien', onClick: () => navigate('/properties/new') }}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Référence</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Adresse</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Propriétaire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Surface</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {properties.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-900">{p.reference}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{p.address}</p>
                      <p className="text-xs text-slate-500">{p.city}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.owner
                        ? (p.owner.companyName ?? `${p.owner.firstName ?? ''} ${p.owner.lastName ?? ''}`.trim())
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.surface} m²</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.rentPrice ? <p>{formatCurrency(Number(p.rentPrice))}<span className="text-xs text-slate-400">/mois</span></p> : null}
                      {p.salePrice ? <p className="text-xs">{formatCurrency(Number(p.salePrice))}</p> : null}
                      {!p.rentPrice && !p.salePrice ? '—' : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}
                          onClick={() => navigate(`/properties/${p.id}`)} />
                        <Button variant="ghost" size="sm" icon={<Edit className="h-4 w-4" />}
                          onClick={() => navigate(`/properties/${p.id}/edit`)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </Card>
    </PageLayout>
  );
}
