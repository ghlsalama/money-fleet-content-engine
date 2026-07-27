import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { config } from './config.js';
import { log } from './log.js';
import { renderPost, renderIndex } from './template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const DOCS_DIR = path.join(ROOT, 'docs');
const DOCS_POSTS = path.join(DOCS_DIR, 'posts');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function ensureDirs() {
  for (const d of [CONTENT_DIR, DOCS_DIR, DOCS_POSTS]) fs.mkdirSync(d, { recursive: true });
}

// --- Hashnode (primary): publish via the GraphQL v2 API. Returns the live post URL. ---
async function publishHashnode({ title, metaDescription, body, topic, slug }) {
  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { id slug url title }
      }
    }`;
  const tagSlugs = [
    { slug: 'astronomy', name: 'Astronomy' },
    { slug: 'stargazing', name: 'Stargazing' },
    { slug: 'beginners', name: 'Beginners' },
  ];
  // Field names follow the Hashnode v2 (gql.hashnode.com) PublishPostInput schema:
  //   contentMarkdown (not "content"), slug (not "slugOverride").
  //   isRepublished is omitted entirely — setting it would wrongly mark the post as a cross-post.
  const variables = {
    input: {
      publicationId: config.hashnode.publicationId,
      title,
      subtitle: metaDescription || undefined,
      contentMarkdown: body,
      tags: tagSlugs,
      slug,
    },
  };
  const res = await fetch('https://gql.hashnode.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.hashnode.token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    throw new Error(`Hashnode publish failed: ${JSON.stringify(json.errors || json).slice(0, 300)}`);
  }
  const post = json.data?.publishPost?.post;
  if (!post?.url) throw new Error('Hashnode publish returned no URL');
  return { url: post.url, slug: post.slug || slug };
}

// --- Static site fallback: write markdown + rendered HTML to ./content and ./docs. ---
function publishStatic({ title, metaDescription, body, topic, slug, state }) {
  ensureDirs();
  const dateIso = new Date().toISOString();

  // Canonical markdown (the source of truth).
  const frontmatter = `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(
    metaDescription || '',
  )}\ndate: ${dateIso}\nslug: ${slug}\n---\n\n`;
  fs.writeFileSync(path.join(CONTENT_DIR, `${slug}.md`), frontmatter + body + '\n');

  // Rendered HTML page (carries the AdSense slot + JSON-LD + disclosure).
  const html = renderPost({
    title,
    description: metaDescription || title,
    html: marked.parse(body),
    slug,
    dateIso,
  });
  fs.writeFileSync(path.join(DOCS_POSTS, `${slug}.html`), html);

  // Rebuild the homepage index from published history, INCLUDING the post we are
  // publishing right now (recordPublish happens later in the pipeline).
  const current = { slug, title, at: dateIso };
  const posts = [current, ...(state.published || [])].map((p) => ({ ...p, slug: p.slug }));
  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), renderIndex(posts));

  const url = `${config.blogBaseUrl}/posts/${slug}.html`;
  return { url, slug };
}

export async function publish({ draft, research, topic, state }) {
  const slug = slugify(draft.title || topic.id);
  const payload = {
    title: draft.title,
    metaDescription: draft.metaDescription,
    body: draft.body,
    topic,
    slug,
    state,
  };

  if (config.dryRun) {
    // Still render locally so a dry run produces something to eyeball, but do not push.
    const local = publishStatic(payload);
    log.info(`DRY_RUN — wrote local preview: ${local.url}`);
    return { url: local.url, slug };
  }

  if (config.cms === 'hashnode' && config.hashnode.token && config.hashnode.publicationId) {
    try {
      const pub = await publishHashnode(payload);
      log.info(`Published to Hashnode: ${pub.url}`);
      return pub;
    } catch (e) {
      log.warn(`Hashnode publish failed (${e.message}); falling back to static site.`);
      const pub = publishStatic(payload);
      log.info(`Published to static site: ${pub.url}`);
      return pub;
    }
  }

  const pub = publishStatic(payload);
  log.info(`Published to static site: ${pub.url}`);
  return pub;
}

export { slugify };
