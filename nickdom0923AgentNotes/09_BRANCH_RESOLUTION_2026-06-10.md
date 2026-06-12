# 09 — Branch Resolution Plan (2026-06-10)

*Prepared by Claude (Cowork). I verified everything below in a sandbox copy but **could not push** — this repo is read-only to me (no GitHub credentials), and pushing to `main` auto-deploys to the live NGU site, which should be a deliberate human action. Run the commands yourself (or have the next chat do it once you've authenticated).*

## State of the repo (verified against GitHub `main`)

- `main` = `d34ae22` (2026-05-27). Your local clone is **even with it** — not behind.
- Three `claude/*` branches exist:
  - `claude/amazing-darwin-Fiisg` — **4 real commits**: a design refresh. New UI component library (`KPI`, `StatusPill`, `AIPill`, `SourcePill`, `UrgencyBadge`, `UrgentBanner`, `Topbar`, `NotificationBell`), redesigned estimate/proposal pages, and a `vercel.json` change (moves `maxDuration` from the `functions` block to per-route exports). **Worth keeping.**
  - `claude/busy-davinci-AbDg3` — **0 commits ahead of main.** Stale. Delete.
  - `claude/busy-bell-FhUPD` — **0 commits ahead of main.** Stale. Delete.

## Verification I ran (sandbox copy)

- `git merge origin/claude/amazing-darwin-Fiisg` into `main` → **clean, no conflicts.**
- Your `nickdom0923AgentNotes/` survive the merge (the branch predates them but doesn't delete them).
- The security-fix files (`middleware.ts`, `app/api/profile/route.ts`, `app/api/bids/route.ts`) are **untouched** by the design merge — the two workstreams don't collide.
- `npm install` + `npx tsc --noEmit` on the merged tree → **passes, zero type errors.**

## Do this (from your local clone, where you're authenticated)

```bash
git fetch origin
git checkout main
git pull

# 1) Delete the two stale branches (no unique work):
git push origin --delete claude/busy-davinci-AbDg3
git push origin --delete claude/busy-bell-FhUPD

# 2) Bring in the design refresh via a PR — do NOT merge straight to main.
#    On GitHub: open a Pull Request from `claude/amazing-darwin-Fiisg` into `main`.
#    Review the Vercel PREVIEW deploy (a temporary URL, not the live site),
#    confirm the redesigned pages look right, then click Merge.

# 3) After the PR is merged, delete that branch too:
git push origin --delete claude/amazing-darwin-Fiisg
```

Why a PR and not a direct merge: pushing to `main` triggers a production Vercel deploy to the live NGU site. A PR gives you a throwaway preview URL to eyeball the new UI first. One click more, much safer.

## Immediately after (the actual gate to customer #2)

The branch cleanup is housekeeping. The real next unit of work is the three security fixes (see `08_PRODUCTIZATION_PUNCHLIST.md`), which are independent of the design refresh: remove `role` from the `/api/profile` PATCH, add an auth helper across the `createServiceClient()` routes, and enforce `workspace_id` / RLS. Tip: the open-source template `github.com/Razikus/supabase-nextjs-template` has working RLS policies you can adapt instead of writing them cold.
