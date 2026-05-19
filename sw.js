/*
 * QuestIRL Service Worker
 * ────────────────────────────────────────────────────────────────────
 *  Precaches the app shell + image assets so weak-connection players
 *  don't see images pop in as they navigate. On every BUILD_VERSION
 *  bump (synced via the page's update-check), the SW installs a new
 *  cache, swaps it in, and reloads the page atomically.
 *
 *  Caching strategy:
 *    • HTML + manifest → network-first (so deploys pick up fast)
 *    • Static assets (img/, manifest icons) → cache-first (instant)
 *    • Music → cache-on-fetch (don't blow up first-visit download)
 *    • API calls (Anthropic, OpenAI, Firebase, Cloudflare relay) →
 *      bypass SW entirely (network-only, no caching)
 * ────────────────────────────────────────────────────────────────────
 */

// Bump this string in lockstep with index.html's BUILD_VERSION whenever
// you want a cache reset. The page also passes its build version via
// postMessage on registration — see version-sync in the install hook.
const CACHE_VERSION = 'questirl-v2026.05.19.235';

// App shell — must succeed for the site to work offline.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
];

// Image assets to precache. List is hand-curated to focus on assets
// the player sees in the first ~60 seconds of play. Music files,
// occasionally-used animation frames, and boss-specific images that
// only appear in some quests are cached on-fetch instead.
const IMAGE_ASSETS = [
  // Favicons / install icons
  'img/favicon.png',
  'img/favicon-32.png',
  'img/apple-touch-icon.png',

  // Home / tabs / core UI
  'img/home.png',
  'img/bag.png',
  'img/profile.png',
  'img/store.png',
  'img/torch.png',
  'img/pvp.png',
  'img/swords.png',
  'img/solo.png',
  'img/unhinged.png',
  'img/unhinged_head.png',
  'img/unhinged_laugh_close.png',
  'img/unhinged_laugh_open.png',
  'img/quest_irl_logo.png',
  'img/cabinet_pedestal.png',

  // Arcade frame
  'img/arcade_buttons.png',
  'img/arcade_coinslot.png',
  'img/arcade_controls_panel.png',
  'img/arcade_joystick.png',

  // Setup picker icons
  'img/place_birthday.png',
  'img/place_campus.png',
  'img/place_downtown.png',
  'img/place_home.png',
  'img/place_mall.png',
  'img/place_park.png',
  'img/place_restaurant.png',
  'img/place_roadtrip.png',
  'img/vibe_chaotic.png',
  'img/vibe_chill.png',
  'img/vibe_cozy.png',
  'img/vibe_nostalgic.png',
  'img/vibe_romantic.png',
  'img/vibe_spicy.png',
  'img/vibe_unhinged.png',
  'img/vibe_wholesome.png',
  'img/gamemode_chaos.png',
  'img/gamemode_compete.png',
  'img/gamemode_coop.png',
  'img/tier_bold.png',
  'img/tier_brave.png',
  'img/tier_chaos.png',
  'img/tier_nightmare.png',
  'img/tier_warmup.png',

  // Avatars (chibi roster)
  'img/avatar_dino.png',
  'img/avatar_dragon.png',
  'img/avatar_fox.png',
  'img/avatar_genie.png',
  'img/avatar_ghost.png',
  'img/avatar_octopus.png',
  'img/avatar_owl.png',
  'img/avatar_robot.png',
  'img/avatar_unicorn.png',
  'img/avatar_vampire.png',
  'img/avatar_vettech.png',
  'img/avatar_wizard.png',
  'img/avatar_wolf.png',

  // System AI face states (sprites for talking animations)
  'img/system/dramatic.png',
  'img/system/dramatic_talk.png',
  'img/system/fail.png',
  'img/system/fail_talk.png',
  'img/system/idle.png',
  'img/system/idle_talk.png',
  'img/system/laugh_close.png',
  'img/system/laugh_open.png',
  'img/system/smug.png',
  'img/system/smug_talk.png',

  // HUD strip
  'img/hud_hp.png',
  'img/hud_steps.png',
  'img/hud_streak.png',
  'img/hud_tier.png',
  'img/hud_timer.png',

  // Step type icons
  'img/step_final.png',
  'img/step_find.png',
  'img/step_move.png',
  'img/step_pose.png',
  'img/step_puzzle.png',
  'img/step_social.png',

  // Common UI icons
  'img/ui_bell.png',
  'img/ui_bolt.png',
  'img/ui_bulb.png',
  'img/ui_camera.png',
  'img/ui_close.png',
  'img/ui_coins.png',
  'img/ui_copy.png',
  'img/ui_copy_code.png',
  'img/ui_fail.png',
  'img/ui_finish.png',
  'img/ui_help.png',
  'img/ui_hint.png',
  'img/ui_home.png',
  'img/ui_invite_link.png',
  'img/ui_lens.png',
  'img/ui_level.png',
  'img/ui_link.png',
  'img/ui_loyal.png',
  'img/ui_medal_bronze.png',
  'img/ui_medal_gold.png',
  'img/ui_medal_silver.png',
  'img/ui_mode_chaos.png',
  'img/ui_mode_compete.png',
  'img/ui_mode_coop.png',
  'img/ui_music.png',
  'img/ui_pass.png',
  'img/ui_pencil.png',
  'img/ui_pin.png',
  'img/ui_reroll.png',
  'img/ui_roast.png',
  'img/ui_role_mask.png',
  'img/ui_satellite.png',
  'img/ui_save.png',
  'img/ui_scoreboard.png',
  'img/ui_settings.png',
  'img/ui_share.png',
  'img/ui_skull.png',
  'img/ui_sound_off.png',
  'img/ui_sound_on.png',
  'img/ui_story.png',
  'img/ui_system.png',
  'img/ui_target.png',
  'img/ui_timeout.png',
  'img/ui_traitor.png',
  'img/ui_waiting.png',
  'img/ui_warn.png',
  'img/ui_why.png',

  // Status badges
  'img/status_alert.png',
  'img/status_completed.png',
  'img/status_failed.png',
  'img/status_locked.png',
  'img/status_star.png',

  // Chat / share
  'img/chat_bubble.png',
  'img/chat_emoji.png',
  'img/chat_send.png',

  // Multiplayer entry
  'img/mp_create.png',
  'img/mp_join.png',
  'img/mp_reconnect.png',

  // Music UI
  'img/music_off.png',
  'img/music_on.png',
  'img/setting_loop.png',
  'img/setting_reset.png',
  'img/setting_sequential.png',
  'img/setting_shuffle.png',
  'img/setting_sound_off.png',
  'img/setting_sound_on.png',

  // Crate / reward animations (4-frame strips per tier)
  'img/crate_bold.png', 'img/crate_bold_0.png', 'img/crate_bold_1.png', 'img/crate_bold_2.png', 'img/crate_bold_3.png',
  'img/crate_brave.png', 'img/crate_brave_0.png', 'img/crate_brave_1.png', 'img/crate_brave_2.png', 'img/crate_brave_3.png',
  'img/crate_chaos.png', 'img/crate_chaos_0.png', 'img/crate_chaos_1.png', 'img/crate_chaos_2.png', 'img/crate_chaos_3.png',
  'img/crate_nightmare.png', 'img/crate_nightmare_0.png', 'img/crate_nightmare_1.png', 'img/crate_nightmare_2.png', 'img/crate_nightmare_3.png',
  'img/crate_warmup.png', 'img/crate_warmup_0.png', 'img/crate_warmup_1.png', 'img/crate_warmup_2.png', 'img/crate_warmup_3.png',

  // Hero crew (party loading + idle)
  'img/hero_crew_charge_0.png', 'img/hero_crew_charge_1.png', 'img/hero_crew_charge_2.png', 'img/hero_crew_charge_3.png',
  'img/hero_crew_idle_0.png', 'img/hero_crew_idle_1.png', 'img/hero_crew_idle_2.png', 'img/hero_crew_idle_3.png',

  // Solo fight transitions
  'img/solo_fight_1a.png', 'img/solo_fight_1b.png', 'img/solo_fight_2a.png', 'img/solo_fight_2b.png',

  // Store category icons
  'img/store_buffs.png',
  'img/store_frames.png',
  'img/store_gear.png',
  'img/store_wand.png',

  // Inventory items (all in img/items/)
  'img/items/bookmark.png', 'img/items/champion.png', 'img/items/chaoscoin.png', 'img/items/compass.png',
  'img/items/contract.png', 'img/items/doubledmg.png', 'img/items/dx.png', 'img/items/focus.png',
  'img/items/grace.png', 'img/items/hint.png', 'img/items/horizon.png', 'img/items/innerfire.png',
  'img/items/kibble.png', 'img/items/kraft.png', 'img/items/lens.png', 'img/items/lonewolf.png',
  'img/items/mainchar.png', 'img/items/medallion.png', 'img/items/meditate.png', 'img/items/mirrorcurse.png',
  'img/items/mood.png', 'img/items/overtime.png', 'img/items/partypopper.png', 'img/items/reroll.png',
  'img/items/sanctuary.png', 'img/items/second.png', 'img/items/shadow.png', 'img/items/shield.png',
  'img/items/snack.png', 'img/items/time.png', 'img/items/whisperhex.png', 'img/items/whistle.png',

  // Frames (incl 4-frame anim variants for the animated ones)
  'img/frame_arcadeking.png',
  'img/frame_arcadeking_anim_0.png', 'img/frame_arcadeking_anim_1.png',
  'img/frame_arcadeking_anim_2.png', 'img/frame_arcadeking_anim_3.png',
  'img/frame_aurora.png',
  'img/frame_bronze.png',
  'img/frame_crown.png',
  'img/frame_eldritch.png',
  'img/frame_eldritch_anim_0.png', 'img/frame_eldritch_anim_1.png',
  'img/frame_eldritch_anim_2.png', 'img/frame_eldritch_anim_3.png',
  'img/frame_fire.png',
  'img/frame_ghostly.png',
  'img/frame_glass.png',
  'img/frame_goblin.png',
  'img/frame_gremlin.png',
  'img/frame_gremlin_anim_0.png', 'img/frame_gremlin_anim_1.png',
  'img/frame_gremlin_anim_2.png', 'img/frame_gremlin_anim_3.png',
  'img/frame_honey.png',
  'img/frame_lavender.png',
  'img/frame_mercury.png',
  'img/frame_mint.png',
  'img/frame_rainbow.png',
  'img/frame_ruby.png',
  'img/frame_shattered.png',
  'img/frame_shattered_anim_0.png', 'img/frame_shattered_anim_1.png',
  'img/frame_shattered_anim_2.png', 'img/frame_shattered_anim_3.png',
  'img/frame_silver.png',
  'img/frame_static.png',
  'img/frame_vetshalo.png',
  'img/frame_vetshalo_anim_0.png', 'img/frame_vetshalo_anim_1.png',
  'img/frame_vetshalo_anim_2.png', 'img/frame_vetshalo_anim_3.png',
  'img/frame_void.png',
  'img/frame_wraith.png',

  // Twist cards
  'img/twist_bored.png', 'img/twist_clown.png', 'img/twist_mascot.png', 'img/twist_narrator.png',
  'img/twist_noback.png', 'img/twist_panic.png', 'img/twist_phoneswap.png', 'img/twist_silence.png',
  'img/twist_staredown.png',

  // Sabotage cards
  'img/sab_blind.png', 'img/sab_bossheal.png', 'img/sab_shaky.png',

  // Wheel of consequence
  'img/wheel_badaccent.png', 'img/wheel_compliment.png', 'img/wheel_confess.png',
  'img/wheel_freepass.png', 'img/wheel_gremlinmode.png', 'img/wheel_imitateboss.png',
  'img/wheel_loudlaugh.png', 'img/wheel_phonestack.png', 'img/wheel_plank.png',
  'img/wheel_serenade.png', 'img/wheel_shameselfie.png', 'img/wheel_voicemail.png',

  // Achievements + unlock badges
  'img/ach_gift.png', 'img/ach_lock.png', 'img/ach_sparkle.png', 'img/ach_star.png', 'img/ach_trophy.png',
  'img/unlock_badge.png', 'img/unlock_frame.png', 'img/unlock_item.png', 'img/unlock_title.png',

  // Bosses
  'img/bosses/cat_door_specter.png', 'img/bosses/couch_goblin.png', 'img/bosses/default_mode_specter.png',
  'img/bosses/doomscroll_hydra.png', 'img/bosses/doomscroll_wraith.png', 'img/bosses/doubt_echo.png',
  'img/bosses/hoof_beat_echo.png', 'img/bosses/inertia_beast.png', 'img/bosses/lava_lord.png',
  'img/bosses/lord_pleaseno.png', 'img/bosses/microwave_goblin.png', 'img/bosses/optimization_grendel.png',
  'img/bosses/perfectionism_specter.png', 'img/bosses/polling_hydra.png', 'img/bosses/ripley.png',
  'img/bosses/self_surveillance_wraith.png', 'img/bosses/sign_blindness_spectre.png',
  'img/bosses/stable_wraith.png', 'img/bosses/trivia_wraith.png', 'img/bosses/vault_wraith.png',
];

