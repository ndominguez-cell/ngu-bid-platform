import { cn } from '@/lib/utils';
import type { BidStatus } from '@/lib/types';

const STYLES: Record<BidStatus, string> = {
  New:       'bg-[var(--info-soft)] text-[var(--info)]',
  Reviewing: 'bg-[oklch(0.95_0.04_200)] text-[oklch(0.45_0.11_200)] dark:bg-[oklch(0.30_0.06_200)] dark:text-[oklch(0.78_0.13_200)]',
  Active:    'bg-[var(--ok-soft)] text-[var(--ok)]',
  Submitted: 'bg-[var(--warn-soft)] text-[oklch(0.45_0.13_70)] dark:text-[var(--warn)]',
  Won:       'bg-[var(--ok)] text-white dark:text-[var(--bg)]',
  Lost:      'bg-[oklch(0.55_0.01_250)] text-white dark:bg-[oklch(0.45_0.015_245)]',
  Declined:  'bg-[var(--surface-3)] text-[var(--text-muted)]',
  Expired:   'bg-[var(--surface-3)] text-[var(--text-subtle)]',
};

export function StatusPill({ status, className }: { status: BidStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11px] font-semibold tracking-tight whitespace-nowrap',
        STYLES[status],
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}
