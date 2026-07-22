import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { useReviews } from '../hooks/useDashboardData';

export function TimelinePage() {
  const reviews = useReviews({ page: 1 });
  if (reviews.isLoading) return <LoadingPanel rows={8} />;
  if (reviews.isError) return <ErrorState message={reviews.error.message} retry={() => reviews.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Review timeline" title="The history of change." description="A chronological view of pull request risk and the systems touched along the way." />
      <section className="panel p-5 md:p-8">
        <div className="relative ml-3 border-l pl-7">
          {reviews.data?.items.map(review => (
            <article key={review.id} className="relative mb-8 last:mb-0">
              <span className="absolute -left-[34px] top-2 size-3 rounded-full border-2 border-white bg-signal ring-4 ring-stone-100 dark:border-panel dark:ring-line" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{format(new Date(review.createdAt), 'MMM d, yyyy · HH:mm')}</p>
              <Link to={`/reviews/${review.id}`} className="mt-2 block rounded-2xl border p-5 transition hover:bg-stone-50 dark:hover:bg-ink">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-mono text-[11px] text-stone-500">{review.repository} · PR #{review.prNumber}</p><h2 className="mt-2 font-display text-lg font-semibold">{review.title}</h2></div>
                  <div className="flex items-center gap-3"><span className="font-display text-2xl font-semibold">{review.riskScore.toFixed(1)}</span><SeverityBadge severity={review.severity} /></div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
