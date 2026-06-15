# Codex A3 Review and Structure Proposal

Branch reviewed: `feature/a3-tenant-scoping`  
Commit reviewed: `299937e`  
Input read: `11_CURSOR_A3_REVIEW.md`  
Mode: independent read-only architecture review; no code or SQL changes

## A) Second-pass findings

| Severity | file:line | finding | suggested direction |
|---|---|---|---|
| Blocker | `supabase/migrations/20260612100000_tenant_scoping.sql:88-92` | The migration equates "has an existing profile" with "is authorized for NGU" and inserts every profile into the NGU workspace. Because self-signup was public, a pre-existing test or hostile account becomes an NGU member and passes both RLS and `requireUser()`. | Replace the blanket insert with an explicit, reviewed user-ID allowlist for the initial NGU membership. Audit existing accounts before migration and test a pre-existing uninvited account. |
| Blocker | `supabase/migrations/20260101000000_initial_schema.sql:283-296`; `app/api/estimates/presign/route.ts:12-18` | Storage object names are now prefixed with `workspaceId`, which is good, but Storage RLS still grants every authenticated user bucket-wide insert/read/delete. A caller can bypass the presign route and directly upload, list/read, or delete objects under another workspace prefix. Database `documents.workspace_id` does not protect `storage.objects`. | Replace all three broad Storage policies with prefix-plus-membership policies. Treat the first path segment as the workspace UUID and check `is_workspace_member(...)`. Include update as well as insert/select/delete. |
| Blocker | `app/api/gmail/detect-bids/route.ts:37-51,146-180`; `supabase/migrations/20260101000000_initial_schema.sql:49-50` | Per-workspace `nextBidId()` conflicts with a globally unique text primary key. Workspace #2 generates the same first number as NGU. Concurrent detection calls can also allocate the same number. The route ignores bid/conversation insert errors, so results can be internally inconsistent. | Use an immutable UUID primary key plus a display `bid_number`, unique by `(workspace_id, bid_number)`. Allocate the number atomically in PostgreSQL and make child creation conditional on a successful bid insert. |
| High | `app/api/estimates/route.ts:17-18,89-115`; `app/api/bids/[id]/route.ts:10-15` | Estimate creation does not verify that `bid_id` belongs to the caller's workspace. It can create an own-workspace estimate/document linked to another workspace's bid. The service-role bid embedded select can then return that mismatched child because the child relation is not workspace-filtered. | Scope and require the parent bid before insert. Add composite tenant foreign keys so `(workspace_id, bid_id)` must reference the same workspace. Fetch embedded service-role children with their own workspace filter until the invariant exists. |
| High | `app/api/proposals/draft/route.ts:39-43,95-105` | The optional estimate lookup is scoped, but a missing or cross-tenant estimate is not rejected. The route still inserts the caller-supplied `estimate_id`, creating a cross-workspace relationship if the UUID exists. It also does not verify that a valid estimate belongs to the selected bid. | Reject a supplied estimate ID unless the scoped lookup succeeds and `estimate.bid_id === bid.id`. Insert `estimate.id`, never the raw request value. Back this with a tenant-consistent composite foreign key. |
| High | `app/api/proposals/[id]/send/route.ts:13-25`; `app/api/bids/[id]/route.ts:10-15` | Both service-role embedded reads rely on relational consistency the database does not enforce. Parent filtering alone does not scope `bids(...)`, `estimates(*)`, or `proposals(*)`. The proposal send route could address email to a cross-workspace embedded bid if malformed data exists. | Read the related bid separately using both ID and `workspace_id`, or use an RLS client. Add database-level same-workspace relationship constraints before returning to embedded service-role selects. |
| High | `supabase/migrations/20260101000000_initial_schema.sql:188-197`; `app/api/team/route.ts:11-13,53-75`; `supabase/migrations/20260612100000_tenant_scoping.sql:23-29` | Authorization roles are split and one path remains client-controlled. The signup trigger accepts `raw_user_meta_data.role`; team authorization checks global `profiles.role`; the tenant model stores the real role in `workspace_members.role`. This permits signup-time profile admin creation and cannot represent different roles in different workspaces. | Ignore role metadata during signup, deprecate `profiles.role` for authorization, and check/update only the membership role scoped by `(workspace_id, user_id)`. |
| High | `supabase/migrations/20260612100000_tenant_scoping.sql:137-149`; representative mutation route `app/api/bids/route.ts:19-32` | Every workspace member receives `for all` RLS access, and normal mutation routes do not check `auth.role`. A `viewer` is not read-only; it can write through either the APIs or the request-scoped Supabase client. This is not a cross-tenant leak, but it contradicts the role model exposed in the UI. | Define route/RLS permissions by membership role: owner/admin manage workspace/team, estimator mutates business rows, viewer selects only. Centralize mutation authorization rather than relying on labels. |
| High | `app/api/auth/google/route.ts:17-25`; `app/api/auth/google/callback/route.ts:7-10,37-42` | Independent confirmation of the OAuth issue: state is a raw user UUID, not a nonce bound to the browser session. The public callback performs a service-role profile update using untrusted input. | Store a random one-time state server-side or in a signed HttpOnly cookie, bind it to the initiating user, validate/consume it, and derive the profile ID from that validated state. |
| High | `lib/auth.ts:36-49`; `supabase/migrations/20260612100000_tenant_scoping.sql:95-103` | Service-role routes are protected only by their explicit predicates; service role bypasses every business-table RLS policy. The current top-level target-table calls are scoped, but embedded relations and any future missed predicate have no database fallback. The code/migration pair also has no safe overlap window. | Prefer the request-scoped client for ordinary user CRUD. Reserve service role for admin/Auth/Google-token operations. For retained service-role routes, use shared repository helpers that require a workspace and adopt an expand/backfill/contract deployment. |
| Medium | `app/api/bids/[id]/find-plans/route.ts:161-169` | The find-plans auto-save update is correctly workspace-scoped, so it is not a tenant leak. However, the update result is ignored and `report.auto_saved = true` is set even if the database write fails. | Inspect the update error and only report `auto_saved` after a successful scoped update. |
| Medium | `app/api/seed/route.ts:73-84` | The seed route stamps NGU's workspace, but `upsert(..., { onConflict: 'id' })` uses the global bid primary key. A collision updates the existing row, including its `workspace_id`, rather than proving the row already belongs to NGU. | Remove the production seed endpoint after setup, or scope seed conflicts with the redesigned `(workspace_id, bid_number)` identity and refuse to update rows outside the target workspace. |
| Medium | `lib/auth.ts:36-42` | Active workspace selection is "oldest membership." That is deterministic but not an authorization UX. Invitations or multi-workspace users will silently operate in one workspace with no visible choice. | Keep a single-workspace invariant for the first customer-onboarding release, then add an explicit active-workspace cookie/profile field validated against membership. |
| Medium | `app/api/estimates/[id]/reanalyze/route.ts:10-34` | The requested Part B list says four hardcoded prompts, but there is a fifth NGU/Texas prompt in estimate reanalysis. Refactoring only the named four leaves a customer #2 path producing NGU-specific output. | Make reanalysis an `estimate_reanalysis` purpose in the same prompt-builder module during Part B. |

