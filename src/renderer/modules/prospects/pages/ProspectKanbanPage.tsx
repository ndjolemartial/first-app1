import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { useProspectKanban, useUpdateProspectStatus } from '../hooks/useProspects';
import { formatCurrency } from '../../../shared/utils/format';
import { UserPlus, List, Eye, Phone, ArrowRight, UserCircle2 } from 'lucide-react';

const formatUserName = (u: any): string =>
  u ? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() : '';

// ── Configuration des colonnes ─────────────────────────────────────────────────

const COLUMNS = [
  { key: 'NOUVEAU',              label: 'Nouveau',        color: 'border-slate-300 bg-slate-50',   header: 'bg-slate-100'   },
  { key: 'CONTACTE',             label: 'Contacté',       color: 'border-blue-200  bg-blue-50',    header: 'bg-blue-100'    },
  { key: 'QUALIFIE',             label: 'Qualifié',       color: 'border-purple-200 bg-purple-50', header: 'bg-purple-100'  },
  { key: 'ENVOI_PROPOSITION',    label: 'Proposition',    color: 'border-amber-200 bg-amber-50',   header: 'bg-amber-100'   },
  { key: 'NEGOCIATION_EN_COURS', label: 'Négociation',    color: 'border-orange-200 bg-orange-50', header: 'bg-orange-100'  },
  { key: 'PERDU',                label: 'Perdu',          color: 'border-red-200   bg-red-50',     header: 'bg-red-100'     },
];

// Transitions autorisées (vers l'avant uniquement, sauf PERDU accessible depuis tout statut)
const NEXT_STATUS: Record<string, string[]> = {
  NOUVEAU:              ['CONTACTE', 'PERDU'],
  CONTACTE:             ['QUALIFIE', 'PERDU'],
  QUALIFIE:             ['ENVOI_PROPOSITION', 'PERDU'],
  ENVOI_PROPOSITION:    ['NEGOCIATION_EN_COURS', 'PERDU'],
  NEGOCIATION_EN_COURS: ['PERDU'],
  PERDU:                ['NOUVEAU'],
};

const STATUS_LABEL: Record<string, string> = {
  NOUVEAU: 'Nouveau', CONTACTE: 'Contacté', QUALIFIE: 'Qualifié',
  ENVOI_PROPOSITION: 'Proposition', NEGOCIATION_EN_COURS: 'Négociation', PERDU: 'Perdu',
};

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ProspectKanbanPage() {
  const navigate     = useNavigate();
  const { data, isLoading } = useProspectKanban();
  const updateStatus = useUpdateProspectStatus();

  const columns: Record<string, any[]> = data?.data ?? {};

  return (
    <PageLayout
      title="Pipeline Prospects"
      breadcrumbs={[{ label: 'Prospects', to: '/prospects' }, { label: 'Kanban' }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<List className="h-4 w-4" />}
            onClick={() => navigate('/prospects')}
          >
            Vue liste
          </Button>
          <Button
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => navigate('/prospects/new')}
          >
            Nouveau prospect
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="w-64 flex-shrink-0 rounded-xl bg-slate-100 h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
          {COLUMNS.map((col) => {
            const cards: any[] = columns[col.key] ?? [];
            return (
              <div
                key={col.key}
                className={`w-72 flex-shrink-0 flex flex-col rounded-xl border-2 ${col.color}`}
              >
                {/* En-tête colonne */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg ${col.header}`}>
                  <span className="font-semibold text-sm text-slate-700">{col.label}</span>
                  <Badge variant="default">{cards.length}</Badge>
                </div>

                {/* Cartes */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-10">Aucun prospect</p>
                  )}
                  {cards.map((p: any) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow transition-shadow"
                    >
                      {/* Nom + bouton détail */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p
                          className="font-medium text-sm text-slate-900 leading-tight cursor-pointer hover:text-blue-600"
                          onClick={() => navigate(`/prospects/${p.id}`)}
                        >
                          {p.lastName} {p.firstName}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="h-3.5 w-3.5" />}
                          onClick={() => navigate(`/prospects/${p.id}`)}
                        />
                      </div>

                      {/* Infos secondaires */}
                      {(p.phone || p.mobile) && (
                        <p className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <Phone className="h-3 w-3" />
                          {p.phone ?? p.mobile}
                        </p>
                      )}
                      {p.budget && (
                        <p className="text-xs font-medium text-emerald-600 mb-2">
                          {formatCurrency(p.budget)}
                        </p>
                      )}
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <UserCircle2 className="h-3 w-3" />
                        {p.assignedTo
                          ? formatUserName(p.assignedTo)
                          : <span className="italic text-slate-400">Non alloué</span>}
                      </p>

                      {/* Transitions de statut */}
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
                        {(NEXT_STATUS[col.key] ?? []).map((nextKey) => (
                          <button
                            key={nextKey}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-0.5 text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 px-2 py-0.5 rounded-full transition-colors"
                            onClick={() => updateStatus.mutate({ id: p.id, status: nextKey })}
                          >
                            <ArrowRight className="h-2.5 w-2.5" />
                            {STATUS_LABEL[nextKey]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
