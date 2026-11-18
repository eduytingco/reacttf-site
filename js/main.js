"use strict";
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
function $(selector, root = document) {
    return root.querySelector(selector);
}
/** Typed querySelectorAll that returns a real array. */
function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MESSAGES_BASE = 'messages';
/**
 * Locales that have a messages_<locale>.properties file. Only these are
 * requested, so visitors on other languages don't trigger 404s.
 * Example: ['es', 'vi', 'zh_TW']
 */
const SUPPORTED_LOCALES = [];
const MESSAGES_TIMEOUT_MS = 3000;
/**
 * Fallbacks for strings that only exist in script (not in index.html).
 * Used when messages.properties can't be loaded, e.g. opening the page
 * straight from disk. Keep these in sync with messages.properties.
 */
const SCRIPT_FALLBACKS = {
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
let messages = {};
/** Decodes the escape sequences allowed in a .properties value or key. */
function unescapeProperty(raw) {
    return raw.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, seq) => {
        if (seq.length === 5)
            return String.fromCharCode(parseInt(seq.slice(1), 16));
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
function parseProperties(text) {
    const result = {};
    const lines = text.split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = (lines[i] ?? '').replace(/^\s+/, '');
        if (line === '' || line.startsWith('#') || line.startsWith('!'))
            continue;
        // Join continuation lines (an odd number of trailing backslashes)
        while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length) {
            i += 1;
            line = line.slice(0, -1) + (lines[i] ?? '').replace(/^\s+/, '');
        }
        // Key ends at the first unescaped '=', ':' or whitespace
        let k = 0;
        while (k < line.length) {
            const ch = line.charAt(k);
            if (ch === '\\') {
                k += 2;
                continue;
            }
            if (ch === '=' || ch === ':' || /\s/.test(ch))
                break;
            k += 1;
        }
        const key = unescapeProperty(line.slice(0, k));
        const rest = line.slice(k).replace(/^\s*[=:]?\s*/, '');
        result[key] = unescapeProperty(rest);
    }
    return result;
}
async function fetchProperties(url, signal) {
    try {
        const res = await fetch(url, { signal, cache: 'no-cache' });
        if (!res.ok)
            return null;
        return parseProperties(await res.text());
    }
    catch {
        return null; // offline, blocked (file://) or timed out
    }
}
/** Best supported locale for this visitor, e.g. 'es' or 'zh_TW', or null. */
function pickLocale() {
    if (SUPPORTED_LOCALES.length === 0)
        return null;
    for (const lang of navigator.languages) {
        const [language = '', region] = lang.split('-');
        const candidates = region ? [`${language}_${region.toUpperCase()}`, language] : [language];
        const match = candidates.find((c) => SUPPORTED_LOCALES.includes(c));
        if (match)
            return match;
    }
    return null;
}
/** Loads messages.properties, then overlays messages_<locale>.properties if supported. */
async function loadMessages() {
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
    if (locale && localized)
        document.documentElement.lang = locale.replace('_', '-');
}
/** Replaces {0}, {1}, ... with args. */
function format(template, args) {
    return template.replace(/\{(\d+)\}/g, (match, n) => {
        const value = args[Number(n)];
        return value === undefined ? match : String(value);
    });
}
/** Looks up a message by key. Falls back to `fallback`, then to the key itself. */
function t(key, args = [], fallback) {
    const template = messages[key] ?? fallback ?? SCRIPT_FALLBACKS[key] ?? key;
    return format(template, args);
}
/** Resolves data-i18n-args, expanding tokens like $year. */
function parseArgs(el) {
    const raw = el.getAttribute('data-i18n-args');
    if (!raw)
        return [];
    return raw.split(',').map((a) => {
        const arg = a.trim();
        return arg === '$year' ? String(new Date().getFullYear()) : arg;
    });
}
/** Applies messages to every [data-i18n] and [data-i18n-attr] element under root. */
function applyMessages(root = document) {
    for (const el of $$('[data-i18n]', root)) {
        const key = el.dataset['i18n'];
        if (!key)
            continue;
        if (messages[key] === undefined)
            continue; // keep the HTML fallback
        el.textContent = t(key, parseArgs(el));
    }
    for (const el of $$('[data-i18n-attr]', root)) {
        const pairs = (el.dataset['i18nAttr'] ?? '').split(',');
        for (const pair of pairs) {
            const [attr, key] = pair.split(':').map((s) => s.trim());
            if (!attr || !key || messages[key] === undefined)
                continue;
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
async function loadPartials(root = document) {
    const slots = $$('[data-include]', root);
    if (slots.length === 0)
        return;
    if (location.protocol === 'file:') {
        console.info('[partials] Opened from disk; serve over HTTP to load the header and footer.');
        return;
    }
    await Promise.all(slots.map(async (slot) => {
        const name = slot.dataset['include'];
        if (!name)
            return;
        try {
            const res = await fetch(`${PARTIALS_PATH}/${name}.html`);
            if (!res.ok)
                throw new Error(`${res.status} ${res.statusText}`);
            const template = document.createElement('template');
            template.innerHTML = await res.text();
            slot.replaceWith(template.content);
        }
        catch (err) {
            console.error(`[partials] Could not load "${name}":`, err);
        }
    }));
}
/** Creates an element with text set via textContent (never innerHTML). */
function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className)
        node.className = options.className;
    if (options.text !== undefined)
        node.textContent = options.text;
    for (const [name, value] of Object.entries(options.attrs ?? {}))
        node.setAttribute(name, value);
    node.append(...children);
    return node;
}
/* Secondary page (page.html?page=<slug>)
   -------------------------------------------------------------------------- */
const PAGES_URL = 'static/data/pages.json';
/** Section anchor on the home page and its title key, per category. */
const CATEGORY_INFO = {
    crimes: { anchor: 'index-real.html#crimes-title', titleKey: 'crimes.title' },
    resources: { anchor: 'index-real.html#resources-title', titleKey: 'resources.title' },
    about: { anchor: 'page.html?page=about', titleKey: 'nav.about' },
    contacts: { anchor: 'page.html?page=contacts', titleKey: 'nav.contacts' },
};
function isPagesFile(value) {
    return typeof value === 'object' && value !== null
        && typeof value.pages === 'object';
}
async function fetchPages() {
    if (location.protocol === 'file:')
        throw new Error('Opened from disk');
    const res = await fetch(PAGES_URL);
    if (!res.ok)
        throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!isPagesFile(data))
        throw new Error('pages.json has an unexpected shape');
    return data;
}
function renderBreadcrumb(page) {
    const category = CATEGORY_INFO[page.category];
    const crumb = (href, text) => el('li', {}, [
        href
            ? el('a', { text, attrs: { href } })
            : el('span', { text, attrs: { 'aria-current': 'page' } }),
    ]);
    const crumbs = [crumb('index-real.html', t('detail.breadcrumb.home'))];
    if (t(category.titleKey) !== t(page.titleKey)) {
        crumbs.push(crumb(category.anchor, t(category.titleKey)));
    }
    crumbs.push(crumb(null, t(page.titleKey)));
    return el('nav', { className: 'breadcrumb', attrs: { 'aria-label': t('detail.breadcrumb.label') } }, [
        el('ol', {}, crumbs),
    ]);
}
function renderPageHero(page) {
    const wrapper = el('section', { className: 'page-hero bleed', attrs: { 'data-category': page.category } });
    const inner = el('div', { className: 'page-hero-inner' }, [
        el('h1', { className: 'page-hero-title', text: t(page.titleKey) }),
    ]);
    wrapper.appendChild(inner);
    return wrapper;
}
function renderArticle(page) {
    const sections = page.sections.map((section) => el('section', { className: 'detail-section' }, [
        el('h2', { text: section.heading }),
        ...section.paragraphs.map((p) => el('p', { text: p })),
        ...(section.list?.length
            ? [el('ul', {}, section.list.map((item) => el('li', { text: item })))]
            : []),
    ]));
    return el('article', { className: 'detail-article col-12 lg-8' }, [
        ...sections,
    ]);
}
function renderRelated(slug, page, all) {
    const categoryTitle = t(CATEGORY_INFO[page.category].titleKey);
    const links = Object.entries(all)
        .filter(([s, p]) => p.category === page.category && s !== slug)
        .map(([s, p]) => el('li', {}, [el('a', { text: t(p.titleKey), attrs: { href: `page.html?page=${encodeURIComponent(s)}` } })]));
    return el('aside', { className: 'detail-related col-12 lg-4', attrs: { 'aria-labelledby': 'related-title' } }, [
        el('h2', { text: t('detail.related.title', [categoryTitle]), attrs: { id: 'related-title' } }),
        el('ul', {}, links),
    ]);
}
function renderMessage(titleKey, bodyKey) {
    return [
        el('div', { className: 'detail-message col-12 lg-8' }, [
            el('h1', { text: t(titleKey) }),
            el('p', { text: t(bodyKey) }),
            el('a', { className: 'detail-back', text: t('detail.back'), attrs: { href: 'index.html' } }),
        ]),
    ];
}
/** Fills [data-page-content] from pages.json, using ?page=<slug>. */
async function renderPage() {
    const container = $('[data-page-content]');
    if (!container)
        return;
    const slug = new URLSearchParams(location.search).get('page') ?? '';
    let content;
    try {
        const { pages } = await fetchPages();
        const page = Object.prototype.hasOwnProperty.call(pages, slug) ? pages[slug] : undefined;
        if (page) {
            document.title = t('detail.titleFormat', [t(page.titleKey)]);
            content = [renderPageHero(page), renderBreadcrumb(page), renderArticle(page), renderRelated(slug, page, pages)];
        }
        else {
            document.title = t('detail.titleFormat', [t('detail.notFound.title')]);
            content = renderMessage('detail.notFound.title', 'detail.notFound.body');
        }
    }
    catch (err) {
        if (location.protocol === 'file:')
            console.info('[page] Opened from disk; serve over HTTP to load content.');
        else
            console.error('[page] Could not load content:', err);
        content = renderMessage('detail.error.title', 'detail.error.body');
    }
    container.replaceChildren(...content);
    container.setAttribute('aria-busy', 'false');
}
/* Search results (search.html?q=<query>)
   -------------------------------------------------------------------------- */
