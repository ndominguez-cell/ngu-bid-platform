'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

interface BidNotification {
  id: string;
  project_name: string;
  bid_due_date: string | null;
  source: string | null;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<BidNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('bid-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, (payload) => {
        setNotifications(prev => [payload.new as BidNotification, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="icon-btn relative"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {notifications.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold text-white grid place-items-center px-0.5"
            style={{ background: 'var(--bad)' }}
          >
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-72 rounded-md border shadow-lg z-50 overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="label-mono">New Bids</span>
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-[11px] transition-colors"
                style={{ color: 'var(--text-subtle)' }}
              >
                Clear all
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-subtle)' }}>
              No new bids — you&apos;re up to date
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { setNotifications(p => p.filter(x => x.id !== n.id)); setOpen(false); router.push(`/bids/${n.id}`); }}
                  className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>{n.project_name}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {n.source && <span className="font-medium">{n.source} · </span>}
                    {n.bid_due_date ? `Due ${formatDate(n.bid_due_date)}` : 'No due date'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