### Service-role/RLS verdict

For business tables, service role bypasses RLS completely. The explicit in-code workspace predicate is therefore the only top-level tenant guard in those routes. The A3 patch covered every direct target-table read/update/delete and stamps every direct insert/upsert, but RLS does not rescue:

- embedded service-role relations,
- caller-supplied cross-workspace foreign keys,
- Storage objects,
- a future route that forgets the predicate.

The request-scoped client is still appropriate where it is intentionally used, including `requireUser()` membership resolution and server-rendered pages. Those calls do receive RLS protection.

## B) Part B prompt-builder structure

### Proposed module

Create one module:

`lib/ai/workspace-prompts.ts`

```ts
export type WorkspacePromptSettings = {
  company_name: string;
  trades: string[];
  state: string;
  plan_sources: Array<{
    name: string;
    url: string;
    notes?: string;
  }>;
  signature_block: string;
};

export type PromptPurpose =
  | 'estimate'
  | 'estimate_reanalysis'
  | 'proposal'
  | 'find_plans'
  | 'detect_bids';

export async function loadWorkspacePromptSettings(
  client: SupabaseClient,
  workspaceId: string
): Promise<WorkspacePromptSettings>;

export function buildWorkspaceSystemPrompt(
  purpose: PromptPurpose,
  settings: WorkspacePromptSettings
): string;
```

`loadWorkspacePromptSettings()` should:

- Query `workspaces.settings` with `.eq('id', workspaceId).single()`.
- Receive only the already-authorized `auth.workspaceId`.
- Validate types, lengths, URLs, and non-empty trades.
- Normalize state consistently (for example `TX` plus an optional display name).
- Return no NGU-specific fallback. Backfill NGU's row with the current exact values; require new workspaces to finish onboarding before AI routes run.

