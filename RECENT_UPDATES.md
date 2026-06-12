# Recent Updates — NGU Bid Platform

*Plain-language log of what's been built and pushed, for quick partner review. Newest at top. Generated from the actual git history on 2026-06-10.*

> **How to read this:** "Live on `main`" = pushed and deployed. "Pending" = built but not yet merged into `main` (won't appear on the live site until merged via a pull request).

---

## Pending — not yet on `main` (awaiting review + merge)

**Design refresh** *(branch `claude/amazing-darwin-Fiisg`, built 2026-05-27)*
A visual overhaul to make the app cleaner and more consistent: a new set of reusable interface pieces (status tags, urgency badges, KPI tiles, notification bell, top bar), and redesigned Estimate and Proposal detail pages. Also a behind-the-scenes config tidy-up. Verified to merge cleanly and pass type-checking. **Next step:** open a pull request, review the preview, then merge. See `nickdom0923AgentNotes/09_BRANCH_RESOLUTION_2026-06-10.md`.

---

## Live on `main`

### 2026-05-27 — Plan Finder
- For bids that arrive without a plan link, the app now uses Claude web search to go find the plans automatically (with a longer time allowance so the search can complete).

### 2026-05-27 — Phase 3: Analytics, smarter Gmail, exports, roles, mobile
- Analytics views, automatic bid detection from Gmail, PDF export of documents, user roles (owner / manager / viewer), and a mobile-friendly layout.

### 2026-05-27 — Estimate generation reliability
- Several fixes so AI estimates generate dependably within the hosting time limits (model and timeout tuning, safer error handling).

### 2026-05-27 — Large file uploads
- Raised the upload size limit and routed large PDFs straight to secure storage so they aren't blocked by the host's size cap.

### 2026-05-27 — Settings
- Editable profile, and a button to disconnect Gmail.

### 2026-05-27 — Phase 2: Gmail, notifications, estimate editor
- Gmail integration, real-time notifications, an estimate editor, and conversation history.

### 2026-05-26 — Foundation
- Added missing pages and fixed the data-seeding route.

---

## What's queued next (not built yet)

1. **Branch cleanup** — delete two stale branches, merge the design refresh via PR (commands in `nickdom0923AgentNotes/09_BRANCH_RESOLUTION_2026-06-10.md`).
2. **Security hardening before a second customer** — three fixes from `nickdom0923AgentNotes/08_PRODUCTIZATION_PUNCHLIST.md`: lock down the API routes, stop self-service role changes, and enforce per-company data isolation (RLS).

---

*Keep this file current: add a short, plain-language bullet each time meaningful work is pushed to `main`. It's the fastest way for either partner to see where things stand without reading code.*
