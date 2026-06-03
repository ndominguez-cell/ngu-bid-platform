import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ProfileEditor from './ProfileEditor';
import GmailDisconnectButton from './GmailDisconnectButton';
import TeamManager from './TeamManager';

export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: { gmail?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();

  const gmailConnected = !!profile?.google_refresh_token;
  const gmailStatus = searchParams.gmail;

  return (
    <div className="mx-auto w-full max-w-2xl px-7 pb-20 pt-6">
      <h1 className="text-[28px] font-medium leading-tight mb-6" style={{ color: 'var(--text)' }}>Settings</h1>

      {/* Status toasts */}
      {gmailStatus === 'connected' && (
        <div
          className="mb-4 text-[13px] rounded px-4 py-3 font-medium"
          style={{ background: 'var(--ok-soft)', color: 'var(--ok)', border: '1px solid var(--ok)' }}
        >
          ✓ Gmail connected successfully
        </div>
      )}
      {gmailStatus === 'error' && (
        <div
          className="mb-4 text-[13px] rounded px-4 py-3 font-medium"
          style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad)' }}
        >
          Gmail connection failed. Check your Google Cloud credentials and try again.
        </div>
      )}

      {/* Account */}
      <div className="card p-6 mb-5">
        <ProfileEditor
          userId={user!.id}
          initialName={profile?.full_name ?? null}
          initialTitle={profile?.title ?? null}
          initialRole={profile?.role ?? 'estimator'}
          email={user!.email ?? ''}
        />
      </div>

      {/* Integrations */}
      <div className="card p-6 mb-5">
        <h2 className="card-title mb-4">Integrations</h2>
        <div className="space-y-3">

          {/* Gmail */}
          <div className="flex items-center justify-between p-4 rounded" style={{ border: '1px solid var(--border)' }}>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Gmail</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Scan inbox for bids, send proposals, sync contacts
              </p>
              {gmailConnected && profile?.gmail_synced_at && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                  Last synced: {new Date(profile.gmail_synced_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {gmailConnected ? (
                <>
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded"
                    style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}
                  >
                    Connected ✓
                  </span>
                  <Link
                    href="/api/auth/google"
                    className="text-[12px] font-semibold underline transition-colors"
                    style={{ color: 'var(--text-subtle)' }}
                  >
                    Reconnect
                  </Link>
                  <GmailDisconnectButton />
                </>
              ) : (
                <Link href="/api/auth/google" className="btn btn-primary btn-sm">
                  Connect Gmail
                </Link>
              )}
            </div>
          </div>

          {/* Claude AI */}
          <div className="flex items-center justify-between p-4 rounded" style={{ border: '1px solid var(--border)' }}>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Claude AI</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Estimates, contact extraction, proposal drafts
              </p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded"
              style={process.env.ANTHROPIC_API_KEY
                ? { background: 'var(--ok-soft)', color: 'var(--ok)' }
                : { background: 'var(--warn-soft)', color: 'var(--warn)' }}
            >
              {process.env.ANTHROPIC_API_KEY ? 'Connected ✓' : 'Needs API Key'}
            </span>
          </div>
        </div>
      </div>

      {/* Team Management — admin only */}
      {profile?.role === 'admin' && (
        <div className="card p-6 mb-5">
          <TeamManager currentUserId={user!.id} />
        </div>
      )}

      {/* Gmail setup instructions */}
      {!gmailConnected && (
        <div
          className="mt-4 rounded p-4 text-[12px]"
          style={{ background: 'var(--info-soft)', border: '1px solid var(--info-soft)', color: 'var(--info)' }}
        >
          <p className="font-bold mb-1">To connect Gmail:</p>
          <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-2)' }}>
            <li>Create a Google Cloud project and enable the Gmail API</li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>{process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback</code> as an authorized redirect URI</li>
            <li>Add <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>GOOGLE_CLIENT_ID</code>, <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>GOOGLE_CLIENT_SECRET</code>, and <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>GOOGLE_REDIRECT_URI</code> to Vercel env vars</li>
          </ol>
        </div>
      )}
    </div>
  );
}
