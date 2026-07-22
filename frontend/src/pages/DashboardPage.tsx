import { Activity, Boxes, GitPullRequest, ShieldAlert, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RiskTrendChart } from '../components/charts/AnalyticsCharts';
import { MetricCard } from '../components/common/MetricCard';
import { PageHeader } from '../components/common/PageHeader';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { ReviewTable } from '../components/reviews/ReviewTable';
import { useAnalytics } from '../hooks/useDashboardData';

export function DashboardPage() {
  const analytics = useAnalytics();

  if (analytics.isLoading) return <LoadingPanel rows={7} />;
  if (analytics.isError) return <ErrorState message={analytics.error.message} retry={() => analytics.refetch()} />;

  const data = analytics.data!;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Engineering risk, in focus."
        description="A live view of review volume, architectural exposure, and the pull requests that need attention."
        action={<Link to="/reviews" className="button-primary">Explore reviews</Link>}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Repositories" value={data.totals.repositories} helper="Connected workspaces" icon={Boxes} />
        <MetricCard label="PR reviews" value={data.totals.reviews} helper="Historical analyses" icon={GitPullRequest} />
        <MetricCard label="Critical PRs" value={data.totals.criticalReviews} helper="Immediate attention" icon={ShieldAlert} accent />
        <MetricCard label="Average risk" value={data.totals.averageRisk.toFixed(1)} helper="Across all reviews" icon={Activity} />
        <MetricCard label="Confidence" value={`${data.totals.averageConfidence}%`} helper="Average evidence quality" icon={Target} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.55fr]">
        <article className="panel p-5 md:p-6">
          <div className="mb-6">
            <p className="eyebrow">Risk trajectory</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Review risk over time</h2>
          </div>
          <RiskTrendChart data={data.riskTrend} />
        </article>
        <article className="panel p-6">
          <p className="eyebrow">Signal brief</p>
          <h2 className="mt-2 font-display text-xl font-semibold">What needs attention</h2>
          <div className="mt-8 space-y-6">
            <Signal label="Critical review ratio" value={`${Math.round((data.totals.criticalReviews / Math.max(1, data.totals.reviews)) * 100)}%`} />
            <Signal label="Average risk posture" value={`${data.totals.averageRisk.toFixed(1)} / 10`} />
            <Signal label="Evidence confidence" value={`${data.totals.averageConfidence}%`} />
          </div>
        </article>
      </section>

      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="eyebrow">Recent intelligence</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Latest reviews</h2>
          </div>
          <Link to="/timeline" className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-white">View timeline</Link>
        </div>
        <ReviewTable reviews={data.recentReviews} />
      </section>
    </>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-5 last:border-0 last:pb-0">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
