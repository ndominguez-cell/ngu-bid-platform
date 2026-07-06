'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Users, Building2, Phone, Mail, Search, Upload, X, FileText, RefreshCw } from 'lucide-react';
import GmailSyncButton from './GmailSyncButton';

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  source: string | null;
  companies: { name: string; type: string } | null;
}

interface CompanyRow {
  id: string;
  name: string;
  type: string;
  city: string | null;
  phone: string | null;
  email: string | null;
}

export default function CRMClient({ contacts, companies }: { contacts: ContactRow[]; companies: CompanyRow[] }) {
  const [search, setSearch] = useState('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const searchLower = search.toLowerCase();
  const filteredContacts = search
    ? contacts.filter(c => {
        const name = `${c.first_name} ${c.last_name ?? ''}`.toLowerCase();
        const co = c.companies?.name?.toLowerCase() ?? '';
        const em = c.email?.toLowerCase() ?? '';
        return name.includes(searchLower) || co.includes(searchLower) || em.includes(searchLower);
      })
    : contacts;

  const filteredCompanies = search
    ? companies.filter(co => co.name.toLowerCase().includes(searchLower) || (co.city?.toLowerCase() ?? '').includes(searchLower))
    : companies;

  async function handleCSVImport() {
    if (!csvFile) return;
    setImporting(true);
    // CSV parsing placeholder — in production this would POST to an API route
    setTimeout(() => {
      setImporting(false);
      setCsvModalOpen(false);
      setCsvFile(null);
    }, 1500);
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] px-7 pb-20 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-medium leading-tight" style={{ color: 'var(--text)' }}>CRM</h1>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
            <span className="mono">{contacts.length}</span> contacts · <span className="mono">{companies.length}</span> companies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="btn btn-ghost btn-sm flex items-center gap-1.5"
          >
            <Upload size={13} /> Import CSV
          </button>
          <GmailSyncButton />
          <Link href="/crm/companies/new" className="btn btn-ghost btn-sm flex items-center gap-1.5">
            <Building2 size={13} /> Add Company
          </Link>
          <Link href="/crm/contacts/new" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Users size={13} /> Add Contact
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-5 relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
        <input
          type="text"
          placeholder="Search contacts, companies, emails…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-md border pl-9 pr-4 py-2.5 text-[13px] outline-none transition-colors"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-subtle)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Contacts table */}
        <div className="col-span-2 card overflow-hidden p-0">
          <div className="card-head">
            <h2 className="card-title">Contacts · {filteredContacts.length}</h2>
          </div>
          {filteredContacts.length === 0 ? (
            <div className="p-10 text-center">
              <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
              <p className="font-medium text-[13px] mb-1" style={{ color: 'var(--text-muted)' }}>
                {search ? 'No contacts match your search' : 'No contacts yet'}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                Contacts are auto-extracted from bid emails. You can also add them manually or import from CSV.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="px-4 py-2.5 text-left label-mono">Name</th>
                    <th className="px-4 py-2.5 text-left label-mono">Company</th>
                    <th className="px-4 py-2.5 text-left label-mono">Title</th>
                    <th className="px-4 py-2.5 text-left label-mono">Email</th>
                    <th className="px-4 py-2.5 text-left label-mono">Phone</th>
                    <th className="px-4 py-2.5 text-left label-mono">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(c => (
                    <tr
                      key={c.id}
                      className="transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/crm/${c.id}`} className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full grid place-items-center shrink-0 font-mono text-[11px] font-bold text-white"
                            style={{ background: '#1a3a5c' }}
                          >
                            {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
                          </div>
                          <span className="font-medium" style={{ color: 'var(--text)' }}>
                            {c.first_name} {c.last_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                          {c.companies?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                        {c.title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.email ? (
                          <span className="mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{c.email}</span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.phone ? (
                          <span className="mono text-[12px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.source ? (
                          <span
                            className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}
                          >
                            {c.source}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Companies sidebar */}
        <div className="card overflow-hidden p-0 h-fit">
          <div className="card-head">
            <h2 className="card-title">Companies · {filteredCompanies.length}</h2>
          </div>
          {filteredCompanies.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: 'var(--text-subtle)' }}>
              {search ? 'No companies match your search' : 'No companies yet'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredCompanies.map(co => (
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
                  <div className="flex gap-2 shrink-0" style={{ color: 'var(--text-subtle)' }}>
                    {co.email && <Mail size={12} />}
                    {co.phone && <Phone size={12} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-lg border shadow-xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text)' }}>Import Contacts from CSV</h3>
              <button onClick={() => { setCsvModalOpen(false); setCsvFile(null); }} style={{ color: 'var(--text-subtle)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
                Upload a CSV file with columns: First Name, Last Name, Email, Phone, Company, Title
              </p>
              <div
                className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors hover:border-[var(--orange)]"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                />
                {csvFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={18} style={{ color: 'var(--ok)' }} />
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{csvFile.name}</span>
                    <span className="mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                      ({(csvFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--text-subtle)' }} />
                    <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      Click to select a CSV file or drag and drop
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setCsvModalOpen(false); setCsvFile(null); }} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                onClick={handleCSVImport}
                disabled={!csvFile || importing}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                {importing ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                {importing ? 'Importing…' : 'Import Contacts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
