import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: boolean;
}

export default function Card({ children, className, padding = true, ...rest }: CardProps) {
  return (
    <div
      className={clsx('bg-white rounded-xl border border-slate-200 shadow-sm', padding && 'p-6', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
