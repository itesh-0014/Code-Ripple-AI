import { ConfidenceChart, DistributionChart, RiskTrendChart, VolumeChart } from '../components/charts/AnalyticsCharts';
import { PageHeader } from '../components/common/PageHeader';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { useAnalytics } from '../hooks/useDashboardData';

export function AnalyticsPage() {
  const analytics = useAnalytics();
  if (analytics.isLoading) return <LoadingPanel rows={8} />;
  if (analytics.isError) return <ErrorState message={analytics.error.message} retry={() => analytics.refetch()} />;
  const data = analytics.data!;

  return (
    <>
      <PageHeader eyebrow="Risk analytics" title="Patterns behind the pull requests." description="Track risk, confidence, and review volume to understand how your engineering posture changes over time." />
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartPanel eyebrow="Risk trend" title="Average review risk"><RiskTrendChart data={data.riskTrend} /></ChartPanel>
        <ChartPanel eyebrow="Distribution" title="Reviews by severity"><DistributionChart data={data.riskDistribution} /></ChartPanel>
        <ChartPanel eyebrow="Confidence trend" title="Evidence quality"><ConfidenceChart data={data.confidenceTrend} /></ChartPanel>
        <ChartPanel eyebrow="Review volume" title="Reviews completed"><VolumeChart data={data.reviewVolume} /></ChartPanel>
      </section>
    </>
  );
}

function ChartPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <article className="panel p-5 md:p-6"><p className="eyebrow">{eyebrow}</p><h2 className="mb-6 mt-2 font-display text-xl font-semibold">{title}</h2>{children}</article>;
}
