# A3 Senior Code Review

Branch reviewed: `feature/a3-tenant-scoping`  
Commit reviewed: `299937e`  
Mode: read-only review; no application, config, SQL, or migration changes

## Findings

| Severity | file:line | issue | suggested fix |
|---|---|---|---|
| Blocker | `supabase/migrations/20260612100000_tenant_scoping.sql:88-92`; `app/(auth)/signup/page.tsx:21-25` | The backfill grants every existing profile membership in the NGU workspace. Signup was public before A3, so this includes test accounts and any uninvited account that already exists, not just authorized NGU staff. Those users immediately pass `requireUser()` and receive NGU row access through both RLS and service-role routes. | Audit `auth.users`/`profiles` before rollout and insert only an explicit allowlist of authorized NGU user IDs. Do not infer tenant membership from "account existed before migration." Remove/quarantine unknown accounts and add an acceptance test using a pre-existing uninvited user. |
| Blocker | `supabase/migrations/20260101000000_initial_schema.sql:283-296`; `supabase/migrations/20260612100000_tenant_scoping.sql:123-150` | A3 scopes database rows but does not replace the Storage policies. `docs_read` and `docs_delete` still allow every authenticated user to read or delete every object in the private `documents` bucket. The new workspace-prefixed upload path does not enforce authorization by itself. | Replace the Storage policies with predicates that require the first path segment to equal a workspace in which `auth.uid()` is a member. Cover select, insert, update, and delete. Revoke/drop the bucket-wide authenticated policies in the same migration. |
| High | `app/api/auth/google/route.ts:17-25`; `app/api/auth/google/callback/route.ts:7-10,37-42`; `middleware.ts:12-16` | The Google callback is not safely user-owned. OAuth `state` is the raw user UUID, the callback is public, and the service-role update trusts that UUID. A forged or replayed callback can write Google tokens to another user's profile. Calling the state parameter "identity" is not an integrity check. | Generate a cryptographically random, single-use OAuth state bound to the initiating authenticated user in an HttpOnly/SameSite cookie or server-side store. Validate and consume it in the callback before updating `profiles`; never take the target user ID directly from callback input. |
| High | `supabase/migrations/20260101000000_initial_schema.sql:188-197`; `app/api/team/route.ts:11-13,53-55` | The signup trigger trusts `raw_user_meta_data.role`. A caller can bypass the UI and sign up through Supabase Auth with `role: 'admin'`, creating a globally privileged profile. The team route still uses that profile role for authorization. Removing role from `/api/profile` did not close this path. | Never accept authorization roles from signup metadata. Create profiles with a fixed non-privileged value, and assign workspace roles only through controlled membership creation/invitation logic. Move team authorization to `workspace_members.role`. |
| High | `app/api/bids/[id]/route.ts:10-15`; `app/api/proposals/[id]/send/route.ts:13-18`; `supabase/migrations/20260101000000_initial_schema.sql:110-151`; `supabase/migrations/20260612100000_tenant_scoping.sql:59-66` | Service-role embedded selects do not automatically apply the parent row's `workspace_id` predicate to embedded children. The parent bid/proposal is scoped, but `estimates(*)`, `proposals(*)`, and `bids(...)` are joined only through their ordinary foreign keys. The schema does not enforce that parent and child `workspace_id` values match. A malformed cross-workspace relation can therefore be returned. | Enforce tenant-consistent relationships in the database, preferably with composite unique keys and composite foreign keys such as `(workspace_id, bid_id)`. Until then, avoid service-role embedded selects: fetch each related table separately with its own `.eq('workspace_id', workspaceId)`, or use the request-scoped client so child RLS applies. |
| High | `app/api/estimates/route.ts:17-18,89-115`; `app/api/proposals/draft/route.ts:39-43,95-105` | Inserts stamp their own `workspace_id`, but caller-supplied foreign keys are not fully validated. Estimate creation accepts any `bid_id`. Proposal draft scopes an optional estimate lookup, but if it is missing/cross-tenant the route still inserts the original `estimate_id`. This permits cross-workspace relationship injection when another tenant's predictable ID is supplied. | Resolve every supplied parent ID with both ID and workspace filters and reject with 404 when it is not found. Insert only the ID returned by that scoped lookup. Add database constraints that require parent and child workspace IDs to match. |
| High | `app/api/gmail/detect-bids/route.ts:37-51,146-180`; `supabase/migrations/20260101000000_initial_schema.sql:49-50` | `nextBidId()` is scoped per workspace, but `bids.id` remains a globally unique primary key. A second workspace will independently generate `BID-2026-001` and collide with the first workspace. Concurrent requests in one workspace can also read the same maximum and generate the same next ID. Insert errors are ignored, so the route may then insert a conversation referencing an existing bid and report success. | Separate the database identity from the display number: use a UUID primary key and a `bid_number` with `unique(workspace_id, bid_number)`. Allocate the number atomically in PostgreSQL (counter row/RPC with row lock, sequence strategy, or advisory lock) and check every insert error before creating child rows. |
| High | `lib/auth.ts:36-49`; `supabase/migrations/20260612100000_tenant_scoping.sql:95-103`; examples at `app/api/bids/route.ts:27-28` and `app/api/estimates/route.ts:90-93` | The migration and code are not overlap-compatible. New code against an unmigrated DB queries a missing `workspace_members` table and writes a missing `workspace_id` column. Old code against the migrated DB omits a now-`NOT NULL` column. `requireUser()` also discards the membership query error and turns schema/runtime failures into a misleading 403. | Use an expand/backfill/contract rollout: create nullable columns/tables and policies first, deploy code that stamps/scopes workspace IDs, verify/backfill, then enforce `NOT NULL` and remove old policies. Return a 500 for membership lookup errors rather than treating them as no membership. |
| High | `middleware.ts:1,19-44`; `HANDOFF.md:9-37,114-120`; `next.config.mjs:6-31` | Verdict: do not deploy the untracked middleware as-is. It recreates an Edge middleware bundle and reintroduces `@supabase/ssr`, after the repository history first removed that import, then made middleware a no-op, then deleted it following `MIDDLEWARE_INVOCATION_FAILED`. The async-hooks shim remains, but the known-safe final state was no middleware. A full matcher makes any recurrence affect every request. | Leave middleware deleted while API routes and the app layout perform real auth. If global middleware is still desired, validate a preview deployment and compiled Edge bundle first, keep a narrow matcher, and retain route-level `requireUser()` as the authorization boundary. |
| Medium | `app/api/team/route.ts:11-13,53-55,64-75`; `lib/auth.ts:53-57`; `supabase/migrations/20260612100000_tenant_scoping.sql:23-29` | Workspace authorization has two role sources. `requireUser()` returns `workspace_members.role`, but the team route authorizes and updates `profiles.role`, which is global. This breaks the per-workspace role model and will prevent a new `owner` membership from managing settings/team unless the profile is separately promoted. | Make `workspace_members.role` the sole workspace authorization source. Check `auth.role` for owner/admin and update the target membership row scoped by both workspace and user. Treat `profiles` as user identity data, not tenant authorization. |
| Medium | `lib/auth.ts:36-42` | `requireUser()` silently selects the oldest membership. This is acceptable only while every user belongs to exactly one workspace; it becomes ambiguous as soon as invitations or a workspace switcher exist. | Document and enforce the one-workspace invariant for Part C, or add an explicit active workspace selection validated against membership. Do not infer it forever from oldest membership. |
| Low | `app/api/bids/[id]/route.ts:26-33`; `app/api/estimates/[id]/route.ts:16-24` | Cross-tenant IDs are correctly filtered out, but update routes translate the zero-row `.single()` result to 400 or 500 rather than 404. This is inconsistent with the read/send/reanalyze routes and makes ordinary not-found behavior look like a server failure. | Detect the PostgREST no-row result and consistently return 404 for a missing or cross-tenant resource. Keep the response non-disclosing. |
| Low | `lib/auth.ts:24-58` | By inspection, `if (auth.error) return auth.error` correlates the success branch with non-null `user` and `workspaceId`; no definite strict-mode error was identified. The return type is nevertheless inferred rather than declared, so a future edit could break that narrowing. A compiler run was not possible because this clone has no installed `node_modules`. | Declare an explicit discriminated result type, for example `{ ok: true; user; workspaceId: string; role } | { ok: false; error: NextResponse }`, and narrow on `ok`. Run `tsc --noEmit` in CI. |

