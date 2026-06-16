# Tier 1 Chassis Hardening Plan - Role, Invites, Bid IDs, FKs

Date: 2026-06-16

Repo: `ngu-bid-platform`

Status: read-only analysis captured for Claude Code. Do not run migrations from this note without partner Supabase access and a live-data audit.

## Context

This app is a Next.js 14 + Supabase multi-tenant SaaS chassis. Tenancy is:

- `workspaces`
- `workspace_members`
- `workspace_id` on every business table
- RLS via `is_workspace_member()`

Relevant existing files:

- `supabase/migrations/20260612100000_tenant_scoping.sql`
- `supabase/migrations/20260615120000_security_tier0.sql`
- `lib/auth.ts`
- `nickdom0923AgentNotes/11_CURSOR_A3_REVIEW.md`
- `nickdom0923AgentNotes/12_CODEX_A3_REVIEW_AND_STRUCTURE.md`
- `nickdom0923AgentNotes/13_TIER0_SECURITY_FIXES_2026-06-15.md`

The goal is to harden this into a reusable chassis that can host multiple companies, each owner inviting their own employees.

## Partner Supabase Access Required

Nick only has Vercel. The partner must handle all Supabase-side live operations:

- Run SQL migrations.
- Audit `auth.users` / `profiles`.
- Replace blanket NGU backfill with an explicit allowlist.
- Disable public Supabase Auth signup when invite/workspace creation endpoints are ready.
- Validate and fix cross-workspace FK mismatches before validating constraints.
- Run bid-ID expand/backfill/contract migrations.
- Add or verify RLS policies/functions in Supabase.

Nick can add Vercel env vars, deploy code, and coordinate with the partner.

## 1. Unify Role Model

### Current Hotspots

- `lib/auth.ts:24-58` returns `workspace_members.role`, but currently returns an inferred shape and drops membership query errors.
- `app/api/team/route.ts:7-78` still authorizes against `profiles.role` and updates `profiles.role`.
- `app/(app)/settings/page.tsx:9-119` reads `profile?.role` and shows team management from the global profile role.
- `app/(app)/settings/ProfileEditor.tsx:6-129` presents role as part of profile editing, even though `/api/profile` ignores role.
- `lib/types.ts:9` excludes the existing DB role `owner`.
- `supabase/migrations/20260101000000_initial_schema.sql:188-197` still has the old signup trigger that reads `raw_user_meta_data.role`.
- `supabase/setup/01_full_setup.sql:207-215` still has the old signup trigger that reads `raw_user_meta_data.role`.
- `lib/supabase/schema.sql:283-301`, `supabase/migrations/20260101000000_initial_schema.sql:300-304`, and `supabase/setup/01_full_setup.sql:319-323` still document/use `get_user_role()` from `profiles.role`.

### Code Diff

```diff
diff --git a/lib/types.ts b/lib/types.ts
@@
-export type UserRole = 'admin' | 'estimator' | 'viewer';
+export type UserRole = 'owner' | 'admin' | 'estimator' | 'viewer';
```

