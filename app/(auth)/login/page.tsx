'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('redirect');
      const safe = r && r.startsWith('/') && !r.startsWith('//') ? r : '/dashboard';
      router.push(safe);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-[#e87722] px-3 py-2 rounded-lg">
          <span className="text-white font-black text-xl tracking-widest">NGU</span>
        </div>
        <div>
          <div className="text-[#1a3a5c] font-bold text-lg tracking-wide">BID PLATFORM</div>
          <div className="text-gray-400 text-xs">NGU Construction</div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-[#1a3a5c] mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Access your bid pipeline and estimates</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@nguconstruction.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a3a5c] transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need access?{' '}
          <a href="/signup" className="text-[#1a3a5c] font-semibold hover:text-[#e87722]">
            Create account
          </a>
        </p>
      </div>
    </div>
  );
}
