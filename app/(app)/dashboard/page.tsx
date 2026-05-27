import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import {
  Plus, Mail, ArrowRight,
} from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { SourcePill } from '@/components/ui/SourcePill';
import { UrgentBanner } from '@/components/ui/UrgentBanner';
import { KPI } from '@/components/ui/KPI';

export const revalidate = 0;

const TERMINAL: ReadonlyArray<Bid['status']> = ['Won', 'Lost', 'Declined', 'Expired'];

async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*')
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return data as Bid[];
}

export default async function DashboardPage() {
  const bids = await getBids();

  const active   = bids.filter(b => !TERMINAL.includes(b.status));
  const urgent   = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 3; });
  const thisWeek = bids.filter(b => { const d = getDaysLeft(b.bid_due_date); return d !== null && d >= 0 && d <= 7; });
  const submitted = bids.filter(b => b.status === 'Submitted');
  const won  = bids.filter(b => b.status === 'Won');
  const lost = bids.filter(b => b.status === 'Lost');
  const winRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : 0;

  const upcoming = active
    .filter(b => b.bid_due_date)
    .sort((a, b) => new Date(a.bid_due_date!).getTime() - new Date(b.bid_due_date!).getTime())
    .slice(0, 6);

  const statusCounts = bids.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusOrder: Bid['status'][] = ['New', 'Reviewing', 'Active', 'Submitted', 'Won', 'Lost', 'Declined', 'Expired'];

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Page header */}
      <div className="mb-[22px] flex items-end justify-between gap-6">
        <div>
          <h1 className="m-0 text-[28px] font-medium leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
            Dashboard
          </h1>
          <div className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            <DotSep />
            <span className="mono">{active.length} active bids</span>
            <DotSep />
            <span className="mono">{won.length} won this year</span>
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
        <KPI label="Total Bids"     value={bids.length}     sub="All-time"               delta="+3 wk" spark={[18, 21, 23, 26, 28, bids.length]} />
        <KPI label="Due ≤ 3 Days"   value={urgent.length}   sub="Includes today"         urgent />
        <KPI label="Due This Week"  value={thisWeek.length} sub={`${submitted.length} already submitted`} />
        <KPI label="Win Rate"       value={`${Math.round(winRate * 100)}%`} sub={`${won.length} wins · ${lost.length} losses`} delta="+4 pts" spark={[30, 34, 38, 36, 42, Math.round(winRate * 100)]} sparkColor="var(--ok)" />
      </div>

      {/* Pipeline chart + status breakdown */}
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
          <div className="p-[18px]">
            <PipelineChartPlaceholder />
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
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <StatusPill status={s} />
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>{c}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-sm" style={{ background: 'var(--surface-3)' }}>
                    <div
                      className="h-full rounded-sm transition-[width] duration-500"
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

      {/* Upcoming bids */}
      <div className="card">
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
    </div>
  );
}

/* ============================================================
   Small page-local helpers
   ============================================================ */

function DotSep() {
  return (
    <span
      className="mx-2 inline-block h-[3px] w-[3px] rounded-full align-middle"
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

function UpcomingTable({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return (
      <div className="px-6 py-14 text-center text-[14px]" style={{ color: 'var(--text-subtle)' }}>
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
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
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
              <Td>{b.gc_name ?? '—'}</Td>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="border-b px-3.5 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider"
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3.5 py-3.5 align-middle">{children}</td>;
}

function PipelineChartPlaceholder() {
  return (
    <div
      className="grid h-[200px] place-items-center rounded font-mono text-[11px] uppercase tracking-wider"
      style={{
        background:
          'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)',
        color: 'var(--text-muted)',
      }}
    >
      Pipeline chart · monthly aggregates
    </div>
  );
}