`buildWorkspaceSystemPrompt()` should remain pure. It formats trusted workspace configuration into stable system instructions. Bid data, filenames, and email contents remain user-message content, separated from system policy. That also reduces prompt-injection risk from inbound Gmail text.

### Route integration

| route | call site |
|---|---|
| `app/api/estimates/route.ts` | After `requireUser()`, load settings once, call `buildWorkspaceSystemPrompt('estimate', settings)`, pass it through Anthropic's `system` field, and keep filenames/project context in the user message. |
| `app/api/proposals/draft/route.ts` | After the scoped bid/estimate reads, call `buildWorkspaceSystemPrompt('proposal', settings)`. The builder injects company name, trades/qualifications context, state, and `signature_block`. |
| `app/api/bids/[id]/find-plans/route.ts` | Replace the module-level constant with `buildWorkspaceSystemPrompt('find_plans', settings)`. Format `plan_sources` into the search ladder; keep the selected bid in the user message. |
| `app/api/gmail/detect-bids/route.ts` | Build one `detect_bids` system prompt per request. Put each raw email in a user message, not inside the system instructions. The state and trade list define relevance and expected extraction defaults. |
| `app/api/estimates/[id]/reanalyze/route.ts` | Include this fifth existing hardcoded prompt and call `buildWorkspaceSystemPrompt('estimate_reanalysis', settings)`. |

Do not load settings at module scope. Settings are tenant-specific and mutable. Load once per request, not once per email in a Gmail loop.

### Settings JSON schema

Minimal `workspaces.settings` value:

```json
{
  "schema_version": 1,
  "company_name": "NGU Construction",
  "trades": [
    "Concrete",
    "Earthwork",
    "Asphalt/Paving",
    "Drainage",
    "Utilities",
    "Masonry",
    "Structural Steel",
    "Striping",
    "Sitework"
  ],
  "state": "TX",
  "plan_sources": [
    {
      "name": "Texas SmartBuy / ESBD",
      "url": "https://www.txsmartbuy.gov/esbd",
      "notes": "Texas public solicitations"
    },
    {
      "name": "TxDOT",
      "url": "https://www.txdot.gov",
      "notes": "Highway and road projects"
    }
  ],
  "signature_block": "Nick Dominguez\nNGU Construction\nndominguez@nguconstruction.com"
}
```

Useful later additions, outside the minimal prompt contract: `default_city`, `market_region`, `reply_email`, `brand_color`, `logo_text`, and `onboarding_complete`.

### Minimal settings UI

Extend `app/(app)/settings/page.tsx` with a "Workspace" card above Integrations:

- Company name: text input.
- State/primary market: select or short text input.
- Trades: removable tags plus add field.
- Plan sources: repeatable name/URL rows.
- Proposal signature: multiline textarea with preview.

Add a client component such as `WorkspaceSettingsForm.tsx` and one API endpoint, for example `PATCH /api/workspace/settings`.

The endpoint should:

- Call `requireUser()`.
- Require membership role `owner` or `admin`.
- Validate and size-limit the JSON.
- Update only `workspaces.settings` for `.eq('id', auth.workspaceId)`.
- Merge known keys without deleting future/unknown versioned settings.

For NGU, backfill the settings row before switching the prompts so generated output remains equivalent. For a new workspace, disable AI actions or redirect to onboarding until required fields are complete.

## C) Part C signup -> workspace flow

### Recommended flow

Use a new migration to replace/extend the existing `handle_new_user()` trigger. Keep profile, workspace, and membership creation in one database transaction:

1. Signup collects `full_name`, `company_name`, and optionally `state`.
2. `supabase.auth.signUp()` sends only those non-authorization fields as metadata.
3. The `auth.users` trigger inserts `public.profiles` with no client-controlled role.
4. The trigger inserts one `public.workspaces` row with initial versioned settings.
5. The trigger inserts `(workspace_id, new.id, 'owner')` into `public.workspace_members`.
6. After email confirmation and first login, `requireUser()` resolves the new membership.
7. Redirect incomplete workspaces to the Settings onboarding card before enabling Gmail/AI actions.

The trigger function should be `security definer`, set a fixed empty `search_path`, fully qualify table/function names, trim and length-limit metadata, and fail the signup transaction if workspace or owner membership creation fails. Never accept `role`, `workspace_id`, or billing/plan fields from user metadata.

### Existing-user and invitation behavior

- Do not repeat A3's blanket "all profiles join NGU" behavior.
- Existing NGU users should be migrated through an explicit allowlist.
- New self-signups create a new workspace; they never join NGU based on email domain or account age.
- A later invitation flow should consume a signed, expiring invite and join the invited workspace instead of creating another one.
- Keep the first release single-workspace-per-user unless an active workspace selector is implemented.

