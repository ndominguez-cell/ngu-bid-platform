import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDaysLeft, formatDate } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import { Download, ExternalLink, Mail, MoreHorizontal, Plus } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { SourcePill } from '@/components/ui/SourcePill';
import GmailImportButton from './GmailImportButton';

export const revalidate = 0;

async function getBids(): Promise<Bid[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('bids')
    .select('*')
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  return (data ?? []) as Bid[];
}

interface BidsPageProps {
  searchParams: { status?: string };
}

export default async function BidsPage({ searchParams }: BidsPageProps) {
  const bids = await getBids();
  const activeTab = searchParams?.status ?? 'all';

  const STATUS_TABS: Array<{ id: string; label: string }> = [
    { id: 'all',       label: 'All' },
    { id: 'New',       label: 'New' },
    { id: 'Reviewing', label: 'Reviewing' },
    { id: 'Active',    label: 'Active' },
    { id: 'Submitted', label: 'Submitted' },
    { id: 'Won',       label: 'Won' },
    { id: 'Lost',      label: 'Lost' },
  ];

  const counts = bids.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const list = activeTab === 'all' ? bids : bids.filter(b => b.status === activeTab);

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-[22px] flex items-end justify-between gap-6">
        <div>
          <h1 className="m-0 text-[28px] font-medium leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
            Bids
          </h1>
          <div className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            <span className="mono">{bids.length}</span> total bid requests
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
          const count = t.id === 'all' ? bids.length : counts[t.id] ?? 0;
          return (
            <Link
              key={t.id}
              href={t.id === 'all' ? '/bids' : `/bids?status=${t.id}`}
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
                <Th>Project</Th>
                <Th>Location</Th>
                <Th>GC</Th>
                <Th>Bid Due</Th>
                <Th>Days Left</Th>
                <Th>Trades</Th>
                <Th className="text-right">Our Bid</Th>
                <Th>Status</Th>
                <Th className="w-10"></Th>
              </tr>
            </thead>
            <tbody>
              {list.map(b => {
                const d = getDaysLeft(b.bid_due_date);
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
                    <Td><StatusPill status={b.status} /></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {b.plans_link && (
                          <a
                            href={b.plans_link}
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
