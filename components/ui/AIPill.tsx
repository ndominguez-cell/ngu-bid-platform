import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AIPill({ children = 'AI', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11px] font-semibold',
        'bg-gradient-to-br from-[oklch(0.95_0.04_290)] to-[oklch(0.95_0.04_50)]',
        'border border-[oklch(0.88_0.05_290)]',
        'text-[oklch(0.40_0.12_290)]',
        'dark:from-[oklch(0.28_0.06_290)] dark:to-[oklch(0.28_0.06_50)]',
        'dark:border-[oklch(0.40_0.08_290)] dark:text-[oklch(0.85_0.08_290)]',
        className,
      )}
    >
      <Sparkles size={11} />
      {children}
    </span>
  );
}
