import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getValidAccessToken, gmailFetch } from '@/lib/gmail';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accessToken = await getValidAccessToken(user.id);
    const serviceClient = createServiceClient();

    // List recent bid-related emails
    const listRes = await gmailFetch(
      accessToken,
      '/messages?q=subject:(bid+OR+estimate+OR+proposal+OR+quote)&maxResults=20'
    );
    if (!listRes.ok) throw new Error('Failed to list Gmail messages');
    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages ?? [];

    let contactsFound = 0;
    const conversationsInserted: string[] = [];

    for (const msg of messages) {
      const msgRes = await gmailFetch(accessToken, `/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const headers: { name: string; value: string }[] = msgData.payload?.headers ?? [];
      const fromHeader = headers.find(h => h.name === 'From')?.value ?? '';
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
      const dateHeader = headers.find(h => h.name === 'Date')?.value ?? '';
      const snippet: string = msgData.snippet ?? '';
      const threadId: string = msgData.threadId ?? msg.id;
      const internalDate = msgData.internalDate
        ? new Date(parseInt(msgData.internalDate)).toISOString()
        : dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

      // Skip if we already have this conversation
      const { data: existing } = await serviceClient
        .from('conversations')
        .select('id')
        .eq('gmail_thread_id', threadId)
        .single();
      if (existing) continue;

      // Use Claude Haiku to extract contact info
      const extractPrompt = `Extract contact information from this email header. Return ONLY valid JSON, nothing else.

From: ${fromHeader}
Subject: ${subject}
Snippet: ${snippet}

Return this exact JSON shape (use null for unknown fields):
{"first_name":"","last_name":null,"email":null,"phone":null,"title":null,"company_name":null,"company_type":"GC"}

company_type must be one of: GC, Owner, Architect, Engineer, Subcontractor, Other`;

      let contactInfo: {
        first_name: string;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        title: string | null;
        company_name: string | null;
        company_type: string;
      } = { first_name: '', last_name: null, email: null, phone: null, title: null, company_name: null, company_type: 'GC' };

      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: extractPrompt }],
        });
        const raw = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '{}';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) contactInfo = { ...contactInfo, ...JSON.parse(match[0]) };
      } catch { /* skip extraction errors, still save conversation */ }

      let companyId: string | null = null;
      let contactId: string | null = null;

      // Upsert company if we have a name
      if (contactInfo.company_name) {
        const { data: company } = await serviceClient
          .from('companies')
          .upsert({ name: contactInfo.company_name, type: contactInfo.company_type ?? 'GC' }, { onConflict: 'name' })
          .select('id')
          .single();
        companyId = company?.id ?? null;
      }

      // Upsert contact if we have enough info
      if (contactInfo.first_name && contactInfo.email) {
        const { data: contact } = await serviceClient
          .from('contacts')
          .upsert({
            first_name: contactInfo.first_name,
            last_name: contactInfo.last_name,
            email: contactInfo.email,
            phone: contactInfo.phone,
            title: contactInfo.title,
            company_id: companyId,
            source: 'gmail',
          }, { onConflict: 'email' })
          .select('id')
          .single();
        contactId = contact?.id ?? null;
        contactsFound++;
      }

      // Save conversation record
      await serviceClient.from('conversations').insert({
        contact_id: contactId,
        gmail_thread_id: threadId,
        subject,
        snippet,
        direction: 'inbound',
        date: internalDate,
      });
      conversationsInserted.push(threadId);
    }

    // Update last sync time
    await serviceClient.from('profiles').update({ gmail_synced_at: new Date().toISOString() }).eq('id', user.id);

    return NextResponse.json({ success: true, synced: conversationsInserted.length, contacts_found: contactsFound });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
