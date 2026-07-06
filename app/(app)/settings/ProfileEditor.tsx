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
        <h2 className="label-mono text-[11px]" style={{ color: 'var(--navy)' }}>Your Account</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            style={{ color: 'var(--text-subtle)' }}
          >
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {error && <span className="text-xs" style={{ color: 'var(--bad)' }}>{error}</span>}
            {saved && <span className="text-xs font-semibold" style={{ color: 'var(--ok)' }}>Saved</span>}
            <button onClick={handleCancel} disabled={saving}
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color: 'var(--text-subtle)' }}
            >
              <X size={12} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="btn btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="label-mono block mb-1">Name</label>
          {editing ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{name || '—'}</p>
          )}
        </div>

        <div>
          <label className="label-mono block mb-1">Title</label>
          {editing ? (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Estimator, Project Manager"
              className="w-full rounded border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title || '—'}</p>
          )}
        </div>

        <div>
          <label className="label-mono block mb-1">Email</label>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{email}</p>
        </div>

        <div>
          <label className="label-mono block mb-1">Role</label>
          {editing ? (
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="rounded border px-3 py-2 text-sm outline-none capitalize"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>{role}</p>
          )}
        </div>
      </div>
    </div>
  );
}
