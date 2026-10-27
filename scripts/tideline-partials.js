/**
 * Site 26 (The Tideline) shares one head, header, drawer and footer across
 * its seven pages. This script is the single source for those parts: it
 * rewrites everything outside <main id="main"> … </main> in each page and
 * leaves the page's own content untouched.
 *
 * Usage (after editing a partial below, or adding a page):
 *   node scripts/tideline-partials.js
 *
 * Not part of the deployed site.
 */
const fs = require('fs');
const path = require('path');

const SITE = '/sites/26-the-tideline';
const DIR = path.resolve(__dirname, '..', 'sites', '26-the-tideline');

const PAGES = [
  { key: 'home', file: 'index.html', solid: false,
    title: "The Tideline — Modern Coastal Kitchen · Harrow's Point",
    desc: "A modern coastal kitchen in the harbor town of Harrow's Point. Same-day fish from the town dock, three coastal farms, and a menu rewritten every morning. Reserve a table.",
    css: ['home'], js: ['tide-hero'] },
  { key: 'menu', file: 'menu/index.html', solid: true,
    title: "Menu — The Tideline · Harrow's Point",
    desc: "Tonight's menu at The Tideline: starters, mains, sides, dessert and drinks, with dietary tags on every dish. The menu changes with what the tide brings in.",
    css: ['menu'], js: ['menu'] },
  { key: 'reservations', file: 'reservations/index.html', solid: true,
    title: "Reservations — The Tideline · Harrow's Point",
    desc: "Reserve a table at The Tideline. Choose your party size, pick a date and time, and we'll hold your seat by the water. Tables released 60 days out.",
    css: ['reserve'], js: ['reserve'] },
  { key: 'story', file: 'story/index.html', solid: true,
    title: "Our Story — The Tideline · Harrow's Point",
    desc: "The Tideline is built around one idea: cook what the tide gives you. Same-day sourcing from the town dock and three coastal farms within twenty miles.",
    css: ['story'], js: ['story'] },
  { key: 'private-dining', file: 'private-dining/index.html', solid: true,
    title: "Private Dining — The Tideline · Harrow's Point",
    desc: "A private room off the kitchen for up to fourteen, chef's tasting for six or more, and full buyouts for forty at The Tideline, Harrow's Point.",
    css: ['private'], js: ['private'] },
  { key: 'gallery', file: 'gallery/index.html', solid: true,
    title: "Gallery — The Tideline · Harrow's Point",
    desc: "One day at The Tideline in pictures: the morning landing, the prep, the room and the table.",
    css: ['gallery'], js: ['gallery'] },
  { key: 'contact', file: 'contact/index.html', solid: true,
    title: "Contact & Directions — The Tideline · Harrow's Point",
    desc: "Find The Tideline on the quay at Harrow's Point: hours, directions, parking and a general enquiry form.",
    css: ['contact'], js: ['contact'] },
];

const NAV = [
  { key: 'menu', label: 'Menu', href: `${SITE}/menu` },
  { key: 'story', label: 'Story', href: `${SITE}/story` },
  { key: 'private-dining', label: 'Private Dining', href: `${SITE}/private-dining` },
  { key: 'gallery', label: 'Gallery', href: `${SITE}/gallery` },
  { key: 'contact', label: 'Contact', href: `${SITE}/contact` },
];
const DRAWER = [
  { key: 'home', label: 'Home', href: `${SITE}/` },
  { key: 'menu', label: 'Menu', href: `${SITE}/menu` },
  { key: 'reservations', label: 'Reservations', href: `${SITE}/reservations` },
  { key: 'story', label: 'Story', href: `${SITE}/story` },
  { key: 'private-dining', label: 'Private Dining', href: `${SITE}/private-dining` },
  { key: 'gallery', label: 'Gallery', href: `${SITE}/gallery` },
  { key: 'contact', label: 'Contact', href: `${SITE}/contact` },
];

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f171a'/%3E%3Cpath d='M5 19c3 0 3-2.6 6-2.6s3 2.6 6 2.6 3-2.6 6-2.6 3 2.6 4 2.6' stroke='%2393bcae' stroke-width='1.7' fill='none' stroke-linecap='round'/%3E%3Cpath d='M5 24c3 0 3-2.6 6-2.6s3 2.6 6 2.6 3-2.6 6-2.6 3 2.6 4 2.6' stroke='%2393bcae' stroke-width='1.7' fill='none' stroke-linecap='round' opacity='.5'/%3E%3Ccircle cx='23' cy='9' r='2.6' fill='%23d9a05b'/%3E%3C/svg%3E";

const MARK = `<svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 19.5c3 0 3-2.6 6-2.6s3 2.6 6 2.6 3-2.6 6-2.6 3 2.6 5 2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 24.5c3 0 3-2.6 6-2.6s3 2.6 6 2.6 3-2.6 6-2.6 3 2.6 5 2.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".5"/><circle cx="23" cy="9" r="2.6" fill="#d9a05b"/></svg>`;

const cur = (p, key) => (p.key === key ? ' aria-current="page"' : '');

