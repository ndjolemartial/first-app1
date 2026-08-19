import { useNavigate } from 'react-router-dom';
import Badge from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlReviewByConvention } from '../hooks/useAml';
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_VARIANT } from '../utils/aml.utils';
import { Radar } from 'lucide-react';

const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];

/** Badge non bloquant de la revue de vigilance LBC/FT la plus récente d'une convention. */
export default function AmlReviewBadge({ conventionId }: { conventionId: number }) {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const { data } = useAmlReviewByConvention(conventionId);
  const review = data?.data;
  if (!review) return null;

  const clickable = AML_ROLES.includes(role);
  const label = (
    <span className="inline-flex items-center gap-1">
      <Radar className="h-3 w-3" />
      Revue LBC/FT : {REVIEW_STATUS_LABEL[review.status] ?? review.status}
    </span>
  );
  if (!clickable) return <Badge variant={REVIEW_STATUS_VARIANT[review.status] ?? 'default'}>{label}</Badge>;
  return (
    <button type="button" onClick={() => navigate(`/aml/reviews/${review.id}`)} className="cursor-pointer">
      <Badge variant={REVIEW_STATUS_VARIANT[review.status] ?? 'default'}>{label}</Badge>
    </button>
  );
}
