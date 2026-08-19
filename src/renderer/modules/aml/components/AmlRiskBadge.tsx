import Badge from '../../../shared/components/ui/Badge';
import { RISK_LEVEL_LABEL, RISK_LEVEL_VARIANT } from '../utils/aml.utils';
import type { AmlRiskLevel } from '../types/aml.types';

export default function AmlRiskBadge({ level }: { level: AmlRiskLevel }) {
  return <Badge variant={RISK_LEVEL_VARIANT[level] ?? 'default'}>{RISK_LEVEL_LABEL[level] ?? level}</Badge>;
}
