# 07 - Market Research + Product Ideas

> **Audience:** Nick, the partner, and future assistants.
> **Author:** Codex, 2026-05-27.
> **Scope:** Web research on construction CRM, field-service, work-management, inbox CRM, and small-business payment tools, then mapped those patterns back to `ngu-bid-platform`. This is an ideas note only; no app files were changed.

---

## 1. Research frame

Nick's goal is the right one: help NGU first, then figure out what generalizes to other construction businesses, then maybe later to other small businesses that live inside the same loop:

```text
Inbound opportunity -> qualify -> estimate/quote -> send proposal -> follow up -> win/loss -> do work -> get paid -> learn
```

The important takeaway from the market scan is that most competitors win by owning a clear slice of that loop:

- Construction CRM tools own bid pipeline, follow-up, proposal, and hit-rate reporting.
- Field-service tools own quote, schedule, dispatch, invoice, payment, and mobile execution.
- Inbox CRMs own email context, automatic activity logging, follow-up reminders, and pipeline hygiene.
- Work OS/no-code tools own flexible data, custom views, templates, automations, dashboards, and permissions.
- Payment/POS tools own the last mile: invoices, payment links, customer records, reminders, deposits, and reporting.
- AI proposal tools are starting to own evidence-backed response generation, confidence scoring, approvals, and go/no-go scoring.

`ngu-bid-platform` already has a strong seed: Gmail bid detection, bid records, estimates, proposals, CRM, analytics, plan finding, and Supabase/Gmail/Claude integrations. The opportunity is not to clone Procore, Odoo, Jobber, or Square. It is to become the lightweight, AI-native command center for small contractors who need help turning messy inbound opportunities into profitable work.

---

## 2. What the researched products seem to prove

### Construction CRM and preconstruction tools

