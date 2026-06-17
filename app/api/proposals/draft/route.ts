import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Static system prompt — cached on first call, ~90% cheaper on subsequent calls.
const SYSTEM_PROMPT = `You are writing professional bid proposal emails for NGU Construction, a Texas site work and concrete subcontractor.

Write complete, professional proposal emails. Be direct, confident, and use construction industry language.

Always structure the email as:
1. Subject line — start with "SUBJECT: "
2. Professional greeting
3. Clear statement of NGU's bid for the specific scope
4. Brief scope description
5. Total bid amount prominently stated
6. Key qualifications (bonded, licensed, Texas experience)
7. Call to action
8. Signature block for Nick Dominguez, NGU Construction, ndominguez@nguconstruction.com

Return ONLY the email text, starting with "SUBJECT: ". No preamble, no markdown, no explanation outside the email.`;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { bid_id, estimate_id } = await req.json();

  if (!bid_id) return NextResponse.json({ error: 'bid_id required' }, { status: 400 });

  const { data: bid } = await supabase.from('bids').select('*').eq('id', bid_id).eq('workspace_id', auth.workspaceId).single();
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  let estimate = null;
  if (estimate_id) {
    const { data } = await supabase.from('estimates').select('*').eq('id', estimate_id).eq('workspace_id', auth.workspaceId).single();
    estimate = data;
  }

  const totalStr = estimate?.total_amount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(estimate.total_amount)
    : 'TBD';

  const tradesStr = bid.trades?.join(', ') || 'site work';
  const dueStr = bid.bid_due_date
    ? new Date(bid.bid_due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'the bid due date';

  const projectContext = `Project: ${bid.project_name}
Location: ${[bid.address, bid.city, bid.state].filter(Boolean).join(', ') || 'Texas'}
General Contractor: ${bid.gc_name || 'the General Contractor'}
GC Contact: ${bid.gc_contact_name || ''}
Scope: ${bid.scope || tradesStr}
Our Bid Total: ${totalStr}
Bid Due Date: ${dueStr}
Submit To: ${bid.submit_to || bid.gc_email || ''}${
    estimate
      ? `\n\nLine items summary:\n${(estimate.line_items || [])
          .slice(0, 5)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((li: any) => `- ${li.trade}: ${li.description} — $${li.total?.toLocaleString()}`)
          .join('\n')}`
      : ''
  }`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Write a bid proposal email for the following project:\n\n${projectContext}`,
        },
      ],
    });

    const fullText = response.content[0].type === 'text' ? response.content[0].text : '';
    const subjectMatch = fullText.match(/SUBJECT:\s*(.+)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : `Bid Proposal — ${bid.project_name}`;
    const body = fullText.replace(/^SUBJECT:.*\n?/, '').trim();

    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert({
        workspace_id: auth.workspaceId,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proposal draft failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
