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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        (payload) => {
          const bid = payload.new as BidNotification;
          setNotifications(prev => [bid, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setOpen(o => !o);
  }

  function handleBidClick(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setOpen(false);
    router.push(`/bids/${id}`);
  }

  function handleClearAll() {
    setNotifications([]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
        title="Notifications"
      >
        <Bell size={16} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-[#e87722] rounded-full text-[9px] font-black text-white flex items-center justify-center px-0.5">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-bold text-[#1a3a5c] uppercase tracking-wider">New Bids</span>
            {notifications.length > 0 && (
              <button onClick={handleClearAll} className="text-[10px] text-gray-400 hover:text-red-400 font-semibold">
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              No new bids — you&apos;re up to date
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleBidClick(n.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs font-semibold text-[#1a3a5c] truncate">{n.project_name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
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
