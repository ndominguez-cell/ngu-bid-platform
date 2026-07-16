import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonAdmin } from '@/lib/auth';
import { isValidEmail } from '@/lib/validation';

// Roles an admin may invite. `owner` is intentionally excluded — ownership is
// assigned at workspace creation/backfill only, never via an invite.
const INVITABLE_ROLES = ['admin', 'estimator', 'viewer'];

function inviteLink(req: NextRequest, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

// GET /api/team/invite — list this workspace's pending (unaccepted, unexpired)
// invitations. Admin/owner only.
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonAdmin(auth.role);
  if (denied) return denied;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('id, email, role, token, created_at, expires_at')
    .eq('workspace_id', auth.workspaceId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invitations: data ?? [] });
}

// POST /api/team/invite — create an invitation for the caller's workspace and
// return a shareable accept link. Admin/owner only. Never trusts a
// workspace_id from the body — always the caller's workspace.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonAdmin(auth.role);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : 'admin';

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const token = randomBytes(32).toString('base64url');

  const { data: invitation, error } = await supabase
    .from('workspace_invitations')
    .insert({
      workspace_id: auth.workspaceId,
      email,
      role,
      token,
      invited_by: auth.user?.id ?? null,
    })
    .select('id, email, role, token, created_at, expires_at')
    .single();

  if (error) {
    // Most likely the migration hasn't been applied yet.
    const hint = /workspace_invitations.* does not exist/i.test(error.message)
      ? 'The workspace_invitations table is missing — apply migration 20260716120000_workspace_invitations.sql in Supabase.'
      : error.message;
    return NextResponse.json({ error: hint }, { status: 500 });
  }

  return NextResponse.json({ invitation, link: inviteLink(req, token) }, { status: 201 });
}

// DELETE /api/team/invite?id=<uuid> — revoke a pending invitation in the
// caller's workspace. Admin/owner only, same-workspace only.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonAdmin(auth.role);
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('workspace_invitations')
    .delete()
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
