import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Users, Building2, Phone, Mail } from 'lucide-react';
import GmailSyncButton from './GmailSyncButton';

export const revalidate = 0;

export default async function CRMPage() {
  const supabase = createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, companies(name, type)')
    .order('created_at', { ascending: false });

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>CRM</h1>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--text-muted)' }}>Contacts and companies from bids and emails</p>
        </div>
        <div className="flex items-center gap-2">
          <GmailSyncButton />
          <Link href="/crm/companies/new" className="btn btn-ghost btn-sm flex items-center gap-1.5">
            <Building2 size={13} /> Add Company
          </Link>
          <Link href="/crm/contacts/new" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Users size={13} /> Add Contact
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Contacts list */}
        <div className="col-span-2 card overflow-hidden p-0">
          <div className="card-head">
            <h2 className="card-title">Contacts · {contacts?.length ?? 0}</h2>
          </div>
          {(!contacts || contacts.length === 0) ? (
            <div className="p-10 text-center">
              <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
              <p className="font-medium text-[13px] mb-1" style={{ color: 'var(--text-muted)' }}>No contacts yet</p>
              <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                Contacts are auto-extracted from bid emails. You can also add them manually.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {contacts.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/crm/${c.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div
                    className="h-9 w-9 rounded-full grid place-items-center shrink-0 font-mono text-[12px] font-bold text-white"
                    style={{ background: 'var(--navy)' }}
                  >
                    {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                      {c.first_name} {c.last_name}
                      {c.title && <span className="font-normal" style={{ color: 'var(--text-subtle)' }}> · {c.title}</span>}
                    </div>
                    <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {c.companies?.name && <span className="font-medium">{c.companies.name}</span>}
                      {c.email && <span> · {c.email}</span>}
                    </div>
                  </div>
                  <div className="flex gap-3" style={{ color: 'var(--border-strong)' }}>
                    {c.email && <Mail size={14} />}
                    {c.phone && <Phone size={14} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Companies sidebar */}
        <div className="card overflow-hidden p-0 h-fit">
          <div className="card-head">
            <h2 className="card-title">Companies · {companies?.length ?? 0}</h2>
          </div>
          {(!companies || companies.length === 0) ? (
            <div className="p-8 text-center text-[12px]" style={{ color: 'var(--text-subtle)' }}>No companies yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {companies.map((co: any) => (
                <Link
                  key={co.id}
                  href={`/crm/companies/${co.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Building2 size={15} style={{ color: 'var(--border-strong)' }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{co.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {co.type}{co.city ? ` · ${co.city}` : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
