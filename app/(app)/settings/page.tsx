import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const revalidate = 0;

export default async function SettingsPage({ searchParams }: { searchParams: { gmail?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();

  const gmailConnected = !!profile?.google_refresh_token;
  const gmailStatus = searchParams.gmail;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1a3a5c] mb-6">Settings</h1>

      {/* Status toast */}
      {gmailStatus === 'connected' && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 font-medium">
          ✓ Gmail connected successfully
        </div>
      )}
      {gmailStatus === 'error' && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-medium">
          Gmail connection failed. Check your Google Cloud credentials and try again.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Your Account</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <p className="text-sm font-medium text-gray-700">{profile?.full_name ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <p className="text-sm font-medium text-gray-700">{user?.email}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
            <p className="text-sm font-medium text-gray-700 capitalize">{profile?.role ?? 'estimator'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider mb-4">Integrations</h2>
        <div className="space-y-3">
          {/* Gmail */}
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-gray-700">Gmail</p>
              <p className="text-xs text-gray-400 mt-0.5">Scan inbox for bids, send proposals, sync contacts</p>
              {gmailConnected && profile?.gmail_synced_at && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Last synced: {new Date(profile.gmail_synced_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {gmailConnected ? (
                <>
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Connected ✓</span>
                  <Link href="/api/auth/google"
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium underline">
                    Reconnect
                  </Link>
                </>
              ) : (
                <Link href="/api/auth/google"
                  className="flex items-center gap-1.5 bg-[#1a3a5c] hover:bg-[#e87722] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                  Connect Gmail
                </Link>
              )}
            </div>
          </div>

          {/* Claude AI */}
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-gray-700">Claude AI</p>
              <p className="text-xs text-gray-400 mt-0.5">Estimates, contact extraction, proposal drafts</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${process.env.ANTHROPIC_API_KEY ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {process.env.ANTHROPIC_API_KEY ? 'Connected ✓' : 'Needs API Key'}
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2 setup notes — only shown if Gmail not yet connected */}
      {!gmailConnected && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
          <p className="font-bold mb-1">To connect Gmail:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>Create a project in Google Cloud Console</li>
            <li>Enable the Gmail API</li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback</code> as an authorized redirect URI</li>
            <li>Add <code className="bg-blue-100 px-1 rounded">GOOGLE_CLIENT_ID</code>, <code className="bg-blue-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, and <code className="bg-blue-100 px-1 rounded">GOOGLE_REDIRECT_URI</code> to your Vercel environment variables</li>
          </ol>
        </div>
      )}
    </div>
  );
}
