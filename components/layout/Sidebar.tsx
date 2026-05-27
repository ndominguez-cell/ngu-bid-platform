'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, FileText, Calculator, Send, Users, BarChart2,
  Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKSPACE = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bids',      label: 'Bids',      icon: FileText },
  { href: '/estimates', label: 'Estimates', icon: Calculator },
  { href: '/proposals', label: 'Proposals', icon: Send },
];

const NETWORK = [
  { href: '/crm',       label: 'CRM',       icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
];

const SYSTEM = [
  { href: '/settings',  label: 'Settings',  icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  userName?: string;
  userTitle?: string;
  urgentCount?: number;
  bidsCount?: number;
}

export default function Sidebar({ userEmail, userName, userTitle, urgentCount = 0, bidsCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const displayName = userName ?? userEmail ?? 'User';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside
      className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r overflow-y-auto"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-[11px] px-[18px] pt-[18px] pb-4 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="h-[38px] w-[38px] shrink-0 overflow-hidden rounded bg-[#141210]">
          <Image src="/ngu-logo.png" alt="NGU" width={38} height={38} className="h-full w-full object-cover" />
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
      <nav className="flex flex-col gap-px px-3 py-3.5 flex-1">
        <NavGroup
          title="Workspace"
          pathname={pathname}
          items={WORKSPACE}
          extras={{ '/bids': { count: bidsCount, urgent: urgentCount > 0 } }}
        />
        <NavGroup title="Network" pathname={pathname} items={NETWORK} />
        <NavGroup title="System"  pathname={pathname} items={SYSTEM} />
      </nav>

      {/* Footer — user card + sign out */}
      <div className="px-3 pb-3 pt-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)] mb-1"
          style={{ color: 'var(--text-subtle)' }}
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>

        <div
          className="flex items-center gap-2.5 rounded-md px-2 py-2 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
        >
          <div
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold text-white"
            style={{ background: 'var(--navy)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight" style={{ color: 'var(--text)' }}>
              {displayName}
            </div>
            {userTitle && (
              <div className="truncate text-[11px] leading-tight" style={{ color: 'var(--text-subtle)' }}>
                {userTitle}
              </div>
            )}
          </div>
          <ChevronDown size={13} style={{ color: 'var(--text-subtle)' }} className="shrink-0" />
        </div>
      </div>
    </aside>
  );
}

interface NavGroupProps {
  title: string;
  pathname: string;
  items: Array<{ href: string; label: string; icon: LucideIcon }>;
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
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
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
            {active && (
              <span
                className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r"
                style={{ background: 'var(--orange)' }}
              />
            )}
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {extra?.urgent ? (
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-soft shrink-0"
                style={{ background: 'var(--bad)', boxShadow: '0 0 0 3px var(--bad-soft)' }}
                title="Urgent items"
              />
            ) : extra?.count != null ? (
              <span className="font-mono text-[11px] shrink-0" style={{ color: active ? 'var(--navy)' : 'var(--text-muted)' }}>
                {extra.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
