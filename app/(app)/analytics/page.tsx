import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { formatCurrency, formatDate, getDaysLeft } from '@/lib/utils';
import type { Bid, Proposal } from '@/lib/types';
import { AlertTriangle, Award, BarChart2, Clock3, Send, Target, TrendingUp } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';

export const revalidate = 0;

type ProposalSummary = Pick<Proposal, 'id' | 'bid_id' | 'status' | 'sent_at' | 'created_at'>;

type WinGroup = {
  label: string;
  won: number;
  lost: number;
  decided: number;
  winRate: number;
  amount: number;
};

type PipelineRow = {
  bid: Bid;
  daysLeft: number | null;
  proposalLabel: string;
  needsProposal: boolean;
};

type CycleRow = {
  bid: Bid;
  sentAt: string;
  hours: number;
};

type GapRow = {
  bid: Bid;
  gap: number;
  gapPct: number;
};

const TERMINAL: ReadonlyArray<Bid['status']> = ['Won', 'Lost', 'Declined', 'Expired'];

async function getAnalyticsData() {
  const auth = await requireUser();
  if (auth.error || !auth.workspaceId) {
    return { workspaceReady: false, bids: [] as Bid[], proposals: [] as ProposalSummary[] };
  }

  const supabase = createServiceClient();
  const [{ data: bidsData, error: bidsError }, { data: proposalsData, error: proposalsError }] = await Promise.all([
    supabase
      .from('bids')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: true }),
    supabase
      .from('proposals')
      .select('id, bid_id, status, sent_at, created_at')
      .eq('workspace_id', auth.workspaceId),
  ]);

  if (bidsError) throw new Error(bidsError.message);
  if (proposalsError) throw new Error(proposalsError.message);

  return {
    workspaceReady: true,
    bids: (bidsData ?? []) as Bid[],
    proposals: (proposalsData ?? []) as ProposalSummary[],
  };
}

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCycle(hours: number | null) {
  if (hours == null) return '-';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function inviteDate(bid: Bid) {
  return bid.email_received ?? bid.created_at;
}

function proposalsByBid(proposals: ProposalSummary[]) {
  const map = new Map<string, ProposalSummary[]>();
  for (const proposal of proposals) {
    const existing = map.get(proposal.bid_id) ?? [];
    existing.push(proposal);
    map.set(proposal.bid_id, existing);
  }
  return map;
}

function earliestSentAt(proposals: ProposalSummary[]) {
  const sent = proposals
    .map(proposal => proposal.sent_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return sent[0] ?? null;
}

function proposalLabel(bid: Bid, proposals: ProposalSummary[]) {
  if (bid.status === 'Submitted') return 'Submitted';
  if (earliestSentAt(proposals)) return 'Sent';
  if (proposals.length > 0) return 'Drafted';
  return 'Needs proposal';
}

function sizeBand(amount: number | null) {
  if (amount == null || amount <= 0) return 'Unknown size';
  if (amount < 100000) return '< $100k';
  if (amount < 250000) return '$100k-$250k';
  if (amount < 500000) return '$250k-$500k';
  if (amount < 1000000) return '$500k-$1M';
  return '$1M+';
}

function addWinGroup(groups: Map<string, WinGroup>, label: string, bid: Bid) {
  if (bid.status !== 'Won' && bid.status !== 'Lost') return;
  const current = groups.get(label) ?? { label, won: 0, lost: 0, decided: 0, winRate: 0, amount: 0 };
  current.decided += 1;
  current.amount += bid.our_bid_amount ?? 0;
  if (bid.status === 'Won') current.won += 1;
  if (bid.status === 'Lost') current.lost += 1;
  current.winRate = pct(current.won, current.decided);
  groups.set(label, current);
}

function sortWinGroups(groups: Map<string, WinGroup>, limit = 8) {
  return Array.from(groups.values())
    .sort((a, b) => b.decided - a.decided || b.winRate - a.winRate || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function buildGroups(bids: Bid[]) {
  const byGc = new Map<string, WinGroup>();
  const byTrade = new Map<string, WinGroup>();
  const bySize = new Map<string, WinGroup>();

  for (const bid of bids) {
    addWinGroup(byGc, bid.gc_name?.trim() || 'Unknown GC', bid);
    addWinGroup(bySize, sizeBand(bid.our_bid_amount), bid);

    const trades = bid.trades?.length ? bid.trades : ['Unspecified trade'];
    for (const trade of trades) {
      addWinGroup(byTrade, trade, bid);
    }
  }

  return {
    byGc: sortWinGroups(byGc),
    byTrade: sortWinGroups(byTrade),
    bySize: sortWinGroups(bySize, 6),
  };
}

function buildPipelineRows(bids: Bid[], proposals: Map<string, ProposalSummary[]>): PipelineRow[] {
  return bids
    .filter(bid => !TERMINAL.includes(bid.status))
    .map(bid => {
      const bidProposals = proposals.get(bid.id) ?? [];
      const label = proposalLabel(bid, bidProposals);
      return {
        bid,
        daysLeft: getDaysLeft(bid.bid_due_date),
        proposalLabel: label,
        needsProposal: label === 'Needs proposal',
      };
    })
    .sort((a, b) => {
      const aDate = a.bid.bid_due_date ? new Date(a.bid.bid_due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.bid.bid_due_date ? new Date(b.bid.bid_due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate || a.bid.project_name.localeCompare(b.bid.project_name);
    })
    .slice(0, 12);
}

function buildCycleRows(bids: Bid[], proposals: Map<string, ProposalSummary[]>): CycleRow[] {
  return bids
    .map(bid => {
      const sentAt = earliestSentAt(proposals.get(bid.id) ?? []);
      if (!sentAt) return null;

      const start = new Date(inviteDate(bid)).getTime();
      const end = new Date(sentAt).getTime();
      const hours = (end - start) / 36e5;
      if (!Number.isFinite(hours) || hours < 0) return null;

      return { bid, sentAt, hours };
    })
    .filter((row): row is CycleRow => row !== null)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

function buildGapRows(bids: Bid[]): GapRow[] {
  return bids
    .filter((bid): bid is Bid & { our_bid_amount: number; awarded_amount: number } =>
      bid.status === 'Lost' &&
      typeof bid.our_bid_amount === 'number' &&
      typeof bid.awarded_amount === 'number' &&
      bid.awarded_amount > 0
    )
    .map(bid => {
      const gap = bid.our_bid_amount - bid.awarded_amount;
      return { bid, gap, gapPct: gap / bid.awarded_amount };
    })
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));
}

function buildMonthlyTrend(bids: Bid[]) {
  const now = new Date();
  const months: { label: string; bids: number; won: number; decided: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthBids = bids.filter(bid => {
      const sourceDate = bid.decided_at ?? bid.bid_due_date ?? bid.created_at;
      const bidDate = new Date(sourceDate);
      return bidDate.getFullYear() === date.getFullYear() && bidDate.getMonth() === date.getMonth();
    });
    const won = monthBids.filter(bid => bid.status === 'Won').length;
    const decided = monthBids.filter(bid => bid.status === 'Won' || bid.status === 'Lost').length;
    months.push({
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      bids: monthBids.length,
      won,
      decided,
    });
  }
  return months;
}

export default async function AnalyticsPage() {
  const { workspaceReady, bids, proposals } = await getAnalyticsData();

  if (!workspaceReady) {
    return (
      <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
        <div className="card p-6">
          <div className="card-title">Workspace required</div>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            This account does not have an NGU workspace membership yet.
          </p>
        </div>
      </div>
    );
  }

  const proposalMap = proposalsByBid(proposals);
  const won = bids.filter(bid => bid.status === 'Won');
  const lost = bids.filter(bid => bid.status === 'Lost');
  const decided = [...won, ...lost];
  const open = bids.filter(bid => !TERMINAL.includes(bid.status));
  const submitted = bids.filter(bid => bid.status === 'Submitted');
  const winRate = pct(won.length, decided.length);
  const wonValue = won.reduce((sum, bid) => sum + (bid.awarded_amount ?? bid.our_bid_amount ?? 0), 0);
  const openPipelineValue = open.reduce((sum, bid) => sum + (bid.our_bid_amount ?? 0), 0);
  const groups = buildGroups(bids);
  const pipelineRows = buildPipelineRows(bids, proposalMap);
  const cycleRows = buildCycleRows(bids, proposalMap);
  const avgCycle = average(cycleRows.map(row => row.hours));
  const gapRows = buildGapRows(bids);
  const avgGapPct = average(gapRows.map(row => row.gapPct));
  const avgGapAmount = average(gapRows.map(row => row.gap));
  const monthlyTrend = buildMonthlyTrend(bids);
  const maxMonthBids = Math.max(...monthlyTrend.map(month => month.bids), 1);
  const needsProposalCount = pipelineRows.filter(row => row.needsProposal).length;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>Analytics</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            Won-bids control loop across <span className="mono">{bids.length}</span> bids
          </p>
        </div>
        <Link href="/bids" className="btn btn-sm">
          <Send size={13} /> Work pipeline
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${won.length} won / ${lost.length} lost`}
          icon={<Target size={16} />}
          accentColor={winRate >= 50 ? 'var(--ok)' : winRate > 0 ? 'var(--orange)' : 'var(--bad)'}
        />
        <KpiCard
          label="Won Value"
          value={formatCurrency(wonValue)}
          sub={`${won.length} captured bids`}
          icon={<Award size={16} />}
          accentColor="var(--ok)"
        />
        <KpiCard
          label="Open Pipeline"
          value={formatCurrency(openPipelineValue)}
          sub={`${open.length} open / ${submitted.length} submitted`}
          icon={<TrendingUp size={16} />}
          accentColor="var(--orange)"
        />
        <KpiCard
          label="Invite to Sent"
          value={formatCycle(avgCycle)}
          sub={`${cycleRows.length} sent proposals measured`}
          icon={<Clock3 size={16} />}
          accentColor="var(--navy)"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-head">
            <div className="flex items-center gap-1.5 card-title">
              <BarChart2 size={14} /> Outcome Trend
            </div>
            <span className="label-mono">Last 12 months</span>
          </div>
          <div className="px-5 pb-5 pt-4">
            <MonthlyChart months={monthlyTrend} maxMonthBids={maxMonthBids} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Bid vs Winning Gap</div>
            <span className="label-mono">{gapRows.length} known losses</span>
          </div>
          <div className="p-4">
            {gapRows.length === 0 ? (
              <EmptyText>No known winning amounts recorded yet.</EmptyText>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Avg Gap" value={formatCurrency(avgGapAmount ?? 0)} tone={gapTone(avgGapAmount ?? 0)} />
                  <Metric label="Avg Gap %" value={`${Math.round((avgGapPct ?? 0) * 100)}%`} tone={gapTone(avgGapPct ?? 0)} />
                </div>
                <div className="mt-4 space-y-3">
                  {gapRows.slice(0, 4).map(row => (
                    <Link key={row.bid.id} href={`/bids/${row.bid.id}`} className="block rounded border p-3 hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>{row.bid.project_name}</div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{row.bid.gc_name ?? 'Unknown GC'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="mono text-[12px] font-medium" style={{ color: gapColor(row.gap) }}>
                            {row.gap > 0 ? '+' : ''}{formatCurrency(row.gap)}
                          </div>
                          <div className="mono mt-0.5 text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>
                            {Math.round(row.gapPct * 100)}%
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <WinRateCard title="Win Rate by GC" rows={groups.byGc} />
        <WinRateCard title="Win Rate by Trade" rows={groups.byTrade} />
        <WinRateCard title="Win Rate by Size" rows={groups.bySize} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="card xl:col-span-3">
          <div className="card-head">
            <div>
              <div className="card-title">Open Pipeline by Deadline</div>
              <div className="label-mono mt-1">{needsProposalCount} need proposal</div>
            </div>
            {needsProposalCount > 0 && (
              <span className="tag tag-warn">
                <AlertTriangle size={11} /> Proposal gap
              </span>
            )}
          </div>
          <PipelineTable rows={pipelineRows} />
        </div>

        <div className="card xl:col-span-2">
          <div className="card-head">
            <div>
              <div className="card-title">Cycle Time</div>
              <div className="label-mono mt-1">Invite to proposal sent</div>
            </div>
            <span className="mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{formatCycle(avgCycle)} avg</span>
          </div>
          <CycleTable rows={cycleRows.slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}

function gapTone(value: number): 'good' | 'bad' | 'neutral' {
  if (value < 0) return 'good';
  if (value > 0) return 'bad';
  return 'neutral';
}

function gapColor(value: number) {
  if (value < 0) return 'var(--ok)';
  if (value > 0) return 'var(--bad)';
  return 'var(--text-muted)';
}

function KpiCard({ label, value, sub, icon, accentColor }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accentColor: string;
}) {
  return (
    <div className="card p-5" style={{ borderTop: `3px solid ${accentColor}` }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <span style={{ color: 'var(--border-strong)' }}>{icon}</span>
      </div>
      <div className="text-[22px] font-bold" style={{ color: accentColor }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: 'var(--text-subtle)' }}>{sub}</div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'var(--ok)' : tone === 'bad' ? 'var(--bad)' : 'var(--text-muted)';
  return (
    <div className="rounded border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      <div className="label-mono">{label}</div>
      <div className="mono mt-1 text-[16px] font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function MonthlyChart({ months, maxMonthBids }: { months: { label: string; bids: number; won: number; decided: number }[]; maxMonthBids: number }) {
  return (
    <>
      <div className="flex h-28 items-end gap-1.5">
        {months.map(month => (
          <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-col justify-end" style={{ height: 80 }}>
              {month.bids > 0 ? (
                <div
                  className="group relative w-full rounded-t-sm"
                  style={{ height: `${Math.round((month.bids / maxMonthBids) * 80)}px`, background: 'var(--navy)' }}
                >
                  {month.decided > 0 && (
                    <div
                      className="absolute bottom-0 left-0 w-full rounded-t-sm"
                      style={{ height: `${Math.round((month.won / month.decided) * 100)}%`, background: 'var(--ok)' }}
                    />
                  )}
                  <div
                    className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: 'var(--text)', color: 'var(--bg)' }}
                  >
                    {month.bids} bids / {month.won} won
                  </div>
                </div>
              ) : (
                <div className="h-0.5 w-full" style={{ background: 'var(--border)', marginTop: 'auto' }} />
              )}
            </div>
            <span className="text-[9px] font-medium" style={{ color: 'var(--text-subtle)' }}>{month.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <Legend swatch="var(--navy)" label="All bids" />
        <Legend swatch="var(--ok)" label="Won share" />
      </div>
    </>
  );
}

function WinRateCard({ title, rows }: { title: string; rows: WinGroup[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        <span className="label-mono">won / decided</span>
      </div>
      <div className="p-4">
        {rows.length === 0 ? (
          <EmptyText>No decided outcomes yet.</EmptyText>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>{row.label}</span>
                  <span className="mono shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {row.won}W / {row.lost}L
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.winRate}%`, background: row.winRate >= 50 ? 'var(--ok)' : row.winRate > 0 ? 'var(--orange)' : 'var(--border-strong)' }}
                    />
                  </div>
                  <span className="mono w-9 text-right text-[11px]" style={{ color: row.winRate >= 50 ? 'var(--ok)' : 'var(--text-muted)' }}>
                    {row.winRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineTable({ rows }: { rows: PipelineRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel>No open bids in the pipeline.</EmptyPanel>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>GC</Th>
            <Th>Due</Th>
            <Th>Urgency</Th>
            <Th>Status</Th>
            <Th>Proposal</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.bid.id} className="hover:bg-[var(--surface-2)]" style={{ borderBottom: '1px solid var(--border)' }}>
              <Td>
                <Link href={`/bids/${row.bid.id}`} className="block">
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{row.bid.project_name}</div>
                  <div className="mono mt-0.5 text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>{row.bid.id}</div>
                </Link>
              </Td>
              <Td><span style={{ color: 'var(--text-2)' }}>{row.bid.gc_name ?? '-'}</span></Td>
              <Td>
                <span className="mono text-[12px]">{formatDate(row.bid.bid_due_date, 'MMM d')}</span>
                {row.bid.bid_due_time && (
                  <div className="mono mt-0.5 text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>{row.bid.bid_due_time}</div>
                )}
              </Td>
              <Td><UrgencyBadge days={row.daysLeft} /></Td>
              <Td><StatusPill status={row.bid.status} /></Td>
              <Td>
                <span className={`tag ${row.needsProposal ? 'tag-warn' : row.proposalLabel === 'Sent' || row.proposalLabel === 'Submitted' ? 'tag-ok' : ''}`}>
                  <span className="dot" />{row.proposalLabel}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CycleTable({ rows }: { rows: CycleRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel>No sent proposals with invite dates yet.</EmptyPanel>;
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {rows.map(row => (
        <Link key={`${row.bid.id}-${row.sentAt}`} href={`/bids/${row.bid.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--surface-2)]">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>{row.bid.project_name}</div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {formatDate(inviteDate(row.bid), 'MMM d')} to {formatDate(row.sentAt, 'MMM d')}
            </div>
          </div>
          <span className="mono shrink-0 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{formatCycle(row.hours)}</span>
        </Link>
      ))}
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center text-[13px]" style={{ color: 'var(--text-subtle)' }}>
      {children}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-[13px]" style={{ color: 'var(--text-subtle)' }}>{children}</p>;
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
      className="border-b px-3.5 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider"
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3.5 py-3 align-middle">{children}</td>;
}
