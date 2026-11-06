import { CONFIG } from './js/config.js';
import { Auth } from './js/auth.js';
import { Calendar } from '../timeline/script.js?v=timeline-clear-1';
import { LoadingScreen } from '../load/loading.js?v=load-4';

const App = {
    _timerInterval: null,
    _inputBound: false,
    _pointsHandler: null,
    _tabMenuExpanded: false,
    _isSendingDiary: false,
    _lastDiarySubmit: { key: '', at: 0 },
    _loginIdentities: {
        gogo: { identity: 'Gogo', password: '20250522' },
        gigi: { identity: 'Gigi', password: '20250522' }
    },

    async init() {
        LoadingScreen.show({ task: true });

        try {
        if (!this._pointsHandler) {
            this._pointsHandler = () => this.updatePointsDisplay();
            document.addEventListener('points-updated', this._pointsHandler);
        }

        // 检查登录状态
        let isLoggedIn = false;
        try {
            isLoggedIn = await Auth.init();
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }

        // 移除 Loading 遮罩
        if (isLoggedIn) {
            await this.showPage('main', { waitForData: true });
        } else {
            this.showPage('auth');
        }

        } finally {
            LoadingScreen.hide({ task: true });
        }
    },

    async showPage(pageName, { waitForData = false } = {}) {
        document.getElementById('page-auth').classList.add('hidden');
        document.getElementById('page-main').classList.add('hidden');

        const target = document.getElementById(`page-${pageName}`);
        if (target) target.classList.remove('hidden');

        const chatEntry = document.getElementById('ai-chat-entry');
        if (chatEntry) chatEntry.classList.toggle('hidden', pageName !== 'main');

        if (pageName === 'auth') {
            this.selectLoginIdentity('gigi');
        }

        if (pageName === 'main') {
            const ready = this.initMainPage();
            if (waitForData) await ready;
        }
    },

    async initMainPage() {
        this.startLoveTimer();
        this.updatePointsDisplay();

        await Calendar.initTimeline();

        this.bindInputEnter();
        this.syncTabMenu(false);
    },

    startLoveTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        const start = new Date(CONFIG.ANNIVERSARY_DATE);

        const updateTimer = () => {
            const now = new Date();
            const diff = now - start;

            if (diff >= 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const remainder = diff % (1000 * 60 * 60 * 24);

                const hours = Math.floor(remainder / (1000 * 60 * 60));
                const minutes = Math.floor((remainder % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remainder % (1000 * 60)) / 1000);

                const dayEl = document.getElementById('timer-days');
                if (dayEl) dayEl.innerText = days;

                this.updateFlipCard('hour', hours);
                this.updateFlipCard('min', minutes);
                this.updateFlipCard('sec', seconds);
            }
        };

        updateTimer();
        this._timerInterval = setInterval(updateTimer, 1000);
    },

    updateFlipCard(type, value) {
        const str = value.toString().padStart(2, '0');
        const tens = str[0];
        const ones = str[1];

        const tensEl = document.getElementById(`${type}-tens`);
        const onesEl = document.getElementById(`${type}-ones`);

        if (tensEl && tensEl.innerText !== tens) {
            this.animateFlip(tensEl, tens);
        }
        if (onesEl && onesEl.innerText !== ones) {
            this.animateFlip(onesEl, ones);
        }
    },

    animateFlip(el, newValue) {
        el.style.transition = "transform 0.3s ease-in";
        el.style.transform = "rotateX(90deg)";

        setTimeout(() => {
            el.innerText = newValue;
            el.style.transition = "transform 0.3s ease-out";
            el.style.transform = "rotateX(0deg)";
        }, 300);
    },

    bindInputEnter() {
        if (this._inputBound) return;
        const input = document.getElementById('new-diary');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (e.repeat || e.isComposing) return;
                this.sendDiary();
            }
        });
        this._inputBound = true;
    },

    setDiarySubmitting(isSubmitting) {
        const input = document.getElementById('new-diary');
        const button = document.getElementById('diary-send-btn');
        if (input) input.disabled = isSubmitting;
        if (button) button.disabled = isSubmitting;
    },

    updatePointsDisplay() {
        const el = document.getElementById('user-points');
        if (el && Auth.profile) {
            el.innerText = `🧸 ${Auth.profile.points || 0}`;
        }
    },

    switchTab(tab) {
        document.getElementById('view-timeline')?.classList.add('hidden');

        const buttons = ['tab-btn-timeline'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('is-active', 'bg-pink-500', 'text-white');
            }
        });

        const targetView = document.getElementById(`view-${tab}`);
        const targetBtn = document.getElementById(`tab-btn-${tab}`);

        if (targetView) targetView.classList.remove('hidden');
        if (targetBtn) {
            targetBtn.classList.remove('text-gray-400');
            targetBtn.classList.add('is-active');
        }

        const composer = document.getElementById('timeline-composer');
        if (composer) composer.classList.toggle('hidden', tab !== 'timeline');
        const timerRow = document.getElementById('home-timer-row');
        if (timerRow) timerRow.classList.toggle('hidden', tab !== 'timeline');
        if (tab !== 'timeline') {
            document.getElementById('mood-panel')?.classList.add('hidden');
        }

        this.syncTabMenu(false);
    },

    syncTabMenu(expanded = this._tabMenuExpanded) {
        this._tabMenuExpanded = !!expanded;

        const main = document.getElementById('tab-grid-main');
        const extra = document.getElementById('tab-grid-extra');
        const toggle = document.getElementById('tab-menu-toggle');
        if (main) {
            main.classList.toggle('hidden', !this._tabMenuExpanded);
        }
        if (extra) {
            extra.classList.toggle('hidden', !this._tabMenuExpanded);
        }
        if (toggle) {
            toggle.textContent = this._tabMenuExpanded ? 'x' : '...';
            toggle.setAttribute('aria-expanded', this._tabMenuExpanded ? 'true' : 'false');
        }
    },

    toggleTabMenu() {
        this.syncTabMenu(!this._tabMenuExpanded);
    },

    selectLoginIdentity(identity) {
        const config = this._loginIdentities[identity] || this._loginIdentities.gigi;
        const identityInput = document.getElementById('input-identity');
        const passwordInput = document.getElementById('input-password');
        const gogoOption = document.getElementById('identity-gogo-option');
        const gigiOption = document.getElementById('identity-gigi-option');
        const radio = document.querySelector(`input[name="login-identity"][value="${config.identity}"]`);

        if (identityInput) identityInput.value = config.identity;
        if (passwordInput) passwordInput.value = config.password;
        if (radio) radio.checked = true;

        if (gogoOption) gogoOption.classList.toggle('active', identity === 'gogo');
        if (gigiOption) gigiOption.classList.toggle('active', identity !== 'gogo');
    },

    async loginWithPassword() {
        const identity = document.getElementById('input-identity').value.trim();
        const password = document.getElementById('input-password').value.trim();

        try {
            await LoadingScreen.withLoading(async () => {
                await Auth.loginWithPassword(identity, password);
                await this.showPage('main', { waitForData: true });
            });
        } catch (e) {
            alert(e.message);
        }
    },

    async logout() {
        if (!confirm('确定要退出登录吗？')) return;
        await Auth.logout();
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        this._inputBound = false;
        this.showPage('auth');
    },

    async sendDiary() {
        const input = document.getElementById('new-diary');
        if (!input || this._isSendingDiary) return;
        const content = input.value.trim();
        const moodSelect = document.getElementById('mood-select');
        const mood = moodSelect ? moodSelect.value : null;

        if (!content && !mood) return;

        const submitKey = `${content}|${mood || ''}`;
        const now = Date.now();
        if (this._lastDiarySubmit.key === submitKey && now - this._lastDiarySubmit.at < 1800) {
            return;
        }
        this._lastDiarySubmit = { key: submitKey, at: now };

        const originalContent = input.value;
        this._isSendingDiary = true;
        this.setDiarySubmitting(true);
        input.value = '';
        if (moodSelect) moodSelect.value = '';

        try {
            const error = await Calendar.addEvent({ content, mood });
            if (error) {
                input.value = originalContent;
                alert('发送失败：' + (error.message || '未知错误'));
            }
        } finally {
            this._isSendingDiary = false;
            this.setDiarySubmitting(false);
            input.focus();
        }
    },

    openModule(moduleName) {
        const isRoot = !window.location.pathname.includes('/apps/home');
        LoadingScreen.goTo(isRoot ? `./apps/${moduleName}/` : `../${moduleName}/`);
    },

    openWheel() {
        this.openModule('wheel');
    },

    openAlbum() {
        this.openModule('album');
    },

    openMenu() {
        this.openModule('menu');
    },

    openXiaobenben() {
        this.openModule('xiaobenben');
    },

    openCalendar() {
        this.openModule('calendar');
    },

    openStore() {
        this.openModule('store');
    },

    openLetter() {
        this.openModule('letter');
    },

    doCheckIn: () => Calendar.doCheckIn(),
    sootheUser: (id) => Calendar.sootheUser(id),
    toggleMoodPanel() {
        const panel = document.getElementById('mood-panel');
        panel.classList.toggle('hidden');
    },

    async sendSOS(moodType) {
        const contentMap = {
            'angry': '我现在很生气！😠',
            'sad': '我好难过... 😭',
            'sos': '紧急求救！需要抱抱！🆘'
        };

        const error = await Calendar.addEvent({
            content: contentMap[moodType],
            type: 'diary',
            mood: moodType
        });

        if (error) return alert('发送失败：' + error.message);
        document.getElementById('mood-panel').classList.add('hidden');
    }
};

window.app = App;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init(), { once: true });
} else {
    App.init();
}
