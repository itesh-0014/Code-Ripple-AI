import { Flame, Layers3, Repeat2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { useArchitecture } from '../hooks/useDashboardData';

export function ArchitecturePage() {
  const architecture = useArchitecture();
  if (architecture.isLoading) return <LoadingPanel rows={8} />;
  if (architecture.isError) return <ErrorState message={architecture.error.message} retry={() => architecture.refetch()} />;
  const data = architecture.data!;

  return (
    <>
      <PageHeader eyebrow="Architecture insights" title="Where change concentrates." description="Surface systems and modules carrying the most architectural risk and modification pressure." />
      <section className="grid gap-6 xl:grid-cols-3">
        <RankingPanel icon={Layers3} title="Impacted systems" subtitle="Most frequently affected">
          {data.impactedSystems.map((item, index) => <Rank key={item.name} index={index} label={item.name} value={`${item.value} reviews`} />)}
        </RankingPanel>
        <RankingPanel icon={Flame} title="Risky modules" subtitle="Highest average risk">
          {data.riskyModules.map((item, index) => <Rank key={item.name} index={index} label={item.name} value={`${item.averageRisk.toFixed(1)} risk`} />)}
        </RankingPanel>
        <RankingPanel icon={Repeat2} title="Frequently modified" subtitle="Recurring review surface">
          {data.frequentlyModified.map((item, index) => <Rank key={item.name} index={index} label={item.name} value={`${item.reviews} reviews`} />)}
        </RankingPanel>
      </section>
      <section className="panel mt-6 p-6">
        <p className="eyebrow">Architecture hotspots</p>
        <h2 className="mt-2 font-display text-xl font-semibold">Files with repeated pressure</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.hotspots.map((hotspot, index) => (
            <article key={`${hotspot.file}-${index}`} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3"><p className="truncate font-mono text-xs">{hotspot.file}</p><span className="font-display text-lg font-semibold">{hotspot.score}</span></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-ink"><div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, hotspot.score)}%` }} /></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function RankingPanel({ icon: Icon, title, subtitle, children }: { icon: typeof Layers3; title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="panel p-5"><span className="grid size-10 place-items-center rounded-xl bg-stone-100 dark:bg-line"><Icon size={18} /></span><h2 className="mt-4 font-display text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-stone-500">{subtitle}</p><div className="mt-5 space-y-1">{children}</div></article>;
}

function Rank({ index, label, value }: { index: number; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-stone-50 dark:hover:bg-ink"><span className="font-mono text-[10px] text-stone-400">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1 truncate text-sm">{label}</span><span className="text-[11px] text-stone-500">{value}</span></div>;
}
