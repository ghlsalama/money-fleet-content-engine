import { config } from './config.js';
import { chat } from './llm.js';

// STEP 2 — Draft. The LLM is CONSTRAINED to the research material only: it must cite
// inline as [n] and is told not to invent facts. This is grounding, not "free writing".

export async function draftArticle(research) {
  const { topic, sources } = research;
  const srcBlock = sources
    .map((s) => `[${s.n}] ${s.title} — ${s.url}\n    ${s.snippet}`)
    .join('\n\n');

  const system = [
    `You are the lead writer for ${config.siteName}, a backyard-astronomy and stargazing publication.`,
    `Audience: beginner-to-intermediate hobbyist observers.`,
    `Write ORIGINAL prose in your own words. Be specific and useful: dates, times in UTC with a note to localise, magnitudes, where in the sky to look, and practical observing tips.`,
    `Use ONLY the source material provided. Do NOT invent facts, dates, numbers, magnitudes, or quotes.`,
    `Cite every factual claim inline using [1], [2] ... that map to the numbered sources. If useful detail is missing, say so plainly rather than guessing.`,
    `Tone: friendly, calm, expert. No hype, no clickbait, no keyword stuffing.`,
    `Format: well-structured Markdown with ## section headings. Roughly 700-1100 words.`,
    `Do NOT add a "Sources" list (added automatically). Do NOT add affiliate links or a disclosure (added automatically).`,
    config.discloseAi ? 'Do not mention AI; an editor note is appended automatically if needed.' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    `TOPIC: ${topic.title}`,
    topic.angle ? `ANGLE: ${topic.angle}` : '',
    '',
    'SOURCE MATERIAL (cite inline as [n] matching the numbers):',
    srcBlock,
    '',
    'Respond in EXACTLY this format and nothing else:',
    'TITLE: <article title, max 70 characters, no surrounding quotes>',
    'META: <meta description, max 155 characters>',
    '---',
    '<markdown body>',
  ].join('\n');

  const raw = await chat({ system, user, temperature: 0.7, maxTokens: 1800 });
  return parseDraft(raw, topic);
}

function parseDraft(raw, topic) {
  const split = raw.split(/^---\s*$/m);
  let head = '';
  let body = raw;
  if (split.length >= 2) {
    head = split[0];
    body = split.slice(1).join('\n').trim();
  }

  const titleLine = head.match(/^TITLE:\s*(.+)$/m)?.[1] || body.match(/^#\s+(.+)$/m)?.[1] || topic.title;
  const title = titleLine.trim().replace(/^["']|["']$/g, '').slice(0, 120);
  const meta = (head.match(/^META:\s*(.+)$/m)?.[1] || '').trim().slice(0, 160);

  // Strip the TITLE/META helper lines and any redundant leading H1 from the body.
  body = body
    .replace(/^TITLE:.*$/gm, '')
    .replace(/^META:.*$/gm, '')
    .replace(/^#\s+.+\n*/, '')
    .trim();

  return { title, metaDescription: meta || title, body };
}
