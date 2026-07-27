import 'dotenv/config'; // load .env for local runs (no-op in GitHub Actions, where env comes from secrets)
import { log } from './log.js';

// Parse a boolean env var. Treats "", "0", "false" (case-insensitive) as false.
function bool(v, fallback = false) {
  if (v === undefined) return fallback;
  return !['', '0', 'false'].includes(String(v).toLowerCase());
}

function trimTrailingSlash(u) {
  return (u || '').replace(/\/+$/, '');
}

export const config = {
  siteName: process.env.SITE_NAME || 'StarHopper',
  siteTagline: process.env.SITE_TAGLINE || 'Backyard astronomy and stargazing, made simple.',
  blogBaseUrl: trimTrailingSlash(process.env.BLOG_BASE_URL),

  cronSchedule: process.env.CRON_SCHEDULE || '30 10 * * 2,5',
  runOnStart: bool(process.env.RUN_ON_START),
  dryRun: bool(process.env.DRY_RUN),
  discloseAi: bool(process.env.DISCLOSE_AI, true),

  cms: (process.env.CMS || 'hashnode').toLowerCase(),
  hashnode: {
    token: process.env.HASHNODE_TOKEN || '',
    publicationId: process.env.HASHNODE_PUBLICATION_ID || '',
  },

  buttondown: { apiKey: process.env.BUTTONDOWN_API_KEY || '' },

  bluesky: {
    identifier: process.env.BLUESKY_IDENTIFIER || '',
    password: process.env.BLUESKY_APP_PASSWORD || '',
    host: 'https://bsky.social',
  },

  mastodon: {
    baseUrl: trimTrailingSlash(process.env.MASTODON_BASE_URL),
    token: process.env.MASTODON_ACCESS_TOKEN || '',
  },

  amazon: { tag: process.env.AMAZON_ASSOC_TAG || '' },
  adsense: {
    client: process.env.ADSENSE_CLIENT || '',
    slot: process.env.ADSENSE_SLOT || '',
  },

  nasaKey: process.env.NASA_API_KEY || 'DEMO_KEY',

  affiliateDisclosure:
    process.env.AFFILIATE_DISCLOSURE ||
    'As an Amazon Associate I earn from qualifying purchases. Some links are affiliate links, at no extra cost to you.',

  llm: {
    baseUrl: trimTrailingSlash(process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1'),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
  },
};

// Friendly non-fatal provisioning warnings (so a first `npm run dry` works even half-configured).
export function warnIfUnconfigured() {
  if (!config.llm.apiKey) log.warn('LLM_API_KEY not set — drafting will fail until a model key is provided.');
  if (config.cms === 'hashnode' && (!config.hashnode.token || !config.hashnode.publicationId))
    log.warn('HASHNODE_TOKEN / HASHNODE_PUBLICATION_ID not set — articles will be saved as local markdown only.');
  if (!config.amazon.tag) log.warn('AMAZON_ASSOC_TAG not set — affiliate links disabled.');
  if (!config.bluesky.identifier && !config.mastodon.token && !config.buttondown.apiKey)
    log.warn('No newsletter/social keys set — repurpose step will only log posts.');
}
