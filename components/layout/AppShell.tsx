import { createClient } from '@/lib/supabase/server';
import { getDaysLeft } from '@/lib/utils';
import type { Bid } from '@/lib/types';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppShellProps {
  userEmail?: string;
  children: React.ReactNode;
}

export default async function AppShell({ userEmail, children }: AppShellProps) {
  const supabase = createClient();
  const { data: bids } = await supabase
    .from('bids')
    .select('id, status, bid_due_date');

  const list = (bids ?? []) as Pick<Bid, 'id' | 'status' | 'bid_due_date'>[];
  const active = list.filter(b => !['Won', 'Lost', 'Declined', 'Expired'].includes(b.status));
  const urgentCount = list.filter(b => {
    const d = getDaysLeft(b.bid_due_date);
    return d != null && d >= 0 && d <= 3;
  }).length;

  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: '232px 1fr', background: 'var(--bg)' }}
    >
      <Sidebar
        userEmail={userEmail}
        urgentCount={urgentCount}
        bidsCount={active.length}
      />
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
