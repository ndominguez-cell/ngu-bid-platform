import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

// GET /api/settings — workspace estimating defaults
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('workspaces')
    .select('default_markup_pct, default_margin_pct')
    .eq('id', auth.workspaceId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    default_markup_pct: Number(data.default_markup_pct ?? 10),
    default_margin_pct: Number(data.default_margin_pct ?? 8),
  });
}

// PATCH /api/settings — update workspace estimating defaults
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (auth.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot change settings' }, { status: 403 });
  }

  const body = await req.json();
  const markup = Number(body.default_markup_pct);
  const margin = Number(body.default_margin_pct);
  if (!Number.isFinite(markup) || markup < 0 || markup > 100 ||
      !Number.isFinite(margin) || margin < 0 || margin > 100) {
    return NextResponse.json({ error: 'Percentages must be between 0 and 100' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('workspaces')
    .update({ default_markup_pct: markup, default_margin_pct: margin })
    .eq('id', auth.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
