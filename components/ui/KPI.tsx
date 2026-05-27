import { cn } from '@/lib/utils';

interface KPIProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
  urgent?: boolean;
  spark?: number[];
  sparkColor?: string;
  className?: string;
}

export function KPI({
  label,
  value,
  sub,
  delta,
  deltaTone = 'up',
  urgent = false,
  spark,
  sparkColor = 'var(--orange)',
  className,
}: KPIProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md p-5 transition-colors',
        'bg-[var(--surface)] border',
        urgent
          ? 'border-[oklch(0.85_0.08_25)] bg-gradient-to-b from-[var(--bad-soft)] to-[var(--surface)]'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]',
        className,
      )}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          'mt-2.5 text-[32px] font-medium leading-none tracking-tight mono',
          urgent && 'text-[var(--bad)]',
        )}
        style={!urgent ? { color: 'var(--text)' } : undefined}
      >
        {value}
      </div>
      {(delta || sub) && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
          {delta && (
            <span
              className={cn(
                'font-mono text-[11px] px-1.5 py-0.5 rounded',
                deltaTone === 'down'
                  ? 'bg-[var(--bad-soft)] text-[var(--bad)]'
                  : 'bg-[var(--ok-soft)] text-[var(--ok)]',
              )}
            >
              {delta}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
      {spark && spark.length > 0 && (
        <div className="absolute right-3.5 top-3.5" style={{ color: sparkColor }}>
          <Sparkline data={spark} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, w = 70, h = 26 }: { data: number[]; w?: number; h?: number }) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / span) * h * 0.85 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