```diff
diff --git a/app/api/team/route.ts b/app/api/team/route.ts
@@
-import { createClient, createServiceClient } from '@/lib/supabase/server';
+import { createServiceClient } from '@/lib/supabase/server';
 import { requireUser } from '@/lib/auth';
 import type { UserRole } from '@/lib/types';
+
+const MANAGE_TEAM_ROLES: UserRole[] = ['owner', 'admin'];
+const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'estimator', 'viewer'];
@@
 export async function GET() {
   const auth = await requireUser();
-  if (auth.error) return auth.error;
-
-  const supabase = createClient();
-  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
-  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
+  if (!auth.ok) return auth.error;
+  if (!MANAGE_TEAM_ROLES.includes(auth.role)) {
+    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
+  }
@@
   const { data: members } = await serviceClient
     .from('workspace_members')
-    .select('user_id')
+    .select('user_id, role, created_at')
     .eq('workspace_id', auth.workspaceId);
   const memberIds = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
+  const memberMap = Object.fromEntries((members ?? []).map((m: { user_id: string; role: string; created_at: string }) => [m.user_id, m]));
@@
   const { data: profiles } = await serviceClient
     .from('profiles')
-    .select('id, full_name, role, title, created_at')
+    .select('id, full_name, title, created_at')
     .in('id', [...memberIds]);
@@
-      role: (profileMap[u.id]?.role ?? 'estimator') as UserRole,
-      created_at: profileMap[u.id]?.created_at ?? u.created_at,
+      role: memberMap[u.id]?.role as UserRole,
+      created_at: memberMap[u.id]?.created_at ?? profileMap[u.id]?.created_at ?? u.created_at,
@@
 export async function PATCH(req: NextRequest) {
   const auth = await requireUser();
-  if (auth.error) return auth.error;
-
-  const supabase = createClient();
-  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
-  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
+  if (!auth.ok) return auth.error;
+  if (!MANAGE_TEAM_ROLES.includes(auth.role)) {
+    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
+  }
@@
-  if (!userId || !['admin', 'estimator', 'viewer'].includes(role)) {
+  if (!userId || !ASSIGNABLE_ROLES.includes(role)) {
     return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
   }
@@
   const { data: targetMembership } = await serviceClient
     .from('workspace_members')
-    .select('user_id')
+    .select('user_id, role')
     .eq('workspace_id', auth.workspaceId)
     .eq('user_id', userId)
     .maybeSingle();
@@
-  const { error } = await serviceClient.from('profiles').update({ role }).eq('id', userId);
+  if (targetMembership.role === 'owner') {
+    return NextResponse.json({ error: 'Owner role cannot be changed here' }, { status: 400 });
+  }
+
+  const { error } = await serviceClient
+    .from('workspace_members')
+    .update({ role })
+    .eq('workspace_id', auth.workspaceId)
+    .eq('user_id', userId);
```

```diff
diff --git a/app/(app)/settings/page.tsx b/app/(app)/settings/page.tsx
@@
 import TeamManager from './TeamManager';
+import type { UserRole } from '@/lib/types';
@@
-  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
+  const { data: profile } = await supabase
+    .from('profiles')
+    .select('full_name, title, google_refresh_token, gmail_synced_at')
+    .eq('id', user!.id)
+    .single();
+  const { data: membership } = await supabase
+    .from('workspace_members')
+    .select('role')
+    .eq('user_id', user!.id)
+    .order('created_at', { ascending: true })
+    .limit(1)
+    .single();
+  const role = (membership?.role ?? 'viewer') as UserRole;
@@
-          initialRole={profile?.role ?? 'estimator'}
+          initialRole={role}
@@
-      {profile?.role === 'admin' && (
+      {['owner', 'admin'].includes(role) && (
```

```diff
diff --git a/app/(app)/settings/ProfileEditor.tsx b/app/(app)/settings/ProfileEditor.tsx
@@
-  const [role, setRole] = useState<UserRole>(initialRole);
@@
-    setRole(initialRole);
@@
-        body: JSON.stringify({ full_name: name, title, role }),
+        body: JSON.stringify({ full_name: name, title }),
@@
-          {editing ? (
-            <select
-              value={role}
-              onChange={e => setRole(e.target.value as UserRole)}
-              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1a3a5c] capitalize"
-            >
-              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
-            </select>
-          ) : (
-            <p className="text-sm font-medium text-gray-700 capitalize">{role}</p>
-          )}
+          <p className="text-sm font-medium text-gray-700 capitalize">{initialRole}</p>
```

Also remove `ROLES` if no longer used.

### SQL Migration

`20260615120000_security_tier0.sql` already stops trusting `raw_user_meta_data.role` for live migrations. Still clean up canonical setup/schema files so future installs do not reintroduce it.

```sql
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

drop function if exists get_user_role();

-- Contract phase only after deployed code no longer reads profiles.role:
alter table profiles drop column if exists role;
```

Replace the unsafe blanket membership backfill in `supabase/migrations/20260612100000_tenant_scoping.sql:88-92` before live run:

```sql
-- Partner must fill real audited UUIDs/roles.
insert into workspace_members (workspace_id, user_id, role) values
  (ws, 'OWNER_USER_UUID_HERE', 'owner'),
  (ws, 'ESTIMATOR_USER_UUID_HERE', 'estimator')
on conflict (workspace_id, user_id) do update set role = excluded.role;
```

### Rollout

Expand:

- Deploy code that reads `workspace_members.role`.
- Keep `profiles.role` present temporarily.
- Audit existing `auth.users` / `profiles`.
- Backfill `workspace_members` only from explicit allowlist.

