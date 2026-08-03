import { fetchMemoryAlbumEntries } from '../../album/album-service.js';
import { escapeAttribute, escapeHtml } from '../../shared/html.js';

const PHOTO_LIST = [
    { file: 'img20250422.jpg', date: '2025.04.22', text: '第一次遇见你，我们的故事就开始啦。✨' },
    { file: 'img20250430.jpg', date: '2025.04.30', text: '就这么开始了第一次约会嘿嘿嘿。💕' },
    { file: 'img20250509.jpg', date: '2025.05.09', text: '小小二龙喉，出发！📸' },
    { file: 'img20250515.jpg', date: '2025.05.15', text: '黑沙滩，这是谁的最爱呀？💕' },
    { file: 'img20250520.jpg', date: '2025.05.20', text: '送给你呀！（害羞💕' },
    { file: 'img20250530.jpg', date: '2025.05.30', text: '一起回中山咯。💖' },
    { file: 'img20250605.jpg', date: '2025.06.05', text: '你怎么就靠上来了呀。😊' },
    { file: 'img20250613.jpg', date: '2025.06.13', text: '我真帅，夹带私货。😎' },
    { file: 'img20250626.jpg', date: '2025.06.26', text: '饭后和你散步一起享受休闲时光。😊' },
    { file: 'img20250627.jpg', date: '2025.06.27', text: '黑沙滩我们又来啦。⏰' },
    { file: 'img20250630.jpg', date: '2025.06.30', text: '有人说这张她好可爱。🥰' },
    { file: 'img20250723.jpg', date: '2025.07.23', text: '来看日落了呀。☀️' },
    { file: 'img20250726.jpg', date: '2025.07.26', text: '一起做小小社工捏。🍃' },
    { file: 'img20250805.jpg', date: '2025.08.05', text: '欢迎来到我的主场。🚀' },
    { file: 'img20250813.jpg', date: '2025.08.13', text: 'Gigi好看，Gogo嫌弃。😏' },
    { file: 'img20250901.jpg', date: '2025.09.01', text: '新学期开始啦，送Gigi上学。💝' },
    { file: 'img20250903.jpg', date: '2025.09.03', text: '一起去薅羊毛咯。🍂' },
    { file: 'img20250912.jpg', date: '2025.09.12', text: '又去逛gaigai啦。💓' },
    { file: 'img20250920.jpg', date: '2025.09.20', text: '一人一个大奖，我们超棒哒。🍁' },
    { file: 'img20251003.jpg', date: '2025.10.03', text: '去了你的家乡哦。🌅' },
    { file: 'img20251018.jpg', date: '2025.10.18', text: '一起逛博物馆咯。👫' },
    { file: 'img20251108.jpg', date: '2025.11.08', text: '依旧是让Gigi超期待的黑沙滩。🌟' },
    { file: 'img20251115.jpg', date: '2025.11.15', text: '送你一朵小黄花。😊' },
    { file: 'img20251122.jpg', date: '2025.11.22', text: '你的星星人的星星怎么少了个角？🤔' },
    { file: 'img20251202.jpg', date: '2025.12.02', text: '是一口寿司郎噢。🍣' },
    { file: 'img20251212.jpg', date: '2025.12.12', text: '心心念念的Omakase安排上咯。🎉' },
    { file: 'img20251214.jpg', date: '2025.12.14', text: '一起参加百万行啦。🚶' },
    { file: 'img20251219.jpg', date: '2025.12.19', text: 'oi,给我爆点金币。💰' },
    { file: 'img20251225.jpg', date: '2025.12.25', text: '圣诞快乐！你就是我最好的圣诞礼物。🎅' },
    { file: 'img20260101.jpg', date: '2026.01.01', text: '新的一年，我们未来可期！🎊' }
];

const isHomeDir = window.location.pathname.includes('/apps/home');
const assetsBase = isHomeDir ? 'assets/' : 'apps/home/assets/';
const musicPath = `${assetsBase}music/music.mp3`;

function mapStaticPhotoEntries() {
    return PHOTO_LIST.map((photo, idx) => ({
        id: `static-${idx}`,
        imagePath: photo.file,
        imageUrl: `${assetsBase}photos/${photo.file}`,
        shotDate: photo.date,
        caption: photo.text,
        authorName: '',
        createdAt: null,
        isPublished: true,
        sortOrder: idx
    }));
}

function getNetworkHint() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = c && c.effectiveType ? String(c.effectiveType) : '';
    const saveData = !!(c && c.saveData);
    return { effectiveType, saveData };
}