Sources reviewed: [TopBuilder Construction CRM](https://www.topbuildersolutions.com/construction-crm/), [iDeal Construction CRM](https://idealcrm.app/), [JobTread](https://www.jobtread.com/?cacheoff=2166683), [Procore Construction CRM](https://www.procore.com/fc/crm), [Buildertrend product overview](https://buildertrend.com/product-overview/).

Pattern:

- Construction users do not want a generic sales funnel. They want bid opportunities, due dates, scopes, estimators, GCs, documents, proposals, bid follow-up, hit rates, and handoff to project execution.
- TopBuilder and iDeal both emphasize construction-specific CRM, bid tracking, proposal generation, follow-up, and reporting.
- iDeal specifically highlights bidding multiple clients for one project, proposal templates, visual pipeline, follow-up alerts, and reports like bids submitted vs. bids won.
- Procore frames construction CRM around avoiding the sales-to-operations handoff gap: carry notes, docs, and bid context into the project record.
- Buildertrend and JobTread show that small/mid-market construction buyers like one system that covers sales, estimating, projects, customer communication, financials, and documents.

Ideas for NGU:

- Add a real **Bid Follow-Up Calendar**: upcoming due dates, proposals sent with no response, stale bids, missing plans, missing GC email, and "call today" tasks.
- Add **Bid Hit-Rate Intelligence**: win rate by GC, trade, project type, geography, source, bid amount band, and estimator.
- Add **Multi-Client Bid Packages**: one project/opportunity can have multiple GCs/recipients/proposal versions. This matters when one job is bid through several GCs.
- Add **Sales-to-Project Handoff** for won bids: convert a won bid into a lightweight project record with the original scope, estimate, proposal, documents, commitments, and open tasks.
- Make CRM company pages construction-native: GC bid history, average response time, historical win rate, typical markup, payment reliability notes, and preferred submission method.

### Field-service and operations platforms

Sources reviewed: [BuildOps](https://buildops.com/), [Jobber field-service management](https://www.getjobber.com/features/field-service-management-software/), [ServiceTitan features](https://www.servicetitan.com/features).

Pattern:

- BuildOps is aimed at commercial contractors and emphasizes dispatch, quoting, scheduling, invoicing, payments, reporting, service agreements, time tracking, mobile app, and AI.
- Jobber is simpler and SMB-friendly: quote, schedule, invoice/payment, customer communication, automation, mobile access, and dashboards.
- ServiceTitan shows the large-platform version: CRM/sales, service/replacement, construction, dispatching, scheduling, accounting integrations, reporting, field mobile app, financing, and customer experience.

Ideas for NGU:

- Do not jump straight to full dispatch/project management. First add a **Won Bid Next Steps** flow:
  - assign owner
  - confirm scope
  - request signed proposal/contract
  - schedule kickoff
  - create initial job checklist
  - mark billing/payment status
- Add **Work Type Templates** for NGU's common jobs: paving, concrete flatwork, utilities, drainage, striping, sitework. Each template can prefill checklist items, default exclusions, needed documents, and estimate assumptions.
- Add a **mobile-first field note/photo capture** page later: if someone visits the site, they can add photos, notes, and contact updates directly to the bid/project.
- Add **invoice/payment status** fields once proposals become jobs. Square/Clover-style payment processing can wait, but "sent / deposit requested / paid / overdue" status is useful immediately.

### Inbox CRM and sales automation

Sources reviewed: [Streak features](https://start.streak.com/features), [Salesflare features](https://howto.salesflare.com/en/articles/4818234-what-features-does-salesflare-have), [Salesflare email sequences](https://salesflare.com/sales-engagement/email-sequences).

Pattern:

- Streak wins by living where work already happens: Gmail. It offers pipeline context beside email, automatic timelines, tasks, custom fields, saved views, mail merge, send later, snippets, and email tracking.
- Salesflare wins by reducing manual CRM data entry: email sync, timelines, tasks, suggested tasks, enrichment, tracking, sequences, templates, and automations.
- Both products know that small teams will not keep a CRM updated unless the system pulls context from email and tells them what to do next.

Ideas for NGU:

- Make the Gmail integration bidirectional and operational, not just import/send:
  - show recent Gmail thread activity on bid cards
  - detect "reply received" after proposal sent
  - create follow-up reminders when no reply arrives
  - detect addenda emails and attach them to an existing bid
  - detect "we won / we lost / bid tab" language and suggest status updates
- Add **email snippets/templates** for common construction follow-ups:
  - request plans
  - request addenda
  - ask if bids are still being accepted
  - submit RFI
  - follow up on submitted proposal
  - request bid results
- Add a **Today Inbox** view: AI-generated list of bid-related Gmail threads needing action, not a full inbox clone.
- Add **proposal engagement tracking** in a privacy-conscious way. Gmail open tracking may be fragile and sensitive, but the app can still track internal events: sent date, reply detected, follow-up due, clicked public proposal link if using an external proposal page.

### Work OS, no-code, and configurable platforms

Sources reviewed: [Airtable basics](https://support.airtable.com/docs/introduction-to-airtable-basics), [monday CRM features](https://monday.com/crm/features/), [ClickUp features](https://clickup.com/features?targetid=kwd-425085763839), [ClickUp dashboards](https://help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards), [Odoo all apps](https://www.odoo.com/page/all-apps), [Zoho One](https://www.zoho.com/one/?source_from=BO-2023-04A).

Pattern:

- Airtable proves the value of bases, views, interfaces, automations, templates, and workspace-level flexibility.
- monday proves the value of no-code CRM workflows: central communication, activity tracking, dashboards, duplicate detection, lead capture, mobile access, and automations.
- ClickUp proves the value of multiple views, dashboards, docs, automations, time tracking, roles, and "one place for work."
- Odoo and Zoho One prove the ambition of the all-in-one operating system, but they also hint at the danger: breadth creates setup complexity.

Ideas for NGU:

- Build a **small configuration layer**, not a general no-code builder:
  - custom bid fields per workspace
  - configurable bid stages
  - configurable sources
  - configurable trades/services
  - saved views
  - notification rules
  - proposal/estimate templates
- Add **saved views** before full automation:
  - Due this week
  - Missing plans
  - Needs estimate
  - Proposal drafted, not sent
  - Sent, no reply
  - High-fit public jobs
  - Expired but not closed
- Add **role-specific dashboards**:
  - Owner: pipeline value, won/lost, margin, overdue follow-ups, team load.
  - Estimator: today's deadlines, estimates in progress, missing docs, assigned bids.
  - Admin: team, workspace settings, Gmail status, integrations, AI usage.
- Add **lightweight automations** as plain-language rules later:
  - When proposal sent, create follow-up task in 2 business days.
  - When bid due date is within 3 days and no estimate exists, alert estimator.
  - When plans link is empty, suggest plan finder.
  - When status becomes Won, create project handoff checklist.

### Payment and small-business operating tools

Sources reviewed: [Square software/products](https://squareup.com/us/en/software?msockid=108acf624e4a69542e4bd92f4fb96823), [Square Appointments features](https://squareup.com/us/en/appointments/features?country_redirection=true), [Clover payments](https://www.clover.com/pos-systems/accept-payments), [Clover reporting](https://www.clover.com/pos-systems/business-tracking-reporting).

Pattern:

- Square and Clover are useful examples because they close the loop after the sale: invoices, payment links, reminders, customer profiles, reporting, deposits, mobile/virtual terminal payment, and APIs.
- For construction, the app should not become a POS. But it should understand quote/proposal value, deposit requests, invoice status, payment status, and accounting handoff.

Ideas for NGU:

- Add **proposal acceptance and payment intent status** before integrating payments:
  - sent
  - viewed
  - accepted verbally
  - contract requested
  - deposit requested
  - invoice sent
  - paid
  - overdue
- Add optional **payment links** later, likely through Square, Stripe, QuickBooks Payments, or another accounting/payment provider.
- Add **accounting export** before deep accounting integration:
  - won bid summary CSV
  - estimate line items
  - customer/contact
  - accepted proposal PDF/body
  - project/job code

### AI proposal / RFP response tools

Source reviewed: [HeyIris proposal creation](https://heyiris.ai/proposal-creation).

Pattern:

- Iris is valuable inspiration because it does not just generate prose. It emphasizes go/no-go qualification, buyer briefs, source-of-truth grounding, confidence scoring, citations, approvals, collaboration, red-team review, and recommendations.
- This is directly relevant to `ngu-bid-platform` because construction proposals and estimates need trust, not just text.

Ideas for NGU:

- Add a **Bid Go/No-Go Score**:
  - fit with NGU trades
  - distance from home base
  - due date urgency
  - plans available
  - GC history
  - estimated margin
  - public/private job complexity
  - missing info count
- Add **AI Confidence and Evidence** to every estimate/proposal:
  - line item source refs
  - assumptions
  - missing documents
  - confidence score
  - "human must verify" flags
- Add an **AI red-team pass** before sending proposal:
  - missing exclusions
  - inconsistent total
  - no recipient email
  - due date passed
  - scope mentions work NGU does not perform
  - proposal says licensed/bonded claims that workspace settings have not approved

---

## 3. Product ideas by priority

### Priority 0: Trust foundation

This comes before market-inspired features.

- Implement tenant/workspace isolation from `02`.
- Lock down unauthenticated API routes from `04`.
- Remove self-role escalation from `05`.
- Create a shared request context helper for user, role, workspace, and service-client usage.
- Start writing `bid_activity` rows for important workflow events.

Why this matters competitively: every serious product above assumes that customer data, roles, permissions, and activity history are reliable. Without that foundation, SaaS expansion is not safe.

### Priority 1: NGU daily operating value

These help the partner's business first.

1. **Today View**
   - due today / due this week
   - missing plans
   - needs estimate
   - proposal not sent
   - sent proposal with no reply
   - new Gmail bids awaiting review

2. **Bid Follow-Up Calendar**
   - generated from bid due dates, proposal sent dates, Gmail replies, and manual tasks
   - inspired by iDeal, Streak, Salesflare, Jobber

3. **Bid Intake Review Queue**
   - Gmail AI detections do not immediately become final bids
   - estimator can accept, edit, merge, or ignore
   - duplicate warnings for digest emails and similar project names

4. **Document-Aware Estimate 2.0**
   - parse PDF/image content
   - source refs per line item
   - assumptions per line item
   - confidence and missing-info flags

5. **Proposal QA Before Send**
   - total matches estimate
   - recipient exists
   - due date not expired
   - scope/exclusions included
   - workspace-approved signature and qualifications used

### Priority 2: Construction SaaS readiness

These are useful for NGU and become necessary for other construction companies.

1. **Workspace Settings**
   - company name
   - logo/colors
   - default state/city
   - trades performed
   - proposal signature
   - qualifications
   - default markup ranges
   - source list
   - prompt settings

2. **Pipeline Templates**
   - construction subcontractor default
   - heavy civil/sitework default
   - service contractor default
   - residential remodeler default

3. **Custom Fields + Saved Views**
   - small Airtable/monday inspiration without building full no-code
   - enough flexibility for each contractor's workflow

4. **Multi-Recipient Opportunities**
   - one project can be bid through multiple GCs
   - each recipient has separate proposal status, follow-up, and result

5. **Project Handoff**
   - won bid becomes a project
   - carry estimate, proposal, docs, contacts, commitments, and assumptions forward

### Priority 3: Multi-industry platform seeds

Do not build this yet, but design the data model so it is possible.

The generic loop is:

```text
Opportunity -> Qualification -> Quote/Estimate -> Proposal/Order -> Follow-up -> Fulfillment -> Payment -> Outcome
```

Construction-specific words should be workspace or vertical settings:

- "bid" could become opportunity/request
- "GC" could become customer/client/account
- "trade" could become service/category/scope
- "plans/specs/addenda" could become documents/requirements/attachments
- "estimate" could become quote/pricing model
- "proposal" could become offer/order response

Potential verticals later:

- HVAC/plumbing/electrical service contractors
- concrete/paving/sitework subcontractors
- specialty trades
- custom manufacturing
- wholesale/distribution
- B2B services that quote from email requests

---

## 4. Suggested schema/data model additions

These are not implementation instructions, just a product-data map.

```sql
-- High-level SaaS/config layer
workspaces
workspace_members
workspace_settings
verticals
pipeline_templates
pipeline_stages
custom_fields
saved_views

-- Work execution
tasks
task_assignments
follow_up_rules
activity_log / bid_activity expansion
projects
project_checklists

-- AI trust layer
ai_runs
ai_findings
estimate_source_refs
estimate_assumptions
proposal_qa_checks
bid_fit_scores

-- Sales/proposal loop
opportunity_recipients
proposal_events
proposal_links
proposal_acceptances
payment_requests

-- Integrations
integration_connections
gmail_threads
accounting_exports
webhook_events
```

The most important design principle: every table that represents business data should eventually include `workspace_id`, `created_by`, timestamps, and activity history.

---

## 5. What to copy, what not to copy

Copy:

- TopBuilder/iDeal: construction-specific bid follow-up and reporting.
- JobTread/Buildertrend: estimate/proposal/project handoff.
- Procore: never lose sales-to-operations context.
- Jobber: simple quote-to-payment workflow for small operators.
- BuildOps/ServiceTitan: role-specific operations command center and commercial-trade focus.
- Streak/Salesflare: email-first CRM with automatic timelines and reminders.
- Airtable/monday/ClickUp: configurable views, dashboards, automations, and templates.
- Square/Clover: invoice/payment status and customer/payment visibility.
- Iris: evidence-backed AI with confidence, citations, approvals, and go/no-go recommendations.

Do not copy yet:

- Full accounting.
- Full POS.
- Full dispatch.
- Full HR/payroll.
- Full no-code builder.
- Full Procore-style project management.
- Full Odoo/Zoho all-app suite.

The product should feel like: **the contractor's bid desk that thinks with them**, not a giant enterprise system.

---

## 6. A practical next-roadmap version

### Sprint A - Make it safe and reliable

- Tenant isolation.
- API auth cleanup.
- Role escalation fix.
- Activity logging.
- Missing env docs.
- Build/runtime paper cuts from `06`.

### Sprint B - Make NGU faster every morning

- Today View.
- Follow-Up Calendar.
- Gmail Intake Review Queue.
- Missing-plan/missing-estimate alerts.
- Source taxonomy cleanup.

### Sprint C - Make AI trustworthy

- PDF/image-aware estimate generation.
- line item source refs.
- assumptions and confidence.
- proposal QA/red-team.
- AI run logs and cost/latency tracking.

### Sprint D - Make it tenant/config ready

- Workspace settings.
- prompt builders.
- configurable trades/sources/stages.
- saved views.
- per-workspace branding.

### Sprint E - Make it a construction SaaS

- invite flow.
- workspace switcher.
- multi-recipient opportunities.
- project handoff.
- CSV/accounting export.
- optional payment links.

---

## 7. Final product thesis

The researched products mostly split into two worlds:

1. Heavy platforms that can run a whole business, but require setup and discipline.
2. Lightweight tools that are easy to start, but stop short of the whole workflow.

`ngu-bid-platform` can sit in the missing middle for small contractors:

- specific enough to understand bids, scopes, plans, GCs, estimates, proposals, and deadlines
- lightweight enough that an owner/operator or estimator can actually use it
- AI-native enough to reduce paperwork instead of just organizing it
- configurable enough to become multi-tenant construction SaaS
- abstract enough, later, to support any small business whose work starts as an inbound request and ends as a priced offer

For now, keep the promise narrow: **help NGU decide what to bid, estimate it with more confidence, send better proposals, follow up without forgetting, and learn which work is worth chasing.**

