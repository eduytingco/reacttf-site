/* ==========================================================================
   REACT site scripts (TypeScript source)
   Edit this file, then run `npm run build` to regenerate js/main.js.

   - Messages (loads messages.properties into [data-i18n] elements)
   - Shared partials (header and footer from static/partials/)
   - Secondary page (builds page.html from static/data/pages.json)
   - Mobile menu
   - Carousel (controls, dots, keyboard, swipe sync, intro autoplay)
   - Dev: column overlay toggle
   ========================================================================== */

/* Helpers
   -------------------------------------------------------------------------- */

/** Typed querySelector scoped to a root. Returns null when the element is missing. */
function $<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

/** Typed querySelectorAll that returns a real array. */
function $$<T extends Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Messages (messages.properties)
   -------------------------------------------------------------------------- */

type Messages = Record<string, string>;

const MESSAGES_BASE = 'messages';

/**
 * Locales that have a messages_<locale>.properties file. Only these are
 * requested, so visitors on other languages don't trigger 404s.
 * Example: ['es', 'vi', 'zh_TW']
 */
const SUPPORTED_LOCALES: readonly string[] = [];

const MESSAGES_TIMEOUT_MS = 3000;

/**
 * Fallbacks for strings that only exist in script (not in index.html).
 * Used when messages.properties can't be loaded, e.g. opening the page
 * straight from disk. Keep these in sync with messages.properties.
 */
const SCRIPT_FALLBACKS: Messages = {
  'nav.menu.open': 'Open menu',
  'nav.menu.close': 'Close menu',
  'carousel.slide.label': '{0} of {1}',
  'carousel.dot.label': 'Go to slide {0}',
  'carousel.counter': '{0} / {1}',
  'detail.titleFormat': '{0} | REACT',
  'detail.back': 'Back to home',
  'detail.error.title': 'Content unavailable',
  'detail.error.body': 'This page needs to be served from a web server to load its content. Run npm run serve and open http://localhost:8000.',
};

let messages: Messages = {};

/** Decodes the escape sequences allowed in a .properties value or key. */
function unescapeProperty(raw: string): string {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, seq: string) => {
    if (seq.length === 5) return String.fromCharCode(parseInt(seq.slice(1), 16));
    switch (seq) {
      case 't': return '\t';
      case 'n': return '\n';
      case 'r': return '\r';
      case 'f': return '\f';
      default: return seq;
    }
  });
}

/** Parses Java .properties text: comments, continuations, =/:/space separators, escapes. */
function parseProperties(text: string): Messages {
  const result: Messages = {};
  const lines = text.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    let line = (lines[i] ?? '').replace(/^\s+/, '');
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;

    // Join continuation lines (an odd number of trailing backslashes)
    while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length) {
      i += 1;
      line = line.slice(0, -1) + (lines[i] ?? '').replace(/^\s+/, '');
    }

    // Key ends at the first unescaped '=', ':' or whitespace
    let k = 0;
    while (k < line.length) {
      const ch = line.charAt(k);
      if (ch === '\\') { k += 2; continue; }
      if (ch === '=' || ch === ':' || /\s/.test(ch)) break;
      k += 1;
    }

    const key = unescapeProperty(line.slice(0, k));
    const rest = line.slice(k).replace(/^\s*[=:]?\s*/, '');
    result[key] = unescapeProperty(rest);
  }
  return result;
}

async function fetchProperties(url: string, signal: AbortSignal): Promise<Messages | null> {
  try {
    const res = await fetch(url, { signal, cache: 'no-cache' });
    if (!res.ok) return null;
    return parseProperties(await res.text());
  } catch {
    return null; // offline, blocked (file://) or timed out
  }
}

/** Best supported locale for this visitor, e.g. 'es' or 'zh_TW', or null. */
function pickLocale(): string | null {
  if (SUPPORTED_LOCALES.length === 0) return null;
  for (const lang of navigator.languages) {
    const [language = '', region] = lang.split('-');
    const candidates = region ? [`${language}_${region.toUpperCase()}`, language] : [language];
    const match = candidates.find((c) => SUPPORTED_LOCALES.includes(c));
    if (match) return match;
  }
  return null;
}

