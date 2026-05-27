import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate, formatCurrency } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import { Plus, Mail, ArrowRight, Filter } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { SourcePill } from '@/components/ui/SourcePill';
import { UrgentBanner } from '@/components/ui/UrgentBanner';
import { KPI } from '@/components/ui/KPI';

export const revalidate = 0;

const TERMINAL: ReadonlyArray<Bid['status']> = ['Won', 'Lost', 'Declined', 'Expired'];

interface ActivityRow {
  id: string;
  type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  bid_id: string;
  bids: { project_name: string } | null;
}

async function getData() {
  const supabase = createClient();
  const [{ data: bidsData }, { data: activityData }] = await Promise.all([
    supabase.from('bids').select('*').order('bid_due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('bid_activity')
      .select('id, type, content, metadata, created_at, bid_id, bids(project_name)')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);
  return {
    bids: (bidsData ?? []) as Bid[],
    activities: (activityData ?? []) as unknown as ActivityRow[],
  };
}

export default async function DashboardPage() {
  const { bids, activities } = await getData();

  const active    = bids.filter(b => !TERMINAL.includes(b.status));
  const urgent    = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 3; });
  const thisWeek  = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 7; });
  const submitted = bids.filter(b => b.status === 'Submitted');
  const won       = bids.filter(b => b.status === 'Won');
  const lost      = bids.filter(b => b.status === 'Lost');
  const winRate   = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : 0;

  const inFlight = active.reduce((sum, b) => sum + (b.our_bid_amount ?? 0), 0);

  const upcoming = active
    .filter(b => b.bid_due_date)
    .sort((a, b) => new Date(a.bid_due_date!).getTime() - new Date(b.bid_due_date!).getTime())
    .slice(0, 8);

  const statusCounts = bids.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusOrder: Bid['status'][] = ['New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired'];

  const pipelineData = buildPipelineData(bids);

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Page header */}
      <div className="mb-[22px] flex items-end justify-between gap-6">
        <div>
          <h1 className="m-0 text-[28px] font-medium leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
            Dashboard
          </h1>
          <div className="mt-1.5 flex items-center flex-wrap gap-0 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            <DotSep />
            <span className="mono">{active.length} active bids</span>
            {inFlight > 0 && (
              <>
                <DotSep />
                <span className="mono">{formatCurrency(inFlight)} in flight</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn"><Mail size={14} /> Sync Gmail</button>
          <Link href="/bids/new" className="btn btn-accent"><Plus size={14} /> New Bid</Link>
        </div>
      </div>

      {/* Urgent banner */}
      <UrgentBanner bids={urgent} />

      {/* KPIs */}
      <div className="mb-[18px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Total Bids"
          value={bids.length}
          sub="All-time"
          delta="+3 wk"
          spark={[18, 21, 23, 26, 28, bids.length]}
        />
        <KPI
          label="Due ≤ 3 Days"
          value={urgent.length}
          sub="Includes today"
          delta={urgent.length > 0 ? 'Action' : undefined}
          deltaTone="down"
          urgent={urgent.length > 0}
        />
        <KPI
          label="Due This Week"
          value={thisWeek.length}
          sub={`${submitted.length} already submitted`}
        />
        <KPI
          label="Win Rate (TTM)"
          value={`${Math.round(winRate * 100)}%`}
          sub={`${won.length} wins · ${lost.length} losses`}
          delta="+4 pts"
          spark={[30, 34, 38, 36, 42, Math.round(winRate * 100)]}
          sparkColor="var(--ok)"
        />
      </div>

      {/* Pipeline + Status breakdown */}
      <div className="mb-[18px] grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card lg:col-span-8">
          <div className="card-head">
            <div>
              <div className="card-title">Pipeline</div>
              <div className="label-mono mt-1">Invitations · submitted · won by month</div>
            </div>
            <div className="flex items-center gap-3.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <Legend swatch="var(--border-strong)" label="Invites" />
              <Legend swatch="var(--navy)"          label="Submitted" />
              <Legend swatch="var(--orange)"        label="Won" />
            </div>
          </div>
          <div className="px-[18px] pb-[18px] pt-4">
            <PipelineChart data={pipelineData} />
          </div>
        </div>

        <div className="card lg:col-span-4">
          <div className="card-head">
            <div className="card-title">Status Breakdown</div>
            <span className="label-mono">All bids</span>
          </div>
          <div className="p-3.5">
            {statusOrder.filter(s => statusCounts[s]).map(s => {
              const c = statusCounts[s];
              const pct = bids.length ? c / bids.length : 0;
              return (
                <div key={s} className="mb-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <StatusPill status={s} />
                    <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{c}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${pct * 100}%`,
                        background: s === 'Won' ? 'var(--ok)' : s === 'Lost' ? 'var(--text-muted)' : 'var(--orange)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming bids + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card lg:col-span-8">
          <div className="card-head">
            <div>
              <div className="card-title">Upcoming Bids</div>
              <div className="label-mono mt-1">Sorted by bid due date</div>
            </div>
            <Link href="/bids" className="btn btn-sm inline-flex items-center gap-1.5">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <UpcomingTable bids={upcoming} />
        </div>

        <div className="card lg:col-span-4">
          <div className="card-head">
            <div className="card-title">Activity</div>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Filter">
              <Filter size={13} />
            </button>
          </div>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Pipeline data helpers
   ============================================================ */

function buildPipelineData(bids: Bid[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      invites: 0,
      submitted: 0,
      won: 0,
    };
  });

  for (const bid of bids) {
    const receivedDate = bid.email_received ?? bid.created_at;
    const rd = new Date(receivedDate);
    const rk = `${rd.getFullYear()}-${rd.getMonth()}`;
    const rm = months.find(m => m.key === rk);
    if (rm) rm.invites++;

    if (['Submitted', 'Won', 'Lost'].includes(bid.status)) {
      const ud = new Date(bid.updated_at);
      const uk = `${ud.getFullYear()}-${ud.getMonth()}`;
      const um = months.find(m => m.key === uk);
      if (um) {
        um.submitted++;
        if (bid.status === 'Won') um.won++;
      }
    }
  }

  return months;
}

/* ============================================================
   Pipeline SVG bar chart
   ============================================================ */

function PipelineChart({ data }: { data: { label: string; invites: number; submitted: number; won: number }[] }) {
  const W = 540, H = 168;
  const padL = 28, padR = 8, padT = 8, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(1, ...data.flatMap(d => [d.invites, d.submitted, d.won]));
  const yMax = Math.ceil(maxVal / 5) * 5 || 5;

  const groupW = chartW / data.length;
  const barW = Math.max(8, Math.floor((groupW - 16) / 3));
  const barGap = 2;
  const groupBarW = barW * 3 + barGap * 2;
  const groupOffX = (groupW - groupBarW) / 2;

  const yPos = (v: number) => padT + chartH - (v / yMax) * chartH;
  const bH   = (v: number) => (v / yMax) * chartH;

  const gridVals = [0, Math.round(yMax * 0.5), yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }}>
      {/* Grid lines */}
      {gridVals.map(v => {
        const y = yPos(v);
        return (
          <g key={v}>
            <line
              x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="var(--border)" strokeWidth={v === 0 ? 1 : 0.5}
              strokeDasharray={v === 0 ? undefined : '3 3'}
            />
            {v > 0 && (
              <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--text-subtle)" fontFamily="var(--font-mono)">
                {v}
              </text>
            )}
          </g>
        );
      })}

      {/* Bars + labels */}
      {data.map((d, i) => {
        const gx = padL + i * groupW + groupOffX;
        const cx = padL + (i + 0.5) * groupW;
        return (
          <g key={d.label}>
            {d.invites > 0 && (
              <rect x={gx} y={yPos(d.invites)} width={barW} height={bH(d.invites)}
                fill="var(--border-strong)" rx="2" />
            )}
            {d.submitted > 0 && (
              <rect x={gx + barW + barGap} y={yPos(d.submitted)} width={barW} height={bH(d.submitted)}
                fill="var(--navy)" rx="2" />
            )}
            {d.won > 0 && (
              <rect x={gx + (barW + barGap) * 2} y={yPos(d.won)} width={barW} height={bH(d.won)}
                fill="var(--orange)" rx="2" />
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   Activity feed
   ============================================================ */

const TYPE_DOT: Record<string, string> = {
  status_change:    'var(--warn)',
  email_sent:       'var(--info)',
  estimate_created: 'var(--navy)',
  proposal_sent:    'var(--orange)',
  note:             'var(--text-subtle)',
  call:             'var(--text-subtle)',
  file_upload:      'var(--text-subtle)',
};

const TYPE_LABEL: Record<string, string> = {
  status_change:    'Status changed',
  email_sent:       'Email sent',
  estimate_created: 'Estimate created',
  proposal_sent:    'Proposal sent',
  note:             'Note added',
  call:             'Call logged',
  file_upload:      'File uploaded',
};

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function ActivityFeed({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-subtle)' }}>
        No recent activity.
      </div>
    );
  }
  return (
    <div className="divide-y overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: 440 }}>
      {activities.map(a => {
        const dotColor = TYPE_DOT[a.type] ?? 'var(--text-subtle)';
        const meta = a.metadata as Record<string, unknown> | null ?? {};
        const fromTo = meta.from && meta.to ? `${meta.from} → ${meta.to}` : null;
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ background: dotColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] leading-snug" style={{ color: 'var(--text-2)' }}>
                {TYPE_LABEL[a.type] ?? a.type}
                {a.bids?.project_name && (
                  <>
                    {' on '}
                    <Link
                      href={`/bids/${a.bid_id}`}
                      className="font-medium hover:text-[var(--orange)] transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      {a.bids.project_name}
                    </Link>
                  </>
                )}
              </div>
              {a.content && (
                <div className="mt-0.5 text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {a.content}
                </div>
              )}
              {fromTo && (
                <div className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                  {fromTo}
                </div>
              )}
            </div>
            <span className="mono shrink-0 text-[10.5px] pt-0.5" style={{ color: 'var(--text-subtle)' }}>
              {relativeTime(a.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Upcoming bids table
   ============================================================ */

function UpcomingTable({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-[14px]" style={{ color: 'var(--text-subtle)' }}>
        No upcoming bids. Run Gmail sync to import new invitations.
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <Th>Project</Th>
          <Th>GC</Th>
          <Th>Bid Due</Th>
          <Th>Urgency</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {bids.map(b => {
          const d = getDaysLeft(b.bid_due_date);
          return (
            <tr
              key={b.id}
              className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <Td>
                <Link href={`/bids/${b.id}`} className="block">
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{b.project_name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                    <SourcePill source={b.source} />
                    <span className="mono">{b.id}</span>
                    {(b.city || b.state) && (
                      <>
                        <DotSep />
                        <span>{[b.city, b.state].filter(Boolean).join(', ')}</span>
                      </>
                    )}
                  </div>
                </Link>
              </Td>
              <Td><span style={{ color: 'var(--text-2)' }}>{b.gc_name ?? '—'}</span></Td>
              <Td>
                <span className="mono text-[12px]">{formatDate(b.bid_due_date, 'MMM d')}</span>
                {b.bid_due_time && (
                  <div className="mono mt-0.5 text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>
                    {b.bid_due_time}
                  </div>
                )}
              </Td>
              <Td><UrgencyBadge days={d} /></Td>
              <Td><StatusPill status={b.status} /></Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ============================================================
   Tiny shared helpers
   ============================================================ */

function DotSep() {
  return (
    <span
      className="inline-block h-[3px] w-[3px] rounded-full align-middle"
      style={{ background: 'var(--text-subtle)' }}
    />
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className="border-b px-3.5 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider"
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3.5 py-3 align-middle">{children}</td>;
}
