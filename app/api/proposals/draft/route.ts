import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { bid_id, estimate_id } = await req.json();

  if (!bid_id) return NextResponse.json({ error: 'bid_id required' }, { status: 400 });

  // Fetch bid + estimate data
  const { data: bid } = await supabase.from('bids').select('*').eq('id', bid_id).single();
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  let estimate = null;
  if (estimate_id) {
    const { data } = await supabase.from('estimates').select('*').eq('id', estimate_id).single();
    estimate = data;
  }

  const totalStr = estimate?.total_amount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(estimate.total_amount)
    : 'TBD';

  const tradesStr = bid.trades?.join(', ') || 'site work';
  const dueStr = bid.bid_due_date ? new Date(bid.bid_due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'the bid due date';

  const prompt = `You are writing a professional bid proposal email for NGU Construction, a Texas site work and concrete subcontractor.

Write a complete, professional proposal email. Be direct, confident, and professional. Use construction industry language.

Project: ${bid.project_name}
Location: ${[bid.address, bid.city, bid.state].filter(Boolean).join(', ') || 'Texas'}
General Contractor: ${bid.gc_name || 'the General Contractor'}
GC Contact: ${bid.gc_contact_name || ''}
Scope: ${bid.scope || tradesStr}
Our Bid Total: ${totalStr}
Bid Due Date: ${dueStr}
Submit To: ${bid.submit_to || bid.gc_email || ''}

${estimate ? `Line items summary:\n${(estimate.line_items || []).slice(0, 5).map((li: any) => `- ${li.trade}: ${li.description} — $${li.total?.toLocaleString()}`).join('\n')}` : ''}

Write the email with:
1. Subject line (start with "SUBJECT: ")
2. Professional greeting
3. Clear statement of our bid for the specific scope (concrete, site work, earthwork as applicable)
4. Brief scope description
5. Total bid amount prominently stated
6. Key qualifications/notes (bonded, licensed, Texas experience)
7. Call to action
8. Signature block for Nick Dominguez, NGU Construction, ndominguez@nguconstruction.com

Return ONLY the email text, starting with "SUBJECT: "`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const fullText = response.content[0].type === 'text' ? response.content[0].text : '';
    const subjectMatch = fullText.match(/SUBJECT:\s*(.+)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Bid Proposal — ${bid.project_name}`;
    const body = fullText.replace(/^SUBJECT:.*\n?/, '').trim();

    // Save to database
    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert({
        bid_id,
        estimate_id: estimate_id || null,
        subject,
        body_draft: body,
        body_final: body,
        status: 'Draft',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: proposal }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
