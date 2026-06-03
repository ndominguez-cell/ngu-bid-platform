import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Building2, ExternalLink, MessageSquare } from 'lucide-react';
import type { Conversation } from '@/lib/types';

export const revalidate = 0;

type Company = { name: string; type: string; website: string | null; phone: string | null; email: string | null; city: string | null; state: string | null };

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data, error }, { data: bids }, { data: conversations }] = await Promise.all([
    supabase.from('contacts').select('*, companies(name, type, website, phone, email, city, state)').eq('id', params.id).single(),
    supabase.from('bids').select('id, project_name, status, bid_due_date, gc_name').eq('contact_id', params.id).order('bid_due_date', { ascending: false }),
    supabase.from('conversations').select('*').eq('contact_id', params.id).order('date', { ascending: false }),
  ]);

  if (error || !data) notFound();
  const contact = data as Record<string, string | null | Company>;
  const convs = (conversations ?? []) as Conversation[];

  const initials = ((contact.first_name as string)?.[0] ?? '') + ((contact.last_name as string)?.[0] ?? '');
  const co = contact.companies as Company | null;

  return (
    <div className="mx-auto w-full max-w-4xl px-7 pb-20 pt-6">
      <Link
        href="/crm"
        className="inline-flex items-center gap-1.5 text-[13px] mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={13} /> CRM
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 mb-6">
        <div
          className="h-16 w-16 rounded-full grid place-items-center shrink-0 font-mono text-[22px] font-bold text-white"
          style={{ background: 'var(--navy)' }}
        >
          {initials}
        </div>
        <div className="flex-1">
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text)' }}>
            {contact.first_name as string} {contact.last_name as string}
          </h1>
          {contact.title && (
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{contact.title as string}</p>
          )}
          {co && (
            <p className="text-[13px] font-medium mt-1" style={{ color: 'var(--orange)' }}>{co.name}</p>
          )}
          <div className="flex gap-2 mt-3">
            {contact.email && (
              <a
                href={`mailto:${contact.email as string}`}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <Mail size={12} /> {contact.email as string}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone as string}`}
                className="btn btn-ghost btn-sm flex items-center gap-1.5"
              >
                <Phone size={12} /> {contact.phone as string}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Contact details */}
          <div className="card p-5">
            <h2 className="card-title mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Email"  value={contact.email as string | null} />
              <InfoRow label="Phone"  value={contact.phone as string | null} />
              <InfoRow label="Mobile" value={contact.mobile as string | null} />
              <InfoRow label="Source" value={contact.source as string | null} />
              <InfoRow label="Added"  value={formatDate(contact.created_at as string)} />
            </div>
            {contact.notes && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="label-mono mb-1">Notes</p>
                <p className="text-[13px]" style={{ color: 'var(--text)' }}>{contact.notes as string}</p>
              </div>
            )}
          </div>

          {/* Email history */}
          <div className="card p-5">
            <h2 className="card-title mb-4 flex items-center gap-1.5">
              <MessageSquare size={13} /> Email History
            </h2>
            {convs.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                No email history yet. Sync Gmail from the CRM page to populate this.
              </p>
            ) : (
              <div className="space-y-2">
                {convs.map(c => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 p-3 rounded"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 mt-0.5"
                      style={c.direction === 'outbound'
                        ? { background: 'var(--orange-soft)', color: 'var(--orange)' }
                        : { background: 'var(--info-soft)', color: 'var(--info)' }}
                    >
                      {c.direction === 'outbound' ? 'Sent' : 'Received'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {c.subject || '(no subject)'}
                      </div>
                      {c.snippet && (
                        <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.snippet}</div>
                      )}
                    </div>
                    <div className="text-[11px] shrink-0" style={{ color: 'var(--text-subtle)' }}>
                      {c.date ? formatDate(c.date) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Associated bids */}
          <div className="card p-5">
            <h2 className="card-title mb-4">Associated Bids</h2>
            {(!bids || bids.length === 0) ? (
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No bids linked to this contact yet.</p>
            ) : (
              <div className="space-y-2">
                {(bids as Array<{ id: string; project_name: string; status: string; bid_due_date: string | null; gc_name: string | null }>).map(bid => (
                  <Link
                    key={bid.id}
                    href={`/bids/${bid.id}`}
                    className="flex items-center justify-between p-3 rounded transition-colors hover:bg-[var(--surface-2)]"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--navy)' }}>{bid.project_name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {bid.id} · {bid.gc_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      >
                        {bid.status}
                      </span>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                        {formatDate(bid.bid_due_date)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Company sidebar */}
        {co && (
          <div className="card p-5 h-fit">
            <h2 className="card-title mb-4 flex items-center gap-1.5">
              <Building2 size={13} /> Company
            </h2>
            <div className="space-y-3 text-[13px]">
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{co.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{co.type}</p>
              </div>
              {co.phone && (
                <div>
                  <p className="label-mono mb-0.5">Phone</p>
                  <a href={`tel:${co.phone}`} className="transition-colors hover:text-[var(--orange)]" style={{ color: 'var(--navy)' }}>
                    {co.phone}
                  </a>
                </div>
              )}
              {co.email && (
                <div>
                  <p className="label-mono mb-0.5">Email</p>
                  <a href={`mailto:${co.email}`} className="transition-colors hover:text-[var(--orange)]" style={{ color: 'var(--navy)' }}>
                    {co.email}
                  </a>
                </div>
              )}
              {co.website && (
                <div>
                  <a
                    href={co.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-semibold hover:underline"
                    style={{ color: 'var(--orange)' }}
                  >
                    <ExternalLink size={11} /> Website
                  </a>
                </div>
              )}
              {(co.city || co.state) && (
                <div>
                  <p className="label-mono mb-0.5">Location</p>
                  <p style={{ color: 'var(--text)' }}>
                    {[co.city, co.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="label-mono mb-0.5">{label}</p>
      <p className="text-[13px] font-medium" style={{ color: value ? 'var(--text)' : 'var(--text-subtle)' }}>
        {value || '—'}
      </p>
    </div>
  );
}
