import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/seed?secret=YOUR_SECRET
// Seeds the database with bids from bids.json
// Only call this ONCE after initial deployment

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Paste your bids.json "bids" array here, or fetch it from an env variable
  // For initial seed, we'll accept the bids array in the request body
  const { bids } = await req.json();

  if (!Array.isArray(bids)) {
    return NextResponse.json({ error: 'Request body must be { bids: [...] }' }, { status: 400 });
  }

  // Map bids.json fields to database fields
  const mapped = bids.map((b: any) => ({
    id: b.id,
    thread_id: b.thread_id || null,
    email_received: b.email_received || null,
    project_name: b.project_name,
    address: b.address || null,
    city: b.city || null,
    state: b.state || 'TX',
    gc_name: b.gc_name || null,
    gc_email: b.gc_email || null,
    gc_contact_name: b.gc_contact_name || null,
    gc_contact_phone: b.gc_contact_phone || null,
    bid_due_date: b.bid_due_date || null,
    bid_due_time: b.bid_due_time || null,
    submit_to: b.submit_to || null,
    scope: b.scope || null,
    trades: b.trades || [],
    plans_link: b.plans_link || null,
    source: b.source || 'Direct',
    status: b.status || 'New',
    our_bid_amount: b.our_bid_amount || null,
    awarded_amount: b.awarded_amount || null,
    notes: b.notes || null,
    created_at: b.last_updated ? new Date(b.last_updated).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('bids')
    .upsert(mapped, { onConflict: 'id' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    seeded: data?.length ?? 0,
    message: `Successfully seeded ${data?.length} bids into Supabase`,
  });
}
