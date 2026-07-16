'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Users, Shield, Eye, Pencil, Mail, Copy, Send, Trash2, Check } from 'lucide-react';
import type { UserRole } from '@/lib/types';

interface TeamMember {
  id: string;
  email: string | undefined;
  full_name: string | null;
  title: string | null;
  role: UserRole;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
}

const ROLE_INFO: Record<UserRole, { label: string; icon: React.ReactNode; bg: string; color: string; desc: string }> = {
  admin: {
    label: 'Admin',
    icon: <Shield size={12} />,
    bg: 'var(--bad-soft)',
    color: 'var(--bad)',
    desc: 'Full access — create, edit, delete, manage team',
  },
  estimator: {
    label: 'Estimator',
    icon: <Pencil size={12} />,
    bg: 'var(--info-soft)',
    color: 'var(--info)',
    desc: 'Create and edit bids, estimates, proposals',
  },
  viewer: {
    label: 'Viewer',
    icon: <Eye size={12} />,
    bg: 'var(--surface-3)',
    color: 'var(--text-muted)',
    desc: 'Read-only access — cannot create or edit',
  },
};

export default function TeamManager({ currentUserId }: { currentUserId: string }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('admin');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load team');
      setTeam(data.team);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/team/invite');
      if (!res.ok) return;
      const data = await res.json();
      setInvites(data.invitations ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); loadInvites(); }, [load, loadInvites]);

  async function updateRole(userId: string, role: UserRole) {
    setSaving(userId);
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setTeam(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    setLastLink(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send invite');
      setLastLink(data.link ?? null);
      setInviteEmail('');
      await loadInvites();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Could not send invite');
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(id: string) {
    try {
      const res = await fetch(`/api/team/invite?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) setInvites(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-subtle)' }}>
        <Loader2 size={18} className="animate-spin mr-2" /> Loading team…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-sm rounded-lg p-4"
        style={{ color: 'var(--bad)', background: 'var(--bad-soft)', border: '1px solid var(--bad-soft)' }}
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} style={{ color: 'var(--navy)' }} />
        <h2 className="label-mono text-[11px]" style={{ color: 'var(--navy)' }}>Team Members</h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-subtle)' }}>{team.length} member{team.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(Object.entries(ROLE_INFO) as [UserRole, typeof ROLE_INFO[UserRole]][]).map(([role, info]) => (
          <div
            key={role}
            className="p-2.5 rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1"
              style={{ background: info.bg, color: info.color }}
            >
              {info.icon} {info.label}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{info.desc}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Mail size={14} style={{ color: 'var(--navy)' }} />
          <h3 className="label-mono text-[11px]" style={{ color: 'var(--navy)' }}>Invite Collaborator</h3>
        </div>
        <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as UserRole)}
            className="text-sm rounded-lg px-3 py-2 outline-none cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="admin">Admin</option>
            <option value="estimator">Estimator</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--navy)' }}
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Invite
          </button>
        </form>

        {inviteError && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--bad)' }}>{inviteError}</p>
        )}

        {lastLink && (
          <div className="mt-3 p-2.5 rounded-lg flex items-center gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{lastLink}</span>
            <button
              onClick={() => copyLink(lastLink)}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
              style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>{inv.email}</span>
                <span className="capitalize" style={{ color: 'var(--text-subtle)' }}>{inv.role}</span>
                <span style={{ color: 'var(--text-subtle)' }}>&middot; pending</span>
                <button onClick={() => revokeInvite(inv.id)} title="Revoke" className="shrink-0" style={{ color: 'var(--text-subtle)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {team.map(member => {
          const roleInfo = ROLE_INFO[member.role];
          const isMe = member.id === currentUserId;
          return (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg transition-colors"
              style={{ border: '1px solid var(--border)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: '#1a3a5c' }}
              >
                {(member.full_name ?? member.email ?? '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {member.full_name || member.email}
                  </span>
                  {isMe && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}
                    >
                      You
                    </span>
                  )}
                </div>
                {member.full_name && <p className="text-[11px] truncate" style={{ color: 'var(--text-subtle)' }}>{member.email}</p>}
                {member.title && <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{member.title}</p>}
              </div>
              <div className="shrink-0">
                {isMe ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{ background: roleInfo.bg, color: roleInfo.color }}
                  >
                    {roleInfo.icon} {roleInfo.label}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {saving === member.id && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-subtle)' }} />}
                    <select
                      value={member.role}
                      onChange={e => updateRole(member.id, e.target.value as UserRole)}
                      disabled={saving === member.id}
                      className="text-[10px] font-bold px-2 py-1 rounded-full border-0 cursor-pointer outline-none"
                      style={{ background: roleInfo.bg, color: roleInfo.color }}
                    >
                      <option value="admin">Admin</option>
                      <option value="estimator">Estimator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