function head(p) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<meta name="theme-color" content="#0f171a">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.desc}">
<link rel="icon" href="${ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Karla:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/fontawesome.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/solid.min.css">
<link rel="stylesheet" href="${SITE}/style.css">
${p.css.map((c) => `<link rel="stylesheet" href="${SITE}/css/${c}.css">`).join('\n')}
<script>document.documentElement.classList.add("js")</script>
</head>
<body class="page-${p.key}">

<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header${p.solid ? ' solid' : ''}">
  <div class="nav-bar">
    <a class="brand" href="${SITE}/"${p.key === 'home' ? ' aria-current="page"' : ''}>
      ${MARK}
      <span><span class="brand-name">The Tideline</span><span class="brand-town">Harrow's Point</span></span>
    </a>
    <nav class="nav-primary" aria-label="Primary">
      <ul class="nav-links">
${NAV.map((n) => `        <li><a href="${n.href}"${cur(p, n.key)}>${n.label}</a></li>`).join('\n')}
      </ul>
    </nav>
    <a class="btn btn-amber btn-sm nav-cta" href="${SITE}/reservations"${cur(p, 'reservations')}>Reserve<span class="cta-long"> a Table</span></a>
    <button class="nav-burger" type="button" aria-expanded="false" aria-controls="drawer"><i class="fa-solid fa-bars" aria-hidden="true"></i><span class="visually-hidden">Menu</span></button>
  </div>
</header>

<div class="drawer" id="drawer">
  <nav class="drawer-nav" aria-label="Site">
    <ul>
${DRAWER.map((n, i) => `      <li><a href="${n.href}"${cur(p, n.key)}><span class="n">0${i + 1}</span>${n.label}<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></li>`).join('\n')}
    </ul>
  </nav>
  <div class="drawer-foot">
    <p class="pill"><span class="dot" data-open-dot aria-hidden="true"></span><span data-open>Tue – Sun · 5 – 10 PM</span></p>
    <a href="tel:+15550100178"><i class="fa-solid fa-phone" aria-hidden="true"></i>(555) 010-0178</a>
    <a href="${SITE}/contact"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>6 Quay Lane, Harrow's Point</a>
    <p class="pill"><span class="dot live" aria-hidden="true"></span><span data-tide="short">Tide</span></p>
  </div>
</div>
`;
}

function foot(p) {
  return `
<footer class="site-footer">
  <div class="foot-grid">
    <div class="foot-brand">
      <a class="brand" href="${SITE}/">
        ${MARK}
        <span><span class="brand-name">The Tideline</span><span class="brand-town">Harrow's Point</span></span>
      </a>
      <p class="foot-tag">A modern coastal kitchen. Same-day sourcing off the town dock,
        and a menu that changes with the water.</p>
      <p class="pill"><span class="dot live" aria-hidden="true"></span><span data-tide="short">Tide</span></p>
    </div>
    <nav class="foot-col" aria-label="Footer">
      <h2>Explore</h2>
      <ul>
${DRAWER.slice(1).map((n) => `        <li><a href="${n.href}">${n.label}</a></li>`).join('\n')}
      </ul>
    </nav>
    <div class="foot-col">
      <h2>Visit</h2>
      <p>6 Quay Lane<br>Harrow's Point</p>
      <div class="stack">
        <a href="tel:+15550100178"><i class="fa-solid fa-phone" aria-hidden="true"></i>(555) 010-0178</a>
        <a href="mailto:hello@thetideline.example"><i class="fa-solid fa-envelope" aria-hidden="true"></i>hello@thetideline.example</a>
        <a href="${SITE}/contact#directions"><i class="fa-solid fa-route" aria-hidden="true"></i>Directions &amp; parking</a>
      </div>
    </div>
    <div class="foot-col">
      <h2>Hours</h2>
      <div class="hours">
        <div data-row="service"><span>Tue – Sun</span><span>5:00 – 10:00 PM</span></div>
        <div data-row="bar"><span>Bar opens</span><span>4:30 PM</span></div>
        <div data-row="monday"><span>Monday</span><span>Closed</span></div>
      </div>
      <p class="pill" style="margin-top:18px"><span class="dot" data-open-dot aria-hidden="true"></span><span data-open>Tue – Sun · 5 – 10 PM</span></p>
    </div>
  </div>
  <div class="foot-base">
    <div class="foot-base-in">
      <span>© <span data-year>2026</span> The Tideline · Harrow's Point</span>
      <span>A concept kitchen in a fictional harbor town — a <a href="/">Blueprint Labs</a> design study.</span>
    </div>
  </div>
</footer>

<script src="${SITE}/main.js" defer></script>
${p.js.map((j) => `<script src="${SITE}/${j}.js" defer></script>`).join('\n')}
</body>
</html>
`;
}

let changed = 0;
for (const p of PAGES) {
  const file = path.join(DIR, p.file);
  const html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf('<main id="main"');
  const b = html.lastIndexOf('</main>');
  if (a < 0 || b < 0) throw new Error(`${p.file}: no <main id="main"> … </main>`);
  const out = head(p) + '\n' + html.slice(a, b + '</main>'.length) + '\n' + foot(p);
  if (out !== html) { fs.writeFileSync(file, out); changed++; }
}
console.log(`tideline-partials: ${changed} of ${PAGES.length} pages updated`);