/** Loads messages.properties, then overlays messages_<locale>.properties if supported. */
async function loadMessages(): Promise<void> {
  // Browsers block fetch() on pages opened from disk; keep the HTML fallback text
  if (location.protocol === 'file:') {
    console.info('[messages] Opened from disk; serve over HTTP to load messages.properties.');
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), MESSAGES_TIMEOUT_MS);

  const base = await fetchProperties(`${MESSAGES_BASE}.properties`, controller.signal);
  if (!base) {
    console.info('[messages] messages.properties not loaded; using built-in text.');
    window.clearTimeout(timeout);
    return;
  }

  const locale = pickLocale();
  const localized = locale
    ? await fetchProperties(`${MESSAGES_BASE}_${locale}.properties`, controller.signal)
    : null;

  window.clearTimeout(timeout);
  messages = { ...base, ...(localized ?? {}) };
  if (locale && localized) document.documentElement.lang = locale.replace('_', '-');
}

/** Replaces {0}, {1}, ... with args. */
function format(template: string, args: ReadonlyArray<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (match, n: string) => {
    const value = args[Number(n)];
    return value === undefined ? match : String(value);
  });
}

/** Looks up a message by key. Falls back to `fallback`, then to the key itself. */
function t(key: string, args: ReadonlyArray<string | number> = [], fallback?: string): string {
  const template = messages[key] ?? fallback ?? SCRIPT_FALLBACKS[key] ?? key;
  return format(template, args);
}

/** Resolves data-i18n-args, expanding tokens like $year. */
function parseArgs(el: Element): string[] {
  const raw = el.getAttribute('data-i18n-args');
  if (!raw) return [];
  return raw.split(',').map((a) => {
    const arg = a.trim();
    return arg === '$year' ? String(new Date().getFullYear()) : arg;
  });
}

/** Applies messages to every [data-i18n] and [data-i18n-attr] element under root. */
function applyMessages(root: ParentNode = document): void {
  for (const el of $$<HTMLElement>('[data-i18n]', root)) {
    const key = el.dataset['i18n'];
    if (!key) continue;
    if (messages[key] === undefined) continue; // keep the HTML fallback
    el.textContent = t(key, parseArgs(el));
  }

  for (const el of $$<HTMLElement>('[data-i18n-attr]', root)) {
    const pairs = (el.dataset['i18nAttr'] ?? '').split(',');
    for (const pair of pairs) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key || messages[key] === undefined) continue;
      el.setAttribute(attr, t(key, parseArgs(el)));
    }
  }
}

/* Shared partials (header, footer)
   -------------------------------------------------------------------------- */

const PARTIALS_PATH = 'static/partials';

/**
 * Replaces each <div data-include="name"> with static/partials/name.html.
 * Requires HTTP; on file:// the placeholder is left empty.
 */