function choosePreloadAhead() {
    const { effectiveType, saveData } = getNetworkHint();
    if (saveData) return 1;
    if (effectiveType.includes('2g')) return 1;
    if (effectiveType.includes('3g')) return 3;
    return 8;
}

function choosePreloadConcurrency() {
    return 2;
}

class ImagePreloadQueue {
    constructor(concurrency = 2) {
        this.concurrency = Math.max(1, Number(concurrency) || 1);
        this._q = [];
        this._active = 0;

        document.addEventListener('visibilitychange', () => this._drain());
    }

    enqueue(url) {
        if (!url) return;
        this._q.push(url);
        this._drain();
    }

    _drain() {
        if (document.visibilityState === 'hidden') return;

        while (this._active < this.concurrency && this._q.length) {
            const url = this._q.shift();
            if (!url) continue;

            this._active++;
            const img = new Image();

            const done = () => {
                this._active = Math.max(0, this._active - 1);
                // Yield to keep main thread responsive.
                setTimeout(() => this._drain(), 0);
            };

            img.onload = done;
            img.onerror = done;
            img.src = url;
        }
    }
}

class BirthdayApp {
    constructor() {
        this.fireworksCanvas = null;
        this.fireworksCtx = null;
        this.fireworksParticles = [];
        this.fireworksLoop = null;
        this.createFirework = null;
        this.state = 'gift';
        this._preloadedUrls = new Set();
        this._preloadAhead = choosePreloadAhead();
        this._preloadQueue = new ImagePreloadQueue(choosePreloadConcurrency());
        this._bgPreloadHandle = null;
        this._audioPrepared = false;
        this.photoEntries = mapStaticPhotoEntries();
        this._entriesPromise = this._loadPhotoEntries();
        this.initDOM();
        this.initAudio();
        this._preloadBatch(0, this._preloadAhead);
    }

    async _loadPhotoEntries() {
        try {
            const remoteEntries = await fetchMemoryAlbumEntries();
            if (remoteEntries.length > 0) {
                this.photoEntries = remoteEntries;
                this._preloadedUrls.clear();
                this._preloadBatch(0, this._preloadAhead);
            }
        } catch (_) {
            this.photoEntries = mapStaticPhotoEntries();
        }
        return this.photoEntries;
    }

    async _ensurePhotoEntries() {
        if (this._entriesPromise) {
            await this._entriesPromise;
        }
        return this.photoEntries;
    }

    _getPhotoUrl(idx) {
        if (idx < 0 || idx >= this.photoEntries.length) return null;
        return this.photoEntries[idx].imageUrl;
    }

    _preloadBatch(start, count) {
        for (let i = start; i < Math.min(start + count, this.photoEntries.length); i++) {
            const url = this._getPhotoUrl(i);
            if (url && !this._preloadedUrls.has(url)) {
                this._preloadedUrls.add(url);
                this._preloadQueue.enqueue(url);
            }
        }
    }

    initDOM() {
        this.giftSection = document.getElementById('bday-gift-section');
        this.cakeSection = document.getElementById('bday-cake-section');
        this.gallerySection = document.getElementById('bday-gallery-section');

        const giftBox = document.getElementById('gift-box-container');
        if (giftBox && !giftBox.onclick) {
            giftBox.addEventListener('click', () => this.openGift());
        }

        const blowBtn = document.getElementById('blow-candle-btn');
        if (blowBtn) blowBtn.addEventListener('click', () => this.blowCandles());
    }

    initAudio() {
        // Avoid starting a big download immediately; warm up later when idle.
        this.audio = new Audio();
        this.audio.loop = true;
        // De-prioritize music: don't auto-download, only start when user clicks gift.
        this.audio.preload = 'none';
        this.audio.playsInline = true;
        this.audio.muted = false;
        this.audio.volume = 0.9;
    }

    _prepareAudio() {
        if (!this.audio || this._audioPrepared) return;
        this._audioPrepared = true;
        this.audio.preload = 'auto';
        this.audio.src = musicPath;
        try { this.audio.load(); } catch (_) {}
    }

