/**
 * Static checker for the hard constraints in CLAUDE.md / AGENTS.md.
 * Catches the rules that are easy to forget during a long build session,
 * so neither agent has to remember them.
 *
 * Usage (from the repo root or scripts/, no install needed):
 *   node scripts/check-rules.js
 *
 * Exits 1 and prints file:line for every violation. Not part of the
 * deployed site.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'scripts', '.claude', '.vercel', 'revamp']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.json']);

const errors = [];
const rel = (p) => path.relative(ROOT, p);
const fail = (file, line, msg) => errors.push(`${rel(file)}${line ? `:${line}` : ''}  ${msg}`);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.vercelignore') {
      if (entry.isDirectory()) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (TEXT_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function eachLine(file, text, re, msg) {
  text.split('\n').forEach((line, i) => {
    const m = line.match(re);
    if (m) fail(file, i + 1, `${msg}: ${m[0].trim().slice(0, 80)}`);
  });
}

// Deployed files only (the .md notes, scripts/ and revamp/ never ship).
const files = walk(ROOT);

// Rule: no AI/model/tool names anywhere except /guide.
const AI_NAMES = /\b(claude|anthropic|fable\s*\d|opus\s*\d|sonnet\s*\d|codex|chatgpt|openai|gpt-?\d)\b|generated (by|with) ai|built (by|with) ai/i;

// Rule: Fastwork is shutting down — don't reintroduce it.
const FASTWORK = /fastwork/i;

// Rule: no hotlinked third-party images.
const HOTLINK_IMG = /https?:\/\/[^\s"'()]+\.(jpe?g|png|webp|avif|gif)(\?[^\s"'()]*)?/i;

// Rule: site assets use root-absolute paths, never relative ones.
const REL_ATTR = /\b(src|href)\s*=\s*["'](?!\/|https?:|#|mailto:|tel:|data:|javascript:|about:)([^"']+)["']/i;
const REL_CSS_URL = /url\(\s*["']?(?!\/|https?:|data:|#|%23)([^"')]+)["']?\s*\)/i;

// Rule: fonts from Google Fonts, icons from Font Awesome — no other stylesheet hosts.
const EXT_STYLESHEET = /<link[^>]+rel=["']stylesheet["'][^>]*href=["'](https?:\/\/[^"']+)["']|<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*rel=["']stylesheet["']/i;
const ALLOWED_STYLE_HOSTS = ['https://fonts.googleapis.com/', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/'];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const r = rel(file);
  const inGuide = r.startsWith('guide' + path.sep);
  const inSites = r.startsWith('sites' + path.sep);
  const ext = path.extname(file);

  if (!inGuide) eachLine(file, text, AI_NAMES, 'AI/model name outside /guide');
  eachLine(file, text, FASTWORK, 'Fastwork reference (platform is shutting down)');
  eachLine(file, text, HOTLINK_IMG, 'hotlinked image (self-host it under the site\'s assets/)');

  if (inSites && ext === '.html') eachLine(file, text, REL_ATTR, 'relative path (use /sites/NN-slug/...)');
  if (inSites && ext === '.css') eachLine(file, text, REL_CSS_URL, 'relative url() (use /sites/NN-slug/...)');

  if (ext === '.html') {
    text.split('\n').forEach((line, i) => {
      const m = line.match(EXT_STYLESHEET);
      if (!m) return;
      const href = m[1] || m[2];
      if (!ALLOWED_STYLE_HOSTS.some((h) => href.startsWith(h))) {
        fail(file, i + 1, `stylesheet from a non-approved host (Google Fonts / Font Awesome only): ${href.slice(0, 80)}`);
      }
    });
    // Rule: every <img> has an alt attribute (alt="" is fine for decoration).
    const imgRe = /<img\b[^>]*>/gi;
    let m;
    while ((m = imgRe.exec(text))) {
      if (!/\balt\s*=/.test(m[0])) {
        const line = text.slice(0, m.index).split('\n').length;
        fail(file, line, 'img without alt');
      }
    }
  }
}

// Rule: every site handles prefers-reduced-motion somewhere in its own files.
const sitesDir = path.join(ROOT, 'sites');
for (const site of fs.readdirSync(sitesDir)) {
  const siteFiles = files.filter((f) => f.startsWith(path.join(sitesDir, site) + path.sep));
  if (!siteFiles.some((f) => /prefers-reduced-motion/.test(fs.readFileSync(f, 'utf8')))) {
    fail(path.join(sitesDir, site), 0, 'no prefers-reduced-motion handling found');
  }
}

// Rule: projects.json is valid, complete, public-safe, and points at real files.
const pjPath = path.join(ROOT, 'projects.json');
let projects = [];
try {
  projects = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
} catch (err) {
  fail(pjPath, 0, `invalid JSON: ${err.message}`);
}
const REQUIRED = ['id', 'title', 'vertical', 'styleTags', 'description', 'thumbnail', 'livePath', 'tech', 'status'];
for (const p of projects) {
  for (const key of REQUIRED) {
    if (p[key] === undefined) fail(pjPath, 0, `${p.id || '?'}: missing "${key}"`);
  }
  if ('builtBy' in p) fail(pjPath, 0, `${p.id}: "builtBy" must not be in the public projects.json (use BUILD_LOG.md)`);
  if (p.thumbnail && !fs.existsSync(path.join(ROOT, p.thumbnail))) fail(pjPath, 0, `${p.id}: thumbnail not found: ${p.thumbnail}`);
  if (p.livePath) {
    const index = path.join(ROOT, p.livePath.replace(/\/?(index\.html)?$/, ''), 'index.html');
    if (!fs.existsSync(index)) fail(pjPath, 0, `${p.id}: livePath has no index.html: ${p.livePath}`);
  }
}

if (errors.length) {
  console.error(`check-rules: ${errors.length} problem(s)\n`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log(`check-rules: OK (${files.length} files, ${projects.length} projects)`);
