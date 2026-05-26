import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate, formatCurrency, getDaysLeft, getUrgencyClass, getUrgencyLabel, STATUS_COLORS } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Mail, MapPin, Calendar, DollarSign, FileText } from 'lucide-react';
import BidStatusUpdater from './BidStatusUpdater';

export const revalidate = 0;

export default async function BidDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*, estimates(*), proposals(*)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();
  const bid = data as Bid;
  const days = getDaysLeft(bid.bid_due_date);
  const { bg, text } = STATUS_COLORS[bid.status] ?? STATUS_COLORS.New;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/bids" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Bids
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] leading-tight">{bid.project_name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-gray-400 font-mono">{bid.id}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bg} ${text}`}>{bid.status}</span>
            {bid.bid_due_date && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getUrgencyClass(days)}`}>
                {getUrgencyLabel(days)} · Due {formatDate(bid.bid_due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {bid.plans_link && (
            <a href={bid.plans_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-[#1a3a5c] text-white px-3 py-2 rounded-lg hover:bg-[#e87722] transition-colors font-semibold">
              <ExternalLink size={13} /> View Plans
            </a>
          )}
          {bid.thread_id && (
            <a href={`https://mail.google.com/mail/u/0/#inbox/${bid.thread_id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:border-[#1a3a5c] transition-colors font-semibold">
              <Mail size={13} /> Gmail Thread
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main info */}
        <div className="col-span-2 space-y-4">
          {/* Project details card */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Project Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={<MapPin size={14} />} label="Location" value={[bid.address, bid.city, bid.state].filter(Boolean).join(', ') || '—'} />
              <InfoRow icon={<Calendar size={14} />} label="Bid Due" value={bid.bid_due_date ? `${formatDate(bid.bid_due_date)}${bid.bid_due_time ? ' · ' + bid.bid_due_time : ''}` : '—'} />
              <InfoRow label="GC / Owner" value={bid.gc_name || '—'} />
              <InfoRow label="Submit To" value={bid.submit_to || '—'} />
              <InfoRow label="GC Contact" value={bid.gc_contact_name || '—'} />
              <InfoRow label="GC Phone" value={bid.gc_contact_phone || '—'} />
              <InfoRow label="Source" value={bid.source || '—'} />
              <InfoRow label="Received" value={formatDate(bid.email_received)} />
            </div>

            {bid.scope && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Scope</p>
                <p className="text-sm text-gray-700">{bid.scope}</p>
              </div>
            )}

            {bid.trades && bid.trades.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trades</p>
                <div className="flex flex-wrap gap-1.5">
                  {bid.trades.map(t => (
                    <span key={t} className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {bid.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{bid.notes}</p>
              </div>
            )}
          </div>

          {/* Estimates */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Estimates</h2>
              <Link href={`/estimates/new?bid=${bid.id}`} className="text-xs bg-[#1a3a5c] text-white px-3 py-1.5 rounded-lg hover:bg-[#e87722] transition-colors font-semibold">
                + New Estimate
              </Link>
            </div>
            {(!bid.estimates || bid.estimates.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                No estimates yet — upload plans to create one
              </div>
            ) : (
              <div className="space-y-2">
                {bid.estimates!.map((est: any) => (
                  <Link key={est.id} href={`/estimates/${est.id}`} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-[#1a3a5c] transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-[#1a3a5c]">{est.name}</div>
                      <div className="text-xs text-gray-400">{formatDate(est.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[#1a3a5c]">{formatCurrency(est.total_amount)}</div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{est.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Status updater */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-3">Update Status</h2>
            <BidStatusUpdater bidId={bid.id} currentStatus={bid.status} />
          </div>

          {/* Our bid amount */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-3">Financials</h2>
            <div className="space-y-2">
              <InfoRow icon={<DollarSign size={14} />} label="Our Bid" value={formatCurrency(bid.our_bid_amount)} />
              <InfoRow icon={<DollarSign size={14} />} label="Awarded" value={formatCurrency(bid.awarded_amount)} />
            </div>
          </div>

          {/* Proposals */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">Proposals</h2>
              <Link href={`/proposals/new?bid=${bid.id}`} className="text-xs text-[#e87722] font-semibold hover:underline">+ Draft</Link>
            </div>
            {(!bid.proposals || bid.proposals.length === 0) ? (
              <p className="text-xs text-gray-400">No proposals yet</p>
            ) : (
              bid.proposals!.map((p: any) => (
                <Link key={p.id} href={`/proposals/${p.id}`} className="block text-xs text-[#1a3a5c] hover:text-[#e87722] font-medium">
                  {p.subject} · {p.status}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="text-sm text-gray-700 font-medium">{value}</p>
    </div>
  );
}