    _playMusic() {
        if (!this.audio) return;
        this._prepareAudio();
        const p = this.audio.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Retry once after enough data is buffered.
                this.audio.addEventListener('canplay', () => {
                    this.audio.play().catch(() => {});
                }, { once: true });
            });
        }
    }

    openGift() {
        if (this.state !== 'gift') return;
        this.state = 'opening';

        // On iOS/Safari, play() is most reliable when called immediately on the user gesture.
        this._playMusic();

        const giftBox = document.getElementById('gift-box-container');
        if (giftBox) {
            giftBox.classList.add('gift-open');
            const rect = giftBox.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height * 0.35;
            this.createBoxConfetti(cx, cy, 40);
            setTimeout(() => this.createBoxConfetti(cx, cy, 25), 150);
        }

        setTimeout(() => {
            this.giftSection.classList.add('fade-out-up');
            setTimeout(() => {
                this.giftSection.classList.add('hidden');
                this.showCake();
            }, 800);
        }, 1200);
    }

    createBoxConfetti(x, y, count) {
        const colors = ['#fb7185', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#ec4899'];
        const frag = document.createDocumentFragment();
        const els = [];

        for (let i = 0; i < count; i++) {
            const c = document.createElement('div');
            const size = 8 + Math.random() * 10;
            c.style.cssText = `position:fixed;pointer-events:none;border-radius:50%;z-index:9999;width:${size}px;height:${size}px;left:${x}px;top:${y}px;opacity:1;background:${colors[i % colors.length]}`;
            frag.appendChild(c);
            els.push(c);
        }
        document.body.appendChild(frag);

        requestAnimationFrame(() => {
            els.forEach(c => {
                const angle = Math.random() * Math.PI * 2;
                const dist = 100 + Math.random() * 150;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist - 60;
                c.style.transition = 'transform 1s ease-out, opacity 1s ease-out';
                c.style.transform = `translate(${tx}px, ${ty}px) scale(0.1)`;
                c.style.opacity = '0';
            });
        });

        setTimeout(() => els.forEach(c => c.remove()), 1100);
    }

    showCake() {
        this.state = 'cake';
        this.cakeSection.classList.remove('hidden');
        this.cakeSection.classList.add('fade-in');
    }

    blowCandles() {
        if (this.state !== 'cake') return;
        this.state = 'blowing';

        const btn = document.getElementById('blow-candle-btn');
        if (btn) {
            btn.classList.add('active:scale-90');
            btn.style.transform = 'scale(0.88)';
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            btn.textContent = '🎂 蜡烛熄灭啦~';
        }

        const flames = document.querySelectorAll('.flame-fancy');
        flames.forEach(f => {
            f.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out, filter 0.6s';
            f.style.opacity = '0';
            f.style.transform = 'translateX(-50%) scale(0.1) translateY(-20px)';
            f.style.filter = 'blur(4px)';
        });

        const smoke = document.getElementById('candle-smoke');
        if (smoke) {
            smoke.classList.remove('hidden');
            smoke.style.opacity = '1';
            setTimeout(() => { smoke.style.transition = 'opacity 1.5s'; smoke.style.opacity = '0'; }, 800);
        }

        const cake = document.querySelector('.cake-body, .cake-container, [class*="cake"]');
        if (cake) {
            cake.style.transition = 'filter 0.8s';
            cake.style.filter = 'brightness(0.6)';
            setTimeout(() => { cake.style.filter = 'brightness(1)'; }, 1500);
        }

        setTimeout(() => {
            if (btn) btn.textContent = '🎉 准备看照片墙...';
            document.getElementById('cake-msg').innerText = '生日快乐! 🎂';
            this.startFireworks();
        }, 800);
    }

    initFireworksEngine() {
        const canvas = document.getElementById('fireworks-canvas');
        if (!canvas) return;

        this.fireworksCanvas = canvas;
        this.fireworksCtx = canvas.getContext('2d');
        this.fireworksParticles = [];

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = this.fireworksCtx;
        const particles = this.fireworksParticles;

        this.createFirework = (x, y) => {
            const hue = Math.random() * 360;
            const color = `hsl(${hue}, 70%, 60%)`;
            for (let i = 0; i < 25; i++) {
                particles.push({
                    x, y, color,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    alpha: 1,
                    friction: 0.95,
                    gravity: 0.05
                });
            }
        };

        const animate = () => {
            this.fireworksLoop = requestAnimationFrame(animate);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                if (p.alpha <= 0) { particles.splice(i, 1); continue; }
                p.vx *= p.friction;
                p.vy *= p.friction;
                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.012;

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                ctx.restore();
            }

            // Keep fireworks alive behind the photo wall as well.
            if ((this.state === 'fireworks' || this.state === 'gallery') && Math.random() < 0.06) {
                this.createFirework(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height * 0.5
                );
            }
        };

        animate();
    }

    startFireworks() {
        this.state = 'fireworks';
        // Progressive background preload to avoid flooding network connections.
        this._startBackgroundPreload();

        if (!this.fireworksCanvas) {
            this.initFireworksEngine();
        }

        if (this.createFirework && this.fireworksCanvas) {
            const w = this.fireworksCanvas.width;
            const h = this.fireworksCanvas.height;
            for (let i = 0; i < 8; i++) {
                setTimeout(() => this.createFirework(Math.random() * w, Math.random() * h * 0.6), i * 200);
            }
        }

        setTimeout(() => {
            this.cakeSection.classList.add('fade-out-up');
            setTimeout(() => {
                this.cakeSection.classList.add('hidden');
                this.showGallery();
            }, 800);
        }, 4000);
    }

    showGallery() {
        this.state = 'gallery';
        this.gallerySection.classList.remove('hidden');
        this.renderPhotos().catch(() => {
            this.photoEntries = mapStaticPhotoEntries();
            this.renderPhotoCards();
        });
    }

    _startBackgroundPreload() {
        if (this._bgPreloadHandle) return;
        let idx = 0;

        const tick = () => {
            this._bgPreloadHandle = null;
            // Only preload aggressively while fireworks are showing.
            // In gallery mode, prioritize in-view image loads and music.
            if (this.state !== 'fireworks') return;

            const batch = Math.max(2, this._preloadAhead);
            this._preloadBatch(idx, batch);
            idx += batch;
            if (idx >= this.photoEntries.length) return;

            if ('requestIdleCallback' in window) {
                this._bgPreloadHandle = requestIdleCallback(tick, { timeout: 1600 });
            } else {
                this._bgPreloadHandle = setTimeout(tick, 800);
            }
        };

        tick();
    }

    _buildPhotoCard(photo, idx) {
        const rotate = ((Math.random() - 0.5) * 8).toFixed(1);
        const fetchPriority = idx < 2 ? 'high' : 'auto';

        const div = document.createElement('div');
        div.className = 'w-64 transition-all duration-700 ease-out opacity-0';
        div.style.transform = `rotate(${rotate}deg) translateY(40px)`;
        div.dataset.rotate = rotate;
        div.dataset.idx = idx;

        div.innerHTML = `
            <div class="bg-white p-4 pb-10 shadow-2xl text-center rounded-sm relative">
                <div class="relative overflow-hidden rounded-sm mb-3 bg-gray-200 aspect-[3/4] flex items-center justify-center">
                    <div class="animate-pulse text-gray-400 text-2xl absolute">📷</div>
                    <img data-src="${escapeAttribute(photo.imageUrl)}" alt="${escapeAttribute(photo.shotDate)}"
                         class="w-full h-full object-cover relative z-10 transition-opacity duration-500" 
                         loading="lazy" decoding="async" fetchpriority="${fetchPriority}" style="opacity:0"
                         onerror="this.previousElementSibling.textContent='😢'">
                </div>
                <div class="font-handwriting text-gray-700 text-lg tracking-widest mb-2">${escapeHtml(photo.shotDate)}</div>
                <div class="font-handwriting text-gray-600 text-sm leading-relaxed px-2">${escapeHtml(photo.caption)}</div>
                <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-pink-200/50 rotate-1"></div>
            </div>
        `;

        return div;
    }

    renderPhotoCards() {
        const container = document.getElementById('photo-wall');
        container.innerHTML = '';
        const rootEl = this.gallerySection || null;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const card = entry.target;
                const idx = parseInt(card.dataset.idx, 10);

                const img = card.querySelector('img[data-src]');
                if (img) {
                    const src = img.dataset.src;
                    this._preloadedUrls.add(src);
                    img.src = src;
                    img.removeAttribute('data-src');

                    const placeholder = img.previousElementSibling;
                    const reveal = () => {
                        img.style.opacity = '1';
                        if (placeholder) placeholder.remove();
                    };

                    img.addEventListener('load', reveal, { once: true });

                    if (img.decode) {
                        img.decode().then(() => {
                            reveal();
                        }).catch(() => {});
                    }

                    setTimeout(() => {
                        if (img.complete && img.naturalWidth > 0) reveal();
                    }, 3000);
                }

                this._preloadBatch(idx + 1, this._preloadAhead);

                card.classList.remove('opacity-0');
                card.style.transform = `rotate(${card.dataset.rotate || 0}deg) translateY(0)`;
                observer.unobserve(card);
            });
        }, { root: rootEl, rootMargin: '220px' });

        this.photoEntries.forEach((photo, idx) => {
            const div = this._buildPhotoCard(photo, idx);
            container.appendChild(div);
            observer.observe(div);
        });
    }

    async renderPhotos() {
        await this._ensurePhotoEntries();
        this.renderPhotoCards();
    }
}

window.triggerBirthday = function () {
    const birthdayEl = document.getElementById('birthday-app');
    if (!birthdayEl) return;
    if (!birthdayEl.classList.contains('hidden')) return;

    birthdayEl.classList.remove('hidden');

    if (!window.birthdayApp) {
        window.birthdayApp = new BirthdayApp();
    }
};
