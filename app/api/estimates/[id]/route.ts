import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { line_items, markup_pct, margin_pct, status, notes } = await req.json();

  const subtotal = (line_items ?? []).reduce((sum: number, item: { total?: number }) => sum + (item.total ?? 0), 0);
  const markup = typeof markup_pct === 'number' ? markup_pct : 10;
  const margin = typeof margin_pct === 'number' ? margin_pct : 8;
  const total_amount = Math.round(subtotal * (1 + markup / 100) * (1 + margin / 100));

  const { data, error } = await supabase
    .from('estimates')
    .update({ line_items, markup_pct: markup, margin_pct: margin, status, notes, total_amount })
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
