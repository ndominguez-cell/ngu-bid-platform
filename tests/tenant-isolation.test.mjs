import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildAcceptedMembership,
  buildWorkspaceInvitation,
  isInvitableRole,
} from '../lib/invitations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

function compactSql(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
}

test('cross-workspace reads are denied for core bid records by the final RLS contract', async () => {
  const tenantSql = compactSql(
    await source('supabase/migrations/20260612100000_tenant_scoping.sql'),
  );
  const hardeningSql = compactSql(
    await source('supabase/migrations/20260717120000_advisor_hardening.sql'),
  );

  for (const table of ['bids', 'estimates', 'proposals', 'documents']) {
    assert.match(
      tenantSql,
      new RegExp(`array\\[[^\\]]*['"]${table}['"]`),
      `${table} must be included in the workspace_member_all policy loop`,
    );
  }

  assert.match(tenantSql, /using \(is_workspace_member\(workspace_id\)\)/);
  assert.match(tenantSql, /with check \(is_workspace_member\(workspace_id\)\)/);
  assert.match(hardeningSql, /alter function public\.is_workspace_member\(uuid\) set schema private/);
  assert.match(hardeningSql, /create or replace function private\.is_workspace_member\(ws uuid\)/);
  assert.doesNotMatch(hardeningSql, /drop function[^;]*is_workspace_member/i);
});

test('invite creation is pinned to the authenticated caller workspace', async () => {
  const callerWorkspace = 'workspace-a';
  const maliciousBody = {
    workspace_id: 'workspace-b',
    email: 'collaborator@example.com',
    role: 'viewer',
  };

  const insert = buildWorkspaceInvitation({
    workspaceId: callerWorkspace,
    email: maliciousBody.email,
    role: maliciousBody.role,
    token: 'synthetic-token',
    invitedBy: 'admin-a',
  });

  assert.equal(insert.workspace_id, callerWorkspace);
  assert.equal(Object.hasOwn(insert, 'workspaceId'), false);

  const route = await source('app/api/team/invite/route.ts');
  assert.match(route, /workspaceId:\s*auth\.workspaceId!/);
  assert.doesNotMatch(route, /body\.workspace_id|body\[['"]workspace_id['"]\]/);
  assert.match(route, /\.eq\('workspace_id', auth\.workspaceId\)/);
});

test('invite acceptance cannot escalate a stored or request-supplied role', async () => {
  assert.equal(isInvitableRole('owner'), false);

  const accepted = buildAcceptedMembership(
    {
      workspace_id: 'workspace-a',
      role: 'viewer',
      requested_role: 'owner',
    },
    'user-a',
  );
  assert.deepEqual(accepted, {
    workspace_id: 'workspace-a',
    user_id: 'user-a',
    role: 'viewer',
  });

  assert.equal(
    buildAcceptedMembership({ workspace_id: 'workspace-a', role: 'owner' }, 'user-a'),
    null,
  );

  const route = await source('app/api/invite/accept/route.ts');
  assert.match(route, /buildAcceptedMembership\(invite, user\.id\)/);
  assert.doesNotMatch(route, /body\.role|body\[['"]role['"]\]/);

  const hardeningSql = compactSql(
    await source('supabase/migrations/20260717120000_advisor_hardening.sql'),
  );
  assert.match(
    hardeningSql,
    /workspace_invitations_role_check.*check \(role in \('admin', 'estimator', 'viewer'\)\)/,
  );
});

test('advisor migration keeps security helpers private and policy-callable', async () => {
  const sql = compactSql(
    await source('supabase/migrations/20260717120000_advisor_hardening.sql'),
  );

  for (const signature of [
    'get_user_role()',
    'is_workspace_member(uuid)',
    'shares_workspace_with(uuid)',
  ]) {
    const escaped = signature.replace(/[()]/g, '\\$&');
    assert.match(sql, new RegExp(`alter function public\\.${escaped} set schema private`));
    assert.match(sql, new RegExp(`grant execute on function private\\.${escaped} to authenticated`));
  }

  assert.match(sql, /grant usage on schema private to authenticated/);
  assert.match(sql, /or private\.shares_workspace_with\(id\)/);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = id\)/);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = id\)/);
  assert.match(sql, /id = \(select auth\.uid\(\)\)/);
});

test('service-only tables have explicit deny-all markers', async () => {
  const sql = compactSql(
    await source('supabase/migrations/20260717120000_advisor_hardening.sql'),
  );

  for (const table of ['ai_rate_limits', 'auto_leads']) {
    assert.match(sql, new RegExp(`create policy [^;]+ on public\\.${table} for all to anon, authenticated using \\(false\\) with check \\(false\\)`));
  }
  assert.match(sql, /to_regclass\('public\.auto_leads'\)/);
});

test('all 17 advisor-reported foreign keys have covering indexes', async () => {
  const sql = compactSql(
    await source('supabase/migrations/20260717120000_advisor_hardening.sql'),
  );
  const expected = [
    ['bid_activity', 'bid_id'],
    ['bid_activity', 'user_id'],
    ['bids', 'company_id'],
    ['bids', 'contact_id'],
    ['contacts', 'company_id'],
    ['conversations', 'bid_id'],
    ['conversations', 'contact_id'],
    ['documents', 'bid_id'],
    ['documents', 'uploaded_by'],
    ['documents', 'estimate_id'],
    ['estimates', 'bid_id'],
    ['estimates', 'created_by'],
    ['proposals', 'bid_id'],
    ['proposals', 'estimate_id'],
    ['proposals', 'sent_by'],
    ['workspace_invitations', 'accepted_by'],
    ['workspace_invitations', 'invited_by'],
  ];

  assert.equal(expected.length, 17);
  for (const [table, column] of expected) {
    assert.match(
      sql,
      new RegExp(`create index if not exists [a-z0-9_]+ on public\\.${table}\\(${column}\\)`),
      `missing covering index for ${table}.${column}`,
    );
  }
});
