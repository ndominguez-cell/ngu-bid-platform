# Standing up your own Supabase copy — step by step

Goal: get the full bid-platform database running in **your own** Supabase
project so you have a safe sandbox. Nothing here touches your partner's
live NGU database or his Vercel deployment.

Files in this folder, in run order:

- `01_full_setup.sql` — builds the chassis + the construction example tables
- `02_seed_demo_data.sql` — a little fake construction data, to confirm it works
- `03_boutique_vertical.sql` — the boutique's own tables (retail + events + marketing)
- `04_seed_boutique_demo.sql` — sample boutique data (products, a pop-up, a sale)

If you only care about the boutique, you still run `01` first (it builds the
shared chassis the boutique depends on), then `03`, then `04`. The construction
seed (`02`) is optional.

---

## Step 1 — Build the database

1. Open your new project at https://supabase.com → your project.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open `01_full_setup.sql`, copy the **whole** file, paste it in, click **Run**.
4. You should see "Success. No rows returned." That's correct — it created
   tables, not rows. (Check **Table Editor** in the sidebar; you'll see
   `bids`, `companies`, `workspaces`, etc.)

If you ever re-run it, that's fine — it's written to be safe to run again.

## Step 2 — Point a LOCAL copy of the app at your project (the safe way)

Do **not** edit your partner's Vercel environment variables. Instead run the
app on your own computer against your own database:

1. In your new Supabase project: **Settings → API**. Copy three values:
   - Project URL
   - `anon` `public` key
   - `service_role` key (keep this secret)
2. In the repo, copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
   SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
   ANTHROPIC_API_KEY=<from console.anthropic.com>   # only needed for AI features
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
3. In a terminal in the repo folder: `npm install` then `npm run dev`.
4. Open http://localhost:3000.

(If you'd rather have your OWN deployed copy later, create a **new** Vercel
project from the same GitHub repo with these same env vars — again, separate
from your partner's.)

## Step 3 — Create your account

On the running app, sign up with your email. That creates your user and a
matching `profiles` row automatically.

## Step 4 — Add the demo data

1. Back in Supabase → **SQL Editor → New query**.
2. Paste **all** of `02_seed_demo_data.sql`, click **Run**.
3. It creates a "NGU Construction (Demo)" workspace, a couple of sample
   bids/companies, and attaches your just-created account to that workspace
   so you can actually see the data.
4. Refresh the app — the demo bids should now appear.

> Order matters: sign up (Step 3) **before** running the seed (Step 4), so it
> can find your account to attach. If you ran it too early, just run it again
> after signing up.

---

## How this sets up the boutique expansion

`01_full_setup.sql` gives you a reusable **multi-tenant chassis**: the
`workspaces` / `workspace_members` / `profiles` tables plus row-level security
that walls each business's data off from the others. That part is identical
for *any* business — construction, boutique, anything.

The `bids` / `estimates` / `proposals` tables are the **construction domain**
— specific to NGU. A boutique store doesn't bid on jobs; it sells inventory.
So the boutique gets its **own** domain tables on top of the same chassis,
in `03_boutique_vertical.sql`:

- `boutique_products` + `boutique_variants` — catalog with size/color and **unified stock** across in-store and online
- `boutique_suppliers` + `boutique_purchase_orders` / `boutique_po_items` — vendors and restocking
- `boutique_customers` — CRM with Instagram handle + marketing opt-in
- `boutique_sales` + `boutique_sale_items` — transactions tagged `in_store`, `online`, or `popup`
- `boutique_events` — **pop-up shops** (defaults to San Antonio), with venue, dates, booth cost
- `boutique_marketing_posts` — a **social calendar** (Instagram/TikTok/etc.) that can link a post to a pop-up

Same workspace + row-level-security pattern, so the boutique's data is walled
off from NGU's. To set up the boutique sandbox: run `01`, then `03`, sign up,
then `04`.

### Where the app code comes in

These files build the boutique's **database**. The app's *screens* (the
React pages) are still the construction ones — they'd need new boutique pages
(products, inventory, pop-up calendar, social planner) to match. That's the
next build phase after you've confirmed the database here. Tell me when you're
ready and we'll scope the boutique UI.