## Complete `app/api` Query Inventory

This inventory covers every `.from('bids'|'estimates'|'proposals'|'documents'|'conversations'|'companies'|'contacts')` occurrence under `app/api`.

| file:line | operation | tenant-scoping result |
|---|---|---|
| `app/api/bids/route.ts:11` | Read bids | OK: `.eq('workspace_id', auth.workspaceId)` at line 13. |
| `app/api/bids/route.ts:27` | Insert bid | OK: caller workspace forced at line 28. |
| `app/api/bids/[id]/route.ts:11` | Read bid plus estimates/proposals | Parent OK at line 14; embedded children are not independently scoped. See High finding. |
| `app/api/bids/[id]/route.ts:27` | Update bid | OK: workspace is forced in the update and filtered at line 30. |
| `app/api/bids/[id]/route.ts:43` | Delete bid | OK: workspace filter at line 46. |
| `app/api/bids/[id]/find-plans/route.ts:77` | Read bid | OK: workspace filter at line 80. |
| `app/api/bids/[id]/find-plans/route.ts:164` | Auto-save plans URL | OK: workspace filter at line 167. |
| `app/api/estimates/route.ts:90` | Insert estimate | Workspace stamped at line 92, but supplied `bid_id` is not scoped/validated. |
| `app/api/estimates/route.ts:108` | Insert document rows | Workspace stamped at line 109, but supplied `bid_id` and storage path are trusted. |
| `app/api/estimates/[id]/route.ts:17` | Update estimate | OK: workspace filter at line 20. |
| `app/api/estimates/[id]/csv/route.ts:11` | Read estimate | OK: workspace filter at line 14. |
| `app/api/estimates/[id]/reanalyze/route.ts:51` | Read estimate | OK: workspace filter at line 54. |
| `app/api/estimates/[id]/reanalyze/route.ts:108` | Update estimate | OK: workspace filter at line 116. |
| `app/api/estimates/[id]/reanalyze/route.ts:123` | Insert document rows | Workspace stamped at line 124; client-supplied storage paths are not prefix-validated. |
| `app/api/estimates/presign/route.ts:17` | Supabase Storage bucket selection, not a DB-table query | Upload key is workspace-prefixed at line 14. Database Storage policies remain globally permissive. |
| `app/api/proposals/draft/route.ts:36` | Read bid | OK: workspace filter on the same chain. |
| `app/api/proposals/draft/route.ts:41` | Read estimate | Read is scoped, but a missing result is ignored and the raw ID is later inserted. |
| `app/api/proposals/draft/route.ts:96` | Insert proposal | Workspace stamped at line 98; relationship validation is incomplete. |
| `app/api/proposals/[id]/send/route.ts:14` | Read proposal plus bid | Parent OK at line 17; embedded bid is not independently scoped. |
| `app/api/proposals/[id]/send/route.ts:50` | Update proposal | OK: workspace filter at line 55. |
| `app/api/proposals/[id]/send/route.ts:57` | Insert conversation | Workspace stamped at line 58; relies on proposal/bid relationship integrity. |
| `app/api/gmail/detect-bids/route.ts:42` | Read latest bid ID | Workspace filter at line 44, but global primary-key and concurrency problems remain. |
| `app/api/gmail/detect-bids/route.ts:92` | Read bid by Gmail thread | OK: workspace filter at line 95. |
| `app/api/gmail/detect-bids/route.ts:149` | Insert detected bid | Workspace stamped at line 150; insert errors are ignored. |
| `app/api/gmail/detect-bids/route.ts:172` | Insert inbound conversation | Workspace stamped at line 173; insert errors are ignored. |
| `app/api/gmail/sync/route.ts:50` | Read conversation by thread | OK: workspace filter at line 53. |
| `app/api/gmail/sync/route.ts:96` | Upsert company | OK: workspace stamped and conflict target is `workspace_id,name`. |
| `app/api/gmail/sync/route.ts:109` | Upsert contact | OK: workspace stamped and conflict target is `workspace_id,email`. |
| `app/api/gmail/sync/route.ts:127` | Insert conversation | OK: workspace stamped at line 128. |
| `app/api/seed/route.ts:82` | Upsert bids | Workspace is stamped through `mapped` at lines 73-79. The global `onConflict: 'id'` can reassign an existing colliding ID to NGU and should not be used after multi-tenant launch. |

