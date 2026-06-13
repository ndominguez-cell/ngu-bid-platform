import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // NOTE: `role` is intentionally NOT writable here. Letting a user PATCH their
  // own role would allow self-escalation to admin. Role changes must go through
  // a separate admin-only path.
  const { full_name, title } = await req.json();

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('profiles')
    .update({ full_name, title })
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createServiceClient();
  await serviceClient.from('profiles').update({
    google_refresh_token: null,
    google_access_token: null,
    google_token_expiry: null,
    gmail_synced_at: null,
  }).eq('id', user.id);

  return NextResponse.json({ success: true });
}
