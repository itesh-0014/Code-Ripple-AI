import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article className={accent ? 'panel bg-ink p-5 text-white dark:bg-signal dark:text-ink' : 'panel p-5'}>
      <div className="flex items-start justify-between">
        <p className={accent ? 'text-xs font-medium text-stone-300 dark:text-stone-700' : 'text-xs font-medium text-stone-500'}>
          {label}
        </p>
        <span className={accent ? 'rounded-lg bg-white/10 p-2 dark:bg-ink/10' : 'rounded-lg bg-stone-100 p-2 dark:bg-line'}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-5 font-display text-3xl font-semibold tracking-tight">{value}</p>
      <p className={accent ? 'mt-2 flex items-center gap-1 text-xs text-stone-300 dark:text-stone-700' : 'mt-2 flex items-center gap-1 text-xs text-stone-500'}>
        <ArrowUpRight size={13} /> {helper}
      </p>
    </article>
  );
}
