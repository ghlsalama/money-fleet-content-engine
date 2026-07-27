import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

// config.js reads env at import (and is cached after first load), so set all env
// BEFORE any dynamic import below.
process.env.BLOG_BASE_URL = 'https://example.com';
process.env.SITE_NAME = 'TestSky';
process.env.AFFILIATE_DISCLOSURE = 'Test disclosure.';
process.env.AMAZON_ASSOC_TAG = 'test-20';

const { allTopics, pickTopic } = await import(path.join(SRC, 'topics.js'));
const { renderPost, renderIndex } = await import(path.join(SRC, 'template.js'));

test('topic list is non-empty and each topic is well-formed', () => {
  const all = allTopics();
  assert.ok(all.length >= 12, 'should have a healthy rotation');
  for (const t of all) {
    assert.ok(t.id && t.title && t.angle && Array.isArray(t.keywords), `bad topic: ${JSON.stringify(t)}`);
    assert.match(t.id, /^[a-z0-9-]+$/, 'id must be slug-safe');
  }
});

test('pickTopic never returns one of the last 12 published, and is deterministic within a week', () => {
  const state = { published: allTopics().slice(0, 12).map((t) => ({ id: t.id })) };
  const t = pickTopic(state);
  assert.ok(t, 'returns a topic');
  const recentIds = new Set(state.published.map((p) => p.id));
  assert.ok(!recentIds.has(t.id), 'must avoid recently published');
  assert.equal(pickTopic(state).id, t.id, 'same week must pick the same topic (idempotent)');
});

test('renderPost includes SEO meta, JSON-LD, canonical, and the affiliate disclosure', () => {
  const html = renderPost({
    title: 'How to See Jupiter',
    description: 'A beginner guide.',
    html: '<p>Body.</p>',
    slug: 'how-to-see-jupiter',
    dateIso: '2026-07-27T00:00:00Z',
  });
  assert.match(html, /<title>How to See Jupiter<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical" href="https:\/\/example\.com\/posts\/how-to-see-jupiter\.html"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"Article"/);
  assert.match(html, /Test disclosure/);
});

test('renderIndex lists published posts newest-first', () => {
  const html = renderIndex([
    { title: 'Older', slug: 'older', at: '2026-01-01T00:00:00Z' },
    { title: 'Newer', slug: 'newer', at: '2026-07-01T00:00:00Z' },
  ]);
  assert.ok(html.indexOf('Newer') < html.indexOf('Older'), 'newest should come first');
});

test('fact-check module appends Sources, a disclosure, and FTC-compliant tagged affiliate links', async () => {
  const mod = await import(path.join(SRC, 'factcheck.js') + '?t=' + Date.now());
  const out = mod.processArticle({
    draft: { title: 'Test', metaDescription: 'Desc', body: '## Intro\nA claim [1].\n\n## Section Two\nMore [2].' },
    research: {
      sources: [
        { n: 1, title: 'Wikipedia: Test', url: 'https://en.wikipedia.org/wiki/Test', snippet: 'x' },
        { n: 2, title: 'NASA APOD', url: 'https://apod.nasa.gov/', snippet: 'y' },
      ],
    },
    topic: { id: 'binoculars', title: 'Best Binoculars for Stargazing', keywords: ['binoculars'] },
  });
  assert.match(out.body, /## Sources/);
  assert.match(out.body, /en\.wikipedia\.org/);
  assert.match(out.body, /tag=test-20/, 'affiliate tag must be appended to gear links');
  assert.doesNotMatch(out.body, /\?k=[^&"]*\?tag=/, 'must not produce a malformed double-? search URL');
  assert.match(out.body, /rel="nofollow sponsored noopener"/, 'FTC/Google-compliant rel attributes');
});

test('slugify produces a clean ASCII slug', async () => {
  const { slugify } = await import(path.join(SRC, 'publish.js') + '?t=' + Date.now());
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify("How to See Jupiter's Rings"), 'how-to-see-jupiters-rings');
});
