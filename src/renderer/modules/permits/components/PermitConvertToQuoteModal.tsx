import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { usePermitEstimateToQuote } from '../hooks/usePermitProjects';
import { useClients } from '../../clients/hooks/useClients';
import { useProspects } from '../../prospects/hooks/useProspects';
import { formatPersonName } from '../../../shared/utils/format';
import { makeEntitySearch } from '../../../shared/utils/entitySearch';
import { useAuthStore } from '../../../shared/stores/auth.store';

const clientLabel = (c: any) => formatPersonName(c, '');
const prospectLabel = (p: any) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

/** Date du jour + 30 jours (format `yyyy-mm-dd`), valeur par défaut de « Validité jusqu'au ». */
function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function PermitConvertToQuoteModal({ open, onClose, estimate }: { open: boolean; onClose: () => void; estimate: any }) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [clientId, setClientId] = useState(estimate?.project?.clientId ? String(estimate.project.clientId) : '');
  const [prospectId, setProspectId] = useState(estimate?.project?.prospectId ? String(estimate.project.prospectId) : '');
  const [taxRate, setTaxRate] = useState('18');
  const [validUntil, setValidUntil] = useState(defaultValidUntil());

  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: prospectsRes } = useProspects({}, 1, 500);
  const searchClients = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.clients.list(token!, filters, page, limit), (c: any) => ({ value: String(c.id), label: clientLabel(c) })),
    [token],
  );
  const searchProspects = useMemo(
    () => makeEntitySearch((filters, page, limit) => window.electron.prospects.list(token!, filters, page, limit), (p: any) => ({ value: String(p.id), label: prospectLabel(p) })),
    [token],
  );
  const toQuote = usePermitEstimateToQuote();

  const handleSubmit = async () => {
    if (!clientId && !prospectId) return;
    const res = await toQuote.mutateAsync({
      estimateId: estimate.id,
      payload: {
        clientId: clientId ? Number(clientId) : null,
        prospectId: prospectId ? Number(prospectId) : null,
        taxRate: Number(taxRate) || 0,
        validUntil: validUntil || null,
      },
    });
    if (res.success && res.data) {
      onClose();
      navigate(`/quotes/${res.data.id}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Créer le devis commercial"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} loading={toQuote.isPending} disabled={!clientId && !prospectId}>Créer le devis</Button>
      </>}
    >
      <div className="space-y-4">
        <SearchSelect label="Client" options={(clientsRes?.data ?? []).map((c: any) => ({ value: String(c.id), label: clientLabel(c) }))}
          onSearch={searchClients} placeholder="Rechercher un client…" value={clientId} onChange={setClientId} />
        <SearchSelect label="Prospect" options={(prospectsRes?.data ?? []).map((p: any) => ({ value: String(p.id), label: prospectLabel(p) }))}
          onSearch={searchProspects} placeholder="Rechercher un prospect…" value={prospectId} onChange={setProspectId} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="TVA %" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          <Input label="Validité jusqu’au" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        {!clientId && !prospectId && <p className="text-xs text-red-500">Sélectionnez un client ou un prospect.</p>}
      </div>
    </Modal>
  );
}
