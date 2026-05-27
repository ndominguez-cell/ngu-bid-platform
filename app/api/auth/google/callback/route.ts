import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error`);
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

  if (!res.ok) {
    return NextResponse.redirect(`${appUrl}/settings?gmail=error`);
  }

  const tokens = await res.json();
  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const supabase = createServiceClient();
  await supabase.from('profiles').update({
    google_refresh_token: tokens.refresh_token,
    google_access_token: tokens.access_token,
    google_token_expiry: expiry,
  }).eq('id', userId);

  return NextResponse.redirect(`${appUrl}/settings?gmail=connected`);
}
