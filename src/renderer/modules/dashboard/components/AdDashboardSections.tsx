import { useNavigate } from 'react-router-dom';
import { Files, CalendarPlus, HardDrive, FileText } from 'lucide-react';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { formatBytes, mimeGroup } from '../../archiving/utils/gedTree';
import { useGedDashboard } from '../../archiving/hooks/useGed';
import CrmRecapSection from './CrmRecapSection';

/**
 * Sections du tableau de bord propres au rôle Assistante de Direction :
 * récapitulatif de la GED (documents, archives récentes, espace disque,
 * documents récents) et synthèse des activités CRM la concernant.
 */
export default function AdDashboardSections() {
  const navigate = useNavigate();

  const { data: gedRes, isLoading: gedLoading } = useGedDashboard();
  const ged = gedRes?.data;

  return (
    <div className="space-y-8">
      {/* ── Récapitulatif GED ─────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Gestion électronique des documents</h3>
          <button
            onClick={() => navigate('/archiving/ged/dashboard')}
            className="text-sm text-blue-600 hover:underline"
          >
            Voir la GED
          </button>
        </div>

        {gedLoading ? (
          <div className="p-6"><SkeletonTable rows={4} /></div>
        ) : !ged ? (
          <Card className="text-sm text-slate-400">Récapitulatif GED indisponible.</Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Documents archivés', value: ged.total, icon: <Files className="h-5 w-5" />, color: 'bg-blue-100 text-blue-600' },
                { label: 'Archives récentes (ce mois)', value: ged.monthCount, icon: <CalendarPlus className="h-5 w-5" />, color: 'bg-emerald-100 text-emerald-600' },
                { label: 'Espace disque', value: formatBytes(ged.diskBytes), icon: <HardDrive className="h-5 w-5" />, color: 'bg-amber-100 text-amber-600' },
              ].map((k) => (
                <Card key={k.label}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.color}`}>{k.icon}</div>
                    <div>
                      <p className="text-xs text-slate-500">{k.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="mt-4">
              <h4 className="mb-3 font-semibold text-slate-800">Documents récents</h4>
              {(ged.recent ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Aucun document.</p>
              ) : (
                <div className="space-y-1">
                  {ged.recent.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => navigate(`/archiving/ged/${doc.id}`)}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate font-medium text-slate-800">{doc.name}</span>
                      <Badge variant="info">{mimeGroup(doc.type).label}</Badge>
                      <span className="text-xs text-slate-400">{formatDate(doc.uploadedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </section>

      {/* ── Récapitulatif activités CRM ───────────────────────── */}
      <CrmRecapSection />
    </div>
  );
}
