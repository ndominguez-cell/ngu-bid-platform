import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { filename, bidId } = await req.json();
  const serviceClient = createServiceClient();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Namespace uploads by workspace so tenants never share storage paths.
  const path = `${auth.workspaceId}/bids/${bidId || 'general'}/${Date.now()}-${safeName}`;

  const { data, error } = await serviceClient.storage
    .from('documents')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token });
}
