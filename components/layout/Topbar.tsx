'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Search, Inbox, Sun, Moon } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

const SECTION_LABELS: Record<string, string> = {
  dashboard:  'Dashboard',
  bids:       'Bids',
  estimates:  'Estimates',
  proposals:  'Proposals',
  crm:        'CRM',
  analytics:  'Analytics',
  settings:   'Settings',
  new:        'New',
};

function useCrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];
  let path = '';
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`;
    const label = SECTION_LABELS[segments[i]] ?? segments[i];
    const isLast = i === segments.length - 1;
    crumbs.push({ label, href: isLast ? undefined : path });
  }
  return crumbs;
}

export default function Topbar() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const crumbs = useCrumbs();

  useEffect(() => {
    const saved = localStorage.getItem('ngu-theme') as 'light' | 'dark' | null;
    if (saved) setTheme(saved);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ngu-theme', next);
  }

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-7"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {c.href ? (
              <Link
                href={c.href}
                className="transition-colors hover:text-[var(--orange)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {c.label}
              </Link>
            ) : (
              <strong className="font-medium" style={{ color: 'var(--text)' }}>{c.label}</strong>
            )}
            {i < crumbs.length - 1 && (
              <span style={{ color: 'var(--text-subtle)' }}>/</span>
            )}
          </span>
        ))}
      </div>

      {/* Search */}
      <div
        className="ml-auto flex w-[300px] items-center gap-2 rounded border px-2.5 py-1.5 transition-colors focus-within:border-[var(--orange)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Search size={13} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search bids, GCs, projects…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-subtle)]"
          style={{ color: 'var(--text)' }}
        />
        <span
          className="rounded border px-1.5 py-px font-mono text-[10px]"
          style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)' }}
        >
          ⌘K
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="icon-btn"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <NotificationBell />
        <button className="icon-btn" aria-label="Inbox">
          <Inbox size={15} />
        </button>
      </div>
    </header>
  );
}
