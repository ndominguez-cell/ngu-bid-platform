import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate } from '@/lib/utils';
import { safeHttpUrl } from '@/lib/validation';
import type { Bid, BidStatus } from '@/lib/types';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Mail, MoreHorizontal, Plus } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { SourcePill } from '@/components/ui/SourcePill';
import GmailImportButton from './GmailImportButton';

export const revalidate = 0;

// Terminal statuses are never overridden by date — once a bid is decided,
// it stays decided even if the due date has since passed.
const TERMINAL_STATUSES: BidStatus[] = ['Won', 'Lost', 'Declined'];

// "Open" = still available to act on: not expired, not yet decided.
const OPEN_STATUSES: BidStatus[] = ['New', 'Reviewing', 'Active', 'Submitted'];

const SORT_KEYS = ['bid_due_date', 'days_left', 'project_name', 'location', 'gc_name', 'our_bid_amount', 'status'] as const;
type SortKey = typeof SORT_KEYS[number];

async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data } = await supabase.from('bids').select('*');
  return (data ?? []) as Bid[];
}

// A bid is treated as Expired once its due date has passed, unless it's
// already in a terminal state (Won/Lost/Declined). This is computed on
// read rather than stored, so it always reflects "today" without needing
// a cron job to flip the stored status.
function effectiveStatus(b: Bid, daysLeft: number | null): BidStatus {
  if (TERMINAL_STATUSES.includes(b.status)) return b.status;
  if (daysLeft !== null && daysLeft < 0) return 'Expired';
  return b.status;
}

interface BidsPageProps {
  searchParams: { status?: string; sort?: string; dir?: string };
}

