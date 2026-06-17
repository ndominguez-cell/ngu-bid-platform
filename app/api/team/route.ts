import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

// GET /api/team — list team members in the caller's workspace (admin only)
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createClient();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const serviceClient = createServiceClient();

  // Only users who belong to the caller's workspace.
  const { data: members } = await serviceClient
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', auth.workspaceId);
  const memberIds = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));

  const { data: users, error } = await serviceClient.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, full_name, role, title, created_at')
  .in('id', Array.from(memberIds));

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null; role: string; title: string | null; created_at: string }) => [p.id, p]));

  const team = users.users
    .filter(u => memberIds.has(u.id))
    .map(u => ({
      id: u.id,
      email: u.email,
      full_name: profileMap[u.id]?.full_name ?? null,
      title: profileMap[u.id]?.title ?? null,
      role: (profileMap[u.id]?.role ?? 'estimator') as UserRole,
      created_at: profileMap[u.id]?.created_at ?? u.created_at,
    }));

  return NextResponse.json({ team });
}

// PATCH /api/team — update a user's role (admin only, same-workspace only)
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createClient();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId || !['admin', 'estimator', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Refuse to touch a user who is not a member of the caller's workspace.
  const { data: targetMembership } = await serviceClient
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not in your workspace' }, { status: 403 });
  }

  const { error } = await serviceClient.from('profiles').update({ role }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
