import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-stone-950 dark:text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
