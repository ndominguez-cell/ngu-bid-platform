import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonAdmin } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

// GET /api/team — list team members in the caller's workspace (admin only).
// Authority is the caller's WORKSPACE role (workspace_members.role via auth.role),
// not the global profiles.role — otherwise an admin in one workspace would be an
// admin in every workspace they belong to.
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonAdmin(auth.role);
  if (denied) return denied;

  const serviceClient = createServiceClient();

  // Only users who belong to the caller's workspace.
  const { data: members } = await serviceClient
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', auth.workspaceId);
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, full_name, role, title, created_at')
    .in('id', memberIds);
  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null; role: string; title: string | null; created_at: string }) => [p.id, p]));

  // Look up each member's auth record directly by id. Previously this paged
  // auth.admin.listUsers() (first 50 project users only), so members silently
  // disappeared once the project grew past 50; getUserById is exact regardless.
  const team = await Promise.all(
    memberIds.map(async (id) => {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(id);
      const u = authUser?.user;
      return {
        id,
        email: u?.email ?? null,
        full_name: profileMap[id]?.full_name ?? null,
        title: profileMap[id]?.title ?? null,
        role: (profileMap[id]?.role ?? 'estimator') as UserRole,
        created_at: profileMap[id]?.created_at ?? u?.created_at ?? null,
      };
    })
  );

  return NextResponse.json({ team });
}

// PATCH /api/team — update a user's role (workspace admin only, same-workspace only)
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonAdmin(auth.role);
  if (denied) return denied;

  const { userId, role } = await req.json();
  if (!userId || !['admin', 'estimator', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Refuse to touch a user who is not a member of the caller's workspace.
  const { data: targetMembership } = await serviceClient
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not in your workspace' }, { status: 403 });
  }
  // Don't let an owner be demoted through this path (would orphan the workspace).
  if (targetMembership.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change the workspace owner’s role here' }, { status: 403 });
  }

  // Update the enforced authority (workspace-scoped) AND the profile role the UI
  // reads, so they stay in sync within this workspace.
  const { error: memErr } = await serviceClient
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', auth.workspaceId)
    .eq('user_id', userId);
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const { error } = await serviceClient.from('profiles').update({ role }).eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