async function loadPartials(root: ParentNode = document): Promise<void> {
  const slots = $$<HTMLElement>('[data-include]', root);
  if (slots.length === 0) return;

  if (location.protocol === 'file:') {
    console.info('[partials] Opened from disk; serve over HTTP to load the header and footer.');
    return;
  }

  await Promise.all(slots.map(async (slot) => {
    const name = slot.dataset['include'];
    if (!name) return;
    try {
      const res = await fetch(`${PARTIALS_PATH}/${name}.html`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const template = document.createElement('template');
      template.innerHTML = await res.text();
      slot.replaceWith(template.content);
    } catch (err: unknown) {
      console.error(`[partials] Could not load "${name}":`, err);
    }
  }));
}

/* Element builder
   -------------------------------------------------------------------------- */

interface ElOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

/** Creates an element with text set via textContent (never innerHTML). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: ReadonlyArray<Node> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/* Secondary page (page.html?page=<slug>)
   -------------------------------------------------------------------------- */

const PAGES_URL = 'static/data/pages.json';

type Category = 'crimes' | 'resources';

interface PageSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

interface PageData {
  category: Category;
  /** Key in messages.properties, so tiles and pages share one name. */
  titleKey: string;
  intro: string;
  sections: PageSection[];
}

interface PagesFile {
  pages: Record<string, PageData>;
}

/** Section anchor on the home page and its title key, per category. */
const CATEGORY_INFO: Record<Category, { anchor: string; titleKey: string }> = {
  crimes: { anchor: 'index.html#crimes-title', titleKey: 'crimes.title' },
  resources: { anchor: 'index.html#resources-title', titleKey: 'resources.title' },
};

function isPagesFile(value: unknown): value is PagesFile {
  return typeof value === 'object' && value !== null
    && typeof (value as { pages?: unknown }).pages === 'object';
}

async function fetchPages(): Promise<PagesFile> {
  if (location.protocol === 'file:') throw new Error('Opened from disk');
  const res = await fetch(PAGES_URL);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data: unknown = await res.json();
  if (!isPagesFile(data)) throw new Error('pages.json has an unexpected shape');
  return data;
}

function renderBreadcrumb(page: PageData): HTMLElement {
  const category = CATEGORY_INFO[page.category];
  const crumb = (href: string | null, text: string): HTMLLIElement =>
    el('li', {}, [
      href
        ? el('a', { text, attrs: { href } })
        : el('span', { text, attrs: { 'aria-current': 'page' } }),
    ]);

  return el('nav', { className: 'breadcrumb', attrs: { 'aria-label': t('detail.breadcrumb.label') } }, [
    el('ol', {}, [
      crumb('index.html', t('detail.breadcrumb.home')),
      crumb(category.anchor, t(category.titleKey)),
      crumb(null, t(page.titleKey)),
    ]),
  ]);
}

function renderPageHero(page: PageData): HTMLElement {
  const wrapper = el('section', { className: 'page-hero bleed' });
  const inner = el('div', { className: 'page-hero-inner' }, [
    el('h1', { className: 'page-hero-title', text: t(page.titleKey) }),
  ]);
  wrapper.appendChild(inner);
  return wrapper;
}

function renderArticle(page: PageData): HTMLElement {
  const sections = page.sections.map((section) =>
    el('section', { className: 'detail-section' }, [
      el('h2', { text: section.heading }),
      ...section.paragraphs.map((p) => el('p', { text: p })),
      ...(section.list?.length
        ? [el('ul', {}, section.list.map((item) => el('li', { text: item })))]
        : []),
    ]),
  );

  return el('article', { className: 'detail-article col-12 lg-8' }, [
    ...sections,
  ]);
}

function renderRelated(slug: string, page: PageData, all: Record<string, PageData>): HTMLElement {
  const categoryTitle = t(CATEGORY_INFO[page.category].titleKey);
  const links = Object.entries(all)
    .filter(([s, p]) => p.category === page.category && s !== slug)
    .map(([s, p]) =>
      el('li', {}, [el('a', { text: t(p.titleKey), attrs: { href: `page.html?page=${encodeURIComponent(s)}` } })]),
    );

  return el('aside', { className: 'detail-related col-12 lg-4', attrs: { 'aria-labelledby': 'related-title' } }, [
    el('h2', { text: t('detail.related.title', [categoryTitle]), attrs: { id: 'related-title' } }),
    el('ul', {}, links),
  ]);
}

function renderMessage(titleKey: string, bodyKey: string): HTMLElement[] {
  return [
    el('div', { className: 'detail-message col-12 lg-8' }, [
      el('h1', { text: t(titleKey) }),
      el('p', { text: t(bodyKey) }),
      el('a', { className: 'detail-back', text: t('detail.back'), attrs: { href: 'index.html' } }),
    ]),
  ];
}

/** Fills [data-page-content] from pages.json, using ?page=<slug>. */
async function renderPage(): Promise<void> {
  const container = $<HTMLElement>('[data-page-content]');
  if (!container) return;

  const slug = new URLSearchParams(location.search).get('page') ?? '';
  let content: HTMLElement[];

  try {
    const { pages } = await fetchPages();
    const page = Object.prototype.hasOwnProperty.call(pages, slug) ? pages[slug] : undefined;

    if (page) {
      document.title = t('detail.titleFormat', [t(page.titleKey)]);
      content = [renderPageHero(page), renderBreadcrumb(page), renderArticle(page), renderRelated(slug, page, pages)];
    } else {
      document.title = t('detail.titleFormat', [t('detail.notFound.title')]);
      content = renderMessage('detail.notFound.title', 'detail.notFound.body');
    }
  } catch (err: unknown) {
    if (location.protocol === 'file:') console.info('[page] Opened from disk; serve over HTTP to load content.');
    else console.error('[page] Could not load content:', err);
    content = renderMessage('detail.error.title', 'detail.error.body');
  }

  container.replaceChildren(...content);
  container.setAttribute('aria-busy', 'false');
}

/* Mobile menu
   -------------------------------------------------------------------------- */

function initMenu(): void {
  const btn = $<HTMLButtonElement>('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  const setOpen = (open: boolean): void => {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', t(open ? 'nav.menu.close' : 'nav.menu.open'));
  };

  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));

  nav.addEventListener('click', (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

/* Carousel
   -------------------------------------------------------------------------- */

interface CarouselOptions {
  /** Milliseconds each slide is shown during the intro pass. */
  dwell: number;
  /** Play through every slide once on page load, then return to slide 1. */
  introAutoplay: boolean;
}

const DEFAULT_CAROUSEL_OPTIONS: CarouselOptions = {
  dwell: 2000,
  introAutoplay: true,
};

interface CarouselParts {
  track: HTMLElement;
  slides: HTMLElement[];
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  dotsEl: HTMLElement;
  counter: HTMLElement;
}

/** Finds every element the carousel needs; returns null if markup is incomplete. */
function getCarouselParts(carousel: HTMLElement): CarouselParts | null {
  const track = $<HTMLElement>('.carousel-track', carousel);
  const slides = $$<HTMLElement>('.slide', carousel);
  const prev = $<HTMLButtonElement>('.prev', carousel);
  const next = $<HTMLButtonElement>('.next', carousel);
  const dotsEl = $<HTMLElement>('.dots', carousel);
  const counter = $<HTMLElement>('.counter', carousel);

  if (!track || slides.length === 0 || !prev || !next || !dotsEl || !counter) {
    console.warn('[carousel] Missing required markup; skipping.', carousel);
    return null;
  }
  return { track, slides, prev, next, dotsEl, counter };
}

function initCarousel(
  carousel: HTMLElement,
  options: Partial<CarouselOptions> = {},
): void {
  const opts: CarouselOptions = { ...DEFAULT_CAROUSEL_OPTIONS, ...options };
  const parts = getCarouselParts(carousel);
  if (!parts) return;

  const { track, slides, prev, next, dotsEl, counter } = parts;
  const lastIndex = slides.length - 1;

  slides.forEach((s, i) => s.setAttribute('aria-label', t('carousel.slide.label', [i + 1, slides.length])));

  let index = 0;
  let timer: number | undefined;

  const clamp = (i: number): number => Math.max(0, Math.min(lastIndex, i));

  const goTo = (i: number): void => {
    const target = slides[clamp(i)];
    if (!target) return;
    track.scrollTo({ left: target.offsetLeft - track.offsetLeft });
  };

  // One dot per slide
  const dots: HTMLButtonElement[] = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot';
    dot.setAttribute('aria-label', t('carousel.dot.label', [i + 1]));
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
    return dot;
  });

  const update = (i: number): void => {
    index = i;
    prev.disabled = i === 0;
    next.disabled = i === lastIndex;
    counter.textContent = t('carousel.counter', [i + 1, slides.length]);
    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === i)));
    slides.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== i)));
  };

  prev.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));

  // Arrow keys when the track has focus
  track.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
  });

  // Keep controls in sync with swipes and trackpad scrolling
  const observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          update(slides.indexOf(entry.target as HTMLElement));
        }
      }
    },
    { root: track, threshold: 0.6 },
  );
  slides.forEach((s) => observer.observe(s));

  update(0);

  // Intro autoplay: each slide for `dwell` ms, back to slide 1, then stop
  const stopAutoplay = (): void => {
    window.clearTimeout(timer);
    timer = undefined;
  };

  const startAutoplay = (): void => {
    if (!opts.introAutoplay || prefersReducedMotion() || slides.length < 2) return;

    let step = 0;
    const tick = (): void => {
      step += 1;
      if (step <= lastIndex) {
        goTo(step);
        timer = window.setTimeout(tick, opts.dwell);
      } else {
        goTo(0);
        timer = undefined;
      }
    };
    timer = window.setTimeout(tick, opts.dwell);
  };

  // Any interaction ends autoplay so it never fights the visitor
  const interactionEvents: ReadonlyArray<keyof HTMLElementEventMap> =
    ['pointerdown', 'wheel', 'keydown', 'focusin'];
  interactionEvents.forEach((evt) =>
    carousel.addEventListener(evt, stopAutoplay, { passive: true }),
  );

  if (document.readyState === 'complete') startAutoplay();
  else window.addEventListener('load', startAutoplay, { once: true });
}

/* Dev: column overlay toggle (remove for production)
   -------------------------------------------------------------------------- */

function initColumnToggle(): void {
  const toggle = $<HTMLButtonElement>('.toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => document.body.classList.toggle('show-cols'));
}

/* Init
   -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  // Partials and messages load in parallel; text is applied once both are in
  await Promise.all([loadPartials(), loadMessages()]);
  applyMessages();
  await renderPage(); // builds its own text with t(), and sets the page title

  initMenu();
  $$<HTMLElement>('.carousel').forEach((c) => initCarousel(c));
  initColumnToggle();
}

main().catch((err: unknown) => console.error('[main] Startup failed:', err));
