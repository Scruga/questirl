// QuestIRL → Anthropic relay (Cloudflare Worker).
//
// Why: the Anthropic API key cannot live in the QuestIRL client. Anyone
// who opens the page can view source and steal it. This Worker holds the
// key as an env var, accepts requests from the QuestIRL client, and
// forwards them to Anthropic. Client never sees the key.
//
// Env vars (set via `wrangler secret put`):
//   ANTHROPIC_API_KEY  — your sk-ant-... key
//   ALLOWED_ORIGINS    — comma-separated list of origins allowed to call
//                        this worker (e.g. "https://questirl.gg").
//                        Use "*" only for local testing.
//
// Endpoint:
//   POST /  — body forwarded verbatim to https://api.anthropic.com/v1/messages
//   GET  /healthz — returns 200 + "ok" for uptime checks
//
// Rate limiting (P0 stub): we rely on the Anthropic daily-spend cap as
// the primary cost ceiling. Per-IP rate limiting can be added in P1 when
// we have proper auth + sessions. The cf-ray header + Cloudflare
// firewall rules cover bot abuse for now.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS — compute the allowed origin for this request. We normalize
    // both sides (strip trailing slash, lowercase) so subtle URL drift
    // (e.g. https://x.com/ vs https://x.com) doesn't fail-closed.
    const norm = (s) => (s || '').toLowerCase().replace(/\/$/, '');
    const allowed = (env.ALLOWED_ORIGINS || '*')
      .split(',').map(s => norm(s)).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const originNorm = norm(origin);
    const wildcard = allowed.includes('*');
    const isAllowed = wildcard || allowed.includes(originNorm);
    // When wildcard is on we echo the request origin (or '*' if none),
    // which is what browsers expect for credentialless requests.
    const corsOrigin = wildcard
      ? (origin || '*')
      : (isAllowed ? origin : null);

    const corsHeaders = corsOrigin ? {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, anthropic-version',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    } : {
      // No CORS headers — browser will block. Useful diagnostic in console.
      'Vary': 'Origin',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Uptime check
    if (url.pathname === '/healthz') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405, headers: corsHeaders,
      });
    }

    // Block requests from disallowed origins.
    if (!corsOrigin) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'relay_misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Forward the body to Anthropic. Client sends the same JSON shape as
    // a direct Anthropic call (model, max_tokens, system, messages, etc.)
    // We just inject the auth header.
    const body = await request.text();
    let upstreamRes;
    try {
      upstreamRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
        },
        body,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'upstream_unreachable', detail: String(e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Stream the response back verbatim. Preserves Anthropic error
    // bodies so the client gets useful diagnostics on 4xx/5xx.
    const respHeaders = {
      'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json',
      ...corsHeaders,
    };
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  },
};
