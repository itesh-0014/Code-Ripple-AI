import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Review } from '../../types/dashboard';
import { SeverityBadge } from '../common/SeverityBadge';

export function ReviewTable({ reviews }: { reviews: Review[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wider text-stone-500">
            <th className="px-5 py-3 font-medium">Pull request</th>
            <th className="px-3 py-3 font-medium">Repository</th>
            <th className="px-3 py-3 font-medium">Risk</th>
            <th className="px-3 py-3 font-medium">Confidence</th>
            <th className="px-3 py-3 font-medium">Reviewed</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {reviews.map(review => (
            <tr key={review.id} className="border-b last:border-0 hover:bg-stone-50/70 dark:hover:bg-ink/50">
              <td className="px-5 py-4">
                <p className="max-w-xs truncate text-sm font-medium">{review.title}</p>
                <p className="mt-1 font-mono text-[11px] text-stone-500">PR #{review.prNumber}</p>
              </td>
              <td className="px-3 py-4 font-mono text-xs text-stone-500">{review.repository}</td>
              <td className="px-3 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold">{review.riskScore.toFixed(1)}</span>
                  <SeverityBadge severity={review.severity} />
                </div>
              </td>
              <td className="px-3 py-4 text-sm">{review.confidence}%</td>
              <td className="px-3 py-4 text-xs text-stone-500">
                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              </td>
              <td className="px-5 py-4 text-right">
                <Link to={`/reviews/${review.id}`} className="inline-flex rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-line">
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
