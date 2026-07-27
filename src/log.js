// Tiny leveled logger. No deps.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const cur = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 2;

function ts() {
  return new Date().toISOString();
}
function out(level, label, args) {
  if (LEVELS[level] > cur) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${ts()}] [${label}]`, ...args);
}

export const log = {
  error: (...a) => out('error', 'ERROR', a),
  warn: (...a) => out('warn', 'WARN ', a),
  info: (...a) => out('info', 'INFO ', a),
  debug: (...a) => out('debug', 'DEBUG', a),
};