Backfill:

- Assign each existing legitimate user exactly one NGU workspace membership and role.
- Leave test/unknown users unenrolled or delete them from `auth.users`.

Contract:

- Drop `profiles.role`.
- Drop stale `get_user_role()`.
- Remove role from profile UI entirely.

## 2. Invite Flow

### Design

Add an `invitations` table with:

- `token_hash`, not raw token
- `workspace_id`
- `email`
- `role`
- `expires_at`
- `status`
- `invited_by`
- `accepted_by`
- timestamps

New API routes:

- `POST /api/invitations`: owner/admin sends invite.
- `POST /api/invitations/accept`: authenticated user accepts invite.
- Optional `GET /invite/accept?token=...`: UI page that signs user in or routes to invite-aware signup.

Resend sends email inside `POST /api/invitations` after inserting the pending invitation.

### SQL Migration

```sql
create extension if not exists citext;

create table if not exists invitations (
  id uuid primary key default uuid_generate_v4(),
  token_hash text not null unique,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email citext not null,
  role text not null check (role in ('admin','estimator','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists invitations_pending_email_key
  on invitations(workspace_id, lower(email::text))
  where status = 'pending';

drop trigger if exists invitations_updated_at on invitations;
create trigger invitations_updated_at before update on invitations
  for each row execute procedure update_updated_at();

create or replace function workspace_role(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select role
  from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1
$$;

create or replace function is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select workspace_role(ws) in ('owner','admin')
$$;

alter table invitations enable row level security;

drop policy if exists "invitation_read" on invitations;
create policy "invitation_read" on invitations
  for select to authenticated
  using (
    is_workspace_admin(workspace_id)
    or lower(email::text) = lower(auth.jwt()->>'email')
  );

drop policy if exists "invitation_manage" on invitations;
create policy "invitation_manage" on invitations
  for all to authenticated
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));

create or replace function accept_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype;
begin
  select * into inv
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found or inv.status <> 'pending' or inv.expires_at <= now() then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(inv.email::text) <> lower(auth.jwt()->>'email') then
    raise exception 'Invitation email does not match authenticated user';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = inv.id;

  return inv.workspace_id;
end;
$$;

grant execute on function accept_invitation(text) to authenticated;
```

### Code Sketch

Install `resend` and add env vars:

```diff
diff --git a/package.json b/package.json
@@
     "react-dom": "^18",
+    "resend": "^4.0.0"
```

```diff
diff --git a/.env.local.example b/.env.local.example
@@
 NEXT_PUBLIC_APP_URL=http://localhost:3000
+RESEND_API_KEY=re_...
+INVITE_FROM_EMAIL="NGU Bid Platform <invites@your-domain.com>"
```

