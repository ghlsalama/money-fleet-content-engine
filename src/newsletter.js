import { config } from './config.js';
import { log } from './log.js';

// STEP 5a — Newsletter repurpose. Sends the published article to all Buttondown
// subscribers as one email (free tier covers up to 100 subscribers). The body is the
// full article markdown with a header linking back to the live post.
//
// Buttondown docs: https://buttondown.com/api
//   POST https://api.buttondown.com/api/v1/emails  (Authorization: Token <key>)

export async function sendNewsletter({ draft, url }) {
  if (!config.buttondown.apiKey) {
    log.info('BUTTONDOWN_API_KEY not set — skipping newsletter send.');
    return { sent: false };
  }
  if (config.dryRun) {
    log.info(`DRY_RUN — would send newsletter: ${draft.title}`);
    return { sent: false };
  }

  const readLink = url ? `\n\n[Read this on the site →](${url})\n` : '';
  const intro = `*New from ${config.siteName}.* ${draft.metaDescription || ''}\n`;
  const body = intro + readLink + '\n---\n\n' + draft.body;

  try {
    const res = await fetch('https://api.buttondown.com/api/v1/emails', {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.buttondown.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: draft.title,
        body,
        // Buttondown accepts markdown by default.
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      log.warn(`Newsletter send failed (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
      return { sent: false };
    }
    log.info(`Newsletter sent: "${draft.title}"`);
    return { sent: true };
  } catch (e) {
    log.warn('Newsletter send error:', e.message);
    return { sent: false };
  }
}