function collectPageText(page) {
    const parts = [t(page.titleKey), page.intro];
    for (const section of page.sections) {
        parts.push(section.heading);
        parts.push(...section.paragraphs);
        if (section.list)
            parts.push(...section.list);
    }
    return parts.join(' ');
}
function snippetAround(text, query, radius = 120) {
    const lower = text.toLowerCase();
    const pos = lower.indexOf(query.toLowerCase());
    if (pos === -1)
        return text.slice(0, radius * 2) + '…';
    const start = Math.max(0, pos - radius);
    const end = Math.min(text.length, pos + query.length + radius);
    let snippet = '';
    if (start > 0)
        snippet += '…';
    snippet += text.slice(start, end);
    if (end < text.length)
        snippet += '…';
    return snippet;
}
function renderSearchResults() {
    const container = $('[data-search-results]');
    if (!container)
        return;
    const query = new URLSearchParams(location.search).get('q')?.trim() ?? '';
    if (!query) {
        document.title = t('detail.titleFormat', [t('search.title')]);
        container.replaceChildren(el('section', { className: 'page-hero bleed', attrs: { 'data-category': 'about' } }, [
            el('div', { className: 'page-hero-inner' }, [
                el('h1', { className: 'page-hero-title', text: t('search.title') }),
            ]),
        ]), el('nav', { className: 'breadcrumb', attrs: { 'aria-label': t('detail.breadcrumb.label') } }, [
            el('ol', {}, [
                el('li', {}, [el('a', { text: t('detail.breadcrumb.home'), attrs: { href: 'index-real.html' } })]),
                el('li', {}, [el('span', { text: t('search.title'), attrs: { 'aria-current': 'page' } })]),
            ]),
        ]), el('div', { className: 'detail-message col-12 lg-8' }, [
            el('p', { text: t('search.prompt') }),
        ]));
        container.setAttribute('aria-busy', 'false');
        return;
    }
    document.title = t('detail.titleFormat', [t('search.title')]);
    fetchPages().then(({ pages }) => {
        const lower = query.toLowerCase();
        const results = [];
        for (const [slug, page] of Object.entries(pages)) {
            const text = collectPageText(page);
            if (text.toLowerCase().includes(lower)) {
                results.push({ slug, page, text });
            }
        }
        const hero = el('section', { className: 'page-hero bleed', attrs: { 'data-category': 'about' } }, [
            el('div', { className: 'page-hero-inner' }, [
                el('h1', { className: 'page-hero-title', text: t('search.title') }),
            ]),
        ]);
        const breadcrumb = el('nav', { className: 'breadcrumb', attrs: { 'aria-label': t('detail.breadcrumb.label') } }, [
            el('ol', {}, [
                el('li', {}, [el('a', { text: t('detail.breadcrumb.home'), attrs: { href: 'index-real.html' } })]),
                el('li', {}, [el('span', { text: t('search.title'), attrs: { 'aria-current': 'page' } })]),
            ]),
        ]);
        if (results.length === 0) {
            container.replaceChildren(hero, breadcrumb, el('div', { className: 'detail-message col-12 lg-8' }, [
                el('h2', { text: t('search.noResults', [query]) }),
                el('p', { text: t('search.noResultsHint') }),
                el('a', { className: 'detail-back', text: t('detail.back'), attrs: { href: 'index-real.html' } }),
            ]));
        }
        else {
            const list = el('div', { className: 'search-results col-12 lg-8' }, [
                el('p', { className: 'search-meta', text: t('search.resultsFor', [query]) + ' — ' + t('search.resultCount', [results.length]) }),
                ...results.map(({ slug, page, text }) => el('article', { className: 'search-result' }, [
                    el('h2', {}, [
                        el('a', { text: t(page.titleKey), attrs: { href: `page.html?page=${encodeURIComponent(slug)}` } }),
                    ]),
                    el('p', { className: 'search-result-category', text: t(CATEGORY_INFO[page.category].titleKey) }),
                    el('p', { className: 'search-result-snippet', text: snippetAround(text, query) }),
                ])),
            ]);
            container.replaceChildren(hero, breadcrumb, list);
        }
        container.setAttribute('aria-busy', 'false');
    }).catch((err) => {
        console.error('[search] Could not load pages:', err);
        container.replaceChildren(...renderMessage('detail.error.title', 'detail.error.body'));
        container.setAttribute('aria-busy', 'false');
    });
}
/* Mobile menu
   -------------------------------------------------------------------------- */
