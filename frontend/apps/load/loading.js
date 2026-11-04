import { LOADING_MESSAGES } from './messages.js?v=load-4';

const OVERLAY_ID = 'love-loading-overlay';
const STYLE_ID = 'love-loading-style';
const PENDING_CLASS = 'love-loading-pending';
const DEFAULT_MESSAGE = '亲亲我的小居居';

let activeTasks = 0;
let isNavigating = false;
let isNavigationBound = false;
let lastMessage = '';

function randomMessage() {
    const messages = LOADING_MESSAGES.filter(Boolean);
    if (messages.length === 0) return DEFAULT_MESSAGE;
    if (messages.length === 1) return messages[0];

    let next = messages[Math.floor(Math.random() * messages.length)];
    if (next === lastMessage) {
        next = messages[(messages.indexOf(next) + 1) % messages.length];
    }
    lastMessage = next;
    return next;
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) => {
        try {
            return new URL(link.href, window.location.href).pathname.endsWith('/apps/load/loading.css');
        } catch (error) {
            return false;
        }
    });
    if (existing) {
        existing.id = STYLE_ID;
        return;
    }

    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = new URL('./loading.css', import.meta.url).href;
    document.head.appendChild(link);
}

function ensureOverlay() {
    ensureStyle();

    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'love-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="love-loading-panel">
            <img class="love-loading-image" alt="加载中" decoding="async">
            <p class="love-loading-copy" data-loading-copy></p>
        </div>
    `;

    const image = overlay.querySelector('.love-loading-image');
    image.src = new URL('./load.webp', import.meta.url).href;

    document.body.appendChild(overlay);
    return overlay;
}

function shouldHandleLink(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return false;
    if (/^(javascript:|mailto:|tel:)/i.test(href)) return false;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;

    const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
    if (samePage && url.hash) return false;

    return true;
}

function setMessage(overlay, message) {
    const copy = overlay.querySelector('[data-loading-copy]');
    if (copy) copy.textContent = message || randomMessage();
}

export const LoadingScreen = {
    show({ message, task = false } = {}) {
        if (task) activeTasks += 1;

        const overlay = ensureOverlay();
        const isAlreadyVisible = overlay.classList.contains('is-visible');
        if (message || !isAlreadyVisible) {
            setMessage(overlay, message);
        }
        overlay.setAttribute('aria-hidden', 'false');
        if (!isAlreadyVisible) {
            overlay.classList.add('is-visible');
        }
    },

    hide({ task = false, force = false } = {}) {
        if (task) activeTasks = Math.max(0, activeTasks - 1);
        if (!force && (activeTasks > 0 || isNavigating)) return;

        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
            document.documentElement.classList.remove(PENDING_CLASS);
            return;
        }

        overlay.classList.remove('is-visible');
        overlay.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove(PENDING_CLASS);
    },

    async withLoading(work, options = {}) {
        this.show({ ...options, task: true });
        try {
            return await work();
        } finally {
            this.hide({ task: true });
        }
    },

    goTo(url, { replace = false, message } = {}) {
        isNavigating = true;
        if (replace) {
            window.location.replace(url);
        } else {
            window.location.assign(url);
        }
    },

    bindNavigation() {
        if (isNavigationBound) return;
        isNavigationBound = true;

        document.addEventListener('click', (event) => {
            const link = event.target.closest?.('a[href]');
            if (!shouldHandleLink(link, event)) return;

            isNavigating = true;
        }, true);

        window.addEventListener('pageshow', (event) => {
            isNavigating = false;
            if (event.persisted) this.hide({ force: true });
        });
    },

    holdInitialPage() {
        if (!document.documentElement.classList.contains(PENDING_CLASS)) return;
        this.show();
    }
};
