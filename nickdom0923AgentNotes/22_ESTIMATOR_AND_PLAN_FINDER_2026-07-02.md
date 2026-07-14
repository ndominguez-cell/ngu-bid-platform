# 22 — Estimating Engine + Plan Finder review & rework (2026-07-02)

Review of the AI estimating engine and the plan/spec document finder, with the
accuracy fixes applied on branch `claude/security-items-review-hh13hl`.

## The core problem found

**The estimator never read the plans.** `POST /api/estimates` and
`POST /api/estimates/[id]/reanalyze` uploaded the PDFs to Storage and then sent
Claude only the **file names** — the prompt literally said *"Base quantities on
the project type inferred from filenames."* Every quantity, unit, and total on
every AI estimate was invented from the filename and generic Texas rates. There
was no takeoff and nothing traceable to a drawing. For a subcontractor bid that
goes out to a GC, that's the difference between a real number and a guess.

Secondary issues:
- Estimator and plan finder ran on `claude-sonnet-4-6`.
- Plan finder used the old `web_search_20250305` tool and **could not open a
  document** — it judged plan rooms from search snippets, never verifying them.
- On a parse failure the estimator silently saved an empty/である fabricated
  estimate instead of erroring.

## What changed

### New: `lib/estimator.ts`
Shared engine used by both estimate routes:
- `loadPlanDocuments()` — downloads each uploaded file from the workspace's
  Storage bucket (service client) and uploads it to the **Anthropic Files API**,
  returning real `document` (PDF) / `image` blocks plus a record of which files
  were `reviewed` vs `skipped`. Guards: ≤15 files and ≤60MB per analysis, with
  every skipped file reported (no silent truncation). Unsupported types and
  download failures are surfaced, not swallowed.
- `ESTIMATOR_SYSTEM_PROMPT` — a real bid protocol: take quantities off the
  drawings/schedules (never off the filename), make every line item traceable
  via a `basis` field citing the sheet, mark anything not found as
  `TBD — not found in provided plans` instead of fabricating, apply itemized
  waste/mobilization allowances, and report exclusions, assumptions, missing
  documents, and an overall confidence.
- Structured output (`ESTIMATE_SCHEMA`) so the result is validated JSON, not a
  regex scrape. `line_items` stays compatible with the existing
  `EstimateLineItem` shape (editor + CSV unchanged); the extra `basis` field is
  stored for auditability and ignored by the UI.
- `ESTIMATOR_MODEL = claude-opus-4-8` — accuracy is the priority; the value of a
  correct bid dwarfs the token cost. Centralized so it's a one-line change.
- `composeNotes()` folds confidence, assumptions, exclusions, missing docs, and
  the reviewed/skipped file list into the estimate's notes for the human
  reviewer.

### `POST /api/estimates`
Now loads the actual documents, passes bid context + the drawings to Opus 4.8
with structured output, and **refuses to create an estimate (422) if no document
could be read** — no more fabricated-from-filename estimates. `maxDuration`
raised to 300s. Only files actually analyzed are recorded.

### `POST /api/estimates/[id]/reanalyze`
Same document-reading path; asks only for the NEW line items the added sheets
introduce and merges them. Same 422 guard.

### `POST /api/bids/[id]/find-plans`
- Model → `claude-opus-4-8`.
- Tools → `web_search_20260209` + **`web_fetch_20260209`** (dynamic filtering).
- Prompt now requires the model to `web_fetch` and **open/verify** a candidate
  document before reporting it "found" / high-confidence; search-only hits are
  downgraded to "Partial" / "Gated". This directly targets the "improve the
  plans and spec finder" ask — it can now confirm a plan room actually holds the
  documents instead of trusting a snippet.

## Verification
`npx tsc --noEmit` → 0 errors. SDK surfaces confirmed against the installed
`@anthropic-ai/sdk` 0.99: `toFile`, `beta.files.upload`, `beta.messages.create`
with `output_config`, and the `web_*_20260209` tool literals all present.
Not yet exercised against a live Supabase bucket + Anthropic key (no secrets in
this environment) — recommend one end-to-end run on a real bid before relying on
a generated number.

## Follow-ups worth doing
- Surface `basis`, confidence, exclusions, and the reviewed/skipped file list in
  the estimate UI (data is already stored) so estimators can sanity-check the
  takeoff.
- Files uploaded to the Anthropic Files API persist until deleted — add cleanup
  of the returned file ids after analysis if retention matters.
- Consider caching the uploaded file ids on the `documents` row so reanalyze /
  redraft don't re-upload the same sheets.
- Rate-limit / cost guard on these routes (see note 21, M5) — Opus + full plan
  sets are the most expensive calls in the app.
