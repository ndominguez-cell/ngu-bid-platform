import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Users, Building2, Phone, Mail } from 'lucide-react';

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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">CRM</h1>
          <p className="text-gray-500 text-sm mt-0.5">Contacts and companies from bids and emails</p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/companies/new" className="border border-[#1a3a5c] text-[#1a3a5c] text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Building2 size={14} /> Add Company
          </Link>
          <Link href="/crm/contacts/new" className="bg-[#1a3a5c] hover:bg-[#e87722] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <Users size={14} /> Add Contact
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Contacts list */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">
                Contacts · {contacts?.length ?? 0}
              </h2>
            </div>
            {(!contacts || contacts.length === 0) ? (
              <div className="p-10 text-center text-gray-400">
                <Users size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="font-medium mb-1">No contacts yet</p>
                <p className="text-xs">Contacts are auto-extracted from bid emails. You can also add them manually.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {contacts.map((c: any) => (
                  <Link key={c.id} href={`/crm/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#1a3a5c] flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">
                        {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1a3a5c]">
                        {c.first_name} {c.last_name}
                        {c.title && <span className="text-gray-400 font-normal"> · {c.title}</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {c.companies?.name && <span className="font-medium">{c.companies.name}</span>}
                        {c.email && <span> · {c.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-3 text-gray-300">
                      {c.email && <Mail size={14} className="hover:text-[#1a3a5c]" />}
                      {c.phone && <Phone size={14} className="hover:text-[#1a3a5c]" />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Companies */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">
              Companies · {companies?.length ?? 0}
            </h2>
          </div>
          {(!companies || companies.length === 0) ? (
            <div className="p-8 text-center text-gray-400 text-xs">No companies yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {companies.map((co: any) => (
                <Link key={co.id} href={`/crm/companies/${co.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <Building2 size={15} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1a3a5c] truncate">{co.name}</div>
                    <div className="text-xs text-gray-400">{co.type} {co.city ? `· ${co.city}` : ''}</div>
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
