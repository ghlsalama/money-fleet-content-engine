import { config } from './config.js';

// Minimal, dependency-free HTML shell for the optional STATIC site (CMS=static).
// It carries: SEO meta + JSON-LD, an in-article AdSense slot (if ADSENSE_CLIENT is
// set), the affiliate disclosure, and a subscribe link. This is the path that makes
// display ads genuinely render; Hashnode hosting relies on affiliate revenue + its
// own sponsorship UI (see PROVISION.md).

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adSlot() {
  if (!config.adsense.client) return '';
  const slotAttr = config.adsense.slot ? ` data-ad-slot="${esc(config.adsense.slot)}"` : '';
  return `
<div class="ad-slot">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.adsense.client)}" crossorigin="anonymous"></script>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(config.adsense.client)}" data-ad-format="auto" data-ad-layout="in-article"${slotAttr} data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function head({ title, description, canonical, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_article">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="/style.css">
</head>`;
}

function header() {
  return `<body>
<header class="site"><div class="wrap">
  <a href="/" class="brand">${esc(config.siteName)}</a>
  <p class="tagline">${esc(config.siteTagline)}</p>
</div></header>
<main class="wrap">`;
}

function footer() {
  return `</main>
<footer class="site"><div class="wrap">
  <p class="disclosure">${esc(config.affiliateDisclosure)}</p>
  <p class="meta">&copy; ${new Date().getUTCFullYear()} ${esc(config.siteName)}. Articles are drafted with AI assistance and fact-checked against the cited sources.</p>
</div></footer>
</body></html>`;
}

export function renderPost({ title, description, html, slug, dateIso }) {
  const canonical = `${config.blogBaseUrl}/posts/${slug}.html`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: dateIso,
    author: { '@type': 'Organization', name: config.siteName },
    publisher: { '@type': 'Organization', name: config.siteName },
    mainEntityOfPage: canonical,
  };
  return `${head({ title, description, canonical, jsonLd })}
${header()}
<article class="post">
${html}
${adSlot()}
</article>
${footer()}`;
}

export function renderIndex(posts = []) {
  const list = posts
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map(
      (p) =>
        `<li><a href="/posts/${esc(p.slug)}.html">${esc(p.title)}</a> <time>${esc(
          (p.at || '').slice(0, 10),
        )}</time></li>`,
    )
    .join('\n');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: config.siteName,
    description: config.siteTagline,
    url: config.blogBaseUrl,
  };
  return `${head({
    title: config.siteName,
    description: config.siteTagline,
    canonical: config.blogBaseUrl,
    jsonLd,
  })}
${header()}
<h1>${esc(config.siteName)}</h1>
<p class="lead">${esc(config.siteTagline)}</p>
<ul class="post-list">
${list || '<li>First post coming soon.</li>'}
</ul>
${footer()}`;
}
