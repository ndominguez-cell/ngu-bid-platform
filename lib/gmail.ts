import { createServiceClient } from '@/lib/supabase/server';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('google_refresh_token, google_access_token, google_token_expiry')
    .eq('id', userId)
    .single();

  // Tokens are stored encrypted at rest (legacy plaintext passes through).
  const refreshToken = decryptSecret(profile?.google_refresh_token);
  const accessToken = decryptSecret(profile?.google_access_token);

  if (error || !refreshToken) {
    throw new Error('Gmail not connected. Please connect Gmail in Settings.');
  }

  const expiry = profile?.google_token_expiry ? new Date(profile.google_token_expiry) : new Date(0);
  const isExpired = expiry.getTime() - Date.now() < 60_000; // refresh 1 min early

  if (!isExpired && accessToken) {
    return accessToken;
  }

  // Refresh the access token
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('profiles').update({
    google_access_token: encryptSecret(tokens.access_token),
    google_token_expiry: newExpiry,
  }).eq('id', userId);

  return tokens.access_token as string;
}

export async function gmailFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
}

export function buildMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): string {
  const lines = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body,
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}
