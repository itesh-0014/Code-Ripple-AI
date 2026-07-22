import { Inbox, RefreshCw } from 'lucide-react';

export function LoadingPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel animate-pulse p-5">
      <div className="h-4 w-32 rounded bg-stone-200 dark:bg-line" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 rounded-xl bg-stone-100 dark:bg-ink" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel grid min-h-64 place-items-center p-8 text-center">
      <div>
        <Inbox className="mx-auto text-stone-400" />
        <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-stone-500">{description}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="panel grid min-h-64 place-items-center p-8 text-center">
      <div>
        <h3 className="font-display text-lg font-semibold">Could not load this view</h3>
        <p className="mt-2 text-sm text-stone-500">{message}</p>
        <button className="button-secondary mt-5" onClick={retry}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
}
