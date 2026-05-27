'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, FileText, Calculator, Users, Send, Settings, LogOut, BarChart2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/notifications/NotificationBell';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/bids',       label: 'Bids',        icon: FileText },
  { href: '/estimates',  label: 'Estimates',   icon: Calculator },
  { href: '/crm',        label: 'CRM',         icon: Users },
  { href: '/proposals',  label: 'Proposals',   icon: Send },
  { href: '/analytics',  label: 'Analytics',   icon: BarChart2 },
];

export default function Sidebar({ userEmail, onClose }: { userEmail?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 bg-[#0d2137] flex flex-col min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="bg-[#e87722] px-2.5 py-1.5 rounded-md">
          <span className="text-white font-black text-base tracking-widest">NGU</span>
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm tracking-wide leading-tight">BID PLATFORM</div>
          <div className="text-white/40 text-[10px] tracking-wide">NGU Construction</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-white/40 hover:text-white transition-colors ml-auto"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-[#e87722] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 px-3 py-1">
          <Link
            href="/settings"
            className={cn(
              'flex flex-1 items-center gap-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              pathname.startsWith('/settings')
                ? 'text-white'
                : 'text-white/50 hover:text-white'
            )}
          >
            <Settings size={17} />
            Settings
          </Link>
          <NotificationBell />
        </div>

        {userEmail && (
          <div className="px-3 pt-2 pb-1">
            <div className="text-white/40 text-[11px] truncate">{userEmail}</div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/5 transition-all"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
