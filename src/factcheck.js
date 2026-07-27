import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { log } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, '..', 'topics', 'products.json');

let products = [];
try {
  products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
} catch (e) {
  log.warn('topics/products.json could not be loaded:', e.message);
}

// STEP 3 — Fact-check / citations + monetization wiring.
// "Fact-check" here = citation grounding: the draft was forced to use only the research
// material and cite inline; we now append the verbatim Sources list so every [n] resolves
// to a real public URL. We also insert affiliate links + an AdSense slot + disclosures.

function affiliateLink(p) {
  // Build the base product URL, then append the associate tag with the correct
  // separator (? for /dp/ links, & for /s? search links) so we never produce a
  // malformed double-? URL.
  //
  // ToS note: Amazon Associates prefers links generated via SiteStripe or the Product
  // Advertising API. `/dp/<ASIN>?tag=` product links (p.asin populated) are the safest
  // pattern; the `/s?k=...&tag=` search fallback (used when no ASIN is on file) is a soft
  // gray area and may risk commission voiding. Populate `asin` in topics/products.json
  // for each product to lock in the compliant product-link form.
  const base = p.asin
    ? `https://www.amazon.com/dp/${p.asin}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(p.query || p.name)}`;
  if (!config.amazon.tag) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}tag=${config.amazon.tag}`;
}

function matchProducts(topic, limit = 2) {
  const hay = `${topic.title} ${topic.angle || ''} ${(topic.keywords || []).join(' ')}`.toLowerCase();
  let scored = products
    .map((p) => ({
      p,
      sc: (p.topics || []).reduce((acc, k) => acc + (hay.includes(k.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc);

  if (!scored.length) {
    // Fallback: general-interest stargazing picks so the section is never empty.
    scored = products.filter((p) => (p.topics || []).includes('general')).map((p) => ({ p, sc: 1 }));
  }
  return scored.slice(0, limit).map((x) => x.p);
}

function gearSection(topic) {
  if (!config.amazon.tag) {
    log.info('No AMAZON_ASSOC_TAG — skipping affiliate gear section.');
    return '';
  }
  const picks = matchProducts(topic);
  if (!picks.length) return '';
  const items = picks
    .map((p) => {
      const url = affiliateLink(p);
      return `- **${p.name}** — ${p.note} <a href="${url}" rel="nofollow sponsored noopener" target="_blank">Check current price on Amazon</a>`;
    })
    .join('\n');
  return `\n\n## Recommended gear\n${items}\n`;
}

function adBlock() {
  if (!config.adsense.client) return '';
  const slotAttr = config.adsense.slot ? ` data-ad-slot="${config.adsense.slot}"` : '';
  return (
    `\n\n<div style="text-align:center;margin:1.5em 0">\n` +
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsense.client}" crossorigin="anonymous"></script>\n` +
    `<ins class="adsbygoogle" style="display:block" data-ad-format="auto" data-ad-layout="in-article"${slotAttr} data-ad-client="${config.adsense.client}"></ins>\n` +
    `</div>\n`
  );
}

export function processArticle({ draft, research, topic }) {
  let md = draft.body.trim();
  const sources = research.sources;

  // 1) Disclosure at the very top (FTC-compliant + optional AI disclosure).
  const aiNote = config.discloseAi
    ? ' This article was drafted with AI assistance and is fact-checked against the sources listed below.'
    : '';
  md = `*${config.affiliateDisclosure}${aiNote}*\n\n` + md;

  // 2) Insert one in-article ad slot after the first section heading (if AdSense is on).
  if (config.adsense.client) {
    const idx = md.indexOf('\n## ');
    if (idx >= 0) {
      const lineEnd = md.indexOf('\n', idx + 1);
      md = md.slice(0, lineEnd + 1) + adBlock() + md.slice(lineEnd + 1);
    } else {
      md += adBlock();
    }
  }

  // 3) Affiliate "Recommended gear" section (HTML anchors carry rel="nofollow sponsored").
  md += gearSection(topic);

  // 4) Verbatim Sources list — every inline [n] resolves to a real public URL.
  md += '\n\n## Sources\n' + sources.map((s) => `${s.n}. [${s.title}](${s.url})`).join('\n') + '\n';

  return { ...draft, body: md };
}
