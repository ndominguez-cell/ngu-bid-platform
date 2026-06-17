import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bids')
    .select('*, estimates(*), proposals(*)')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('bids')
    .update({ ...body, workspace_id: auth.workspaceId, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('bids')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
