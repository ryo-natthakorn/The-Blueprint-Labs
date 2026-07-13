/**
 * Generates a thumbnail screenshot for every project in projects.json that
 * doesn't have one yet (or all of them, with --force).
 *
 * Usage:
 *   node screenshot.js [--base-url http://localhost:3000] [--force]
 *
 * Requires the sites to be servable at --base-url (default: a `vercel dev`
 * or `npx serve` instance rooted at the repo root, so /sites/NN-slug/
 * resolves) — run this after Phase 2 sites exist, or against the deployed
 * Vercel URL in Phase 3.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_JSON = path.join(ROOT, 'projects.json');

function parseArgs(argv) {
  const args = { baseUrl: 'http://localhost:3000', force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') args.baseUrl = argv[++i];
    if (argv[i] === '--force') args.force = true;
  }
  return args;
}

async function main() {
  const { baseUrl, force } = parseArgs(process.argv.slice(2));

  const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf-8'));

  if (projects.length === 0) {
    console.log('projects.json is empty — nothing to screenshot yet.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
      await page.waitForTimeout(1500);
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
