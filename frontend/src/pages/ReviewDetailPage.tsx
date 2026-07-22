import { ArrowLeft, ExternalLink, FileCode2, Gauge, RefreshCw, Target } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { MetricCard } from '../components/common/MetricCard';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { useReanalyzeReview, useReview } from '../hooks/useDashboardData';

export function ReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const review = useReview(id);
  const reanalyze = useReanalyzeReview();

  if (review.isLoading) return <LoadingPanel rows={8} />;
  if (review.isError) return <ErrorState message={review.error.message} retry={() => review.refetch()} />;

  const data = review.data!;

  return (
    <>
      <Link to="/reviews" className="mb-5 inline-flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white"><ArrowLeft size={14} /> Back to reviews</Link>
      <header className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3"><SeverityBadge severity={data.severity} /><span className="font-mono text-xs text-stone-500">{data.repository} · PR #{data.prNumber}</span></div>
          <h1 className="mt-4 max-w-4xl font-display text-3xl font-semibold tracking-[-0.04em] md:text-4xl">{data.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button-secondary"
            disabled={reanalyze.isPending}
            onClick={() => {
              if (id) {
                reanalyze.mutate(id, {
                  onSuccess: () => {
                    navigate(`/reviews/${id}/analysis`);
                  },
                });
              }
            }}
          >
            <RefreshCw size={15} className={reanalyze.isPending ? 'animate-spin' : ''} /> Reanalyze
          </button>
          <a className="button-secondary" href={data.prUrl} target="_blank" rel="noreferrer">View on GitHub <ExternalLink size={15} /></a>
        </div>
      </header>
      {reanalyze.data && (
        <div className="panel mb-6 p-4 text-sm text-stone-500">
          Reanalysis queued: {reanalyze.data.stage}. Track it in Operations.
        </div>
      )}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Risk score" value={`${data.riskScore.toFixed(1)} / 10`} helper={data.riskLevel} icon={Gauge} accent />
        <MetricCard label="Confidence" value={`${data.confidence}%`} helper="Evidence quality" icon={Target} />
        <MetricCard label="Review mode" value={data.reviewMode} helper={data.smartReview?.prSize || 'PR intelligence'} icon={FileCode2} />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <SmallStat label="GitHub publication" value={data.githubPublicationStatus || 'Not published'} />
        <SmallStat label="Check run" value={data.checkRunStatus || 'Not available'} />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <DetailSection title="Architecture findings" eyebrow="System impact">
            <div className="space-y-3">
              {data.architectureFindings.map((finding, index) => (
                <article key={`${finding.title}-${index}`} className="rounded-xl border p-4">
                  <div className="flex items-center gap-2"><SeverityBadge severity={finding.severity} /><p className="text-sm font-medium">{finding.title}</p></div>
                  <p className="mt-3 text-sm leading-6 text-stone-500">{finding.description}</p>
                  {finding.filePath && <p className="mt-3 font-mono text-[10px] text-stone-400">{finding.filePath}</p>}
                </article>
              ))}
            </div>
          </DetailSection>
          <DetailSection title="Suggested changes" eyebrow="Recommended action">
            {data.suggestedChanges.length ? <ol className="space-y-3">
              {data.suggestedChanges.map((change, index) => (
                <li key={change} className="flex gap-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-100 font-mono text-[10px] dark:bg-line">{index + 1}</span>{change}
                </li>
              ))}
            </ol> : <p className="text-sm text-stone-500">No suggested changes were saved for this review.</p>}
          </DetailSection>
          {data.readableReport && (
            <DetailSection title="Full report" eyebrow="Backend report">
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-950 p-4 font-mono text-xs leading-6 text-stone-100">{data.readableReport}</pre>
            </DetailSection>
          )}
        </div>
        <div className="space-y-6">
          <DetailSection title="Affected systems" eyebrow="Blast radius">
            <div className="flex flex-wrap gap-2">{data.affectedSystems.map(system => <span key={system} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs dark:bg-line">{system}</span>)}</div>
          </DetailSection>
          <DetailSection title="Critical files" eyebrow="Review priority">
            <div className="space-y-2">{data.criticalFiles.map(file => {
              const item = typeof file === 'string' ? { file } : file;
              return <div key={item.file} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3 dark:bg-ink"><span className="truncate font-mono text-[11px]">{item.file}</span><span className="font-mono text-xs text-stone-500">{item.score ?? '—'}</span></div>;
            })}</div>
          </DetailSection>
          <DetailSection title="Smart review" eyebrow="Allocation">
            <div className="grid grid-cols-2 gap-3">
              <SmallStat label="PR size" value={data.smartReview?.prSize || 'N/A'} />
              <SmallStat label="Mode" value={data.smartReview?.reviewMode || data.reviewMode} />
              <SmallStat label="Files changed" value={data.changedFiles.length} />
              <SmallStat label="Architecture" value={data.architectureImpact} />
            </div>
          </DetailSection>
        </div>
      </section>
    </>
  );
}

function DetailSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="panel p-5 md:p-6"><p className="eyebrow">{eyebrow}</p><h2 className="mb-5 mt-2 font-display text-xl font-semibold">{title}</h2>{children}</section>;
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-stone-50 p-3 dark:bg-ink"><p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p><p className="mt-2 text-sm font-medium">{value}</p></div>;
}
