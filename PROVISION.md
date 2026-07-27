# PROVISION.md — the ONE-TIME human setup

This is everything a human does, once. After these steps the engine researches,
writes, fact-checks, publishes, and repurposes a backyard-astronomy article twice a
week with no further work. Budget: ~1 hour, ~$0.

> Niche: **backyard astronomy / beginner stargazing & gear** (brand: **StarHopper**).
> Chosen because it is evergreen (guides earn for years), has real affiliate demand
> (Amazon Associates pays 3–4% on binoculars/telescopes/eyepieces), and is poorly
> served by quality, well-cited content.

---

## 0. Prerequisites

- A GitHub account (free). Everything else is optional and layered in piece-by-piece.
- Node 20+ only needed if you want to test locally. The scheduled run happens on
  GitHub Actions (free), so you do **not** need a server.

## 1. Create accounts (all free)

| Account | Why | URL |
|---|---|---|
| GitHub | Hosts the code + runs the schedule on Actions | https://github.com |
| LLM provider (pick one) | Drafts articles. **Groq** has a generous free tier; Google AI Studio (Gemini) and local Ollama also work. | https://console.groq.com/keys |
| Hashnode | Free hosted blog + REST/GraphQL API (the publisher) | https://hashnode.com |
| Buttondown | Newsletter (free to 100 subscribers) | https://buttondown.com |
| Bluesky | Free, open social API | https://bsky.app |
| Mastodon (any instance) | Free, open social API (native post scheduling) | https://joinmastodon.org |
| Amazon Associates | Affiliate tag — the primary monetization | https://affiliate-program.amazon.com |

Optional, later (see "Ads" below): Google AdSense — needs the site to age first.

## 2. Collect the keys/IDs

After creating the accounts, gather:

- **LLM_API_KEY** — from Groq (or your chosen provider). This is the only *required* key.
- **HASHNODE_TOKEN** + **HASHNODE_PUBLICATION_ID** — Hashnode → Settings → Developer (Personal Access Token). Publication ID is in your blog dashboard URL (`hashnode.dev/@you` → the publication).
- **BUTTONDOWN_API_KEY** — Buttondown → Settings → API.
- **BLUESKY_IDENTIFIER** (your handle) + **BLUESKY_APP_PASSWORD** — Bluesky → Settings → App passwords (do **not** use your main password).
- **MASTODON_BASE_URL** (e.g. `https://mastodon.world`) + **MASTODON_ACCESS_TOKEN** — Mastodon → Preferences → Development → New application, grant `write:statuses`.
- **AMAZON_ASSOC_TAG** — your Amazon Associate store ID (e.g. `starhopper-20`). This is what earns commission.
- **BLOG_BASE_URL** — your Hashnode blog URL (e.g. `https://starhopper.hashnode.dev`).

## 3. Put the code on GitHub

1. Create a new GitHub repository (e.g. `content-engine`), **private is fine**.
2. Push these files to it. From this directory:
   ```
   git init
   git add .
   git commit -m "Autonomous content engine"
   git branch -M main
   git remote add origin git@github.com:YOUR_USER/content-engine.git
   git push -u origin main
   ```

## 4. Paste keys ONCE as repository secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add each key from step 2 as a secret with the same name (e.g. `LLM_API_KEY`,
`HASHNODE_TOKEN`, `AMAZON_ASSOC_TAG`, …). At minimum add **`LLM_API_KEY`**; the rest
are optional and the pipeline skips any channel whose key is absent.

You can also override the defaults with secrets: `SITE_NAME`, `SITE_TAGLINE`,
`BLOG_BASE_URL`, `CMS` (`hashnode` or `static`), `LLM_BASE_URL`, `LLM_MODEL`.

## 5. Turn on the schedule

The workflow file `.github/workflows/publish.yml` already defines the cron
(`30 10 * * 2,5` = Tue & Fri 10:30 UTC). It is active the moment it is on `main`.

- Test it now without waiting: repo → **Actions → content-publish → Run workflow**.
- Watch the run; it will research, draft, fact-check, publish to Hashnode, email the
  newsletter, and post to Bluesky + Mastodon, then commit `state.json` back.

That's it. From here on it runs twice a week, forever, hands-off.

## 6. (Optional) Local test run

```bash
cp .env.example .env       # then fill in the same keys
npm install
DRY_RUN=true npm start     # drafts + writes a local preview; does NOT publish/email/post
```

## 7. (Optional, later) Monetization dial-up

- **Affiliate (day 1):** live the moment `AMAZON_ASSOC_TAG` is set — every "Recommended
  gear" link is tagged. You earn when a reader buys.
- **Display ads:** Hashnode hosting strips raw ad scripts, so on Hashnode rely on
  affiliate + Hashnode's own Gold/sponsorships. To run Google AdSense directly, set
  `CMS=static`, enable GitHub Pages on this repo (Settings → Pages → Source: main /docs),
  set `BLOG_BASE_URL` to your Pages URL, and add `ADSENSE_CLIENT`. AdSense usually
  requires some content + traffic before approval — that's why it's "later".

## 8. What you never have to touch again

- The topic rotation (24 evergreen topics, deterministic by ISO week, no repeats for 12 posts).
- Sourcing (Wikipedia + NASA public APIs — never scraped, always cited).
- Publishing, newsletter, and social posts (best-effort; a down channel never blocks the rest).
- Deduplication (a retried/overlapping run is skipped if the last post was < 12h ago).

---

### Honest expectations
This is a slow compounding asset, not instant income. Realistic arc: 2 posts/week →
~100 posts/year; search traffic and affiliate conversions build over **months**, with
the first trickle of affiliate revenue typically after the site has a few dozen
indexed, ranking posts and modest traffic. Capital cost: **~$0** (all free tiers).
