import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .order('bid_due_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await req.json();
  // Force the caller's workspace — never trust a workspace_id from the request body.
  const { data, error } = await supabase
    .from('bids')
    .insert({ ...body, workspace_id: auth.workspaceId })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
