import { NextResponse } from 'next/server';
import type { createServiceClient } from '@/lib/supabase/server';

// Per-user, per-route sliding-window rate limiting backed by the ai_rate_limits
// table. Each rule is (limit within windowSec); ALL rules must pass. Combine a
// short burst rule (debounce double-clicks) with a longer sustained rule (cap
// cost/abuse) — e.g. [{limit:1,windowSec:6},{limit:15,windowSec:3600}].
export interface RateRule { limit: number; windowSec: number; }

export interface RateLimitArgs {
  userId: string;
  workspaceId?: string | null;
  route: string;
  rules: RateRule[];
}

// Sensible presets. Heavy = Opus + full plan sets / multi-turn web search.
export const RATE_PRESETS = {
  // Estimator (Opus reads whole plan sets) and plan finder (up to 8 web-search turns).
  heavyAI: [{ limit: 1, windowSec: 8 }, { limit: 15, windowSec: 3600 }] as RateRule[],
  // Gmail scans: many message fetches + Haiku extraction per call.
  gmailScan: [{ limit: 1, windowSec: 15 }, { limit: 12, windowSec: 3600 }] as RateRule[],
  // Cheaper single-shot generations.
  lightAI: [{ limit: 1, windowSec: 4 }, { limit: 40, windowSec: 3600 }] as RateRule[],
  // Outbound send: cheap, but debounce + a daily-ish cap.
  send: [{ limit: 1, windowSec: 3 }, { limit: 80, windowSec: 3600 }] as RateRule[],
};

/**
 * Returns a ready-to-return 429 response if the caller is over any rule, else
 * null (and records this request). Fails OPEN: if the limiter itself errors —
 * e.g. the ai_rate_limits migration hasn't been applied yet — it allows the
 * request rather than breaking the endpoint.
 */
export async function enforceRateLimit(
  supabase: ReturnType<typeof createServiceClient>,
  { userId, workspaceId, route, rules }: RateLimitArgs
): Promise<NextResponse | null> {
  const now = Date.now();
  const maxWindowSec = Math.max(...rules.map(r => r.windowSec));
  const sinceIso = new Date(now - maxWindowSec * 1000).toISOString();

  const { data, error } = await supabase
    .from('ai_rate_limits')
    .select('created_at')
    .eq('user_id', userId)
    .eq('route', route)
    .gte('created_at', sinceIso);

  if (error) {
    // Table missing or query failed — don't block the product on the limiter.
    console.error('[ratelimit] check failed (run the ai_rate_limits migration):', error.message);
    return null;
  }

  const times = (data ?? []).map(r => new Date(r.created_at as string).getTime());
  for (const rule of rules) {
    const cutoff = now - rule.windowSec * 1000;
    const inWindow = times.filter(t => t >= cutoff);
    if (inWindow.length >= rule.limit) {
      const oldest = Math.min(...inWindow);
      const retryAfter = Math.max(1, Math.ceil((oldest + rule.windowSec * 1000 - now) / 1000));
      return NextResponse.json(
        { error: 'Too many requests — please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
  }

  // Record this request (best-effort) and opportunistically prune old rows.
  await supabase.from('ai_rate_limits').insert({ user_id: userId, workspace_id: workspaceId ?? null, route });
  if (times.length > rules.reduce((m, r) => Math.max(m, r.limit), 0) * 2) {
    await supabase.from('ai_rate_limits').delete().eq('user_id', userId).eq('route', route).lt('created_at', sinceIso);
  }
  return null;
}
