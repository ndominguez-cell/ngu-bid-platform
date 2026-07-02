import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser, forbidNonWriter } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const denied = forbidNonWriter(auth.role);
  if (denied) return denied;

  const { filename, bidId } = await req.json();
  if (typeof filename !== 'string' || !filename.trim()) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 });
  }
  const serviceClient = createServiceClient();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  // Sanitize bidId too so it can't inject extra path segments.
  const safeBid = typeof bidId === 'string' ? bidId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) : '';
  // Namespace uploads by workspace so tenants never share storage paths.
  const path = `${auth.workspaceId}/bids/${safeBid || 'general'}/${Date.now()}-${safeName}`;

  const { data, error } = await serviceClient.storage
    .from('documents')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token });
}
