import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filename, mimeType, bidId } = await req.json();
  const serviceClient = createServiceClient();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `bids/${bidId || 'general'}/${Date.now()}-${safeName}`;

  const { data, error } = await serviceClient.storage
    .from('documents')
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token });
}
