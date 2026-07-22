import { DependencyGraph } from '../components/graph/DependencyGraph';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState, ErrorState, LoadingPanel } from '../components/common/States';
import { useDependencyGraph, useRepositories } from '../hooks/useDashboardData';
import { useState } from 'react';

export function DependencyGraphPage() {
  const [repository, setRepository] = useState('');
  const repositories = useRepositories();
  const graph = useDependencyGraph(repository || undefined);

  return (
    <>
      <PageHeader
        eyebrow="Dependency intelligence"
        title="Follow the impact path."
        description="Explore module relationships, inspect downstream dependents, and highlight files carrying review risk."
        action={
          <select className="input min-w-56" value={repository} onChange={event => setRepository(event.target.value)}>
            <option value="">Latest reviewed repository</option>
            {repositories.data?.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        }
      />
      {graph.isLoading ? <LoadingPanel rows={8} /> : graph.isError ? (
        <ErrorState message={graph.error.message} retry={() => graph.refetch()} />
      ) : graph.data?.graph.nodes.length ? (
        <DependencyGraph data={graph.data} />
      ) : (
        <EmptyState title="No dependency graph available" description="Run a repository review to populate dependency intelligence." />
      )}
    </>
  );
}
