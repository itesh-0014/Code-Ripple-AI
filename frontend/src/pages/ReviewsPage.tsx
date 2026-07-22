import { Search } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState, ErrorState, LoadingPanel } from '../components/common/States';
import { ReviewTable } from '../components/reviews/ReviewTable';
import { useRepositories, useReviews } from '../hooks/useDashboardData';

export function ReviewsPage() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [repository, setRepository] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const reviews = useReviews({ search, severity, repository, from, to });
  const repositories = useRepositories();

  return (
    <>
      <PageHeader eyebrow="Review history" title="Every review. Fully traceable." description="Search and filter historical pull request intelligence by severity, repository, and date." />
      <section className="panel mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-stone-400" size={15} />
          <input className="input w-full pl-9" placeholder="Search PR or repository" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <select className="input" value={severity} onChange={event => setSeverity(event.target.value)}>
          <option value="">All severities</option>
          <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
        </select>
        <select className="input" value={repository} onChange={event => setRepository(event.target.value)}>
          <option value="">All repositories</option>
          {repositories.data?.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={event => setFrom(event.target.value)} aria-label="From date" />
        <input className="input" type="date" value={to} onChange={event => setTo(event.target.value)} aria-label="To date" />
      </section>
      {reviews.isLoading ? <LoadingPanel rows={7} /> : reviews.isError ? (
        <ErrorState message={reviews.error.message} retry={() => reviews.refetch()} />
      ) : reviews.data?.items.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b px-5 py-4 text-xs text-stone-500">{reviews.data.pagination.total} reviews found</div>
          <ReviewTable reviews={reviews.data.items} />
        </section>
      ) : (
        <EmptyState title="No matching reviews" description="Adjust the filters or wait for the next pull request analysis." />
      )}
    </>
  );
}