function initMenu() {
    const btn = $('.menu-btn');
    const nav = document.getElementById('site-nav');
    if (!btn || !nav)
        return;
    const setOpen = (open) => {
        nav.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', t(open ? 'nav.menu.close' : 'nav.menu.open'));
    };
    btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.closest('a'))
            setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape')
            setOpen(false);
    });
    $$('.nav-dropdown-toggle', nav).forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const dropdown = toggle.closest('.nav-dropdown');
            if (!dropdown)
                return;
            const isOpen = dropdown.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    });
    $$('.footer-dropdown-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const dropdown = toggle.closest('.footer-dropdown');
            if (!dropdown)
                return;
            const isOpen = dropdown.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    });
}
const DEFAULT_CAROUSEL_OPTIONS = {
    dwell: 2000,
    introAutoplay: true,
};
/** Finds every element the carousel needs; returns null if markup is incomplete. */
function getCarouselParts(carousel) {
    const track = $('.carousel-track', carousel);
    const slides = $$('.slide', carousel);
    const prev = $('.prev', carousel);
    const next = $('.next', carousel);
    const dotsEl = $('.dots', carousel);
    const counter = $('.counter', carousel);
    if (!track || slides.length === 0 || !prev || !next || !dotsEl || !counter) {
        console.warn('[carousel] Missing required markup; skipping.', carousel);
        return null;
    }
    return { track, slides, prev, next, dotsEl, counter };
}
function initCarousel(carousel, options = {}) {
    const opts = { ...DEFAULT_CAROUSEL_OPTIONS, ...options };
    const parts = getCarouselParts(carousel);
    if (!parts)
        return;
    const { track, slides, prev, next, dotsEl, counter } = parts;
    const lastIndex = slides.length - 1;
    slides.forEach((s, i) => s.setAttribute('aria-label', t('carousel.slide.label', [i + 1, slides.length])));
    let index = 0;
    let timer;
    const clamp = (i) => Math.max(0, Math.min(lastIndex, i));
    const goTo = (i) => {
        const target = slides[clamp(i)];
        if (!target)
            return;
        track.scrollTo({ left: target.offsetLeft - track.offsetLeft });
    };
    // One dot per slide
    const dots = slides.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dot';
        dot.setAttribute('aria-label', t('carousel.dot.label', [i + 1]));
        dot.addEventListener('click', () => goTo(i));
        dotsEl.appendChild(dot);
        return dot;
    });
    const update = (i) => {
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
    track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goTo(index - 1);
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            goTo(index + 1);
        }
    });
    // Keep controls in sync with swipes and trackpad scrolling
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                update(slides.indexOf(entry.target));
            }
        }
    }, { root: track, threshold: 0.6 });
    slides.forEach((s) => observer.observe(s));
    update(0);
    // Intro autoplay: each slide for `dwell` ms, back to slide 1, then stop
    const stopAutoplay = () => {
        window.clearTimeout(timer);
        timer = undefined;
    };
    const startAutoplay = () => {
        if (!opts.introAutoplay || prefersReducedMotion() || slides.length < 2)
            return;
        let step = 0;
        const tick = () => {
            step += 1;
            if (step <= lastIndex) {
                goTo(step);
                timer = window.setTimeout(tick, opts.dwell);
            }
            else {
                goTo(0);
                timer = undefined;
            }
        };
        timer = window.setTimeout(tick, opts.dwell);
    };
    // Any interaction ends autoplay so it never fights the visitor
    const interactionEvents = ['pointerdown', 'wheel', 'keydown', 'focusin'];
    interactionEvents.forEach((evt) => carousel.addEventListener(evt, stopAutoplay, { passive: true }));
    if (document.readyState === 'complete')
        startAutoplay();
    else
        window.addEventListener('load', startAutoplay, { once: true });
}
/* Search toggle
   -------------------------------------------------------------------------- */