const ALL_PRECACHE = [...CORE_ASSETS, ...IMAGE_ASSETS];

self.addEventListener('install', (event) => {
  // Pre-cache the entire asset list. Each cache.add() is wrapped in a
  // catch so one missing file doesn't refuse the whole install — if a
  // single image is renamed, the SW still activates and the missing
  // one falls back to a network fetch (then auto-caches on hit).
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(
      ALL_PRECACHE.map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch(err => console.warn('[SW precache miss]', url, err.message))
      )
    );
    // Take over from any old SW immediately on first install.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  // Delete any caches that aren't the current version.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_VERSION && k.startsWith('questirl-'))
        .map(k => caches.delete(k))
    );
    // Take control of all open tabs without requiring a reload.
    await self.clients.claim();
  })());
});

// Hostnames that must NEVER be intercepted — these are live data calls.
const BYPASS_HOSTS = [
  'api.anthropic.com',
  'api.openai.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

function shouldBypass(url) {
  if (BYPASS_HOSTS.includes(url.hostname)) return true;
  // Any *.workers.dev (the Cloudflare relay) — never cache
  if (url.hostname.endsWith('.workers.dev')) return true;
  // Firebase storage, firestore, firebaseio — bypass all
  if (url.hostname.endsWith('.firebaseio.com')) return true;
  if (url.hostname.endsWith('.firebaseapp.com')) return true;
  if (url.hostname.endsWith('.firebasestorage.app')) return true;
  if (url.hostname.endsWith('.googleapis.com')) return true;
  if (url.hostname.endsWith('.gstatic.com')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;            // only intercept GETs
  const url = new URL(req.url);
  if (shouldBypass(url)) return;               // let live data through
  if (url.origin !== self.location.origin) return; // CDNs etc. — skip

  // Navigations + HTML → network-first (so deploys go live fast).
  // Falls back to cached index.html if offline.
  if (req.mode === 'navigate' || (req.destination === 'document') ||
      url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last-resort offline fallback.
        return caches.match('./index.html');
      }
    })());
    return;
  }

  // Everything else → cache-first, then network. Cache successful
  // network responses so eventually everything ends up cached even if
  // it wasn't in the precache list (music, late-added bosses, etc.).
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // Network failed and nothing in cache — just propagate the error
      // so the <img> shows broken instead of hanging forever.
      return Response.error();
    }
  })());
});

// Listen for the page asking us to swap to a new version immediately
// (the "Update available — tap to reload" prompt flow).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
