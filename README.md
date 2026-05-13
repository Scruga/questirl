# questirl

real-life party game. you fight silly fictional bosses by doing
physical or social challenges in your actual location. an AI host
called the system generates the bosses, writes the quest steps, and
judges your proof photos.

solo mode works on its own. party mode needs friends and a 4-letter
room code.

play at https://questirl.gg

## running it

it's a single html file. open `index.html` in a browser and it works.
no build step, no install, no dependencies.

for AI features (generated bosses, photo judging, host chat) the
client talks to a tiny cloudflare worker that holds an anthropic key
server-side. without the worker configured (set `RELAY_URL` near the
top of `index.html`), the app falls back to a canned offline mode.

## the relay

cloudflare worker, ~60 lines. setup steps in `relay/README.md`. tl;dr:

```
cd relay
wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

## status

prototype. expect rough edges. the path forward — backend, native
apps, the chat-with-host classifier — is sketched out in notes that
aren't in this repo yet.

## license

proprietary. see LICENSE. don't repost or fork without asking.

— anton
