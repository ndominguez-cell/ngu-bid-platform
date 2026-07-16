'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface InviteInfo {
  valid: boolean;
  expired: boolean;
  accepted: boolean;
  email: string;
  role: string;
  workspaceName: string;
}

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      setInfo(res.ok ? data : null);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setSessionEmail(user?.email ?? null);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function accept() {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept invitation');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation');
      setWorking(false);
    }
  }

  const redirectParam = `?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-[#e87722] px-3 py-2 rounded-lg">
          <span className="text-white font-black text-xl tracking-widest">NGU</span>
        </div>
        <div>
          <div className="text-[#1a3a5c] font-bold text-lg tracking-wide">BID PLATFORM</div>
          <div className="text-gray-400 text-xs">Collaborator invitation</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {loading ? (
          <p className="text-sm text-gray-500 text-center">Loading invitation…</p>
        ) : !info ? (
          <p className="text-sm text-center text-red-600">This invitation link is invalid.</p>
        ) : info.accepted ? (
          <p className="text-sm text-center text-gray-600">This invitation has already been used.</p>
        ) : info.expired ? (
          <p className="text-sm text-center text-gray-600">This invitation has expired. Ask for a new one.</p>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[#1a3a5c] mb-1">You&apos;re invited</h1>
            <p className="text-sm text-gray-500 mb-5">
              Join <span className="font-semibold text-[#1a3a5c]">{info.workspaceName}</span> as{' '}
              <span className="font-semibold capitalize">{info.role}</span>, for{' '}
              <span className="font-semibold">{info.email}</span>.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            {sessionEmail && sessionEmail.toLowerCase() === info.email.toLowerCase() ? (
              <button
                onClick={accept}
                disabled={working}
                className="w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {working ? 'Joining…' : 'Accept invitation'}
              </button>
            ) : sessionEmail ? (
              <p className="text-sm text-gray-600 text-center">
                You&apos;re signed in as <span className="font-semibold">{sessionEmail}</span>, but this invite is
                for <span className="font-semibold">{info.email}</span>. Sign out and sign in with that email to accept.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center">Sign in or create your account to continue.</p>
                <a
                  href={`/login${redirectParam}`}
                  className="block text-center w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                >
                  Sign in
                </a>
                <a
                  href={`/signup${redirectParam}`}
                  className="block text-center w-full border border-[#1a3a5c] text-[#1a3a5c] hover:bg-gray-50 font-bold py-2.5 rounded-lg transition-colors text-sm"
                >
                  Create account
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
