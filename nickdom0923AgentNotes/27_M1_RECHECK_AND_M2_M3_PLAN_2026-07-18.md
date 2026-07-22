# M1 recheck and M2/M3 implementation plan

**Date:** 2026-07-18

**Planning base:** `test/tenant-isolation` through `f51f8db`

**Execution boundary:** local branches and files only. No push, merge, deploy,
live query, or migration application was performed by this work.

## M1 recheck result

M1 application code and local checks are sound, but M1 is not yet cleared for
release because live tenant isolation has not been re-verified after the July
17 batch SQL incident.

### What passed

- Synthetic seed branch contains 29 fixtures and no old credential/domain
  markers.
- Invite routes derive workspace and role from trusted server-side state.
- Tenant/security suite passes 7/7 after the incident regression was added.
- TypeScript passes.
- The advisor migration was reported applied and its private helper/profile
  policy changes were independently observed in the live schema.

### Blocking live gate

The historical initial migration can recreate `auth_full`, `read_all`, and
bucket-wide document policies when run out of sequence. Because permissive RLS
policies combine with OR, their presence bypasses the correct workspace policy.

Local corrective commit `f51f8db` adds:

- `20260718100000_remove_legacy_permissive_policies.sql`, an idempotent,
  drop-only cleanup for every known legacy permissive policy name;
- `supabase/verification/20260718_m1_rls_audit.sql`, which must return zero
  rows before M1 is declared closed;
- a regression test for all known policy names; and
- explicit warnings against batch-running migrations/setup/reference SQL.

### Residual M1 limitations

- The Node suite validates repository contracts and pure invite logic; it is
  not a disposable-Postgres integration test.
- Migration history is out of sync with manually executed live SQL and must be
  reconciled before automated database pushes.
- Invite code is still not on `main` while the invitation table is live.
- The synthetic seed scrub is still not on `main`; removed values remain in git
  history pending an owner decision.
- `requireUser()` selects the earliest membership. Multiple-workspace switching
  is not yet a product feature, so a user invited to a second workspace cannot
  choose between memberships in the UI.

## Milestone strategy

```text
M1: trustworthy tenancy and review path
  └─ live zero-row RLS audit
      └─ M2: private evidence-backed estimating
          └─ measured accuracy/coverage gates
              └─ M3: consented benchmarks and pricing optimization
```

M2 and M3 must not blur three different numbers:

1. **Actual cost** — what labor/material/equipment really cost.
2. **Approved estimate cost** — a reviewed planning number, useful but not
   ground truth.
3. **Public bid price** — what someone bid, not what the work cost them.

Every observation and every recommendation must name its kind and provenance.

## M2 — Estimating brain v0

### Objective

Replace model-memory unit rates with traceable workspace evidence while keeping
the estimator in control. The model may fill gaps, but the UI must identify
which prices are observed, which are inferred, and why.

### Scope

- Workspace-private `cost_observations`.
- Deterministic trade/unit/item normalization.
- Robust comparable selection and weighted median/P25/P75 suggestions.
- Explicit human publication of reviewed estimate lines into cost history.
- Suggestion sidecar in the estimate editor; never silently overwrite a rate.
- Small labeled evaluation set and baseline-vs-suggestion metrics.
- Public-data pilot separated into market signals and unit-price evidence.

No cross-tenant pooling, pgvector, autonomous pricing, or automatic proposal
submission belongs in M2.

### Data contract: `cost_observations`

Each row should include:

| Field | Purpose |
|---|---|
| `workspace_id` | Tenant owner; required and RLS-scoped |
| `observation_kind` | `actual_cost`, `approved_estimate`, `supplier_quote`, or `public_bid_price` |
| `source_name` | Controlled source label such as `estimate` or `manual` |
| `source_ref` / `source_line_ref` | Idempotent provenance without PII |
| `bid_id` / `estimate_id` | Optional local lineage |
| `trade` / `item_key` / `unit` | Canonical comparison key |
| `description` | Human-readable original context |
| `quantity` / `unit_cost` | Positive quantity and nonnegative value |
| `region_code` / `observed_on` | Geography and time context |
| `confidence` | 0–1 source/reviewer confidence |
| `provenance` | Structured non-secret metadata; no PII or bearer URLs |

Authenticated members may read their workspace's rows. Writes go through a
validated service-role API so viewer/write-role rules are enforced in one
place. M2 does not expose public-data rows across tenants.

### Suggestion contract

Input:

- caller workspace;
- canonical trade, item key, and unit;
- as-of date;
- optional allowed observation kinds.

