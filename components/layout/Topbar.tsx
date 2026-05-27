'use client';

import { useState, useEffect } from 'react';
import { Search, Inbox, Sun, Moon } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

interface Crumb {
  label: string;
  href?: string;
}

interface TopbarProps {
  crumbs?: Crumb[];
}

export default function Topbar({ crumbs = [] }: TopbarProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-7 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/80"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {crumbs.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            {c.href && i < crumbs.length - 1 ? (
              <a
                href={c.href}
                className="hover:text-[var(--orange)] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {c.label}
              </a>
            ) : (
              <strong className="font-medium" style={{ color: 'var(--text)' }}>
                {c.label}
              </strong>
            )}
            {i < crumbs.length - 1 && (
              <span style={{ color: 'var(--text-subtle)' }}>/</span>
            )}
          </span>
        ))}
      </div>

      {/* Search */}
      <div
        className="ml-auto flex w-[320px] items-center gap-2 rounded border px-2.5 py-1.5 transition-colors focus-within:border-[var(--orange)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
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
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="icon-btn"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <NotificationBell />
        <button className="icon-btn" aria-label="Inbox">
          <Inbox size={16} />
        </button>
      </div>
    </header>
  );
}
