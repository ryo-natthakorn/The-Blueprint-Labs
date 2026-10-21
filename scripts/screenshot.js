/**
 * Generates a thumbnail screenshot for every project in projects.json that
 * doesn't have one yet (or all of them, with --force).
 *
 * Usage:
 *   node screenshot.js [--base-url http://localhost:3000] [--force] [--id NN-slug] [--cdn-mirror] [--wait ms]
 *
 * --wait sets how long to let the page run before the shot (default 1500 ms).
 * Use it for sites whose opening is an animation that builds the scene, so
 * the thumbnail shows the finished state.
 *
 * --cdn-mirror serves CDN requests from local npm copies (see cdn-mirror.js),
 * for environments whose network blocks the CDNs.
 *
 * Requires the sites to be servable at --base-url (default: a `vercel dev`
 * or `npx serve` instance rooted at the repo root, so /sites/NN-slug/
 * resolves) — run this after Phase 2 sites exist, or against the deployed
 * Vercel URL in Phase 3.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { installCdnMirror } = require('./cdn-mirror');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_JSON = path.join(ROOT, 'projects.json');

function parseArgs(argv) {
  const args = { baseUrl: 'http://localhost:3000', force: false, id: null, cdnMirror: false, wait: 1500 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') args.baseUrl = argv[++i];
    if (argv[i] === '--force') args.force = true;
    if (argv[i] === '--id') args.id = argv[++i];
    if (argv[i] === '--cdn-mirror') args.cdnMirror = true;
    if (argv[i] === '--wait') args.wait = Number(argv[++i]) || 1500;
  }
  return args;
}

async function main() {
  const { baseUrl, force, id, cdnMirror, wait } = parseArgs(process.argv.slice(2));

  let projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf-8'));
  if (id) projects = projects.filter((p) => p.id === id);

  if (projects.length === 0) {
    console.log('projects.json is empty — nothing to screenshot yet.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (cdnMirror) await installCdnMirror(page);

  let count = 0;
  for (const project of projects) {
    if (!project.livePath || !project.thumbnail) continue;

    const thumbAbsPath = path.join(ROOT, project.thumbnail.replace(/^\//, ''));
    if (fs.existsSync(thumbAbsPath) && !force) continue;

    const url = new URL(project.livePath, baseUrl).toString();
    console.log(`Screenshotting ${project.id} -> ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // let fonts, reveal transitions and first canvas frames settle
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(wait);
      fs.mkdirSync(path.dirname(thumbAbsPath), { recursive: true });
      await page.screenshot({ path: thumbAbsPath, type: 'jpeg', quality: 82 });
      count++;
    } catch (err) {
      console.error(`Failed to screenshot ${project.id}: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`Done. ${count} thumbnail(s) generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