`app/api/invitations/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

const resend = new Resend(process.env.RESEND_API_KEY);
const INVITE_ROLES: UserRole[] = ['admin', 'estimator', 'viewer'];

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  if (!['owner', 'admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email || !INVITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(token)}`;
  const service = createServiceClient();

  const { error } = await service.from('invitations').insert({
    token_hash: tokenHash,
    workspace_id: auth.workspaceId,
    email,
    role,
    invited_by: auth.user.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await resend.emails.send({
    from: process.env.INVITE_FROM_EMAIL!,
    to: email,
    subject: 'You have been invited',
    html: `<p>You have been invited to join this workspace.</p><p><a href="${acceptUrl}">Accept invitation</a></p>`,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

`app/api/invitations/accept/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const { data, error } = await supabase.rpc('accept_invitation', {
    p_token_hash: hashToken(token),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ workspaceId: data });
}
```

### Close Public Self-Signup

`app/(auth)/signup/page.tsx:21-25` currently calls `supabase.auth.signUp()` directly. Replace with one of two controlled paths:

- Invite signup: must include valid invite token and accepted email.
- Workspace creation signup: creates a new workspace and owner membership.

Do not allow open signup into an existing workspace. Disable public Supabase Auth signup in Supabase Dashboard once the controlled endpoints are live.

### Rollout

Expand:

- Add invitations table/functions/RLS.
- Add Resend env vars and package.
- Add invite create/accept endpoints.

Backfill:

- Create invites only for new users.
- Existing legitimate NGU users stay in `workspace_members`.

Contract:

- Disable direct public signup.
- Hide or replace `/signup` with invite-aware or workspace-creation flow.

## 3. Bid-ID Redesign

### Current Hotspots

- `app/api/gmail/detect-bids/route.ts:37-52` computes `BID-YYYY-NNN` in app code.
- `app/api/gmail/detect-bids/route.ts:146-180` ignores bid insert errors and then inserts a conversation against the maybe-not-created bid ID.
- `app/api/bids/route.ts:23-31` trusts manual `id` from request body.
- `app/(app)/bids/new/page.tsx:13-32` and `:97-101` expose manual Bid ID.
- `app/(app)/bids/page.tsx:127-138`, `app/(app)/bids/[id]/page.tsx:45-60` display `id` as the bid number.
- `supabase/migrations/20260101000000_initial_schema.sql:49-50` defines `bids.id text primary key`.

### Final Schema

- `bids.id uuid primary key default uuid_generate_v4()`
- `bids.bid_number text not null`
- `unique(workspace_id, bid_number)`
- child `bid_id` columns become uuid FKs to `bids(id)`
- allocate `bid_number` atomically in Postgres

### Expand Migration

Use an expand/backfill/contract rollout. Do not rename/drop the existing text PK in the first migration.

```sql
create table if not exists bid_counters (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  year integer not null,
  next_value integer not null default 1,
  updated_at timestamptz default now(),
  primary key (workspace_id, year)
);

create or replace function allocate_bid_number(
  p_workspace_id uuid,
  p_year integer default extract(year from now())::int
)
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.bid_counters (workspace_id, year, next_value)
  values (p_workspace_id, p_year, 2)
  on conflict (workspace_id, year)
  do update set next_value = public.bid_counters.next_value + 1,
                updated_at = now()
  returning next_value - 1 into n;

  return 'BID-' || p_year || '-' || lpad(n::text, 3, '0');
end;
$$;

alter table bids add column if not exists uuid_id uuid default uuid_generate_v4();
alter table bids add column if not exists bid_number text;

update bids
set bid_number = id
where bid_number is null;

update bids
set uuid_id = uuid_generate_v4()
where uuid_id is null;

alter table bids alter column uuid_id set not null;
alter table bids alter column bid_number set not null;

create unique index if not exists bids_uuid_id_key on bids(uuid_id);
create unique index if not exists bids_workspace_bid_number_key on bids(workspace_id, bid_number);
```

Add parallel child UUID columns during expand:

```sql
alter table estimates add column if not exists bid_uuid uuid;
alter table documents add column if not exists bid_uuid uuid;
alter table proposals add column if not exists bid_uuid uuid;
alter table conversations add column if not exists bid_uuid uuid;
alter table bid_activity add column if not exists bid_uuid uuid;

update estimates e set bid_uuid = b.uuid_id from bids b where e.bid_id = b.id and e.bid_uuid is null;
update documents d set bid_uuid = b.uuid_id from bids b where d.bid_id = b.id and d.bid_uuid is null;
update proposals p set bid_uuid = b.uuid_id from bids b where p.bid_id = b.id and p.bid_uuid is null;
update conversations c set bid_uuid = b.uuid_id from bids b where c.bid_id = b.id and c.bid_uuid is null;
update bid_activity a set bid_uuid = b.uuid_id from bids b where a.bid_id = b.id and a.bid_uuid is null;

create index if not exists estimates_bid_uuid_idx on estimates(bid_uuid);
create index if not exists documents_bid_uuid_idx on documents(bid_uuid);
create index if not exists proposals_bid_uuid_idx on proposals(bid_uuid);
create index if not exists conversations_bid_uuid_idx on conversations(bid_uuid);
create index if not exists bid_activity_bid_uuid_idx on bid_activity(bid_uuid);
```

### Route Changes

`app/api/bids/route.ts` POST:

```ts
const { id: _id, workspace_id: _workspaceId, bid_number: _bidNumber, ...payload } = await req.json();
const { data: bidNumber, error: numberError } = await supabase.rpc('allocate_bid_number', {
  p_workspace_id: auth.workspaceId,
});
if (numberError || !bidNumber) {
  return NextResponse.json({ error: numberError?.message ?? 'Could not allocate bid number' }, { status: 500 });
}

const { data, error } = await supabase
  .from('bids')
  .insert({ ...payload, workspace_id: auth.workspaceId, bid_number: bidNumber })
  .select()
  .single();
```

`app/api/gmail/detect-bids/route.ts`:

```diff
-// Generate next bid ID: BID-YYYY-NNN
-async function nextBidId(...) { ... }
```

```diff
-      const bidId = await nextBidId(serviceClient, workspaceId);
+      const { data: bidNumber, error: numberError } = await serviceClient
+        .rpc('allocate_bid_number', { p_workspace_id: workspaceId });
+      if (numberError || !bidNumber) {
+        throw new Error(numberError?.message ?? 'Could not allocate bid number');
+      }
       const emailDate = new Date(internalDate).toISOString().split('T')[0];

-      await serviceClient.from('bids').insert({
+      const { data: createdBid, error: bidError } = await serviceClient.from('bids').insert({
         workspace_id: workspaceId,
-        id: bidId,
+        bid_number: bidNumber,
         thread_id: threadId,
@@
         status: 'New',
-      });
+      }).select('id, bid_number').single();
+      if (bidError || !createdBid) {
+        throw new Error(bidError?.message ?? 'Bid insert failed');
+      }
@@
         workspace_id: workspaceId,
-        bid_id: bidId,
+        bid_id: createdBid.id,
```

UI display:

- Replace `bid.id` user-facing labels with `bid.bid_number ?? bid.id`.
- Keep URLs using UUID `id`.
- Remove manual Bid ID input from `app/(app)/bids/new/page.tsx`.

### Rollout

Expand:

- Add `uuid_id`, `bid_number`, counter table/RPC.
- Add parallel child `bid_uuid` columns.
- Backfill.
- Deploy code that dual-writes both legacy and new columns if needed.

Backfill:

- Ensure all bids have `uuid_id` and `bid_number`.
- Ensure child rows have `bid_uuid`.
- Check for duplicate `(workspace_id, bid_number)`.

Contract:

- Rename `bids.id` text to `legacy_bid_number`.
- Rename `bids.uuid_id` to `id`.
- Rename child `bid_uuid` columns to `bid_id`.
- Recreate primary and foreign keys.

## 4. Cross-Workspace FK Integrity

### Current Hotspots

- `app/api/estimates/route.ts:17-18,89-115`: accepts caller `bid_id` and inserts own-workspace estimate/documents against it without resolving the parent.
- `app/api/proposals/draft/route.ts:39-43,95-105`: scoped optional estimate lookup, but does not reject missing/cross-workspace estimate and inserts raw `estimate_id`.
- `app/api/proposals/[id]/send/route.ts:13-25`: service-role embedded `bids(...)` relation can return malformed cross-workspace related data.
- `app/api/bids/[id]/route.ts:10-15`: service-role embedded `estimates(*)`, `proposals(*)` can return malformed cross-workspace children.
- `app/api/estimates/presign/route.ts:9-14`: storage path includes caller-provided `bidId`; resolve it if present.
- `app/api/estimates/[id]/reanalyze/route.ts:122-131`: document insert uses existing estimate's `bid_id`; this is safe after scoped estimate fetch, and DB FK should enforce it.

### SQL Migration

Before adding constraints, run mismatch audits:

```sql
select 'estimates_bad_bid' as check_name, e.id, e.workspace_id, e.bid_id, b.workspace_id as bid_workspace_id
from estimates e join bids b on b.id = e.bid_id
where e.bid_id is not null and e.workspace_id <> b.workspace_id;

select 'documents_bad_bid' as check_name, d.id, d.workspace_id, d.bid_id, b.workspace_id as bid_workspace_id
from documents d join bids b on b.id = d.bid_id
where d.bid_id is not null and d.workspace_id <> b.workspace_id;

select 'documents_bad_estimate' as check_name, d.id, d.workspace_id, d.estimate_id, e.workspace_id as estimate_workspace_id
from documents d join estimates e on e.id = d.estimate_id
where d.estimate_id is not null and d.workspace_id <> e.workspace_id;

select 'proposals_bad_bid' as check_name, p.id, p.workspace_id, p.bid_id, b.workspace_id as bid_workspace_id
from proposals p join bids b on b.id = p.bid_id
where p.bid_id is not null and p.workspace_id <> b.workspace_id;

select 'proposals_bad_estimate' as check_name, p.id, p.workspace_id, p.estimate_id, e.workspace_id as estimate_workspace_id
from proposals p join estimates e on e.id = p.estimate_id
where p.estimate_id is not null and p.workspace_id <> e.workspace_id;
```

Add composite uniqueness:

```sql
alter table bids add constraint bids_workspace_id_key unique (workspace_id, id);
alter table estimates add constraint estimates_workspace_id_key unique (workspace_id, id);
alter table companies add constraint companies_workspace_id_key unique (workspace_id, id);
alter table contacts add constraint contacts_workspace_id_key unique (workspace_id, id);
```

Add `not valid` composite FKs:

```sql
alter table estimates add constraint estimates_workspace_bid_fk
  foreign key (workspace_id, bid_id)
  references bids(workspace_id, id)
  on delete cascade
  not valid;

alter table documents add constraint documents_workspace_bid_fk
  foreign key (workspace_id, bid_id)
  references bids(workspace_id, id)
  on delete cascade
  not valid;

alter table documents add constraint documents_workspace_estimate_fk
  foreign key (workspace_id, estimate_id)
  references estimates(workspace_id, id)
  on delete set null
  not valid;

alter table proposals add constraint proposals_workspace_bid_fk
  foreign key (workspace_id, bid_id)
  references bids(workspace_id, id)
  on delete cascade
  not valid;

alter table proposals add constraint proposals_workspace_estimate_fk
  foreign key (workspace_id, estimate_id)
  references estimates(workspace_id, id)
  on delete set null
  not valid;

alter table conversations add constraint conversations_workspace_bid_fk
  foreign key (workspace_id, bid_id)
  references bids(workspace_id, id)
  on delete cascade
  not valid;

alter table bid_activity add constraint bid_activity_workspace_bid_fk
  foreign key (workspace_id, bid_id)
  references bids(workspace_id, id)
  on delete cascade
  not valid;
```

Validate only after fixing mismatches:

```sql
alter table estimates validate constraint estimates_workspace_bid_fk;
alter table documents validate constraint documents_workspace_bid_fk;
alter table documents validate constraint documents_workspace_estimate_fk;
alter table proposals validate constraint proposals_workspace_bid_fk;
alter table proposals validate constraint proposals_workspace_estimate_fk;
alter table conversations validate constraint conversations_workspace_bid_fk;
alter table bid_activity validate constraint bid_activity_workspace_bid_fk;
```

### Route Changes

`app/api/estimates/route.ts`:

```ts
let scopedBidId: string | null = null;
if (bid_id) {
  const { data: scopedBid, error: bidError } = await supabase
    .from('bids')
    .select('id')
    .eq('id', bid_id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });
  if (!scopedBid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  scopedBidId = scopedBid.id;
}

// Insert estimate/documents with bid_id: scopedBidId, never raw bid_id.
```

`app/api/proposals/draft/route.ts`:

```ts
const { data: bid, error: bidError } = await supabase
  .from('bids')
  .select('*')
  .eq('id', bid_id)
  .eq('workspace_id', auth.workspaceId)
  .single();
if (bidError || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

let estimate = null;
let scopedEstimateId: string | null = null;
if (estimate_id) {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimate_id)
    .eq('workspace_id', auth.workspaceId)
    .eq('bid_id', bid.id)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Estimate not found for this bid' }, { status: 404 });
  estimate = data;
  scopedEstimateId = data.id;
}

// Insert proposal with bid_id: bid.id, estimate_id: scopedEstimateId.
```

`app/api/bids/[id]/route.ts`:

```ts
const { data: bid, error } = await supabase
  .from('bids')
  .select('*')
  .eq('id', params.id)
  .eq('workspace_id', auth.workspaceId)
  .single();
if (error || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

const [{ data: estimates }, { data: proposals }] = await Promise.all([
  supabase.from('estimates').select('*').eq('bid_id', bid.id).eq('workspace_id', auth.workspaceId),
  supabase.from('proposals').select('*').eq('bid_id', bid.id).eq('workspace_id', auth.workspaceId),
]);

return NextResponse.json({ data: { ...bid, estimates: estimates ?? [], proposals: proposals ?? [] } });
```

`app/api/proposals/[id]/send/route.ts`:

```ts
const { data: proposal, error: propErr } = await serviceClient
  .from('proposals')
  .select('*')
  .eq('id', params.id)
  .eq('workspace_id', auth.workspaceId)
  .single();
if (propErr || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

const { data: bid, error: bidErr } = await serviceClient
  .from('bids')
  .select('id, gc_email, gc_name, project_name')
  .eq('id', proposal.bid_id)
  .eq('workspace_id', auth.workspaceId)
  .single();
if (bidErr || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
```

### Rollout

Expand:

- Add composite unique constraints.
- Add `not valid` composite FKs.
- Deploy route changes that resolve all caller-supplied parent IDs by scoped lookup.

Backfill:

- Run mismatch audits.
- Fix or delete malformed cross-workspace relationships.

Contract:

- Validate constraints.
- Return to embedded service-role selects only after constraints are validated, or keep separate scoped reads permanently.

## 5. `requireUser()`

### Current Hotspot

`lib/auth.ts:36-49` ignores membership query errors and turns schema/runtime failures into a misleading 403. It also has an inferred return type.

### Code Diff

```diff
diff --git a/lib/auth.ts b/lib/auth.ts
@@
 import { NextResponse } from 'next/server';
 import { createClient } from '@/lib/supabase/server';
+import type { User } from '@supabase/supabase-js';
+import type { UserRole } from '@/lib/types';
+
+export type RequireUserResult =
+  | { ok: true; user: User; workspaceId: string; role: UserRole }
+  | { ok: false; error: NextResponse };
@@
-export async function requireUser() {
+export async function requireUser(): Promise<RequireUserResult> {
   const supabase = createClient();
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     return {
-      user: null,
-      workspaceId: null,
-      role: null,
+      ok: false,
       error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
     };
   }
 
-  const { data: membership } = await supabase
+  const { data: membership, error: membershipError } = await supabase
     .from('workspace_members')
     .select('workspace_id, role')
     .eq('user_id', user.id)
     .order('created_at', { ascending: true })
     .limit(1)
     .maybeSingle();
 
+  if (membershipError) {
+    console.error('[requireUser] membership lookup failed:', membershipError);
+    return {
+      ok: false,
+      error: NextResponse.json({ error: 'Failed to load workspace membership' }, { status: 500 }),
+    };
+  }
+
   if (!membership) {
     return {
-      user,
-      workspaceId: null,
-      role: null,
+      ok: false,
       error: NextResponse.json({ error: 'No workspace assigned to this user' }, { status: 403 }),
     };
   }
 
   return {
+    ok: true,
     user,
     workspaceId: membership.workspace_id as string,
-    role: (membership.role as string) ?? 'estimator',
-    error: null,
+    role: membership.role as UserRole,
   };
 }
```

Update all API call sites:

```diff
-  if (auth.error) return auth.error;
+  if (!auth.ok) return auth.error;
```

Current call sites are under:

- `app/api/bids/route.ts`
- `app/api/bids/[id]/route.ts`
- `app/api/bids/[id]/find-plans/route.ts`
- `app/api/estimates/route.ts`
- `app/api/estimates/presign/route.ts`
- `app/api/estimates/[id]/route.ts`
- `app/api/estimates/[id]/reanalyze/route.ts`
- `app/api/estimates/[id]/csv/route.ts`
- `app/api/gmail/sync/route.ts`
- `app/api/gmail/detect-bids/route.ts`
- `app/api/proposals/draft/route.ts`
- `app/api/proposals/[id]/send/route.ts`
- `app/api/team/route.ts`

### Rollout

Code-only. Deploy after the `workspace_members` table exists. If code may be deployed before migrations, guard the route deployment behind the expand migration.

## Suggested Order for Claude Code

1. Patch `requireUser()` and all call sites to `auth.ok`.
2. Patch role model to use `workspace_members.role`; remove `profiles.role` reads from team/settings/profile UI.
3. Add invitation schema/endpoints/Resend env docs, but do not disable signup until routes are deployed.
4. Add bid-ID expand migration and code changes that allocate `bid_number` atomically.
5. Add FK integrity migration as `not valid`, route-scoped parent resolution, then validate after data audit.
6. Only then do contract cleanup: drop `profiles.role`, drop stale `get_user_role()`, migrate bid primary key fully to UUID, and disable public signup.

