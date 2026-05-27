'use client';

import { useState } from 'react';
import { Loader2, Pencil, Check, X } from 'lucide-react';

type UserRole = 'admin' | 'estimator' | 'viewer';

interface ProfileEditorProps {
  userId: string;
  initialName: string | null;
  initialTitle: string | null;
  initialRole: UserRole;
  email: string;
}

const ROLES: UserRole[] = ['admin', 'estimator', 'viewer'];

export default function ProfileEditor({ initialName, initialTitle, initialRole, email }: ProfileEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setName(initialName ?? '');
    setTitle(initialTitle ?? '');
    setRole(initialRole);
    setEditing(false);
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, title, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[#1a3a5c] uppercase tracking-wider">Your Account</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1a3a5c] font-semibold transition-colors">
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-500">{error}</span>}
            {saved && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
            <button onClick={handleCancel} disabled={saving}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-semibold transition-colors">
              <X size={12} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-[#1a3a5c] hover:bg-[#e87722] text-white font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a3a5c]"
            />
          ) : (
            <p className="text-sm font-medium text-gray-700">{name || '—'}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</label>
          {editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Estimator, Project Manager"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a3a5c]"
            />
          ) : (
            <p className="text-sm font-medium text-gray-700">{title || '—'}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
          <p className="text-sm font-medium text-gray-500">{email}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
          {editing ? (
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a3a5c] capitalize"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <p className="text-sm font-medium text-gray-700 capitalize">{role}</p>
          )}
        </div>
      </div>
    </div>
  );
}
