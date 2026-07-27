import { config, warnIfUnconfigured } from './config.js';
import { log } from './log.js';
import { loadState, saveState, recordPublish } from './state.js';
import { pickTopic } from './topics.js';
import { researchTopic } from './research.js';
import { draftArticle } from './draft.js';
import { processArticle } from './factcheck.js';
import { publish } from './publish.js';
import { sendNewsletter } from './newsletter.js';
import { postSocial } from './social.js';

const HOUR = 60 * 60 * 1000;

// Idempotency: if the last successful publish was < 12h ago, skip. This makes retried
// scheduled runs safe (they will not produce a second, different post). Override with
// FORCE_RUN=1.
function recentlyPublished(state) {
  const last = (state.published || []).slice(-1)[0];
  if (!last?.at) return false;
  const age = Date.now() - new Date(last.at).getTime();
  return age < 12 * HOUR;
}

async function step(name, fn) {
  try {
    return await fn();
  } catch (e) {
    log.error(`STEP "${name}" failed: ${e.message}`);
    throw e; // propagate; pipeline aborts without recording a half-finished post
  }
}

export async function runPipeline() {
  warnIfUnconfigured();
  const state = loadState();

  if (recentlyPublished(state) && !process.env.FORCE_RUN) {
    log.info('Last publish was < 12h ago — skipping to avoid duplicates (set FORCE_RUN=1 to override).');
    return { skipped: true };
  }

  const topic = pickTopic(state);
  const research = await step('research', () => researchTopic(topic));
  const draft = await step('draft', () => draftArticle(research));
  // processArticle is synchronous; the await is harmless and keeps the shape uniform.
  const article = await step('factcheck', () => processArticle({ draft, research, topic }));

  log.info(`Drafted: "${article.title}"`);

  const { url, slug } = await step('publish', () => publish({ draft: article, research, topic, state }));

  // Repurpose — best-effort, never abort the whole pipeline if a channel is down.
  if (!config.dryRun) {
    try {
      await sendNewsletter({ draft: article, url });
    } catch (e) {
      log.warn('Newsletter step errored (continuing):', e.message);
    }
    try {
      await postSocial({ draft: article, url });
    } catch (e) {
      log.warn('Social step errored (continuing):', e.message);
    }
  }

  recordPublish(state, {
    id: topic.id,
    slug,
    title: article.title,
    url,
    at: new Date().toISOString(),
  });
  saveState(state);
  log.info(`Pipeline complete. Live: ${url || '(dry-run local)'}`);
  return { skipped: false, url, title: article.title };
}
