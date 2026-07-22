import clsx from 'clsx';
import type { Severity } from '../../types/dashboard';

const styles: Record<Severity, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  CRITICAL: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={clsx('rounded-full px-2.5 py-1 font-mono text-[10px] font-medium tracking-wide', styles[severity])}>
      {severity}
    </span>
  );
}
