import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1a3a5c] mb-6">Settings</h1>

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
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-700">Gmail</p>
              <p className="text-xs text-gray-400">Bid email scanning and proposal sending</p>
            </div>
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-700">Claude AI</p>
              <p className="text-xs text-gray-400">Estimates, contact extraction, proposal drafts</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${process.env.ANTHROPIC_API_KEY ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {process.env.ANTHROPIC_API_KEY ? 'Connected' : 'Needs API Key'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