Output:

- suggested unit cost (weighted median);
- P25/P75 range;
- sample size and effective weight;
- newest observation date and source-kind mix;
- strength label and explicit no-suggestion reason.

Default behavior excludes `public_bid_price` from cost suggestions. It may be
shown separately as market context only.

### M2 phases

#### M2.0 — Security and measurement gates

Deliverables:

- Live M1 RLS audit returns zero rows.
- Partner lands/reconciles M1 branches and migration history.
- Define a synthetic evaluation fixture format and baseline metrics.

Exit criteria:

- No known permissive policy exists live.
- `main` contains the M1 code the schema expects.
- No M2 migration has been applied before these checks.

#### M2.1 — Observation foundation

Deliverables:

- `cost_observations` migration with read-only member RLS and covering indexes.
- Canonical trade/unit/item functions.
- Deterministic weighted-quantile suggestion kernel.
- Unit tests for tenant filtering, source-kind separation, units, recency, and
  insufficient evidence.

Exit criteria:

- Minimum three exact comparable rows before any suggestion.
- Cross-workspace and wrong-unit rows never enter a result.
- Public bid prices are excluded by default.
- All schema/code remains file-only until M1 is cleared.

#### M2.2 — Internal evidence ingestion

Deliverables:

- “Publish reviewed costs” action available only on approved/submitted
  estimates and only to writer roles.
- Idempotent per-line provenance.
- Ability to supersede an observation without deleting audit history.
- Manual/supplier-quote import with validation and preview.

Exit criteria:

- Replaying the same estimate creates no duplicate observations.
- Every row identifies reviewer, source, and date.
- Estimated numbers are labeled `approved_estimate`, never `actual_cost`.

#### M2.3 — Suggestion API and estimate-editor sidecar

Deliverables:

- Workspace-scoped API for comparables and suggestions.
- UI shows suggested value, range, sample size, freshness, and source mix.
- One-click accept records the prior value and selected suggestion.
- Model-memory fallback is visibly labeled when evidence is insufficient.

Exit criteria:

- No automatic overwrite.
- Viewer cannot publish or accept pricing changes.
- API tests cover foreign workspace/item/estimate injection.

#### M2.4 — Public-data pilot

Treat these as two products:

- **Market signals:** start with two clean adapters for award/project context.
  Useful for GC/corridor intelligence, not unit-cost truth.
- **Unit-price evidence:** add TxDOT bid-tab parsing only after the canonical
  record is stable. Store it as `public_bid_price`, never actual cost.

Pilot assumptions pending partner confirmation:

- Geography: Bexar County first, then San Antonio MSA.
- Refresh: weekly batch/manual review.
- Priority trades: concrete, earthwork, paving, drainage, utilities, striping.
- Alias maintenance: a small reviewed regional-GC map, not uncontrolled fuzzy
  matching.

Exit criteria:

- Public sources and retrieval dates are traceable.
- Contacts/emails and other PII are filtered before storage.
- Failed/changed source formats fail visibly without partial silent imports.

#### M2.5 — Evaluation and rollout

Metrics:

- Exact-comparable coverage by trade/unit.
- Median absolute percentage error for unit cost where ground truth exists.
- Quantity error separately from unit-cost error.
- Suggestion acceptance/override rate.
- Estimate cycle time and gross-margin error on decided jobs.

Initial rollout gates:

- At least five comparable observations for a “medium” strength label.
- At least ten recent observations with controlled spread for “high”.
- Demonstrated improvement over model-memory baseline on the labeled eval set.
- Human review remains mandatory for every submitted estimate.

## M3 — Prediction and pricing optimizer

### Objective

Predict a defensible cost range and win probability, then recommend a bounded
bid price that improves expected profit without hiding uncertainty or crossing
tenant boundaries.

### Prerequisites

- M2 suggestions show measurable improvement and stable normalization.
- Sufficient decided bids with complete price/outcome data.
- Explicit, versioned workspace consent for any cross-tenant contribution.
- At least five consenting workspaces before publishing pooled aggregates.

If the sample is too small, M3 stays in data-collection mode.

### M3 phases

#### M3.1 — Consent and anonymized benchmark layer

- Versioned `workspace_data_consents` with grant/revoke actor and timestamps.
- Service-role derivation into a non-client-readable benchmark staging layer.
- No customer names, raw notes, documents, contacts, or direct workspace IDs.
- Aggregates only when at least five distinct consenting workspaces contribute.
- Revocation stops future contribution and triggers a documented rebuild path.

#### M3.2 — Cost regression baseline