function initSearch() {
    const header = $('.header');
    const toggle = $('.search-toggle');
    const closeBtn = $('.search-close');
    const input = $('.search-input');
    const form = $('.search-bar');
    if (!header || !toggle)
        return;
    const open = () => {
        header.classList.add('search-active');
        toggle.setAttribute('aria-expanded', 'true');
        input?.focus();
    };
    const close = () => {
        header.classList.remove('search-active');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
    };
    toggle.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && header.classList.contains('search-active'))
            close();
    });
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input?.value.trim();
        if (q)
            location.href = `search.html?q=${encodeURIComponent(q)}`;
    });
}
/* Brand letter animation
   -------------------------------------------------------------------------- */
function initBrandLetters() {
    if (!document.body.hasAttribute('data-animate'))
        return;
    const brandName = $('.brand-name');
    if (!brandName)
        return;
    const text = brandName.textContent ?? '';
    brandName.innerHTML = '';
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = text[i];
        span.style.animationDelay = `${0.3 + i * 0.08}s`;
        brandName.appendChild(span);
    }
}
/* Dev: column overlay toggle (remove for production)
   -------------------------------------------------------------------------- */
function initColumnToggle() {
    const toggle = $('.toggle');
    if (!toggle)
        return;
    toggle.addEventListener('click', () => document.body.classList.toggle('show-cols'));
}
function initMediaAdmin() {
    const AUTH_API = 'https://api.reacttf.org/auth.php';
    const loginSection = document.querySelector('.media-login-section');
    const formSection = document.querySelector('.media-form-section');
    const loginForm = document.getElementById('login-form');
    const loginMsg = document.getElementById('login-msg');
    const logoutBtn = document.getElementById('logout-btn');
    if (!loginForm) return;
    const wantsEdit = new URLSearchParams(window.location.search).has('edit');

    function parseJSON(res) {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
        return res.json().then((body) => {
            if (!res.ok) throw new Error(body.error || 'Server error');
            return body;
        });
    }

    function enableEditMode() {
        loginSection.setAttribute('hidden', '');
        formSection.removeAttribute('hidden');
    }

    function showLogin() {
        loginSection.removeAttribute('hidden');
    }

    if (wantsEdit) {
        fetch(AUTH_API, { credentials: 'include' })
            .then(parseJSON)
            .then((data) => { if (data.authenticated) enableEditMode(); else showLogin(); })
            .catch(() => showLogin());
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginMsg.textContent = '';
        const btn = loginForm.querySelector('.media-submit');
        btn.disabled = true;

        fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                username: loginForm.username.value.trim(),
                password: loginForm.password.value
            })
        })
        .then(parseJSON)
        .then(() => enableEditMode())
        .catch((err) => {
            loginMsg.textContent = err.message;
            loginMsg.className = 'media-form-msg error';
        })
        .finally(() => { btn.disabled = false; });
    });

    logoutBtn.addEventListener('click', () => {
        fetch(AUTH_API, { method: 'DELETE', credentials: 'include' })
            .then(() => { window.location.href = 'index-real.html'; });
    });

    const PAGES_API = 'https://api.reacttf.org/pages.php';
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const csvUpload = document.getElementById('csv-upload');
    const csvMsg = document.getElementById('csv-msg');

    csvUpload.addEventListener('change', () => { uploadBtn.disabled = !csvUpload.files.length; });

    downloadBtn.addEventListener('click', () => {
        csvMsg.textContent = '';
        fetch(PAGES_API, { credentials: 'include' })
            .then((res) => { if (!res.ok) throw new Error('Download failed.'); return res.blob(); })
            .then((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'pages.csv';
                a.click();
                URL.revokeObjectURL(a.href);
            })
            .catch((err) => {
                csvMsg.textContent = err.message;
                csvMsg.className = 'media-form-msg error';
            });
    });

    uploadBtn.addEventListener('click', () => {
        if (!csvUpload.files.length) return;
        csvMsg.textContent = '';
        uploadBtn.disabled = true;

        const formData = new FormData();
        formData.append('csv', csvUpload.files[0]);

        fetch(PAGES_API, { method: 'POST', credentials: 'include', body: formData })
            .then((res) => res.json().then((body) => {
                if (!res.ok) throw new Error(body.error || 'Upload failed.');
                return body;
            }))
            .then(() => {
                csvMsg.textContent = 'pages.csv updated.';
                csvMsg.className = 'media-form-msg success';
                csvUpload.value = '';
                uploadBtn.disabled = true;
            })
            .catch((err) => {
                csvMsg.textContent = err.message;
                csvMsg.className = 'media-form-msg error';
            })
            .finally(() => { uploadBtn.disabled = !csvUpload.files.length; });
    });
}

function initReportCrime() {
    const link = $('#report-a-crime');
    if (!link) return;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const fallback = 'https://www.google.com/search?q=how+to+report+a+crime+near+me';
        if (!navigator.geolocation) { window.open(fallback, '_blank'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const q = encodeURIComponent(
                    `how to report a crime near ${pos.coords.latitude},${pos.coords.longitude}`
                );
                window.open(`https://www.google.com/search?q=${q}`, '_blank');
            },
            () => window.open(fallback, '_blank')
        );
    });
}
/* Init
   -------------------------------------------------------------------------- */
async function main() {
    // Partials and messages load in parallel; text is applied once both are in
    await Promise.all([loadPartials(), loadMessages()]);
    applyMessages();
    await renderPage();
    renderSearchResults();
    initBrandLetters();
    initMenu();
    initSearch();
    $$('.carousel').forEach((c) => initCarousel(c));
    initColumnToggle();
    initMediaAdmin();
    initReportCrime();
}
main().catch((err) => console.error('[main] Startup failed:', err));
//# sourceMappingURL=main.js.map