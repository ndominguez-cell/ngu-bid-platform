import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  PlanHub: 'bg-[oklch(0.95_0.045_300)] text-[oklch(0.45_0.13_300)] dark:bg-[oklch(0.30_0.07_300)] dark:text-[oklch(0.80_0.13_300)]',
  Procore: 'bg-[oklch(0.95_0.05_50)] text-[oklch(0.45_0.14_50)] dark:bg-[oklch(0.30_0.07_50)] dark:text-[oklch(0.80_0.14_50)]',
  Novel:   'bg-[oklch(0.95_0.04_240)] text-[oklch(0.45_0.13_240)] dark:bg-[oklch(0.30_0.06_240)] dark:text-[oklch(0.80_0.12_240)]',
  Gmail:   'bg-[oklch(0.95_0.04_145)] text-[oklch(0.45_0.12_145)] dark:bg-[oklch(0.30_0.06_145)] dark:text-[oklch(0.80_0.12_145)]',
  Manual:  'bg-[var(--surface-3)] text-[var(--text-muted)]',
};

export function SourcePill({ source, className }: { source: string | null; className?: string }) {
  if (!source) return null;
  const cls = STYLES[source] ?? STYLES.Manual;
  return (
    <span
      className={cn(
        'inline-flex items-center h-[18px] px-1.5 rounded-[3px] font-mono text-[9.5px] font-bold tracking-widest uppercase',
        cls,
        className,
      )}
    >
      {source}
    </span>
  );
}
