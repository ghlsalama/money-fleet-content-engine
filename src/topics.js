import { log } from './log.js';

// STEP 0 — Topic selection. 24 evergreen, beginner-friendly backyard-astronomy
// topics. Evergreen = the guides stay useful for years, so they keep earning long
// after publish (this is what makes content compound rather than decay).
//
// Selection is DETERMINISTIC by ISO week number: the same calendar week always maps
// to the same topic. That makes the scheduled run idempotent — re-running the same
// week (e.g. a retried GitHub Actions job) will not double-publish a different post.
// We also skip anything published in the last 12 entries so we don't repeat too soon.

const TOPICS = [
  { id: 'choosing-first-telescope', title: 'How to Choose Your First Telescope (Without Getting Burned)', angle: 'The aperture-vs-magnification myth, the three main scope types, and what to actually spend money on.', keywords: ['telescope', 'beginner', 'reflector', 'refractor'] },
  { id: 'best-binoculars-astronomy', title: 'The Best Binoculars for Stargazing (And How to Use Them)', angle: '10x50 vs 7x50, and why a good pair of binoculars beats a cheap toy scope for a first-time observer.', keywords: ['binoculars', 'beginner', 'milky'] },
  { id: 'bortle-scale-dark-skies', title: 'The Bortle Scale: How to Find and Read Truly Dark Skies', angle: 'What each Bortle class actually looks like, and how to use a light-pollution map to find a dark site.', keywords: ['dark sky', 'bortle', 'light pollution'] },
  { id: 'collimate-dobsonian', title: 'How to Collimate a Dobsonian Reflector in 10 Minutes', angle: 'Why and when to collimate, with a simple step-by-step using a cheap laser or Cheshire tool.', keywords: ['collimation', 'reflector', 'dobsonian'] },
  { id: 'eyepieces-explained', title: 'Eyepieces Explained: Focal Length, Magnification, and Field of View', angle: 'The one accessory upgrade that changes how everything looks through your scope.', keywords: ['eyepiece', 'magnification', 'fov'] },
  { id: 'polar-alignment-basics', title: 'Polar Alignment for Beginners: Why and How', angle: 'What polar alignment is, when it matters, and a no-frills method for tracking mounts and astrophotography.', keywords: ['polar alignment', 'mount', 'astrophotography'] },
  { id: 'smartphone-astrophotography', title: 'Smartphone Astrophotography: Real Photos of the Moon and Planets', angle: 'The afocal technique, cheap phone adapters, and the camera settings that actually work.', keywords: ['smartphone', 'astrophotography', 'moon', 'planet'] },
  { id: 'find-andromeda-galaxy', title: 'How to Find the Andromeda Galaxy with Binoculars', angle: 'Star-hopping from Cassiopeia and what you should realistically expect to see.', keywords: ['galaxy', 'andromeda', 'star hop'] },
  { id: 'see-the-milky-way', title: 'How to See the Milky Way This Year', angle: 'Best season, time of night, direction to face, and how to pick a dark enough site.', keywords: ['milky way', 'dark sky'] },
  { id: 'moon-observing-guide', title: "A Beginner's Guide to Observing the Moon", angle: 'Phases, the best features along the terminator, and when a filter helps.', keywords: ['moon', 'lunar', 'phase'] },
  { id: 'jupiter-saturn-viewing', title: 'How to See Jupiter and Saturn Like Never Before', angle: 'Best times, catching the Galilean moons and Saturn\'s rings, and the magnification you need.', keywords: ['planet', 'jupiter', 'saturn'] },
  { id: 'solar-viewing-safety', title: 'How to View the Sun Safely Without Damaging Your Eyes', angle: 'ONLY certified white-light and solar-film filters; the dangerous shortcuts to never use.', keywords: ['solar', 'sun', 'safety', 'filter'] },
  { id: 'meteor-showers-guide', title: 'Meteor Showers: When, Where, and How to Watch Them', angle: 'How to read a shower forecast and maximize the number of meteors you actually see.', keywords: ['meteor', 'shower'] },
  { id: 'star-charts-apps', title: 'The Best Free Star Charts and Planetarium Apps', angle: 'How to choose between the free apps and actually use one at the eyepiece.', keywords: ['chart', 'app', 'planisphere'] },
  { id: 'dark-adaptation-red-light', title: 'Dark Adaptation: The 30-Minute Secret to Seeing More', angle: 'Why you see so little at first, how red light helps, and how to protect your night vision.', keywords: ['red light', 'dark adaptation'] },
  { id: 'filters-for-observing', title: 'Telescope Filters 101: Which Ones Are Actually Worth It', angle: 'Moon filters, nebula filters, and light-pollution filters — honest take on each.', keywords: ['filter', 'nebula', 'light pollution'] },
  { id: 'magnification-vs-fov', title: 'Magnification vs Field of View: The Core Tradeoff in Astronomy', angle: 'Why "more magnification" is usually worse, and how to choose the right power.', keywords: ['magnification', 'fov', 'beginner'] },
  { id: 'scope-types-compared', title: 'Dobsonian vs Refractor vs Schmidt-Cassegrain: Which Scope for What', angle: 'Deep-sky vs planetary vs grab-and-go, and how to match the scope to your goals.', keywords: ['telescope', 'reflector', 'refractor'] },
  { id: 'reading-star-chart', title: 'How to Read a Star Chart and Star-Hop to Any Object', angle: 'The single core skill that unlocks the whole sky, with a worked example.', keywords: ['star hop', 'chart', 'constellation'] },
  { id: 'astronomy-clubs-star-parties', title: 'Why Your First Real Step Should Be an Astronomy Club', angle: 'Star parties, loaner scopes, and experienced observers who will fast-track you.', keywords: ['community', 'beginner'] },
  { id: 'astrophotography-no-tracking', title: 'Beginner Deep-Sky Astrophotography Without an Expensive Mount', angle: 'What is genuinely possible untracked, with just a camera on a sturdy tripod.', keywords: ['astrophotography', 'tripod'] },
  { id: 'protecting-night-vision', title: 'How to Protect and Restore Your Night Vision', angle: 'Screens, headlights, white flashlights — and how long recovery really takes.', keywords: ['red light', 'dark adaptation'] },
  { id: 'learn-5-constellations', title: 'Learn the Night Sky: 5 Constellations to Start With', angle: 'Ursa Major, Orion, Cassiopeia, Scorpius, and Cygnus — your gateway to everything else.', keywords: ['constellation', 'beginner', 'star hop'] },
  { id: 'telescope-care-storage', title: 'How to Clean and Store Your Telescope So It Lasts Decades', angle: 'Optics care, dew control, dust covers, and the mistakes that ruin coatings.', keywords: ['maintenance', 'reflector', 'dew'] },
];

// ISO-8601 week number (stable, timezone-portable enough for once-weekly scheduling).
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setUTCDate(date.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  );
}

export function allTopics() {
  return TOPICS.slice();
}

export function pickTopic(state = { published: [] }) {
  const recent = new Set((state.published || []).slice(-12).map((p) => p.id));
  let pool = TOPICS.filter((t) => !recent.has(t.id));
  if (!pool.length) pool = TOPICS; // all used recently → wrap around deterministically
  const week = isoWeek();
  const chosen = pool[week % pool.length];
  log.info(`Topic picked (iso-week ${week}): ${chosen.title}`);
  return chosen;
}
