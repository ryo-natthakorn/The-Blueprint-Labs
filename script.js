(() => {
  const MAX_LIVE_IFRAMES = 3;
  // Reference desktop viewport the 25 sites are designed for (matches the
  // 16:10 .card-preview aspect ratio and sits above every site's largest
  // mobile breakpoint, ~900px) — rendering at this size then scaling the
  // whole frame down keeps each site's real desktop layout intact instead
  // of squeezing it into a tiny viewport where fixed/100vh hero content
  // overlaps.
  const PREVIEW_REF_WIDTH = 1440;
  const PREVIEW_REF_HEIGHT = 900;

  const grid = document.getElementById('project-grid');
  const emptyState = document.getElementById('empty-state');
  const resultCount = document.getElementById('result-count');
  const verticalSelect = document.getElementById('filter-vertical');
  const styleSelect = document.getElementById('filter-style');
  const sortSelect = document.getElementById('sort-by');
  const flagshipSection = document.getElementById('flagship-feature');

  const hoverCapable = window.matchMedia('(hover: hover)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @type {HTMLElement[]} cards currently holding a live iframe, oldest first */
  const activeLiveCards = [];

  let allProjects = [];

  function unloadPreview(card) {
    const iframe = card.querySelector('iframe');
    if (iframe) iframe.remove();
    const idx = activeLiveCards.indexOf(card);
    if (idx !== -1) activeLiveCards.splice(idx, 1);
  }

  function loadPreview(card, livePath) {
    if (!livePath || card.querySelector('iframe')) return;

    // Enforce concurrency cap: evict the oldest live preview first.
    while (activeLiveCards.length >= MAX_LIVE_IFRAMES) {
      unloadPreview(activeLiveCards[0]);
    }

    const preview = card.querySelector('.card-preview');
    const scale = preview.clientWidth / PREVIEW_REF_WIDTH;
    const iframe = document.createElement('iframe');
    iframe.src = livePath;
    iframe.loading = 'lazy';
    iframe.title = card.dataset.title ? `${card.dataset.title} live preview` : 'Live site preview';
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.width = `${PREVIEW_REF_WIDTH}px`;
    iframe.style.height = `${PREVIEW_REF_HEIGHT}px`;
    iframe.style.transform = `scale(${scale})`;
    preview.appendChild(iframe);
    activeLiveCards.push(card);
  }

  function buildCard(project) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.title = project.title;
    if (project.accent) card.style.setProperty('--card-accent', project.accent);

    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = project.livePath || '#';

    const preview = document.createElement('div');
    preview.className = 'card-preview';

    const img = document.createElement('img');
    img.src = project.thumbnail || '';
    img.alt = `${project.title} — thumbnail preview`;
    img.loading = 'lazy';
    preview.appendChild(img);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = project.title;

    const vertical = document.createElement('p');
    vertical.className = 'card-vertical';
    vertical.textContent = project.vertical || '';

    const tags = document.createElement('div');
    tags.className = 'card-tags';
    (project.styleTags || []).forEach((tag) => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = tag;
      tags.appendChild(el);
    });

    body.append(title, vertical, tags);
    link.appendChild(preview);
    card.append(link, body);

    if (!prefersReducedMotion && project.livePath) {
      if (hoverCapable) {
        card.addEventListener('mouseenter', () => loadPreview(card, project.livePath));
        card.addEventListener('mouseleave', () => unloadPreview(card));
      } else {
        card.addEventListener('touchstart', () => {
          activeLiveCards
            .filter((c) => c !== card)
            .slice()
            .forEach(unloadPreview);
          loadPreview(card, project.livePath);
        }, { passive: true });
      }
    }

    return card;
  }

  function buildFlagship(project) {
    if (!project) return;

    flagshipSection.style.setProperty('--flagship-accent', project.accent || 'var(--accent)');

    const preview = document.createElement('a');
    preview.className = 'flagship-preview';
    preview.href = project.livePath || '#';
    preview.dataset.title = project.title;

    const previewInner = document.createElement('div');
    previewInner.className = 'card-preview';

    const img = document.createElement('img');
    img.src = project.thumbnail || '';
    img.alt = `${project.title} — thumbnail preview`;
    img.loading = 'lazy';
    previewInner.appendChild(img);
    preview.appendChild(previewInner);

    if (!prefersReducedMotion && project.livePath) {
      if (hoverCapable) {
        preview.addEventListener('mouseenter', () => loadPreview(preview, project.livePath));
        preview.addEventListener('mouseleave', () => unloadPreview(preview));
      } else {
        preview.addEventListener('touchstart', () => {
          activeLiveCards
            .filter((c) => c !== preview)
            .slice()
            .forEach(unloadPreview);
          loadPreview(preview, project.livePath);
        }, { passive: true });
      }
    }

    const body = document.createElement('div');
    body.className = 'flagship-body';

    const kicker = document.createElement('p');
    kicker.className = 'flagship-kicker';
    kicker.textContent = 'Flagship build';

    const title = document.createElement('h2');
    title.className = 'flagship-title';
    title.textContent = project.title;

    const vertical = document.createElement('p');
    vertical.className = 'flagship-vertical';
    vertical.textContent = project.vertical || '';

    const pitch = document.createElement('p');
    pitch.className = 'flagship-pitch';
    pitch.textContent = 'A full seven-page restaurant site, not another single-scene demo: real working code covering a business like yours, reservations flow included.';

    const desc = document.createElement('p');
    desc.className = 'flagship-desc';
    desc.textContent = project.description || '';

    const tags = document.createElement('div');
    tags.className = 'card-tags';
    (project.styleTags || []).forEach((tag) => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = tag;
      tags.appendChild(el);
    });

    const cta = document.createElement('a');
    cta.className = 'flagship-cta';
    cta.href = project.livePath || '#';
    cta.textContent = 'View The Tideline';

    body.append(kicker, title, vertical, pitch, desc, tags, cta);
    flagshipSection.append(preview, body);
  }

  function populateFilterOptions(projects) {
    const verticals = [...new Set(projects.map((p) => p.vertical).filter(Boolean))].sort();
    const styles = [...new Set(projects.flatMap((p) => p.styleTags || []))].sort();

    verticals.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      verticalSelect.appendChild(opt);
    });

    styles.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      styleSelect.appendChild(opt);
    });
  }

  function applyFiltersAndSort() {
    const vertical = verticalSelect.value;
    const style = styleSelect.value;
    const sortBy = sortSelect.value;

    let filtered = allProjects.filter((p) => {
      if (vertical && p.vertical !== vertical) return false;
      if (style && !(p.styleTags || []).includes(style)) return false;
      return true;
    });

    switch (sortBy) {
      case 'title-asc':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'vertical':
        filtered.sort((a, b) => (a.vertical || '').localeCompare(b.vertical || ''));
        break;
      default:
        break;
    }

    render(filtered);
  }

  function render(projects) {
    activeLiveCards.slice().forEach(unloadPreview);
    grid.innerHTML = '';

    if (projects.length === 0) {
      emptyState.hidden = false;
      resultCount.textContent = '';
      return;
    }

    emptyState.hidden = true;
    resultCount.textContent = `${projects.length} project${projects.length === 1 ? '' : 's'}`;

    const fragment = document.createDocumentFragment();
    projects.forEach((project) => fragment.appendChild(buildCard(project)));
    grid.appendChild(fragment);

    observeCards();
  }

  let observer;
  function observeCards() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) unloadPreview(entry.target);
      });
    }, { root: null, rootMargin: '0px', threshold: 0 });

    grid.querySelectorAll('.card').forEach((card) => observer.observe(card));
    const flagshipPreview = flagshipSection.querySelector('.flagship-preview');
    if (flagshipPreview) observer.observe(flagshipPreview);
  }

  async function init() {
    let projects = [];
    try {
      const res = await fetch('projects.json');
      projects = await res.json();
    } catch (err) {
      projects = [];
    }

    const flagshipProject = projects.find((p) => p.flagship);
    allProjects = projects.filter((p) => !p.flagship);

    if (flagshipProject) buildFlagship(flagshipProject);
    else flagshipSection.hidden = true;

    populateFilterOptions(allProjects);
    verticalSelect.addEventListener('change', applyFiltersAndSort);
    styleSelect.addEventListener('change', applyFiltersAndSort);
    sortSelect.addEventListener('change', applyFiltersAndSort);

    render(allProjects);
  }

  init();
})();
