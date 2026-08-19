import { useNavigate } from 'react-router-dom';
import Badge from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlProfileBySubject } from '../hooks/useAml';
import { RISK_LEVEL_LABEL, RISK_LEVEL_VARIANT } from '../utils/aml.utils';
import { ShieldAlert } from 'lucide-react';

const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];

/** Badge non bloquant du profil LBC/FT — n'affiche rien si aucun profil n'existe. */
export default function AmlProfileLinkBadge({ subjectType, subjectId }: { subjectType: 'CLIENT' | 'OWNER'; subjectId: number }) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const { data } = useAmlProfileBySubject(subjectType, subjectId);
  const profile = data?.data;
  if (!profile) return null;

  const clickable = AML_ROLES.includes(role);
  const label = (
    <span className="inline-flex items-center gap-1">
      <ShieldAlert className="h-3 w-3" />
      LBC/FT : {RISK_LEVEL_LABEL[profile.riskLevel] ?? profile.riskLevel}
    </span>
  );

  if (!clickable) return <Badge variant={RISK_LEVEL_VARIANT[profile.riskLevel] ?? 'default'}>{label}</Badge>;

  return (
    <button type="button" onClick={() => navigate(`/aml/profiles/${profile.id}`)} className="cursor-pointer">
      <Badge variant={RISK_LEVEL_VARIANT[profile.riskLevel] ?? 'default'}>{label}</Badge>
    </button>
  );
}