No top-level target-table read/update/delete call is missing a workspace predicate, and no target-table insert/upsert omits `workspace_id`. The remaining tenant risks are relationship integrity, embedded service-role reads, Storage RLS, and ID design.

## Checklist Verdicts

### Embedded selects

The foreign key plus parent filter is not a complete tenant boundary. It is safe only while every child row's `workspace_id` is guaranteed to equal its parent, and the current database does not guarantee that. Because the query uses the service-role client, child RLS is bypassed. Treat both embedded selects as unsafe under malformed data.

### Type safety

No definite strict-mode error was found in the `auth.error` pattern by inspection. The success return is the only branch with `error: null`, `workspaceId: string`, and non-null `user`, so the guard should narrow the inferred union. An explicit `ok` discriminant is still preferable, and a real `tsc --noEmit` run remains outstanding because dependencies are absent locally.

### Migration ordering

The change assumes the migration has already run, while the migration's immediate `NOT NULL` enforcement assumes the new code is already running. This is not a safe rolling deployment. New code on old schema fails on missing tables/columns; old code on new schema fails inserts that omit `workspace_id`.

### Gmail upserts

The matching unique indexes exist:

- `companies(workspace_id, name)` at `supabase/migrations/20260612100000_tenant_scoping.sql:119`
- `contacts(workspace_id, email)` at `supabase/migrations/20260612100000_tenant_scoping.sql:120`

