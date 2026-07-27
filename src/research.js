import { config } from './config.js';
import { log } from './log.js';

// STEP 1 — Research. Pulls ONLY from free, public, programmatic APIs that welcome
// machine use (Wikipedia REST/API and NASA's public APIs). No scraping of websites.
// Returns a numbered source list with stable, citable URLs that the draft cites inline
// and that are appended verbatim as the article's "Sources" section.

async function wikiSearch(query) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(`${query} astronomy`)}&format=json&origin=*&srlimit=3`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Wikipedia search HTTP ${r.status}`);
  const j = await r.json();
  return (j?.query?.search || []).map((x) => x.title);
}

async function wikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.extract) return null;
  return {
    title: j.title,
    extract: j.extract,
    url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(j.title)}`,
  };
}

async function apod() {
  try {
    const url = `https://api.nasa.gov/planetary/apod?api_key=${config.nasaKey}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return {
      title: j.title,
      explanation: j.explanation,
      image: j.url,
      date: j.date,
      cite: 'https://apod.nasa.gov/apod/astropix.html',
    };
  } catch (e) {
    log.warn('APOD fetch failed:', e.message);
    return null;
  }
}

async function neoFeed() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&api_key=${config.nasaKey}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const list = j?.near_earth_objects?.[today] || [];
    return list.slice(0, 5).map((o) => ({
      name: o.name,
      approach: o.close_approach_data?.[0]?.close_approach_date,
    }));
  } catch (e) {
    log.warn('NEO feed fetch failed:', e.message);
    return null;
  }
}

export async function researchTopic(topic) {
  log.info(`Researching topic: ${topic.title}`);
  const sources = [];
  let n = 0;
  const add = (s) => {
    if (s && s.url && s.title) {
      n += 1;
      sources.push({ n, title: s.title, url: s.url, snippet: s.extract || s.explanation || '' });
    }
  };

  // Primary: Wikipedia (authoritative, stable URLs, explicitly public API).
  try {
    const titles = await wikiSearch(topic.title);
    for (const t of titles.slice(0, 2)) {
      const s = await wikiSummary(t);
      if (s) add(s);
    }
  } catch (e) {
    log.warn('Wikipedia research failed:', e.message);
  }

  // Supplementary + always-citable: NASA Astronomy Picture of the Day.
  const a = await apod();
  if (a) add({ title: `NASA APOD: ${a.title} (${a.date})`, url: a.cite, extract: a.explanation });

  // Extra real data for meteor/asteroid/comet topics: NASA CNEOS near-Earth-object feed.
  const text = `${topic.title} ${topic.angle || ''}`;
  if (/meteor|asteroid|comet|neo|shower/i.test(text)) {
    const neo = await neoFeed();
    if (neo && neo.length) {
      add({
        title: 'NASA CNEOS Near-Earth Object feed',
        url: 'https://cneos.jpl.nasa.gov/',
        extract: `Notable close approaches around ${new Date().toISOString().slice(0, 10)}: ${neo
          .map((x) => x.name)
          .join(', ')}.`,
      });
    }
  }

  if (!sources.length) {
    // Refuse to publish an uncited article rather than hallucinate.
    throw new Error('No citable sources found for topic — aborting to protect quality.');
  }

  log.info(`Gathered ${sources.length} citable sources.`);
  return { topic, sources, apodImage: a?.image || null };
}
