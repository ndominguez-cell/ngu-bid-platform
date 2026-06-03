import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('name, line_items, markup_pct, total_amount')
    .eq('id', params.id)
    .single();

  if (error || !data) return new NextResponse('Not found', { status: 404 });

  const items = (data.line_items ?? []) as Array<{
    trade: string; description: string; qty: number; unit: string; unit_price: number; total: number;
  }>;

  const subtotal = items.reduce((s, li) => s + (li.total || 0), 0);

  function esc(v: string | number | null | undefined) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }

  const rows: Array<Array<string | number>> = [
    ['Trade', 'Description', 'Qty', 'Unit', 'Unit Price', 'Total'],
    ...items.map(li => [li.trade, li.description, li.qty, li.unit, li.unit_price, li.total]),
    [],
    ['', '', '', '', 'Subtotal', subtotal],
    ['', '', '', '', `Markup (${data.markup_pct}%)`, Math.round(subtotal * (data.markup_pct / 100))],
    ['', '', '', '', 'Grand Total', data.total_amount ?? 0],
  ];

  const csv = rows.map(r => r.map(c => esc(c as string | number | null)).join(',')).join('\n');
  const filename = `${data.name.replace(/[^a-z0-9]/gi, '_')}_estimate.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
