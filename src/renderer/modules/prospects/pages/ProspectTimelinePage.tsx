import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import ExportMenu from '../../../shared/components/ExportMenu';
import EntityTimeline from '../../../shared/components/EntityTimeline';
import { toast } from '../../../shared/components/ui/Toast';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { TIMELINE_EXPORT_COLUMNS } from '../../../shared/utils/timelineExport';
import { useProspect, useProspectTimeline } from '../hooks/useProspects';
import { ArrowLeft, Printer } from 'lucide-react';

export default function ProspectTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const prospectId = Number(id);
  const { data: prospectRes, isLoading: loadingProspect } = useProspect(prospectId);
  const { data: timelineRes, isLoading: loadingTimeline } = useProspectTimeline(prospectId);
  const [printing, setPrinting] = useState(false);

  const p = prospectRes?.data;
  const displayName = p ? `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim() : '…';
  const items = timelineRes?.success ? timelineRes.data ?? [] : [];
  const fileName = `fiche-suivi-${displayName.replace(/\s+/g, '-').toLowerCase()}`;

  const handlePrint = async () => {
    if (items.length === 0) { toast.error('Aucune activité à imprimer'); return; }
    setPrinting(true);
    try {
      const matrix = items.map((row) =>
        TIMELINE_EXPORT_COLUMNS.map((col) => {
          const v = col.cell(row);
          return v === null || v === undefined ? '' : String(v);
        }),
      );
      const pr = await window.electron.exporter.print(token, {
        fileName,
        title: `Fiche de suivi — ${displayName}`,
        subtitle: p?.reference,
        headers: TIMELINE_EXPORT_COLUMNS.map((col) => col.header),
        rows: matrix,
      });
      if (!pr.success) toast.error(typeof pr.error === 'string' ? pr.error : "Erreur lors de l'impression");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'impression");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PageLayout
      title={`Fiche de suivi — ${displayName}`}
      breadcrumbs={[
        { label: 'Prospects', to: '/prospects' },
        { label: displayName, to: `/prospects/${id}` },
        { label: 'Fiche de suivi' },
      ]}
      actions={
        <div className="flex gap-2">
          <ExportMenu
            fileName={fileName}
            title={`Fiche de suivi — ${displayName}`}
            subtitle={p?.reference}
            columns={TIMELINE_EXPORT_COLUMNS}
            fetchRows={async () => items}
          />
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} loading={printing} onClick={handlePrint}>
            Imprimer
          </Button>
          <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(`/prospects/${id}`)}>
            Retour à la fiche
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {!loadingProspect && !p ? (
          <Card><p className="text-sm text-red-600">Prospect introuvable ou inaccessible.</p></Card>
        ) : (
          <EntityTimeline items={items} isLoading={loadingTimeline} />
        )}
      </div>
    </PageLayout>
  );
}
