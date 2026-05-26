# NGU Bid Platform — Phase 1 Deployment Guide

## Prerequisites
You'll need three free accounts and one API key before deploying. Each step below links to where to get them.

---

## Step 1 — GitHub (host the code)

1. Go to [github.com](https://github.com) and sign up (or sign in)
2. Click **New Repository** → name it `ngu-bid-platform` → Private → Create
3. Open **Terminal** on your Mac and run:

```bash
cd "/Users/nd-ngu/Documents/Claude/Projects/Bidding/ngu-bid-platform"
git init
git add .
git commit -m "Initial commit — Phase 1"
git remote add origin https://github.com/YOUR_USERNAME/ngu-bid-platform.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Supabase (database + auth + file storage)

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free)
2. Sign in with GitHub → **New Project**
   - Name: `ngu-bid-platform`
   - Database Password: (generate a strong one, save it)
   - Region: **US East (N. Virginia)** — closest to Texas
3. Wait ~2 minutes for the project to spin up

### Run the database schema
4. In your Supabase project → **SQL Editor** → **New Query**
5. Open the file `lib/supabase/schema.sql` from this folder
6. Copy the entire contents → Paste into SQL Editor → **Run**
7. You should see "Success. No rows returned."

### Create the storage bucket
8. In Supabase → **Storage** → **New Bucket**
   - Name: `documents`
   - Public: **OFF** (private)
   - Click Create

### Get your API keys
9. Go to **Project Settings** → **API**
10. Copy and save:
    - **Project URL** (looks like `https://abcdefgh.supabase.co`)
    - **anon public** key (long string starting with `eyJ`)
    - **service_role** key (keep this SECRET — never expose in browser)

---

## Step 3 — Anthropic API Key (AI estimates and proposals)

1. Go to [console.anthropic.com](https://console.anthropic.com) → Sign in
2. Click **API Keys** → **Create Key**
3. Name it `ngu-bid-platform` → Copy the key (starts with `sk-ant-`)
4. Save it — you won't see it again

---

## Step 4 — Vercel (hosting + auto-deploys)

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub (free)
2. Click **Add New → Project**
3. Import your `ngu-bid-platform` repository
4. Under **Environment Variables**, add all of these:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (sk-ant-...) |
| `NEXT_PUBLIC_APP_URL` | https://ngu-bid-platform.vercel.app |
| `SEED_SECRET` | A random secret you make up (e.g. `ngu2026seed`) |

5. Click **Deploy** — Vercel builds and deploys automatically (~2 minutes)
6. Your app is live at: `https://ngu-bid-platform.vercel.app`

---

## Step 5 — Create Your Account

1. Go to `https://ngu-bid-platform.vercel.app/signup`
2. Sign up with `ndominguez@nguconstruction.com`
3. Check your email for the confirmation link — click it
4. Sign in at `/login`

---

## Step 6 — Seed Your Existing 29 Bids

1. Open Terminal and run this command (replace `ngu2026seed` with whatever you set as `SEED_SECRET`):

```bash
curl -X POST "https://ngu-bid-platform.vercel.app/api/seed?secret=ngu2026seed" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
$(cat "/Users/nd-ngu/Documents/Claude/Projects/Bidding/bids.json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps({'bids': d['bids']}))")
EOF
```

Or do it in two steps:
```bash
# Step A — extract the bids array
python3 -c "import json; d=json.load(open('/Users/nd-ngu/Documents/Claude/Projects/Bidding/bids.json')); print(json.dumps({'bids': d['bids']}))" > /tmp/bids_seed.json

# Step B — send to seed endpoint
curl -X POST "https://ngu-bid-platform.vercel.app/api/seed?secret=ngu2026seed" \
  -H "Content-Type: application/json" \
  -d @/tmp/bids_seed.json
```

You should get: `{"success": true, "seeded": 29, "message": "Successfully seeded 29 bids into Supabase"}`

---

## Step 7 — Local Development (optional)

To run the app on your Mac for testing:

```bash
# 1. Copy the env example
cp .env.local.example .env.local
# 2. Fill in your values in .env.local

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
# App runs at http://localhost:3000
```

---

## Invite Team Members

Once you're signed in:
1. Have each team member go to `https://ngu-bid-platform.vercel.app/signup`
2. They create their own account
3. Go to **Supabase → Authentication → Users** to verify accounts and manage access

---

## What Was Built (Phase 1)

- ✅ Next.js 14 app with TypeScript and Tailwind CSS
- ✅ Supabase Auth (login, signup, team accounts)
- ✅ Full database schema (bids, contacts, companies, estimates, proposals, documents, conversations)
- ✅ Route protection (middleware — unauthenticated users redirected to login)
- ✅ Dashboard with stats, urgency alerts, upcoming bids, status breakdown
- ✅ Bids list with full table (source badges, urgency indicators, Gmail links, plans links)
- ✅ Bid detail page with status updater, financials, estimates, proposals sections
- ✅ Estimates page with AI upload flow (drag & drop → Claude analysis → line items)
- ✅ CRM page (contacts + companies, auto-extracted from emails in Phase 2)
- ✅ Proposals page with draft/review/send workflow
- ✅ Settings page (account + integrations status)
- ✅ Sidebar navigation with sign out
- ✅ REST API (bids CRUD, estimates, proposals draft)
- ✅ Seed endpoint (imports existing 29 bids from bids.json)
- ✅ Vercel-ready deployment config

## Coming in Phase 2

- Gmail OAuth integration (scan inbox from within the app)
- Auto-extract contacts from bid emails
- Real-time bid notifications
- Estimate line-item editor (edit quantities and prices in the browser)
- Proposal send via Gmail API
- CRM conversation history linked to Gmail threads
