/**
 * Opt-in CDN mirror for environments whose network blocks the CDNs the
 * sites load from (cdn.jsdelivr.net, unpkg.com, cdnjs Font Awesome).
 *
 * Installs Playwright route handlers that answer those requests from the
 * same package versions, fetched once with `npm pack` from the npm
 * registry into scripts/.cdn-cache/. jsdelivr's /npm/ and unpkg paths
 * mirror npm packages file-for-file, so pages render the same as with
 * the real CDN. The deployed sites are unchanged.
 *
 * Usage (from another script):
 *   const { installCdnMirror } = require('./cdn-mirror');
 *   await installCdnMirror(pageOrContext);
 *
 * Not part of the deployed site.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '.cdn-cache');

const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

// "three@0.166.1" or "@scope/name@1.2.3" -> { name, version }
function splitSpec(spec) {
  const at = spec.lastIndexOf('@');
  if (at <= 0) return null;
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

function packageDir(name, version) {
  const dir = path.join(CACHE_DIR, `${name.replace('/', '__')}@${version}`);
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    fs.mkdirSync(dir, { recursive: true });
    const tgz = execFileSync('npm', ['pack', `${name}@${version}`, '--silent'], { cwd: dir, encoding: 'utf8' })
      .trim().split('\n').pop();
    execFileSync('tar', ['xzf', tgz, '--strip-components=1'], { cwd: dir });
    fs.rmSync(path.join(dir, tgz));
  }
  return dir;
}

// Map a CDN URL to { name, version, file } or null if it isn't one we mirror.
function resolve(url) {
  const u = new URL(url);
  let rest;
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/')) rest = u.pathname.slice(5);
  else if (u.hostname === 'unpkg.com') rest = u.pathname.slice(1);
  else if (u.hostname === 'cdnjs.cloudflare.com') {
    const m = u.pathname.match(/^\/ajax\/libs\/font-awesome\/([^/]+)\/(.+)$/);
    return m ? { name: '@fortawesome/fontawesome-free', version: m[1], file: m[2] } : null;
  } else return null;

  const parts = rest.split('/');
  const specLen = parts[0].startsWith('@') ? 2 : 1;
  const spec = splitSpec(parts.slice(0, specLen).join('/'));
  if (!spec) return null;
  return { ...spec, file: parts.slice(specLen).join('/') };
}

async function installCdnMirror(target) {
  const handler = async (route) => {
    const hit = resolve(route.request().url());
    if (!hit) return route.continue();
    try {
      const dir = packageDir(hit.name, hit.version);
      let file = hit.file;
      // jsdelivr's "+esm" endpoint, or a bare package URL: serve the ESM entry.
      if (file === '+esm' || file === '') {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        file = pkg.module || pkg.main || 'index.js';
      }
      const abs = path.join(dir, file);
      if (!abs.startsWith(dir) || !fs.existsSync(abs)) return route.fulfill({ status: 404, body: 'not in package' });
      return route.fulfill({
        status: 200,
        body: fs.readFileSync(abs),
        headers: {
          'content-type': MIME[path.extname(abs)] || 'application/octet-stream',
          'access-control-allow-origin': '*',
        },
      });
    } catch (err) {
      return route.fulfill({ status: 502, body: `cdn-mirror: ${err.message}` });
    }
  };
  for (const host of ['https://cdn.jsdelivr.net/**', 'https://unpkg.com/**', 'https://cdnjs.cloudflare.com/**']) {
    await target.route(host, handler);
  }
}

module.exports = { installCdnMirror };
