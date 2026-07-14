import { createClient, createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ProfileEditor from './ProfileEditor';
import GmailDisconnectButton from './GmailDisconnectButton';
import TeamManager from './TeamManager';
import SettingsTabs from './SettingsTabs';

export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: { gmail?: string; tab?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, title, role, gmail_synced_at')
    .eq('id', user!.id)
    .single();

  // Gmail connection status depends on google_refresh_token, which is no longer
  // readable by the authenticated role (note-21 H1 fix). Read it server-side
  // only, via the service client.
  const service = createServiceClient();
  const { data: creds } = await service
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', user!.id)
    .single();
  const gmailConnected = !!creds?.google_refresh_token;
  const gmailStatus = searchParams.gmail;
  const activeTab = searchParams.tab ?? 'general';

  return (
    <div className="mx-auto w-full max-w-[1100px] px-7 pb-20 pt-6">
      <h1 className="text-[28px] font-medium leading-tight mb-2" style={{ color: 'var(--text)' }}>Settings</h1>
      <p className="text-[13.5px] mb-6" style={{ color: 'var(--text-muted)' }}>
        Manage your account, estimating defaults, integrations, and team
      </p>

      {/* Status toasts */}
      {gmailStatus === 'connected' && (
        <div
          className="mb-4 text-[13px] rounded px-4 py-3 font-medium"
          style={{ background: 'var(--ok-soft)', color: 'var(--ok)', border: '1px solid var(--ok)' }}
        >
          Gmail connected successfully
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

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'estimating', label: 'Estimating' },
          { id: 'integrations', label: 'Integrations' },
          { id: 'team', label: 'Team' },
          { id: 'notifications', label: 'Notifications' },
        ].map(t => (
          <Link
            key={t.id}
            href={`/settings${t.id === 'general' ? '' : `?tab=${t.id}`}`}
            scroll={false}
            className="-mb-px inline-flex items-center border-b-2 px-4 py-2.5 text-[13px] transition-colors"
            style={{
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
              borderColor: activeTab === t.id ? 'var(--orange)' : 'transparent',
              fontWeight: activeTab === t.id ? 500 : 400,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="card p-6">
            <ProfileEditor
              userId={user!.id}
              initialName={profile?.full_name ?? null}
              initialTitle={profile?.title ?? null}
              initialRole={profile?.role ?? 'estimator'}
              email={user!.email ?? ''}
            />
          </div>

          <div className="card p-6">
            <h2 className="card-title mb-4">Company Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-mono block mb-1.5">Company Name</label>
                <input
                  type="text"
                  defaultValue="NGU Construction"
                  className="w-full rounded border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">License Number</label>
                <input
                  type="text"
                  placeholder="e.g. CA-1234567"
                  className="w-full rounded border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Phone</label>
                <input
                  type="text"
                  placeholder="(555) 123-4567"
                  className="w-full rounded border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Website</label>
                <input
                  type="text"
                  placeholder="https://nguconstruction.com"
                  className="w-full rounded border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-primary btn-sm">Save Company Info</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estimating' && (
        <SettingsTabs />
      )}

      {activeTab === 'integrations' && (
        <div className="card p-6">
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
                      Connected
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
                {process.env.ANTHROPIC_API_KEY ? 'Connected' : 'Needs API Key'}
              </span>
            </div>

            {/* PlanHub placeholder */}
            <div className="flex items-center justify-between p-4 rounded" style={{ border: '1px solid var(--border)' }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>PlanHub</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Import bid invitations from PlanHub
                </p>
              </div>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded"
                style={{ background: 'var(--surface-2)', color: 'var(--text-subtle)' }}
              >
                Coming Soon
              </span>
            </div>

            {/* Procore placeholder */}
            <div className="flex items-center justify-between p-4 rounded" style={{ border: '1px solid var(--border)' }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Procore</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Sync projects and bid invitations
                </p>
              </div>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded"
                style={{ background: 'var(--surface-2)', color: 'var(--text-subtle)' }}
              >
                Coming Soon
              </span>
            </div>
          </div>

          {/* Gmail setup instructions */}
          {!gmailConnected && (
            <div
              className="mt-5 rounded p-4 text-[12px]"
              style={{ background: 'var(--info-soft)', border: '1px solid var(--info-soft)', color: 'var(--info)' }}
            >
              <p className="font-bold mb-1">To connect Gmail:</p>
              <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-2)' }}>
                <li>Create a Google Cloud project and enable the Gmail API</li>
                <li>Create OAuth 2.0 credentials (Web application type)</li>
                <li>Add the callback URI as an authorized redirect URI</li>
                <li>Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to Vercel env vars</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="card p-6">
          {profile?.role === 'admin' ? (
            <TeamManager currentUserId={user!.id} />
          ) : (
            <div className="text-center py-8">
              <p className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Team management is available to admins only
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                Contact your admin to manage team members and roles
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card p-6">
          <h2 className="card-title mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { label: 'New bid invitations', desc: 'Get notified when new bids are imported from Gmail', default: true },
              { label: 'Urgent deadlines', desc: 'Alert when a bid is due within 3 days', default: true },
              { label: 'Status changes', desc: 'Notify when a bid status is updated', default: false },
              { label: 'Team activity', desc: 'Get notified about team member actions', default: false },
              { label: 'Weekly digest', desc: 'Weekly summary of bid activity and pipeline status', default: true },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{n.label}</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{n.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer">
                  <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                  <div
                    className="w-9 h-5 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all"
                    style={{
                      background: 'var(--border)',
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 flex justify-end" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-sm">Save Preferences</button>
          </div>
        </div>
      )}
    </div>
  );
}
