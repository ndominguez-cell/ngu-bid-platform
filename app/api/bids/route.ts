import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonWriter } from '@/lib/auth';
import { pickBidFields, validateBidRefs } from '@/lib/bids';

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
  const denied = forbidNonWriter(auth.role);
  if (denied) return denied;

  const supabase = createServiceClient();
  const body = (await req.json()) as Record<string, unknown>;

  const fields = pickBidFields(body);
  if (!fields.project_name) return NextResponse.json({ error: 'project_name is required' }, { status: 400 });
  const refErr = await validateBidRefs(supabase, auth.workspaceId!, body, fields);
  if (refErr) return NextResponse.json({ error: refErr }, { status: 400 });

  const { data, error } = await supabase
    .from('bids')
    .insert({ ...fields, workspace_id: auth.workspaceId, status: fields.status ?? 'New' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
