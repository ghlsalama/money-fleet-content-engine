import cron from 'node-cron';
import { config } from './config.js';
import { log } from './log.js';
import { runPipeline } from './pipeline.js';

// Entrypoint. Two modes:
//   npm start            → run the pipeline ONCE, then exit (used by the GitHub Actions
//                          schedule — the workflow IS the scheduler; no server needed).
//   npm run daemon       → long-running node-cron loop for a VPS/Raspberry Pi/Oracle
//                          always-free tier. Uses CRON_SCHEDULE.
//
// Either way, after the one-time provisioning the loop is fully hands-off.

const args = new Set(process.argv.slice(2));
const daemonMode = args.has('--daemon') || process.env.DAEMON === '1';

async function runOnce(label = 'run') {
  log.info(`=== Pipeline ${label} starting ===`);
  try {
    await runPipeline();
    log.info(`=== Pipeline ${label} finished ===`);
  } catch (e) {
    log.error(`Pipeline ${label} aborted: ${e.message}`);
    process.exitCode = 1;
  }
}

if (daemonMode) {
  if (!cron.validate(config.cronSchedule)) {
    log.error(`Invalid CRON_SCHEDULE: "${config.cronSchedule}"`);
    process.exit(1);
  }
  log.info(`Daemon mode. Schedule: "${config.cronSchedule}" (server timezone).`);
  if (config.runOnStart) {
    runOnce('on-start').catch(() => {});
  }
  cron.schedule(config.cronSchedule, () => {
    runOnce('scheduled').catch(() => {});
  });
  // Keep the process alive.
  process.on('SIGINT', () => {
    log.info('SIGINT received — exiting.');
    process.exit(0);
  });
} else {
  runOnce('once').then(() => {
    // Exit promptly; node-cron (if imported) won't hold the loop open here.
    process.exit(process.exitCode || 0);
  });
}
