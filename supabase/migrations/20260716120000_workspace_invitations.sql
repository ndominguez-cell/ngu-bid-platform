-- ============================================================
-- Invite Collaborator: workspace_invitations (2026-07-16)
-- Additive only. Reuses the existing chassis (workspaces,
-- workspace_members, is_workspace_member(), uuid_generate_v4()).
-- Touches NO existing table. Safe to re-run (idempotent).
-- Run in: Supabase > SQL Editor > New Query > Run All.
-- ============================================================

create table if not exists workspace_invitations (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         text not null default 'admin'
                 check (role in ('owner','admin','estimator','viewer')),
  token        text not null unique,
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null
);

create index if not exists workspace_invitations_workspace_idx on workspace_invitations(workspace_id);
create index if not exists workspace_invitations_token_idx     on workspace_invitations(token);
create index if not exists workspace_invitations_email_idx     on workspace_invitations(lower(email));

alter table workspace_invitations enable row level security;

-- Members of a workspace may READ that workspace's invitations (so the
-- Team settings screen can list pending invites). All writes (create,
-- revoke, accept) go through the service-role API routes, consistent with
-- the rest of the schema. Acceptance by a not-yet-member is done via the
-- service role in /api/invite/accept, so no authenticated write policy is
-- needed here.
drop policy if exists "invitations_member_read" on workspace_invitations;
create policy "invitations_member_read" on workspace_invitations
  for select to authenticated
  using (is_workspace_member(workspace_id));
