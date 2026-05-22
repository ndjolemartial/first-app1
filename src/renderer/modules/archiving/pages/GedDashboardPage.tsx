import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import ArchivingNav from '../components/ArchivingNav';
import { useGedDashboard } from '../hooks/useGed';
import { formatBytes, mimeGroup } from '../utils/gedTree';
import { Files, CalendarPlus, HardDrive, Archive, AlertTriangle, FileText } from 'lucide-react';

const GROUP_LABEL: Record<string, string> = {
  PDF: 'PDF', IMAGE: 'Images', VIDEO: 'Vidéos', AUDIO: 'Audios', OFFICE: 'Bureautique', AUTRE: 'Autres',
};

export default function GedDashboardPage() {
  const navigate = useNavigate();
  const { data: res, isLoading } = useGedDashboard();
  const d = res?.data;
  const failed = !isLoading && !d;

  return (
    <PageLayout
      title="Tableau de bord — GED"
      breadcrumbs={[{ label: 'Archivage', to: '/archiving' }, { label: 'Tableau de bord GED' }]}
    >
      <ArchivingNav />

      {isLoading ? (
        <div className="p-6"><SkeletonTable rows={6} /></div>
      ) : failed ? (
        <Card className="border-l-4 border-red-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-red-600">Impossible de charger le tableau de bord.</p>
              <p className="mt-0.5">
                {res && !res.success
                  ? String(res.error)
                  : "Le service de documents n'a pas répondu."}
              </p>
              <p className="mt-1 text-slate-500">
                Si l'application vient d'être mise à jour, fermez-la entièrement puis relancez <code>npm run dev</code>.
              </p>
            </div>
          </div>
        </Card>
      ) : !d ? null : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Documents', value: d.total, icon: <Files className="h-5 w-5" />, color: 'bg-blue-100 text-blue-600' },
              { label: 'Archivés ce mois', value: d.monthCount, icon: <CalendarPlus className="h-5 w-5" />, color: 'bg-emerald-100 text-emerald-600' },
              { label: 'Espace disque', value: formatBytes(d.diskBytes), icon: <HardDrive className="h-5 w-5" />, color: 'bg-amber-100 text-amber-600' },
              { label: 'Documents physiques', value: d.physicalCount, icon: <Archive className="h-5 w-5" />, color: 'bg-purple-100 text-purple-600' },
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

          {/* Alertes */}
          {d.uncategorized > 0 && (
            <Card className="border-l-4 border-amber-400">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{d.uncategorized}</span> document(s) sans catégorie — pensez à les classer.
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Répartition par type */}
            <Card>
              <h3 className="mb-4 font-semibold text-slate-800">Répartition par type</h3>
              <div className="space-y-2">
                {Object.entries(d.byTypeGroup as Record<string, number>).map(([key, count]) => {
                  const pct = d.total > 0 ? Math.round((count / d.total) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="mb-0.5 flex justify-between text-sm">
                        <span className="text-slate-600">{GROUP_LABEL[key] ?? key}</span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Répartition par catégorie */}
            <Card>
              <h3 className="mb-4 font-semibold text-slate-800">Répartition par catégorie</h3>
              {(d.byCategory ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Aucune catégorie définie.</p>
              ) : (
                <div className="space-y-1.5">
                  {d.byCategory.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{c.name}</span>
                      <Badge variant="default">{c._count?.documents ?? 0}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Documents récents */}
          <Card>
            <h3 className="mb-3 font-semibold text-slate-800">Documents récents</h3>
            {(d.recent ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Aucun document.</p>
            ) : (
              <div className="space-y-1">
                {d.recent.map((doc: any) => (
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
        </div>
      )}
    </PageLayout>
  );
}
