import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Gate for API routes that use the service-role client.
 *
 * The service-role client bypasses all Postgres row-level security, so any
 * route that uses it must verify the caller first — otherwise the endpoint is
 * readable/writable by anyone on the public internet. Call this at the top of
 * every such handler:
 *
 *   const auth = await requireUser();
 *   if (auth.error) return auth.error;
 *   // ...auth.user is the authenticated Supabase user
 *
 * It validates the session cookie against Supabase Auth (not just its presence),
 * returning a ready-to-return 401 response when there is no valid user.
 */
export async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}