### Role model

Use `workspace_members.role` as the only tenant authorization source:

- `owner`: workspace settings, team, destructive administration.
- `admin`: settings/team and normal business operations.
- `estimator`: create/update bids, estimates, proposals, CRM.
- `viewer`: read-only.

`profiles` should hold user identity fields and user-owned Gmail tokens, not workspace authorization.

## D) Open questions for Nick / Claude (Cowork)

1. Which exact existing user IDs are authorized NGU members for the initial migration? This must be decided before A3 is applied anywhere containing real data.
2. Should one user be limited to one workspace for customer #2, or is an active workspace switcher required immediately?
3. Is Gmail connection user-owned, as it is now, or should a workspace be able to nominate a shared sending/scanning mailbox?
4. Should `workspaces.name` be the canonical company name, with settings referencing it, or should `settings.company_name` be an independent prompt/branding override?
5. Should state be stored as an abbreviation, display name, or a richer market-region object for multi-state contractors?
6. Are plan sources structured name/URL records, or is a simple ordered list sufficient for the first settings UI?
7. Can bid IDs change to UUID primary keys plus display numbers before customer #2, or must external links/imports preserve the current text ID?
8. Should the known-safe no-middleware deployment remain, with auth in layout/routes, or is there a requirement for a global Edge gate despite the previous Vercel failure?
9. Should Part B include estimate reanalysis now? It is the fifth NGU/Texas prompt and otherwise remains customer-specific.
10. Is the public seed endpoint still needed after sandbox setup, or can it be removed before multi-tenant production?

## E) External repository assessment (2026-06-15)

### Executive decision

Do not replace this project's Next.js, Supabase, Postgres, or RLS foundation with any reviewed starter. The useful path is selective borrowing: use the B2B starters as product-flow and test-case references, then implement those ideas inside the current tenant model. Use the list repositories only to discover candidates that receive a separate security, maintenance, pricing, and licensing review.