They match `onConflict: 'workspace_id,name'` and `onConflict: 'workspace_id,email'`.

### Left-alone routes

- `app/api/profile/route.ts` is correctly user-owned: both writes derive the target profile ID from the validated session user and do not accept another user ID.
- `app/api/auth/google/callback/route.ts` is not safe to leave as-is. It is a public service-role write keyed by untrusted OAuth state.

### Cross-tenant runtime behavior

The newly scoped `.single()` reads intentionally turn a cross-tenant ID into not-found:

- Bid detail API: `app/api/bids/[id]/route.ts:10-16`
- Find plans: `app/api/bids/[id]/find-plans/route.ts:76-83`
- Estimate CSV: `app/api/estimates/[id]/csv/route.ts:10-17`
- Estimate reanalysis initial lookup: `app/api/estimates/[id]/reanalyze/route.ts:50-58`
- Proposal send: `app/api/proposals/[id]/send/route.ts:13-20`
- Proposal draft bid lookup: `app/api/proposals/draft/route.ts:36-37`

That 404 behavior is intended tenant isolation, not a regression. The exceptions are update routes that currently return 400/500 for the same zero-row condition, and the optional estimate lookup in proposal drafting, which does not reject the missing/cross-tenant estimate before insertion.

## Handoff to Claude (Cowork)

1. Stop the migration from auto-enrolling every existing profile into NGU; use an audited allowlist.
2. Close Storage: replace bucket-wide authenticated read/delete/upload policies with workspace-prefix membership policies.
3. Remove client-controlled signup roles and move authorization to `workspace_members.role`.
4. Fix OAuth state before treating the Google callback as user-owned.
5. Redesign bid identity before onboarding workspace #2: UUID primary key, per-workspace display number, atomic allocation, checked insert errors.
6. Enforce tenant-consistent foreign keys and independently scope service-role embedded relations.
7. Validate every caller-supplied parent ID and storage path before inserting estimates, proposals, or documents.
8. Roll A3 out as expand/backfill/contract rather than deploying the current migration and code in either order.
9. Keep the untracked middleware out of deployment unless a preview deployment proves the Edge bundle safe.
10. Normalize cross-tenant/missing update behavior to 404 and add strict type-checking to CI.

## External starter-kit security notes (2026-06-15)

The external repositories reviewed for the architecture follow-up do not change the A3 findings above. They reinforce several implementation boundaries:

- [Auth0's B2B SaaS starter](https://github.com/auth0-developer-hub/auth0-b2b-saas-starter) is a strong checklist for organization creation, invitations, RBAC, SSO, and member administration. Do not copy its global middleware into this project: it uses Auth0's middleware/client model, targets a newer Next.js generation, and does not address this repo's prior Edge `MIDDLEWARE_INVOCATION_FAILED` crash. Reproduce the flow with Supabase sessions and server-side membership checks.
- [Open SaaS](https://github.com/wasp-lang/open-saas) and [Async Labs SaaS](https://github.com/async-labs/saas) enforce tenancy primarily through their application architectures. Neither is evidence that service-role Supabase queries can trust RLS. In this app, service-role access still bypasses RLS, so explicit `workspace_id` scoping remains mandatory on every query.
- Invitation and team-role examples should be treated as behavioral references, not copied authorization code. `workspace_members.role` should remain this app's authoritative role source; signup metadata, profile fields, OAuth state, route parameters, and storage paths are untrusted inputs.
- The starter repositories are permissively licensed, while [System Design Primer](https://github.com/donnemartin/system-design-primer) uses CC BY 4.0. Catalogs such as [Awesome OSS SaaS](https://github.com/vihar/awesome-oss-saas), [Free for Developers](https://github.com/ripienaar/free-for-dev), and [Public APIs](https://github.com/public-apis/public-apis) do not confer a common license or security posture on the projects they list. Verify each selected dependency's upstream license, maintenance, data handling, and tenant-isolation behavior.
