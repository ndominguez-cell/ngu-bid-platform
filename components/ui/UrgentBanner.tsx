import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Bid } from '@/lib/types';

export function UrgentBanner({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) return null;

  return (
    <div className="relative mb-[18px] flex items-start gap-3.5 overflow-hidden rounded-md border border-[oklch(0.85_0.08_25)] bg-[var(--bad-soft)] px-5 py-4">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--bad)]" />
      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[var(--bad)]" />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--bad)]">
          {bids.length} bid{bids.length > 1 ? 's' : ''} due within 3 days
        </div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-[oklch(0.42_0.13_25)] dark:text-[oklch(0.78_0.14_25)]">
          {bids.map((b, i) => (
            <span key={b.id}>
              <Link
                href={`/bids/${b.id}`}
                className="font-medium underline decoration-[oklch(0.75_0.10_25)] underline-offset-[3px] hover:decoration-current"
              >
                {b.project_name}
              </Link>
              <span className="ml-1.5 font-mono opacity-80">
                ({formatDate(b.bid_due_date, 'MMM d')})
              </span>
              {i < bids.length - 1 && (
                <span className="mx-2 inline-block w-[3px] h-[3px] rounded-full bg-current align-middle opacity-50" />
              )}
            </span>
          ))}
        </div>
      </div>
      <Link
        href="/bids"
        className="btn btn-sm shrink-0 inline-flex items-center gap-1.5"
      >
        View all <ArrowRight size={13} />
      </Link>
    </div>
  );
}