- Predict log unit cost by trade/item/unit, region, quantity scale, and date.
- Start with ordinary least squares; use ridge only if diagnostics show unstable
  coefficients.
- Time-based holdout and leave-one-workspace-out evaluation.
- Report residual error, coefficient stability, and prediction intervals.
- Keep robust M2 comparables as the fallback and benchmark.

#### M3.3 — Win-probability model

- Logistic baseline using submitted bids only.
- Candidate features: relative price, markup/margin, GC relationship history,
  response time, completeness, project/trade, region, and season.
- Minimum data gate: roughly 200 decided submissions with at least 40 wins;
  otherwise show descriptive analytics, not a personalized probability.
- Evaluate calibration/Brier score before ranking/AUC.

#### M3.4 — Constrained pricing optimizer

For candidate price `p` and estimated cost `c`:

```text
expected_profit(p) = P(win | p, context) × (p - c)
```

- Search only inside partner-approved min-margin/max-price bounds.
- Show conservative/base/aggressive scenarios with confidence intervals.
- Never auto-submit or silently alter an estimate.
- Log recommendation, inputs, human choice, and eventual outcome.

#### M3.5 — Semantic comparables only if earned

Add pgvector only when exact normalized matching demonstrably misses useful
comparables and there is enough labeled data to evaluate semantic retrieval.
Vector similarity never overrides tenant/consent filters.

### M3 acceptance criteria

- No raw cross-tenant record is client-queryable.
- Consent and k-anonymity tests pass.
- Cost model beats M2 baseline on future-time holdout.
- Win probabilities are calibrated, not merely ranked.
- Backtest shows expected-profit improvement without violating margin floors.
- Every recommendation remains explainable and human-approved.

## Risks and controls

| Risk | Control |
|---|---|
| Estimate data mistaken for actual cost | Required observation kind and provenance |
| Unit mismatch | Canonical unit dictionary; exact unit filter in v0 |
| Sparse/noisy samples | Minimum counts, robust quantiles, explicit no-result |
| Data leakage | Workspace RLS in M2; consent + aggregate-only service layer in M3 |
| Public-source drift | Versioned adapters, fixtures, visible failed imports |
| Optimizing win rate at a loss | Expected profit objective plus margin floors |
| False confidence | Time holdout, intervals, calibration, human review |

## Branch and landing order

Current M2 work is intentionally stacked on corrected M1:

```text
main (096340f)
  └─ test/tenant-isolation (... f51f8db)
      └─ codex/m2-estimating-brain
```

After M1 lands on `main`, replay only M2 commits if the M1 history was squashed:

```powershell
git switch codex/m2-estimating-brain
git rebase --onto main f51f8db codex/m2-estimating-brain
npm.cmd test
npm.cmd run build
```

M3 gets its own branch only after M2 data/accuracy gates pass.

## Decisions needed from Nick/partner

1. Confirm Bexar County as the first public-data geography.
2. Confirm the first three priority trades/items for evaluation.
3. Define who may mark an estimate line as reviewed cost evidence.
4. Decide whether supplier quotes may be stored and their retention policy.
5. Set the minimum margin floor for any future pricing optimizer.
6. Approve the consent language before any M3 cross-tenant implementation.

## 2026-07-22 implementation receipt

This pass moved the remaining code-safe M1 work onto
`codex/m2-estimating-brain` and implemented a bounded M2 feedback loop:

- the reviewed synthetic seed-data scrub is carried forward;
- a new append-only migration pins the two remaining mutable function search
  paths, with a read-only readiness query and partner-controlled rollout guide;
- writer roles can publish only a persisted `Approved` estimate as private
  `approved_estimate` evidence;
- invalid or unsupported lines block the entire publication (`V > 0`), while
  successful replays upsert stable line references and remove stale tail rows;
- `npm run eval:m2` emits a deterministic receipt and exits non-zero on a
  violated expectation, accuracy ceiling, or baseline regression.

Verification at implementation time: 19/19 offline tests passed, strict
TypeScript passed, the production Next build passed, and the synthetic loop
smoke set returned `V = 0`. Synthetic metrics validate plumbing only; the next
M2 accuracy claim requires de-identified partner-approved labeled outcomes.

Still partner-controlled: migration-ledger reconciliation, live SQL execution,
the final RLS/readiness queries, leaked-password protection, and branch landing.
After those gates, the next product slice is M2.3: a workspace-scoped suggestion
API and estimate-editor sidecar that shows range, comparable count, freshness,
source mix, and explicit fallback reasons.
