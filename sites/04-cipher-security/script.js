(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

  /* ----------------------------------------------------------------
     Digital rain — katakana + hex on a 2D canvas
  ---------------------------------------------------------------- */
  const rainCanvas = document.getElementById('rain');
  const rctx = rainCanvas.getContext('2d');
  const GLYPHS = 'アイウエオカキクケコサシスセソ0123456789ABCDEF{}<>/*+-=';
  let columns = [];
  let fontSize = 16;

  function sizeRain() {
    rainCanvas.width = window.innerWidth;
    rainCanvas.height = window.innerHeight;
    fontSize = isSmallScreen ? 13 : 16;
    const count = Math.floor(rainCanvas.width / fontSize);
    columns = Array.from({ length: count }, () => ({
      y: Math.random() * -rainCanvas.height,
      speed: 2 + Math.random() * 4,
      dim: Math.random() < 0.5,
    }));
  }
  sizeRain();
  window.addEventListener('resize', sizeRain);

  let rainIntensity = 1;

  function drawRain() {
    rctx.fillStyle = 'rgba(2, 6, 4, 0.12)';
    rctx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);
    rctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
    columns.forEach((col, i) => {
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      rctx.fillStyle = col.dim ? 'rgba(18, 144, 74, 0.55)' : 'rgba(41, 242, 125, 0.9)';
      rctx.fillText(ch, i * fontSize, col.y);
      col.y += col.speed * rainIntensity;
      if (col.y > rainCanvas.height + 40) {
        col.y = Math.random() * -300;
        col.speed = 2 + Math.random() * 4;
      }
    });
  }

  function drawRainStatic() {
    rctx.fillStyle = '#020604';
    rctx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);
    rctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
    for (let i = 0; i < columns.length; i++) {
      for (let j = 0; j < 14; j++) {
        if (Math.random() < 0.12) {
          rctx.fillStyle = 'rgba(18, 144, 74, 0.35)';
          rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * fontSize, Math.random() * rainCanvas.height);
        }
      }
    }
  }

  if (prefersReducedMotion) {
    drawRainStatic();
    window.addEventListener('resize', drawRainStatic);
  } else {
    (function rainLoop() {
      drawRain();
      requestAnimationFrame(rainLoop);
    })();
  }

  /* ----------------------------------------------------------------
     Terminal engine
  ---------------------------------------------------------------- */
  const output = document.getElementById('output');
  const term = document.getElementById('term');
  const form = document.getElementById('prompt-form');
  const input = document.getElementById('cmd');

  const TYPE_DELAY = prefersReducedMotion ? 0 : 9;
  let busy = false;
  const history = [];
  let historyIdx = -1;

  function scrollToBottom() { term.scrollTop = term.scrollHeight; }

  function addLine(html, cls = '') {
    const div = document.createElement('div');
    div.className = `line ${cls}`;
    div.innerHTML = html;
    output.appendChild(div);
    scrollToBottom();
    return div;
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function typeLine(text, cls = '') {
    const div = addLine('', cls);
    if (TYPE_DELAY === 0) {
      div.textContent = text;
      scrollToBottom();
      return;
    }
    for (let i = 0; i <= text.length; i += 2) {
      div.textContent = text.slice(0, i);
      scrollToBottom();
      await sleep(TYPE_DELAY);
    }
    div.textContent = text;
  }

  async function progressBar(label, ms, cls = 'ok') {
    const row = document.createElement('div');
    row.className = 'line bar-row';
    row.innerHTML = `<span class="bar-label">${label}</span><span class="bar"></span><span class="${cls} pct">0%</span>`;
    output.appendChild(row);
    const bar = row.querySelector('.bar');
    const pct = row.querySelector('.pct');
    const W = 24;
    const steps = prefersReducedMotion ? 1 : 18;
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      bar.textContent = '█'.repeat(Math.round(W * f)).padEnd(W, '░');
      pct.textContent = `${Math.round(f * 100)}%`;
      scrollToBottom();
      if (!prefersReducedMotion) await sleep(ms / steps);
    }
  }

  /* ---------------- command implementations ---------------------- */
  const BANNER = [
    '  ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗',
    ' ██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗',
    ' ██║     ██║██████╔╝███████║█████╗  ██████╔╝',
    ' ██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗',
    ' ╚██████╗██║██║     ██║  ██║███████╗██║  ██║',
    '  ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
  ];

  const COMMANDS = {
    async help() {
      addLine('AVAILABLE COMMANDS', 'heading');
      const rows = [
        ['help', 'this menu'],
        ['services', 'what we break (so others can\'t)'],
        ['scan <host>', 'run a demonstration recon sweep'],
        ['casework', 'selected engagements, redacted'],
        ['team', 'the operators'],
        ['why', 'why offense-first security works'],
        ['uptime', 'field station status'],
        ['whoami', 'identify yourself'],
        ['matrix', 'adjust the rain'],
        ['clear', 'wipe the terminal'],
      ];
      for (const [cmd, desc] of rows) {
        addLine(`  <span class="info">${cmd.padEnd(14)}</span><span class="sys">${desc}</span>`);
      }
      addLine('');
    },

    async services() {
      addLine('SERVICES — OFFENSE, DEFENSIVELY APPLIED', 'heading');
      await typeLine('▸ External penetration testing — your perimeter, attacked like it matters.', 'ok');
      await typeLine('▸ Red team engagements — months-long, objective-based, quiet.', 'ok');
      await typeLine('▸ Social engineering — the firewall between chairs, tested politely.', 'ok');
      await typeLine('▸ Cloud posture review — IAM sprawl, public buckets, forgotten keys.', 'ok');
      await typeLine('▸ Incident rehearsal — practice the worst day before it happens.', 'ok');
      addLine('');
      addLine('All engagements are authorized, scoped in writing, and reported in person.', 'sys');
      addLine('');
    },

    async scan(args) {
      const host = (args[0] || 'demo.target').replace(/[^a-z0-9.\-]/gi, '').slice(0, 40) || 'demo.target';
      addLine(`INITIATING DEMONSTRATION SWEEP → ${host}`, 'heading');
      addLine('(simulated output — no packets were harmed)', 'sys');
      await sleep(prefersReducedMotion ? 0 : 300);
      await progressBar('resolve', 500);
      await progressBar('tcp syn 1-1024', 1100);
      await progressBar('service probe', 800);
      await progressBar('tls audit', 700);
      addLine('');
      addLine(`  PORT     STATE   SERVICE       NOTE`, 'info');
      addLine(`  22/tcp   open    ssh           key auth only — good`, 'ok');
      addLine(`  80/tcp   open    http          redirects to 443 — good`, 'ok');
      addLine(`  443/tcp  open    https         TLS 1.3, HSTS present`, 'ok');
      addLine(`  8080/tcp open    http-proxy    ⚠ default admin panel exposed`, 'warn');
      addLine(`  5432/tcp open    postgresql    ✗ reachable from WAN`, 'err');
      addLine('');
      await typeLine('Two findings in ninety seconds — and this is the polite version.', 'warn');
      addLine('A real engagement goes deeper. Much deeper.', 'sys');
      addLine('');
    },

    async casework() {
      addLine('SELECTED CASEWORK — DETAILS REDACTED BY CONTRACT', 'heading');
      const cases = [
        ['FY25-Q4', 'Regional bank', 'Domain admin in 6 hours via a printer. The printer has been spoken to.'],
        ['FY25-Q2', 'Logistics platform', 'API key in a public mobile build. Rotated before breakfast.'],
        ['FY24-Q4', 'Hospital group', 'Badge-cloned into the server room. Physical controls rebuilt.'],
        ['FY24-Q1', 'SaaS unicorn', 'CI runner exfil path closed 11 days before a real actor tried it.'],
      ];
      for (const [q, client, note] of cases) {
        await typeLine(`▸ ${q} — ${client}`, 'info');
        addLine(`  ${note.replace(/(printer|API key|server room|CI runner)/, '<span class="redact">$1</span>')}`, 'sys');
      }
      addLine('');
    },

    async team() {
      addLine('THE OPERATORS', 'heading');
      const team = [
        ['"Vireo"', 'Lead operator. Ex-CERT. Thinks in attack graphs, dreams in packet captures.'],
        ['"Marrow"', 'Hardware & physical. Owns more lockpicks than keys.'],
        ['"Sable"', 'Social engineering. You have almost certainly held the door for her.'],
        ['"Tern"', 'Cloud & CI. Reads IAM policy documents for fun. Genuinely.'],
      ];
      for (const [name, bio] of team) {
        await typeLine(`▸ ${name}`, 'ok');
        addLine(`  ${bio}`, 'sys');
      }
      addLine('');
      addLine('Handles only. Their real names are the first thing we protect.', 'sys');
      addLine('');
    },

    async why() {
      addLine('WHY OFFENSE-FIRST', 'heading');
      await typeLine('Every control you deploy was designed against yesterday\'s attack.', 'ok');
      await typeLine('The only way to know what today\'s attack looks like is to run it —', 'ok');
      await typeLine('on your terms, in your scope, with your lawyers smiling.', 'ok');
      addLine('');
      await typeLine('We break things gently, document ruthlessly, and leave you stronger.', 'info');
      addLine('');
    },

    async uptime() {
      const days = 1337 + Math.floor((Date.now() / 86400000) % 100);
      addLine(`field station up ${days} days · 0 breaches · 4 operators awake · coffee reserves: ADEQUATE`, 'ok');
      addLine('');
    },

    async whoami() {
      await typeLine('visitor (uid 1000) — unprivileged, unverified, but very welcome.', 'ok');
      addLine('');
    },

    async sudo() {
      await typeLine('visitor is not in the sudoers file. This incident will be reported.', 'err');
      addLine('(It will not. But it felt right to say.)', 'sys');
      addLine('');
    },

    async matrix() {
      rainIntensity = rainIntensity >= 3 ? 0.4 : rainIntensity + 1.3;
      addLine(`rain intensity → ${rainIntensity.toFixed(1)}`, 'info');
      addLine('');
    },

    async clear() {
      output.innerHTML = '';
    },
  };
  COMMANDS.ls = COMMANDS.help;
  COMMANDS.man = COMMANDS.help;

  async function run(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    addLine(escapeHtml(trimmed), 'echo');
    const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);
    const fn = COMMANDS[cmd];
    busy = true;
    if (fn) {
      await fn(args);
    } else {
      addLine(`command not found: ${escapeHtml(cmd)} — try <span class="info">help</span>`, 'err');
      addLine('');
    }
    busy = false;
    scrollToBottom();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const value = input.value;
    input.value = '';
    if (value.trim()) {
      history.push(value.trim());
      historyIdx = history.length;
    }
    run(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx > 0) input.value = history[--historyIdx] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < history.length) input.value = history[++historyIdx] || '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const stub = input.value.trim().toLowerCase();
      if (!stub) return;
      const matches = Object.keys(COMMANDS).filter((c) => c.startsWith(stub));
      if (matches.length === 1) {
        input.value = matches[0] + ' ';
      } else if (matches.length > 1) {
        addLine(matches.join('   '), 'sys');
        scrollToBottom();
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      COMMANDS.clear();
    }
  });

  document.querySelectorAll('.quick button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (busy) return;
      run(btn.dataset.cmd);
      input.focus();
    });
  });

  // focus the prompt when clicking anywhere in the terminal
  term.addEventListener('click', (e) => {
    if (window.getSelection().toString()) return; // let people copy text
    if (e.target === term || e.target.id === 'output' || e.target.closest('#output')) input.focus();
  });

  /* ---------------- boot sequence --------------------------------- */
  async function boot() {
    if (!prefersReducedMotion) {
      addLine('cipher-fieldstation v4.2.0 — secure boot verified', 'sys');
      await progressBar('handshake', 600, 'info');
      await sleep(150);
    }
    BANNER.forEach((row) => addLine(`<span class="ok">${row}</span>`, 'banner'));
    addLine('');
    await typeLine('Offensive security, defensively applied.', 'info');
    addLine('');
    addLine('We are the people you hire to break in — before someone you didn\'t hire does.', 'sys');
    addLine('');
    addLine(`Type <span class="info">help</span> to see what this terminal can do, or use the shortcuts below.`, 'ok');
    addLine('');
    if (!isSmallScreen) input.focus();
  }

  boot();
})();
