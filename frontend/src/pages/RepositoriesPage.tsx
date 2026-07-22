import { ExternalLink, GitBranch, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState, ErrorState, LoadingPanel } from '../components/common/States';
import { StatusDot } from '../components/common/Logo';
import { useRepositories } from '../hooks/useDashboardData';

export function RepositoriesPage() {
  const repositories = useRepositories();

  if (repositories.isLoading) return <LoadingPanel rows={6} />;
  if (repositories.isError) return <ErrorState message={repositories.error.message} retry={() => repositories.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Repositories" title="Connected codebases." description="Monitor review coverage and risk posture across every connected repository." />
      {!repositories.data?.length ? (
        <EmptyState title="No repositories connected" description="Install the GitHub App on a repository to begin collecting review intelligence." />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repositories.data.map(repository => (
            <article key={repository.id} className="panel p-5 transition hover:-translate-y-0.5 hover:shadow-panel">
              <div className="flex items-start justify-between">
                <div className="grid size-11 place-items-center rounded-xl bg-stone-100 dark:bg-line"><GitBranch size={19} /></div>
                <span className="flex items-center gap-2 text-[11px] text-stone-500"><StatusDot active={repository.connected} /> OAuth visible</span>
              </div>
              <h2 className="mt-5 font-display text-lg font-semibold">{repository.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${repository.appInstalled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-600'}`}>
                  {repository.appInstalled ? 'GitHub App installed' : 'Install app for PR analysis'}
                </span>
                {repository.private && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] dark:bg-ink">Private</span>}
              </div>
              <p className="mt-3 text-xs text-stone-500">Last reviewed {formatDistanceToNow(new Date(repository.lastReviewAt), { addSuffix: true })}</p>
              <div className="mt-6 grid grid-cols-3 gap-3 border-t pt-5">
                <RepositoryMetric label="Reviews" value={repository.reviewCount} />
                <RepositoryMetric label="Avg. risk" value={repository.averageRisk.toFixed(1)} />
                <RepositoryMetric label="Critical" value={repository.criticalReviews} />
              </div>
              <a href={repository.htmlUrl || `https://github.com/${repository.name}`} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5 text-xs font-medium dark:bg-ink">
                Open repository <ExternalLink size={14} />
              </a>
            </article>
          ))}
          <article className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-6 text-center">
            <div>
              <ShieldCheck className="mx-auto text-stone-400" />
              <p className="mt-3 text-sm font-medium">Connect another repository</p>
              <p className="mt-1 text-xs text-stone-500">Manage GitHub App installations in settings.</p>
            </div>
          </article>
        </section>
      )}
    </>
  );
}

function RepositoryMetric({ label, value }: { label: string; value: string | number }) {
  return <div><p className="font-display text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-stone-500">{label}</p></div>;
}
