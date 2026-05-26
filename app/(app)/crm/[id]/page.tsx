import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, Building2, ExternalLink } from 'lucide-react';

export const revalidate = 0;

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*, companies(name, type, website, phone, email, city, state)')
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();
  const contact = data as any;

  // Get bids linked to this contact
  const { data: bids } = await supabase
    .from('bids')
    .select('id, project_name, status, bid_due_date, gc_name')
    .eq('contact_id', params.id)
    .order('bid_due_date', { ascending: false });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to CRM
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-16 h-16 rounded-full bg-[#1a3a5c] flex items-center justify-center shrink-0">
          <span className="text-white text-2xl font-bold">
            {(contact.first_name?.[0] ?? '') + (contact.last_name?.[0] ?? '')}
          </span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#1a3a5c]">
            {contact.first_name} {contact.last_name}
          </h1>
          {contact.title && <p className="text-gray-500 text-sm mt-0.5">{contact.title}</p>}
          {contact.companies && (
            <p className="text-sm text-[#e87722] font-medium mt-1">{contact.companies.name}</p>
          )}
          <div className="flex gap-3 mt-3">
            {contact.email && (
              <a href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 text-xs bg-[#1a3a5c] text-white px-3 py-1.5 rounded-lg hover:bg-[#e87722] transition-colors font-semibold">
                <Mail size={12} /> {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:border-[#1a3a5c] transition-colors font-semibold">
                <Phone size={12} /> {contact.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {/* Contact details */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Email" value={contact.email} />
              <InfoRow label="Phone" value={contact.phone} />
              <InfoRow label="Mobile" value={contact.mobile} />
              <InfoRow label="Source" value={contact.source} />
              <InfoRow label="Added" value={formatDate(contact.created_at)} />
            </div>
            {contact.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-gray-700">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Associated Bids */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Associated Bids</h2>
            {(!bids || bids.length === 0) ? (
              <p className="text-sm text-gray-400">No bids linked to this contact yet.</p>
            ) : (
              <div className="space-y-2">
                {bids.map((bid: any) => (
                  <Link key={bid.id} href={`/bids/${bid.id}`}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-[#1a3a5c] transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-[#1a3a5c]">{bid.project_name}</div>
                      <div className="text-xs text-gray-400">{bid.id} · {bid.gc_name}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{bid.status}</span>
                      <div className="text-xs text-gray-400 mt-1">{formatDate(bid.bid_due_date)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Company sidebar */}
        {contact.companies && (
          <div className="bg-white rounded-xl shadow-sm p-5 h-fit">
            <h2 className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Building2 size={13} /> Company
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-[#1a3a5c]">{contact.companies.name}</p>
                <p className="text-xs text-gray-400">{contact.companies.type}</p>
              </div>
              {contact.companies.phone && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Phone</p>
                  <a href={`tel:${contact.companies.phone}`} className="text-sm text-[#1a3a5c] hover:text-[#e87722]">
                    {contact.companies.phone}
                  </a>
                </div>
              )}
              {contact.companies.email && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                  <a href={`mailto:${contact.companies.email}`} className="text-sm text-[#1a3a5c] hover:text-[#e87722]">
                    {contact.companies.email}
                  </a>
                </div>
              )}
              {contact.companies.website && (
                <div>
                  <a href={contact.companies.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#e87722] hover:underline font-semibold">
                    <ExternalLink size={11} /> Website
                  </a>
                </div>
              )}
              {(contact.companies.city || contact.companies.state) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                  <p className="text-sm text-gray-700">
                    {[contact.companies.city, contact.companies.state].filter(Boolean).join(', ')}
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
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 font-medium">{value || '—'}</p>
    </div>
  );
}
