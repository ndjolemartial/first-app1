import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate, formatDateTime } from '../../../shared/utils/format';
import DocumentPreview from '../components/DocumentPreview';
import DocumentLinksFields, { DocumentLinks, EMPTY_LINKS } from '../components/DocumentLinksFields';
import {
  useGedDocument, useGedCategories, useGedFolders, useGedTags,
  useUpdateGedDocument, useDeleteGedDocument, openDocumentExternally,
} from '../hooks/useGed';
import { hierOptions, formatBytes, mimeGroup } from '../utils/gedTree';
import { ExternalLink, Trash2, Save, History, Link2 } from 'lucide-react';

const ACTION_LABEL: Record<string, string> = {
  IMPORT: 'Archivage', CONSULTATION: 'Consultation', MODIFICATION: 'Modification',
  SUPPRESSION: 'Suppression', TELECHARGEMENT: 'Téléchargement', RESTAURATION: 'Restauration',
};

export default function GedDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const docId = Number(id);
  const { data: res, isLoading } = useGedDocument(docId);
  const { data: catRes } = useGedCategories();
  const { data: folderRes } = useGedFolders();
  const { data: tagRes } = useGedTags();
  const update = useUpdateGedDocument();
  const remove = useDeleteGedDocument();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [links, setLinks] = useState<DocumentLinks>(EMPTY_LINKS);
  const [showLinks, setShowLinks] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const doc = res?.data;

  useEffect(() => {
    if (doc) {
      setName(doc.name ?? '');
      setDescription(doc.description ?? '');
      setCategoryId(doc.categoryId ? String(doc.categoryId) : '');
      setFolderId(doc.folderId ? String(doc.folderId) : '');
      setTagIds((doc.tags ?? []).map((t: any) => t.tagId));
      setLinks({
        clientId:      doc.clientId      ? String(doc.clientId)      : '',
        ownerId:       doc.ownerId       ? String(doc.ownerId)       : '',
        propertyId:    doc.propertyId    ? String(doc.propertyId)    : '',
        conventionId:  doc.conventionId  ? String(doc.conventionId)  : '',
        terrainId:     doc.terrainId     ? String(doc.terrainId)     : '',
        lotissementId: doc.lotissementId ? String(doc.lotissementId) : '',
        programmeId:   doc.programmeId   ? String(doc.programmeId)   : '',
        projectId:     doc.projectId     ? String(doc.projectId)     : '',
        prospectId:    doc.prospectId    ? String(doc.prospectId)    : '',
        referrerId:    doc.referrerId    ? String(doc.referrerId)    : '',
        linkedUserId:  doc.linkedUserId  ? String(doc.linkedUserId)  : '',
        invoiceId:     doc.invoiceId     ? String(doc.invoiceId)     : '',
        commissionId:  doc.commissionId  ? String(doc.commissionId)  : '',
        attestationId: doc.attestationId ? String(doc.attestationId) : '',
      });
    }
  }, [doc]);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;
  if (!doc) return <div className="p-8 text-slate-500">Document introuvable.</div>;

  const g = mimeGroup(doc.type);
  const categoryOptions = hierOptions(catRes?.data ?? [], '— Aucune catégorie —');
  const folderOptions = hierOptions(folderRes?.data ?? [], '— Aucun dossier —');
  const tags: any[] = tagRes?.data ?? [];

  const personName = (p: any) =>
    [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim()
    || p?.entreprise || p?.companyName || '—';

  const linkedItems: Array<{ label: string; to: string; name: string }> = [
    doc.client      && { label: 'Client',              to: `/clients/${doc.client.id}`,           name: personName(doc.client) },
    doc.owner       && { label: 'Propriétaire',        to: `/owners/${doc.owner.id}`,             name: personName(doc.owner) },
    doc.prospect    && { label: 'Prospect',            to: `/prospects/${doc.prospect.id}`,       name: personName(doc.prospect) },
    doc.referrer    && { label: "Apporteur d'affaires", to: `/commissions/referrers/${doc.referrer.id}/edit`, name: doc.referrer.companyName || personName(doc.referrer) },
    doc.linkedUser  && { label: 'Utilisateur',         to: `/users/${doc.linkedUser.id}`,         name: personName(doc.linkedUser) },
    doc.property    && { label: 'Bien',                to: `/properties/${doc.property.id}`,      name: doc.property.reference },
    doc.terrain     && { label: 'Terrain',             to: `/terrains/${doc.terrain.id}`,         name: doc.terrain.reference },
    doc.lotissement && { label: 'Lotissement',         to: `/lotissements/${doc.lotissement.id}`, name: `${doc.lotissement.reference} · ${doc.lotissement.nom}` },
    doc.programme   && { label: 'Programme',           to: `/programmes/${doc.programme.id}`,     name: `${doc.programme.reference} · ${doc.programme.nom}` },
    doc.project     && { label: 'Projet',              to: `/projects/${doc.project.id}`,         name: `${doc.project.reference} · ${doc.project.nom}` },
    doc.convention  && { label: 'Convention',          to: `/conventions/${doc.convention.id}`,   name: doc.convention.reference },
    doc.invoice     && { label: 'Facture',             to: `/accounting/invoices/${doc.invoice.id}`, name: doc.invoice.reference },
    doc.attestation && { label: 'Attestation',         to: `/conventions/attestations/${doc.attestation.id}`, name: doc.attestation.reference },
    doc.commission  && { label: 'Commission',          to: `/commissions/all`,                    name: doc.commission.reference },
  ].filter(Boolean) as Array<{ label: string; to: string; name: string }>;

  const handleSave = async () => {
    const linkPayload: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(links)) {
      linkPayload[k] = v ? Number(v) : null;
    }
    await update.mutateAsync({
      id: docId,
      payload: {
        name: name.trim(),
        description: description.trim(),
        categoryId: categoryId ? Number(categoryId) : null,
        folderId: folderId ? Number(folderId) : null,
        tagIds,
        ...linkPayload,
      },
    });
  };

  const activeLinkCount = Object.values(links).filter(Boolean).length;

  return (
    <PageLayout
      title={doc.name}
      breadcrumbs={[{ label: 'Archivage', to: '/archiving' }, { label: 'GED', to: '/archiving/ged' }, { label: doc.numeroArchive ?? doc.name }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />} onClick={() => openDocumentExternally(docId)}>
            Ouvrir
          </Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDelete(true)}>
            Supprimer
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Aperçu */}
        <div className="col-span-2 space-y-6">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <Badge variant="info">{g.label}</Badge>
              <span className="font-mono text-xs font-semibold text-blue-700">{doc.numeroArchive ?? '—'}</span>
              <span className="text-xs text-slate-400">{formatBytes(doc.size)}</span>
            </div>
            <DocumentPreview documentId={docId} mimeType={doc.type} name={doc.name} />
          </Card>

          {/* Journal des actions */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              <History className="h-4 w-4 text-slate-500" /> Journal des actions
            </h3>
            {(doc.auditLogs ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Aucune action enregistrée.</p>
            ) : (
              <div className="space-y-1.5">
                {doc.auditLogs.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="default">{ACTION_LABEL[a.action] ?? a.action}</Badge>
                    <span className="flex-1 text-slate-600">{a.detail}</span>
                    <span className="text-xs text-slate-400">
                      {a.user ? `${a.user.firstName} ${a.user.lastName} · ` : ''}{formatDateTime(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Métadonnées */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-semibold text-slate-800">Informations</h3>
            <div className="space-y-3">
              <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Select label="Catégorie" options={categoryOptions} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
              <Select label="Dossier" options={folderOptions} value={folderId} onChange={(e) => setFolderId(e.target.value)} />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Étiquettes</label>
                {tags.length === 0 ? (
                  <p className="text-xs text-slate-400">Aucune étiquette définie.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => {
                      const active = tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTagIds((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                          className={clsx(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                            active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                          )}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button onClick={handleSave} loading={update.isPending} icon={<Save className="h-4 w-4" />} className="w-full">
                Enregistrer
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold text-slate-800">Détails</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Type', doc.type],
                ['Archivé le', formatDate(doc.uploadedAt)],
                ['Archivé par', doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : '—'],
                ['Mis à jour', formatDate(doc.updatedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            {linkedItems.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs text-slate-500">Rattaché à</p>
                <ul className="space-y-1">
                  {linkedItems.map((item) => (
                    <li key={`${item.label}-${item.to}`} className="flex items-baseline gap-2 text-sm">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <button className="font-medium text-blue-600 hover:underline" onClick={() => navigate(item.to)}>
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Édition des rattachements */}
          <Card>
            <button
              type="button"
              onClick={() => setShowLinks((v) => !v)}
              className="-mx-1 flex w-full items-center justify-between rounded px-1 py-1 text-left hover:bg-slate-50"
            >
              <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <Link2 className="h-4 w-4 text-slate-500" />
                Rattachements
                {activeLinkCount > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {activeLinkCount}
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-400">{showLinks ? 'Masquer' : 'Modifier'}</span>
            </button>
            {showLinks && (
              <div className="mt-3 space-y-3">
                <DocumentLinksFields
                  values={links}
                  onChange={(field, value) => setLinks((prev) => ({ ...prev, [field]: value }))}
                />
                <Button onClick={handleSave} loading={update.isPending} icon={<Save className="h-4 w-4" />} className="w-full">
                  Enregistrer les rattachements
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Mettre le document à la corbeille"
        message={`Retirer « ${doc.name} » de la GED ?`}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          const r: any = await remove.mutateAsync(docId);
          if (r.success) navigate('/archiving/ged');
        }}
      />
    </PageLayout>
  );
}