export default async function BidsPage({ searchParams }: BidsPageProps) {
  const rawBids = await getBids();
  const activeTab = searchParams?.status ?? 'open';
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(searchParams?.sort ?? '')
    ? (searchParams!.sort as SortKey)
    : 'bid_due_date';
  const sortDir: 'asc' | 'desc' = searchParams?.dir === 'desc' ? 'desc' : 'asc';

  const enriched = rawBids.map(b => {
    const daysLeft = getDaysLeft(b.bid_due_date);
    return { bid: b, daysLeft, status: effectiveStatus(b, daysLeft) };
  });

  const STATUS_TABS: Array<{ id: string; label: string }> = [
    { id: 'open',      label: 'Open' },
    { id: 'all',       label: 'All' },
    { id: 'New',       label: 'New' },
    { id: 'Reviewing', label: 'Reviewing' },
    { id: 'Active',    label: 'Active' },
    { id: 'Submitted', label: 'Submitted' },
    { id: 'Expired',   label: 'Expired' },
    { id: 'Won',       label: 'Won' },
    { id: 'Lost',      label: 'Lost' },
    { id: 'Declined',  label: 'Declined' },
  ];

  const counts = enriched.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  const openCount = enriched.filter(e => OPEN_STATUSES.includes(e.status)).length;

  const filtered =
    activeTab === 'all' ? enriched :
    activeTab === 'open' ? enriched.filter(e => OPEN_STATUSES.includes(e.status)) :
    enriched.filter(e => e.status === activeTab);

  const dir = sortDir === 'asc' ? 1 : -1;
  const list = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'days_left': {
        const av = a.daysLeft ?? Infinity, bv = b.daysLeft ?? Infinity;
        return (av - bv) * dir;
      }
      case 'our_bid_amount': {
        const av = a.bid.our_bid_amount ?? -Infinity, bv = b.bid.our_bid_amount ?? -Infinity;
        return (av - bv) * dir;
      }
      case 'project_name':
        return a.bid.project_name.localeCompare(b.bid.project_name) * dir;
      case 'location': {
        const av = [a.bid.city, a.bid.state].filter(Boolean).join(', ');
        const bv = [b.bid.city, b.bid.state].filter(Boolean).join(', ');
        return av.localeCompare(bv) * dir;
      }
      case 'gc_name':
        return (a.bid.gc_name ?? '').localeCompare(b.bid.gc_name ?? '') * dir;
      case 'status':
        return a.status.localeCompare(b.status) * dir;
      case 'bid_due_date':
      default: {
        const av = a.bid.bid_due_date ?? '9999-99-99', bv = b.bid.bid_due_date ?? '9999-99-99';
        return av.localeCompare(bv) * dir;
      }
    }
  });

  function tabHref(tabId: string) {
    const params = new URLSearchParams();
    if (tabId !== 'open') params.set('status', tabId);
    if (sortKey !== 'bid_due_date') params.set('sort', sortKey);
    if (sortDir !== 'asc') params.set('dir', sortDir);
    const qs = params.toString();
    return qs ? `/bids?${qs}` : '/bids';
  }

  function sortHref(key: SortKey) {
    const nextDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams();
    if (activeTab !== 'open') params.set('status', activeTab);
    params.set('sort', key);
    if (nextDir !== 'asc') params.set('dir', nextDir);
    const qs = params.toString();
    return qs ? `/bids?${qs}` : '/bids';
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-[22px] flex items-end justify-between gap-6">
        <div>
          <h1 className="m-0 text-[28px] font-medium leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
            Bids
          </h1>
          <div className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            <span className="mono">{openCount}</span> open of <span className="mono">{rawBids.length}</span> total bid requests
            <DotSep />
            Synced with Gmail, PlanHub, Procore
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GmailImportButton />
          <button className="btn"><Download size={14} /> Export</button>
          <Link href="/bids/new" className="btn btn-accent"><Plus size={14} /> New Bid</Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-5 flex gap-1 border-b -mt-1"
        style={{ borderColor: 'var(--border)' }}
      >
        {STATUS_TABS.map(t => {
          const isActive = activeTab === t.id;
          const count = t.id === 'all' ? rawBids.length : t.id === 'open' ? openCount : counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              scroll={false}
              className="-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] transition-colors"
              style={{
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                borderColor: isActive ? 'var(--orange)' : 'transparent',
                fontWeight: isActive ? 500 : 450,
              }}
            >
              {t.label}
              <span
                className="rounded px-1.5 py-px font-mono text-[11px]"
                style={{ color: 'var(--text-subtle)', background: 'var(--surface-2)' }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <SortTh sortKey="project_name" current={sortKey} dir={sortDir} href={sortHref('project_name')}>Project</SortTh>
                <SortTh sortKey="location" current={sortKey} dir={sortDir} href={sortHref('location')}>Location</SortTh>
                <SortTh sortKey="gc_name" current={sortKey} dir={sortDir} href={sortHref('gc_name')}>GC</SortTh>
                <SortTh sortKey="bid_due_date" current={sortKey} dir={sortDir} href={sortHref('bid_due_date')}>Bid Due</SortTh>
                <SortTh sortKey="days_left" current={sortKey} dir={sortDir} href={sortHref('days_left')}>Days Left</SortTh>
                <Th>Trades</Th>
                <SortTh sortKey="our_bid_amount" current={sortKey} dir={sortDir} href={sortHref('our_bid_amount')} className="text-right">Our Bid</SortTh>
                <SortTh sortKey="status" current={sortKey} dir={sortDir} href={sortHref('status')}>Status</SortTh>
                <Th className="w-10"></Th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ bid: b, daysLeft: d, status }) => {
                return (
                  <tr
                    key={b.id}
                    className="transition-colors hover:bg-[var(--surface-2)]"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <Td className="max-w-[280px]">
                      <Link href={`/bids/${b.id}`} className="block">
                        <div
                          className="truncate font-medium"
                          style={{ color: 'var(--text)' }}
                        >
                          {b.project_name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[12px]">
                          <SourcePill source={b.source} />
                          <span className="mono" style={{ color: 'var(--text-muted)' }}>
                            {b.id}
                          </span>
                        </div>
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-[13px]">
                        {[b.city, b.state].filter(Boolean).join(', ') || '—'}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-[13px]" style={{ color: 'var(--text)' }}>
                        {b.gc_name ?? '—'}
                      </div>
                      {b.gc_contact_name && (
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {b.gc_contact_name}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="mono text-[12px]">{formatDate(b.bid_due_date, 'MMM d')}</span>
                      {b.bid_due_time && (
                        <div className="mono mt-0.5 text-[10.5px]" style={{ color: 'var(--text-subtle)' }}>
                          {b.bid_due_time}
                        </div>
                      )}
                    </Td>
                    <Td><UrgencyBadge days={d} /></Td>
                    <Td className="max-w-[180px]">
                      <div
                        className="truncate text-[11.5px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {(b.trades ?? []).slice(0, 3).join(' · ') || '—'}
                        {b.trades && b.trades.length > 3 && (
                          <span style={{ color: 'var(--text-subtle)' }}> +{b.trades.length - 3}</span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right">
                      {b.our_bid_amount != null ? (
                        <span className="mono text-[12.5px]">
                          ${(b.our_bid_amount / 1_000_000).toFixed(2)}M
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </Td>
                    <Td><StatusPill status={status} /></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {safeHttpUrl(b.plans_link) && (
                          <a
                            href={safeHttpUrl(b.plans_link)!}
                            target="_blank"
                            rel="noopener noreferrer"

                            className="icon-btn"
                            title="View plans"
                            style={{ width: 28, height: 28 }}
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {b.thread_id && (
                          <a
                            href={`https://mail.google.com/mail/u/0/#inbox/${b.thread_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                         
                            className="icon-btn"
                            title="View in Gmail"
                            style={{ width: 28, height: 28 }}
                          >
                            <Mail size={13} />
                          </a>
                        )}
                        <button
                         
                          className="icon-btn"
                          aria-label="More actions"
                          style={{ width: 28, height: 28 }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {list.length === 0 && (
          <div className="px-6 py-14 text-center" style={{ color: 'var(--text-subtle)' }}>
            <p className="text-[14px]">No bids in this view.</p>
            <p className="mt-1 text-[12px]">Run Gmail sync to import bid invitations.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* helpers */
function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b px-3.5 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider ${className}`}
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      {children}
    </th>
  );
}
function SortTh({
  children, sortKey, current, dir, href, className = '',
}: {
  children?: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  href: string;
  className?: string;
}) {
  const isActive = sortKey === current;
  const Icon = isActive ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      className={`border-b px-3.5 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider ${className}`}
      style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <Link
        href={href}
        scroll={false}
        className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
        style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)' }}
      >
        {children}
        <Icon size={11} />
      </Link>
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3.5 py-3.5 align-middle ${className}`}>{children}</td>;
}
function DotSep() {
  return (
    <span
      className="mx-2 inline-block h-[3px] w-[3px] rounded-full align-middle"
      style={{ background: 'var(--text-subtle)' }}
    />
  );
}
