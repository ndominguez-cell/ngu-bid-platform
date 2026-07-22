import { NextResponse } from 'next/server';
import { forbidNonWriter, requireUser } from '@/lib/auth';
import { buildApprovedEstimateObservations } from '@/lib/cost-observations.mjs';
import { createServiceClient } from '@/lib/supabase/server';

const SOURCE_NAME = 'ngu_estimate';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonWriter(auth.role);
  if (denied) return denied;

  const supabase = createServiceClient();
  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id,bid_id,status,line_items,updated_at')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (estimateError) return NextResponse.json({ error: estimateError.message }, { status: 500 });
  if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  if (estimate.status !== 'Approved') {
    return NextResponse.json({
      error: 'Only an Approved estimate can become cost evidence',
      receipt: { contract: 'approved-estimate-evidence-v1', status: 'blocked', V: 1 },
    }, { status: 409 });
  }

  const built = buildApprovedEstimateObservations({
    workspaceId: auth.workspaceId!,
    estimateId: estimate.id,
    bidId: estimate.bid_id,
    lineItems: estimate.line_items,
    observedOn: estimate.updated_at,
    createdBy: auth.user!.id,
  });

  if (built.V > 0) {
    return NextResponse.json({
      error: 'Every estimate line must be valid before evidence is published',
      receipt: {
        contract: 'approved-estimate-evidence-v1',
        status: 'blocked',
        V: built.V,
        lineCount: built.lineCount,
        issues: built.issues,
      },
    }, { status: 422 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('cost_observations')
    .select('source_line_ref')
    .eq('workspace_id', auth.workspaceId)
    .eq('observation_kind', 'approved_estimate')
    .eq('source_name', SOURCE_NAME)
    .eq('source_ref', estimate.id);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const { error: upsertError } = await supabase
    .from('cost_observations')
    .upsert(built.rows, {
      onConflict: 'workspace_id,observation_kind,source_name,source_ref,source_line_ref',
    });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const currentRefs = new Set(built.rows.map(row => row.source_line_ref));
  const staleRefs = (existing ?? [])
    .map(row => row.source_line_ref)
    .filter(sourceLineRef => !currentRefs.has(sourceLineRef));

  if (staleRefs.length > 0) {
    const { error: cleanupError } = await supabase
      .from('cost_observations')
      .delete()
      .eq('workspace_id', auth.workspaceId)
      .eq('observation_kind', 'approved_estimate')
      .eq('source_name', SOURCE_NAME)
      .eq('source_ref', estimate.id)
      .in('source_line_ref', staleRefs);

    if (cleanupError) return NextResponse.json({ error: cleanupError.message }, { status: 500 });
  }

  return NextResponse.json({
    receipt: {
      contract: 'approved-estimate-evidence-v1',
      status: 'published',
      V: 0,
      estimateId: estimate.id,
      published: built.rows.length,
      removedStale: staleRefs.length,
    },
  });
}
