import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Profiles.role is a coarser enum than workspace_members.role; map before sync.
function toProfileRole(role: string): 'admin' | 'estimator' | 'viewer' {
  if (role === 'owner' || role === 'admin') return 'admin';
  if (role === 'estimator') return 'estimator';
  return 'viewer';
}

async function loadInvite(token: string) {
  const service = createServiceClient();
  const { data } = await service
    .from('workspace_invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();
  return { service, invite: data };
}

// GET /api/invite/accept?token=... — public token info so the accept page can
// show who/what the invite is for. The token itself is the bearer secret.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const { service, invite } = await loadInvite(token);
  if (!invite) return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 });

  const expired = new Date(invite.expires_at) < new Date();
  const accepted = !!invite.accepted_at;

  const { data: ws } = await service
    .from('workspaces')
    .select('name')
    .eq('id', invite.workspace_id)
    .maybeSingle();

  return NextResponse.json({
    valid: !expired && !accepted,
    expired,
    accepted,
    email: invite.email,
    role: invite.role,
    workspaceName: ws?.name ?? 'the workspace',
  });
}

// POST /api/invite/accept { token } — the logged-in user accepts an invite.
// Does NOT use requireUser() (that 403s users with no workspace — exactly the
// people accepting their first invite). Requires the signed-in user's email to
// match the invited email so a leaked token can't be redeemed by another
// account.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to accept', needsAuth: true }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const { service, invite } = await loadInvite(token);
  if (!invite) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: 'This invitation was already used' }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
  }

  const userEmail = (user.email ?? '').toLowerCase();
  if (userEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invitation is for ${invite.email}. Sign in with that email to accept.` },
      { status: 403 },
    );
  }

  // Ensure a profile row exists (the signup trigger normally makes it).
  await service.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

  const { error: memErr } = await service
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role },
      { onConflict: 'workspace_id,user_id' },
    );
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  // Keep the UI-facing profiles.role in sync, matching /api/team's convention.
  await service.from('profiles').update({ role: toProfileRole(invite.role) }).eq('id', user.id);

  await service
    .from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', invite.id);

  return NextResponse.json({ success: true, workspace_id: invite.workspace_id });
}
