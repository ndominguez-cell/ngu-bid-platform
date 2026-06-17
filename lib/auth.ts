import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Gate for API routes that use the service-role client.
 *
 * The service-role client bypasses all Postgres row-level security, so any
 * route that uses it must (a) verify the caller, and (b) scope every query to
 * the caller's workspace — otherwise the endpoint leaks or writes across
 * tenants. Call this at the top of every such handler:
 *
 *   const auth = await requireUser();
 *   if (auth.error) return auth.error;
 *   // auth.user        – the authenticated Supabase user
 *   // auth.workspaceId – the workspace to scope every service-role query to
 *   // auth.role        – the caller's role within that workspace
 *
 * It validates the session cookie against Supabase Auth (not just its
 * presence), then resolves the caller's workspace via workspace_members
 * (read through the RLS client, so a user can only ever see their own
 * membership). Returns a ready-to-return 401 when there is no valid user, or
 * 403 when the user belongs to no workspace.
 */
export async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      workspaceId: null,
      role: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      user,
      workspaceId: null,
      role: null,
      error: NextResponse.json({ error: 'No workspace assigned to this user' }, { status: 403 }),
    };
  }

  return {
    user,
    workspaceId: membership.workspace_id as string,
    role: (membership.role as string) ?? 'estimator',
    error: null,
  };
}
