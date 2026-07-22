import { GitPullRequestArrow } from 'lucide-react';
import clsx from 'clsx';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-signal text-ink">
        <GitPullRequestArrow size={18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <div>
          <div className="font-display text-sm font-bold tracking-tight">Code Ripple AI</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">
            Review intelligence
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusDot({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block size-2 rounded-full',
        active ? 'bg-emerald-500' : 'bg-stone-400',
        className,
      )}
    />
  );
}
