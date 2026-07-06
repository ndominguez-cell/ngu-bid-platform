import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a construction bid plan document finder for NGU Construction, a site work and paving subcontractor in San Antonio, Texas.

Your task: Given a construction bid invitation's details, search for publicly available plan documents (drawings, specifications, addenda) using the following 5-tier search ladder. Work top to bottom, stop as soon as you find a complete, verified package.

TIER 1 — Exact Identifiers (highest signal):
- "[PROJECT NAME]" "[BID NUMBER]"
- "[BID NUMBER]" plans
- "[BID NUMBER]" specifications filetype:pdf
- "[PROJECT NAME]" addendum

TIER 2 — Owner and Municipality:
- "[PROJECT NAME]" "[CITY]" bids
- site:[city-domain].gov "[PROJECT NAME]"
- "[PROJECT NAME]" procurement
- "[PROJECT NAME]" "invitation to bid"

TIER 3 — Engineer / Architect:
- "[PROJECT NAME]" "[ENGINEER FIRM]"
- site:[engineer-domain].com "[PROJECT NAME]"

TIER 4 — Document-Type Searches:
- "[PROJECT NAME]" filetype:pdf
- "[PROJECT NAME]" "project manual"
- "[PROJECT NAME]" "addendum no"
- "[PROJECT NAME]" "plan holders"

TIER 5 — Public Records / Meeting Packets:
- "[PROJECT NAME]" "agenda packet"
- "[PROJECT NAME]" "bid tab"
- "[PROJECT NAME]" "capital improvement"

Texas-specific sources to always check for Texas public projects:
- txsmartbuy.gov (Texas SmartBuy / ESBD)
- txdot.gov (for highway/road projects)
- City and county .gov procurement pages
- QuestCDN, PlanHub, BidSync free listing pages (project metadata without paywall)

Verification: A document is confirmed only when it matches at least TWO anchors:
(project name OR bid number OR owner name OR site address OR engineer firm OR bid due date)

Do NOT bypass paywalls or authentication. If docs are gated, report the plan room name and recommend the user request access.

After searching, respond with ONLY a valid JSON object (no markdown, no commentary):
{
  "result": "Found complete docs" | "Partial docs" | "Gated only" | "Not found",
  "plans_url": "<direct URL to plans/specs if found, else null>",
  "confidence": "high" | "medium" | "low",
  "sources_checked": [
    {"url": "<url or domain>", "status": "useful" | "gated" | "no results", "notes": "<brief>"}
  ],
  "search_queries_tried": ["<query1>", "<query2>"],
  "document_checklist": {
    "drawings": "found" | "missing" | "unknown",
    "specifications": "found" | "missing" | "unknown",
    "addenda": "current" | "missing" | "unknown",
    "bid_form": "found" | "missing" | "unknown"
  },
  "recommended_next_step": "<one concrete action>",
  "notes": "<any additional relevant findings>"
}`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const serviceClient = createServiceClient();
  const { data: bid, error: bidError } = await serviceClient
    .from('bids')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (bidError || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  const userPrompt = `Find plan documents for this construction bid:

Project: ${bid.project_name}
Bid ID: ${bid.id}
Location: ${[bid.address, bid.city, bid.state].filter(Boolean).join(', ') || 'Texas'}
GC / Owner: ${bid.gc_name || 'Unknown'}
GC Email: ${bid.gc_email || 'Unknown'}
Bid Due: ${bid.bid_due_date || 'Unknown'}
Scope: ${bid.scope || 'Site work / paving'}
Trades: ${(bid.trades ?? []).join(', ') || 'Unknown'}
Source: ${bid.source || 'Unknown'}
Existing Plans Link: ${bid.plans_link || 'None'}
Notes: ${bid.notes || 'None'}

Search for publicly available plan documents using the 5-tier search ladder. Return the JSON report.`;

  try {
    let fullText = '';
    let attempts = 0;
    const maxAttempts = 8;

    // Run Claude with web search, looping to handle multi-turn tool use
    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

    while (attempts < maxAttempts) {
      attempts++;
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20260209' as const, name: 'web_search' }],
        messages,
      });

      // Collect any text content
      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
      if (textBlocks.length > 0) {
        fullText = textBlocks.map(b => b.text).join('');
      }

      // If stopped or no more tool calls, we're done
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break;

      // tool_use: regular or server-side tool called; pause_turn: Anthropic paused
      // a long-running turn (e.g. while executing web_search server-side).
      // In both cases, append the assistant turn and continue — Anthropic handles
      // server-side tool execution transparently on the next request.
      if (response.stop_reason === 'tool_use' || response.stop_reason === 'pause_turn') {
        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
        ];
        if (attempts >= maxAttempts) break;
        continue;
      }

      break;
    }

    // Parse the JSON report from Claude's response
    const match = fullText.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({
        result: 'Not found',
        plans_url: null,
        confidence: 'low',
        sources_checked: [],
        search_queries_tried: [],
        document_checklist: { drawings: 'unknown', specifications: 'unknown', addenda: 'unknown', bid_form: 'unknown' },
        recommended_next_step: 'Contact the GC directly for plan documents.',
        notes: 'Search completed but no structured result was returned.',
      });
    }

    const report = JSON.parse(match[0]);

    // Auto-save a high-confidence plans URL back to the bid if not already set
    if (report.plans_url && !bid.plans_link && report.confidence === 'high') {
      await serviceClient
        .from('bids')
        .update({ plans_link: report.plans_url, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('workspace_id', auth.workspaceId);
      report.auto_saved = true;
    }

    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Plan search failed';
    console.error('[find-plans] error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
