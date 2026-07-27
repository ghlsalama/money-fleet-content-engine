import { config } from './config.js';
import { log } from './log.js';
import { chat } from './llm.js';

// STEP 5b — Social repurpose. Produces 2-3 short posts per article and publishes them
// to the free, open APIs of Bluesky and Mastodon (Twitter/X now charges for write
// access, so it is deliberately excluded to keep this ~$0 and hands-off).
//
// Distribution plan (no spam, no bots-mention spam):
//   hook #1 → Bluesky, immediately
//   hook #2 → Mastodon, immediately
//   hook #3 → Mastodon, scheduled ~1 day out (Mastodon supports scheduled_at natively)

const BSKY = config.bluesky.host || 'https://bsky.social';
const DAY_MS = 24 * 60 * 60 * 1000;

function trim(text, max = 280) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

// Three distinct hooks via one LLM call; falls back to templated hooks if no model/err.
async function makeHooks({ draft, url }) {
  const link = url ? ` ${url}` : '';
  const sys =
    `You write punchy, honest social copy for ${config.siteName}, a backyard-astronomy site. ` +
    'No hashtags spam (one or two max), no emoji soup, no clickbait, no exclamation overload. Voice: calm expert.';
  const user =
    `Write THREE DIFFERENT short social posts (max 270 chars each) promoting this article. ` +
    'Each on its own line, no numbering, no quotes. Vary the angle across the three (e.g. a tip, a curiosity, a question).\n\n' +
    `TITLE: ${draft.title}\nDESC: ${draft.metaDescription || ''}\n` +
    `NOTE: append this exact URL at the end of each post when it fits:${link || ' (no url available)'}`;
  try {
    const raw = await chat({ system: sys, user, temperature: 0.8, maxTokens: 500 });
    const hooks = raw
      .split('\n')
      .map((l) => l.replace(/^["'\-\d.\)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((h) => trim(h));
    if (hooks.length) {
      // Pad with templated fallbacks (NOT duplicates) so the two Mastodon posts to the
      // same account are never identical text.
      const fallbacks = [
        trim(`New on ${config.siteName}: ${draft.title}.${link}`),
        trim(`${draft.metaDescription || draft.title} — read the full guide.${link}`),
        trim(`Quick stargazing read: ${draft.title}.${link}`),
      ];
      while (hooks.length < 3) hooks.push(fallbacks[hooks.length]);
      return hooks;
    }
  } catch (e) {
    log.warn('Social hook generation fell back to templates:', e.message);
  }
  // Templated fallback (always works, no LLM needed).
  return [
    trim(`New on ${config.siteName}: ${draft.title}.${link}`),
    trim(`${draft.metaDescription || draft.title} — read the full guide.${link}`),
    trim(`Quick stargazing read: ${draft.title}.${link}`),
  ];
}

async function bluesky(text) {
  if (!config.bluesky.identifier || !config.bluesky.password) {
    log.info('Bluesky credentials not set — skipping Bluesky post.');
    return false;
  }
  try {
    const sess = await fetch(`${BSKY}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: config.bluesky.identifier, password: config.bluesky.password }),
    });
    const sj = await sess.json().catch(() => ({}));
    if (!sess.ok || !sj.accessJwt) throw new Error(`session HTTP ${sess.status}`);
    const rec = await fetch(`${BSKY}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sj.accessJwt}` },
      body: JSON.stringify({
        repo: sj.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString(), langs: ['en'] },
      }),
    });
    if (!rec.ok) throw new Error(`post HTTP ${rec.status}`);
    log.info(`Posted to Bluesky: ${text.slice(0, 60)}…`);
    return true;
  } catch (e) {
    log.warn(`Bluesky post failed: ${e.message}`);
    return false;
  }
}

async function mastodon(text, scheduledAt = null) {
  if (!config.mastodon.baseUrl || !config.mastodon.token) {
    log.info('Mastodon credentials not set — skipping Mastodon post.');
    return false;
  }
  try {
    const form = new URLSearchParams({ status: text, visibility: 'public' });
    if (scheduledAt) form.set('scheduled_at', scheduledAt);
    const res = await fetch(`${config.mastodon.baseUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.mastodon.token}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${t.slice(0, 150)}`);
    }
    const label = scheduledAt ? `Mastodon (scheduled ${scheduledAt})` : 'Mastodon';
    log.info(`Posted to ${label}: ${text.slice(0, 60)}…`);
    return true;
  } catch (e) {
    log.warn(`Mastodon post failed: ${e.message}`);
    return false;
  }
}

export async function postSocial({ draft, url }) {
  const hooks = await makeHooks({ draft, url });
  const results = { hooks, bluesky: false, mastodon: false, mastodonScheduled: false };

  if (config.dryRun) {
    log.info('DRY_RUN — generated social hooks (not posting):');
    hooks.forEach((h, i) => log.info(`  #${i + 1}: ${h}`));
    return results;
  }

  results.bluesky = await bluesky(hooks[0]);
  results.mastodon = await mastodon(hooks[1]);
  const inADay = new Date(Date.now() + DAY_MS).toISOString();
  results.mastodonScheduled = await mastodon(hooks[2], inADay);
  return results;
}
