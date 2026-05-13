# QuestIRL Anthropic relay

A 60-line Cloudflare Worker that holds the Anthropic API key server-side
and forwards QuestIRL client requests. The client never sees the key.

## Why this exists

Hardcoding `sk-ant-...` into the QuestIRL HTML would leak the key the
first time anyone opens the site (`View Source` → key exposed →
scraped within hours → drained). The relay is the minimum viable
server-side proxy so testers (and eventually all players) don't have
to bring their own key.

## Setup (one-time, ~10 minutes)

```bash
# 1. Install Wrangler (Cloudflare's CLI)
npm install -g wrangler

# 2. Log in (opens a browser tab)
wrangler login

# 3. cd into this folder
cd relay

# 4. Edit wrangler.toml — set ALLOWED_ORIGINS to your deploy URL.
#    Use "*" only for local testing.

# 5. Store the Anthropic key as a secret (NOT in any file)
wrangler secret put ANTHROPIC_API_KEY
# (paste your sk-ant-... key when prompted)

# 6. Deploy
wrangler deploy
# Wrangler will print the worker URL — copy it.
```

## Wire it into QuestIRL

1. Open `index.html`.
2. Find the `RELAY_URL` constant near the top of the `<script>` block.
3. Replace the placeholder with the worker URL you got from `wrangler deploy`,
   e.g. `https://questirl-relay.YOURNAME.workers.dev`.
4. Deploy `index.html` to your host. Done — testers no longer need a key.

## Costs

- Cloudflare Workers free tier: 100,000 requests/day. A solo run is ~6
  Anthropic calls (boss + 5 step judgments), so this covers ~16,000
  solo runs/day. Plenty for P0 testing.
- Anthropic: set a daily spend cap in your account dashboard ($20 is
  the suggested starting point). The relay does not enforce any cap
  itself — that's the upstream's job in P0.

## Optional hardening for P0

If you start getting abuse before P1 is ready:

1. Add Cloudflare WAF rules to your worker route to block bot user-agents.
2. Enable Cloudflare's built-in rate-limiting rules (3000 free
   evaluations/month).
3. Switch `ALLOWED_ORIGINS` from `*` to your specific deploy URL — the
   relay will reject requests with no/wrong Origin header.

## Migration to Supabase (P1)

When you do Phase 1, port `worker.js` to a Supabase Edge Function. The
shape is almost identical — same input, same output, same env var
pattern. The QuestIRL client just needs a new `RELAY_URL` and that's it.
