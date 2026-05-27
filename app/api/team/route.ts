import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

// GET /api/team — list all team members (admin only)
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const serviceClient = createServiceClient();
  const { data: users, error } = await serviceClient.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await serviceClient.from('profiles').select('id, full_name, role, title, created_at');

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null; role: string; title: string | null; created_at: string }) => [p.id, p]));

  const team = users.users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: profileMap[u.id]?.full_name ?? null,
    title: profileMap[u.id]?.title ?? null,
    role: (profileMap[u.id]?.role ?? 'estimator') as UserRole,
    created_at: profileMap[u.id]?.created_at ?? u.created_at,
  }));

  return NextResponse.json({ team });
}

// PATCH /api/team — update a user's role (admin only)
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId || !['admin', 'estimator', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from('profiles').update({ role }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
