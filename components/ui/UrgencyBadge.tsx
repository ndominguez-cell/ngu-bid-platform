import { cn } from '@/lib/utils';

type Urgency = 'today' | 'critical' | 'warning' | 'week' | 'ok' | 'expired';

function classify(days: number | null): Urgency {
  if (days == null) return 'expired';
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days <= 1) return 'critical';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'week';
  return 'ok';
}

function label(days: number | null): string {
  if (days == null) return 'No Date';
  if (days < 0) return 'Expired';
  if (days === 0) return 'TODAY';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

const STYLES: Record<Urgency, string> = {
  today:    'bg-[var(--bad)] text-white animate-pulse-soft',
  critical: 'bg-[var(--bad)] text-white',
  warning:  'bg-[oklch(0.68_0.18_50)] text-white',
  week:     'bg-[oklch(0.85_0.15_95)] text-[oklch(0.30_0.08_95)]',
  ok:       'bg-[var(--ok-soft)] text-[var(--ok)]',
  expired:  'bg-[var(--surface-3)] text-[var(--text-subtle)]',
};

export function UrgencyBadge({ days, className }: { days: number | null; className?: string }) {
  const u = classify(days);
  return (
    <span
      className={cn(
        'inline-flex items-center h-[22px] px-2.5 rounded-full font-mono text-[11px] font-bold tracking-wider uppercase whitespace-nowrap',
        STYLES[u],
        className,
      )}
    >
      {label(days)}
    </span>
  );
}
