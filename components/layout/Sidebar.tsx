'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, FileText, Calculator, Send, Users, BarChart2,
  Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MAIN = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bids',      label: 'Bids',      icon: FileText },
  { href: '/estimates', label: 'Estimates', icon: Calculator },
  { href: '/proposals', label: 'Proposals', icon: Send },
];

const NETWORK = [
  { href: '/crm',       label: 'CRM',       icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
];

interface SidebarProps {
  userEmail?: string;
  urgentCount?: number;
  bidsCount?: number;
}

export default function Sidebar({ userEmail, urgentCount = 0, bidsCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-[11px] px-[18px] pt-[18px] pb-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded bg-[#141210]">
          <Image
            src="/ngu-logo.png"
            alt="NGU"
            width={38}
            height={38}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
            NGU Construction
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
            Bid Platform
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-px px-3 py-3.5">
        <NavGroup title="Workspace" pathname={pathname} items={MAIN} extras={{ '/bids': { count: bidsCount, urgent: urgentCount > 0 } }} />
        <NavGroup title="Network"   pathname={pathname} items={NETWORK} />
      </nav>

      <div className="mt-auto px-3 pb-3" />

      {/* Footer */}
      <div className="px-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link
          href="/settings"
          className={cn(
            'nav-item flex items-center gap-2.5 rounded px-2.5 py-2 text-[13.5px] transition-colors',
            pathname.startsWith('/settings') ? 'font-medium' : '',
          )}
          style={{
            background: pathname.startsWith('/settings') ? 'var(--navy-soft)' : 'transparent',
            color: pathname.startsWith('/settings') ? 'var(--navy)' : 'var(--text-2)',
          }}
        >
          <Settings size={16} />
          <span>Settings</span>
        </Link>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13.5px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>

        <div
          className="mt-2 flex items-center gap-2.5 rounded px-2 py-2 border-t pt-3 cursor-pointer"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="grid h-7 w-7 place-items-center rounded-full font-mono text-[11px] font-semibold text-white"
            style={{ background: 'var(--navy)' }}
          >
            {(userEmail?.[0] ?? 'N').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {userEmail ?? 'signed in'}
            </div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-subtle)' }} />
        </div>
      </div>
    </aside>
  );
}

interface NavGroupProps {
  title: string;
  pathname: string;
  items: Array<{ href: string; label: string; icon: any }>;
  extras?: Record<string, { count?: number; urgent?: boolean }>;
}

function NavGroup({ title, pathname, items, extras = {} }: NavGroupProps) {
  return (
    <>
      <div
        className="px-2.5 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-subtle)' }}
      >
        {title}
      </div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const extra = extras[href];
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'group relative flex items-center gap-2.5 rounded px-2.5 py-2 text-[13.5px] transition-colors',
              active && 'font-medium',
            )}
            style={{
              background: active ? 'var(--navy-soft)' : 'transparent',
              color: active ? 'var(--navy)' : 'var(--text-2)',
            }}
          >
            {/* Orange accent stripe on active */}
            {active && (
              <span
                className="absolute -left-3 top-2 bottom-2 w-[2px] rounded-r"
                style={{ background: 'var(--orange)' }}
              />
            )}
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {extra?.urgent ? (
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-soft"
                style={{ background: 'var(--bad)', boxShadow: '0 0 0 3px var(--bad-soft)' }}
                title="Urgent items"
              />
            ) : extra?.count != null ? (
              <span
                className="font-mono text-[11px]"
                style={{ color: active ? 'var(--navy)' : 'var(--text-muted)' }}
              >
                {extra.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
