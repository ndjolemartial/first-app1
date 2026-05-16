import { Inbox } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}

export default function EmptyState({ title = 'Aucun résultat', description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-400">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-xs">{description}</p>}
      {action && (
        <Button className="mt-4" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