| Repository | Relevance to NGU | Strengths | Weaknesses / risks | Recommended use |
|---|---|---|---|---|
| [wasp-lang/open-saas](https://github.com/wasp-lang/open-saas) | High as a pattern library; low as a replacement stack | Active and broad SaaS implementation covering billing providers, transactional email, background jobs, file upload, analytics, Playwright E2E, docs, and landing pages. Its cohesive examples can shorten design work for post-tenancy productization. | Built around Wasp, React, Node, and Prisma rather than Next.js API routes and Supabase. It does not solve this app's service-role/RLS boundary. Adopting it would be a rewrite, and its documented Windows workflow adds WSL/tooling overhead. | Study billing lifecycle, webhook handling, jobs, email, upload, and E2E organization. Reimplement only the needed behavior in the existing stack. |
| [async-labs/saas](https://github.com/async-labs/saas) | Low-medium | Concrete examples of team creation, invitations, team settings, Stripe team subscriptions, verified webhooks, SES email, S3 presigned uploads, logging, and websocket notifications. | Separate Next frontend plus Express API, MongoDB/Mongoose, MobX, Material UI, Passport, and app-level team authorization conflict with this repo's architecture. Copying code would add a second backend model and weaken the clarity of Postgres tenant enforcement. | Use as a secondary checklist for invite edge cases, webhook states, and presigned-upload behavior. Do not add its server or data stack. |
| [auth0-developer-hub/auth0-b2b-saas-starter](https://github.com/auth0-developer-hub/auth0-b2b-saas-starter) | Highest for Part C product design | Purpose-built B2B flows: signup plus organization creation, invitations, member administration, RBAC, profile/security settings, enterprise SSO, domain verification, JIT provisioning, and SCIM. These are close to the future workspace lifecycle. | Requires Auth0 as the identity and organization authority and currently targets a newer Next.js/React stack. Its global Auth0 middleware is not compatible with the existing Supabase auth design and is especially risky given this repo's prior Edge middleware crash. Adopting it creates duplicate identity, membership, and billing-source questions. | Use its screens, state transitions, failure cases, and role boundaries as the primary Part C reference. Implement them with Supabase Auth, `workspaces`, and `workspace_members`; do not import the Auth0 middleware or organization model. |
| [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) | Medium later; low for immediate A3 work | Clear reference material for queues, asynchronous workflows, backpressure, caching, availability, latency, and failure tradeoffs. It can guide extraction of long Anthropic or Gmail operations from request/response execution. | It is general architecture and interview material, not a production SaaS implementation. Applying internet-scale patterns too early would increase operational complexity without fixing tenancy or onboarding. Its CC BY 4.0 license also differs from software-library licenses. | Consult targeted sections when introducing jobs for plan finding, Gmail synchronization, or reanalysis. Require job status, idempotency, retries, rate limits, and per-workspace concurrency controls. |
| [ripienaar/free-for-dev](https://github.com/ripienaar/free-for-dev) | Medium for operations and cost control | Large, categorized shortlist of free tiers for monitoring, error tracking, transactional email, CI, testing, security, storage, feature flags, and hosting. Useful while validating the product with a small customer count. | A catalog is not an architecture or endorsement. Free-tier terms, limits, retention, support, and pricing change; vendor selection can create data-residency, privacy, reliability, and lock-in risks. Optimizing solely for free tiers often causes later migration work. | Use to build a small vendor shortlist, then verify every candidate against official documentation, current pricing, security requirements, and expected usage before adoption. |
| [vihar/awesome-oss-saas](https://github.com/vihar/awesome-oss-saas) | Low-medium | Convenient discovery list for self-hosted analytics, support, communication, observability, content, and developer tools. It may reveal inexpensive alternatives when a specific operational need becomes real. | Curation depth, project activity, security posture, licenses, and deployment quality vary. Self-hosting transfers patching, backups, monitoring, and incident response to this small team. Adding several tools would distract from A3, Part B, and Part C. | Use only for candidate discovery after defining a concrete requirement. Prefer managed services until self-hosting has a measured cost, privacy, or control advantage. |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | Low now; potentially medium for later enrichment | Broad discovery catalog that includes business, government, geocoding, weather, and open-data APIs. Plausible future features include address normalization, map context, Census/regional enrichment, weather context, and public procurement discovery. | Listed APIs have uneven uptime, authentication, terms, data quality, geographic coverage, and maintenance. The list does not vet them for commercial dependence. Generic APIs are not a substitute for direct, official Texas procurement or plan-source integrations. | Keep out of core A3/B/C work. For a validated feature, choose an authoritative API and place it behind an adapter with timeouts, caching, quotas, source provenance, and graceful degradation. |

### Priority and timing

1. **Before customer #2:** finish the A3 blockers, tenant-consistent foreign keys, storage namespacing, atomic bid numbering, and migration rollout. No external starter code is more important than closing those isolation gaps.
2. **Part B settings:** the proposed local prompt-builder needs no new framework. Keep settings in the workspace record and test prompt construction directly.
3. **Part C onboarding:** use the Auth0 starter as the main UX and lifecycle checklist. Use Open SaaS for E2E test organization and transactional-email patterns, and Async Labs only as a second source for invitation edge cases.
4. **After onboarding works:** inspect Open SaaS billing and job patterns before implementing subscriptions or long-running AI work. Use System Design Primer to validate the queue and retry model.
5. **When an operational need is approved:** use Free for Developers and Awesome OSS SaaS to produce a shortlist, not an automatic choice. Verify upstream repositories and official vendor terms.
6. **When customers request enrichment:** evaluate Public APIs entries against an explicit feature and authoritative data source. Avoid speculative integrations.

### Explicit non-recommendations

- Do not rewrite the product in Wasp to gain Open SaaS features.
- Do not replace Supabase Auth with Auth0 merely to obtain organization UI.
- Do not add an Express/MongoDB backend beside Supabase for Async Labs compatibility.
- Do not copy any starter's app-level organization checks as a substitute for scoped service-role queries and RLS.
- Do not deploy global Edge middleware from another starter without reproducing and resolving this repo's prior Vercel crash.
- Do not self-host several OSS services while the core tenant and onboarding paths remain incomplete.
- Do not make a catalog-listed public API a hard dependency of bid creation, estimating, or proposal delivery without an outage-tolerant adapter.

### Most valuable follow-up inspections

If the roadmap reaches these features, review only the relevant source modules rather than cloning whole architectures:

- Auth0 starter: organization creation, invite acceptance, member-role editing, and onboarding state transitions.
- Open SaaS: subscription/webhook state model, background-job boundaries, transactional-email abstraction, and Playwright user journeys.
- Async Labs: invitation expiration/resend behavior and S3 presign validation, compared against this app's required workspace-prefixed storage paths.
- System Design Primer: task queues and backpressure before moving Anthropic/Gmail work to asynchronous execution.

The practical conclusion is that the Auth0 and Open SaaS repositories are very helpful design references for this SaaS. Async Labs is a limited secondary reference. The other four are useful research indexes or architecture reading, but they should not influence the core implementation until a specific post-onboarding need exists.
