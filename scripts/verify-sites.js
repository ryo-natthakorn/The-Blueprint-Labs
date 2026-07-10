/**
 * Phase 3 verification pass: loads every project's livePath, captures
 * console errors / page errors / failed requests, and screenshots the
 * page so blank/frozen canvases can be visually inspected afterward.
 *
 * Usage:
 *   node verify-sites.js [--base-url http://localhost:3000]
 *
 * Not part of the deployed site. Writes screenshots to
 * scripts/.verify-shots/<id>.png and a JSON report to
 * scripts/.verify-report.json
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_JSON = path.join(ROOT, 'projects.json');
const SHOTS_DIR = path.join(__dirname, '.verify-shots');

function parseArgs(argv) {
  const args = { baseUrl: 'http://localhost:3000' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url') args.baseUrl = argv[++i];
  }
  return args;
}

async function main() {
  const { baseUrl } = parseArgs(process.argv.slice(2));
  const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf-8'));
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const report = [];

  for (const project of projects) {
    const url = new URL(project.livePath, baseUrl).toString();
    const entry = { id: project.id, url, consoleErrors: [], pageErrors: [], failedRequests: [], status: 'ok' };

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') entry.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      entry.pageErrors.push(err.message);
    });
    page.on('requestfailed', (req) => {
      entry.failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(3000);

      const canvasInfo = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return canvases.map((c) => ({
          width: c.width,
          height: c.height,
          clientWidth: c.clientWidth,
          clientHeight: c.clientHeight,
        }));
      });
      entry.canvasInfo = canvasInfo;

      const shotPath = path.join(SHOTS_DIR, `${project.id}.png`);
      await page.screenshot({ path: shotPath });
      entry.screenshot = shotPath;
    } catch (err) {
      entry.status = 'nav-error';
      entry.navError = err.message;
    }

    if (entry.consoleErrors.length || entry.pageErrors.length || entry.status !== 'ok') {
      entry.status = entry.status === 'ok' ? 'has-errors' : entry.status;
    }

    console.log(`[${entry.status}] ${project.id} — console:${entry.consoleErrors.length} page:${entry.pageErrors.length} failedReq:${entry.failedRequests.length}`);
    report.push(entry);
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, '.verify-report.json'), JSON.stringify(report, null, 2));
  console.log('\nReport written to scripts/.verify-report.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
