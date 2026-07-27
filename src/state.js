import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, '..', 'state.json');

// Shape: { published: [{ id, slug, title, url, year, at }], socialBacklog: [string] }
export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { published: [], socialBacklog: [] };
  }
}

export function saveState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    log.error('Could not write state.json:', e.message);
  }
}

export function recordPublish(state, entry) {
  state.published = state.published || [];
  state.published.push(entry);
  if (state.published.length > 500) state.published = state.published.slice(-500);
  saveState(state);
}

export function pushToBacklog(state, text) {
  if (!text) return;
  state.socialBacklog = state.socialBacklog || [];
  state.socialBacklog.push({ text, at: new Date().toISOString() });
  if (state.socialBacklog.length > 100) state.socialBacklog = state.socialBacklog.slice(-100);
  saveState(state);
}
