import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { RadioTower, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { useReviewJobs, useWebhookDeliveries } from '../hooks/useDashboardData';

export function OperationsPage() {
  const jobs = useReviewJobs();
  const deliveries = useWebhookDeliveries();

  if (jobs.isLoading || deliveries.isLoading) return <LoadingPanel rows={8} />;
  if (jobs.isError) return <ErrorState message={jobs.error.message} retry={() => jobs.refetch()} />;
  if (deliveries.isError) return <ErrorState message={deliveries.error.message} retry={() => deliveries.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Review pipeline activity."
        description="Track active PR analyses, recent webhook deliveries, and processing outcomes."
        action={<button className="button-secondary" onClick={() => { jobs.refetch(); deliveries.refetch(); }}><RefreshCw size={15} /> Refresh</button>}
      />
      <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <article className="panel p-5 md:p-6">
          <div className="flex items-center gap-3">
            <RadioTower size={18} />
            <div>
              <p className="eyebrow">Live jobs</p>
              <h2 className="mt-1 font-display text-xl font-semibold">PR analysis progress</h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {!jobs.data?.length ? <p className="text-sm text-stone-500">No active or recent jobs.</p> : jobs.data.map(job => (
              <Link
                key={job.id}
                to={`/reviews/${job.reviewHistoryId || 'pending'}/analysis?repository=${job.repository}&pr=${job.pullNumber}`}
                className="block rounded-xl border p-4 hover:bg-stone-50 dark:hover:bg-ink transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.repository} #{job.pullNumber}</p>
                    <p className="mt-1 text-xs text-stone-500">{job.stage} · updated {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}</p>
                  </div>
                  <Status label={job.status} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-ink">
                  <div className="h-full bg-signal" style={{ width: `${Math.min(100, job.progress)}%` }} />
                </div>
                {job.error && <p className="mt-3 text-xs text-rose-500">{job.error.message}</p>}
              </Link>
            ))}
          </div>
        </article>
        <article className="panel overflow-hidden">
          <div className="border-b px-5 py-5">
            <p className="eyebrow">Webhook deliveries</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Recent GitHub events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-[11px] uppercase tracking-wider text-stone-500">
                <tr><th className="px-5 py-3">Event</th><th className="px-3 py-3">Repository</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Received</th></tr>
              </thead>
              <tbody>
                {deliveries.data?.map((delivery, index) => (
                  <tr key={delivery.deliveryId || `${delivery.event}-${index}`} className="border-b last:border-0">
                    <td className="px-5 py-4"><p className="font-medium">{delivery.event}</p><p className="text-xs text-stone-500">{delivery.action || 'n/a'}</p></td>
                    <td className="px-3 py-4 font-mono text-xs text-stone-500">{delivery.repository || 'n/a'}</td>
                    <td className="px-3 py-4"><Status label={delivery.status} /></td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}

function Status({ label }: { label: string }) {
  const active = ['completed', 'processed', 'received'].includes(label);
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : label === 'failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'}`}>{label}</span>;
}
