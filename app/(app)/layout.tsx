import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, title')
    .eq('id', user.id)
    .single();

  return (
    <AppShell
      userEmail={user.email}
      userName={profile?.full_name ?? undefined}
      userTitle={profile?.title ?? undefined}
    >
      {children}
    </AppShell>
  );
}
