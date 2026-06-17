import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  // Identity is derived from the caller's OWN session, never from the URL.
  // (Previously the target user id came straight from the `state` param, so a
  // forged callback could write Google tokens onto another user's profile.)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // CSRF: the state Google echoes back must match the HttpOnly cookie we set
  // when starting the flow. Consume the cookie on every exit path.
  const cookieState = req.cookies.get('google_oauth_state')?.value;

  const fail = () => {
    const r = NextResponse.redirect(`${appUrl}/settings?gmail=error`);
    r.cookies.delete('google_oauth_state');
    return r;
  };

  if (oauthError || !code || !user || !state || !cookieState || state !== cookieState) {
    return fail();
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) return fail();

  const tokens = await res.json();
  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const service = createServiceClient();
  const { error: updateError } = await service.from('profiles').update({
    google_refresh_token: tokens.refresh_token,
    google_access_token: tokens.access_token,
    google_token_expiry: expiry,
  }).eq('id', user.id);

  if (updateError) return fail();

  const ok = NextResponse.redirect(`${appUrl}/settings?gmail=connected`);
  ok.cookies.delete('google_oauth_state');
  return ok;
}
