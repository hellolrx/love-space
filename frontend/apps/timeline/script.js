import { supabase } from '../home/js/supabase.js';
import { Auth } from '../home/js/auth.js';
import { LoadingScreen } from '../load/loading.js?v=load-4';
import {
    diffChinaCalendarDays,
    formatChinaDateTimeFull,
    formatChinaMonthDay,
    formatChinaTime,
    formatChinaWeekdayTime,
    getChinaDateParts,
    toChinaDateISO
} from '../shared/china-time.js';
import { escapeHtml } from '../shared/html.js';

const SCHEDULE_LABELS = {
    date:        { icon: '💕', name: '约会', color: 'pink' },
    anniversary: { icon: '💛', name: '纪念日', color: 'yellow' },
    todo:        { icon: '📋', name: '待办', color: 'green' },
    reminder:    { icon: '🔔', name: '提醒', color: 'purple' }
};

function toLocalISO(dateObj) {
    return toChinaDateISO(dateObj);
}

const HOME_ASSET_BASE = window.location.pathname.includes('/apps/')
    ? '../home/assets'
    : './apps/home/assets';

export const Calendar = {
    events: [],
    schedules: [],
    currentDate: new Date(),
    isCheckingIn: false,

    async initCalendar() {
        await Promise.all([this.loadEvents(), this.loadSchedules()]);
        this.renderCalendarGrid();
    },

    async initTimeline() {
        await this.loadEvents();
        await this.checkDailyCheckIn();
    },

    async init() {
        await Promise.all([this.loadEvents(), this.loadSchedules()]);
        this.renderCalendarGrid();
        await this.checkDailyCheckIn();
    },

    async loadEvents() {
        const container = document.getElementById('events-container');
        if (container) container.innerHTML = '';

        const { data } = await supabase
            .from('calendar_events')
            .select('*, profiles(nickname)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (data) {
            this.events = data;
            this.renderEvents();
        }
    },

    async loadSchedules() {
        const { data } = await supabase
            .from('schedules')
            .select('*')
            .order('date', { ascending: true });

        if (data) this.schedules = data;
    },

    _getNickname(item) {
        return item.author_name || (item.profiles ? item.profiles.nickname : '未知生物');
    },

    _quotedEvent: null,

    setQuote(eventId) {
        const evt = this.events.find(e => String(e.id) === String(eventId));
        if (!evt) return;
        this._quotedEvent = evt;
        const bar = document.getElementById('quote-bar');
        const text = document.getElementById('quote-text');
        if (bar && text) {
            const nick = this._getNickname(evt);
            text.textContent = `${nick}: ${evt.content}`.slice(0, 60);
            bar.classList.remove('hidden');
        }
        document.getElementById('new-diary')?.focus();
    },

    clearQuote() {
        this._quotedEvent = null;
        const bar = document.getElementById('quote-bar');
        if (bar) bar.classList.add('hidden');
    },

    renderEvents() {
        const container = document.getElementById('events-container');
        if (!container) return;
        container.innerHTML = '';
        const myName = Auth.getMyNickname();

        this.events.forEach(item => {
            const nickname = this._getNickname(item);
            const safeNickname = escapeHtml(nickname);
            const safeContent = escapeHtml(item.content);
            
            let themeColor = 'pink';
            if (nickname && (nickname.includes('Gogo') || nickname.includes('Boy'))) {
                themeColor = 'blue';
            }

            const isMe = myName && nickname.includes(myName);
            const avatarSrc = themeColor === 'blue'
                ? `${HOME_ASSET_BASE}/background/bubu.jpg`
                : `${HOME_ASSET_BASE}/background/onetwo.jpg`;
            const avatarAlt = themeColor === 'blue' ? 'Gogo' : 'Gigi';
            const borderColor = themeColor === 'blue' ? 'border-blue-400' : 'border-pink-400';
            const textColor = themeColor === 'blue' ? 'text-blue-300' : 'text-pink-300';
            const avatarRing = themeColor === 'blue' ? 'ring-blue-400/70' : 'ring-pink-400/70';
            
            const moodIcons = { happy: '😄', angry: '😡', sad: '😭', sos: '🆘' };
            const moodIcon = item.mood ? (moodIcons[item.mood] || '') : '';

            let typeIcon = '📝';
            if (item.type === 'checkin') typeIcon = '✨';

            const time = new Date(item.created_at);
            const timeShort = this._formatTimeShort(time);
            const timeFull = this._formatTimeFull(time);

            let bubbleClass;
            if (item.mood === 'angry' || item.mood === 'sos') {
                bubbleClass = 'timeline-bubble timeline-bubble-alert p-3 rounded-2xl border-2 border-red-500 fade-in max-w-[78%] relative animate-pulse';
            } else {
                const borderSide = isMe ? `border-r-4 ${borderColor}` : `border-l-4 ${borderColor}`;
                const bubbleTone = themeColor === 'blue' ? 'timeline-bubble-blue' : 'timeline-bubble-pink';
                bubbleClass = `timeline-bubble ${bubbleTone} p-3 rounded-2xl ${borderSide} fade-in max-w-[78%] relative`;
            }

            const flexDir = isMe ? 'flex-row-reverse' : 'flex-row';
            const nameTimeHTML = isMe
                ? `<span class="time-display text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors whitespace-nowrap"
                        data-time-full="${timeFull}" data-time-short="${timeShort}">${timeShort}</span>
                   <span class="text-xs font-bold ${textColor} flex items-center gap-1">${moodIcon} ${safeNickname} ${typeIcon}</span>`
                : `<span class="text-xs font-bold ${textColor} flex items-center gap-1">${typeIcon} ${safeNickname} ${moodIcon}</span>
                   <span class="time-display text-[11px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors whitespace-nowrap"
                        data-time-full="${timeFull}" data-time-short="${timeShort}">${timeShort}</span>`;

            const showSoothe = (item.mood === 'angry' || item.mood === 'sos') && !isMe;

            const el = document.createElement('div');
            el.className = `flex ${flexDir} items-start gap-2 mb-4 fade-in`;
            el.innerHTML = `
                <div class="flex-shrink-0 w-[42px] h-[42px] rounded-full overflow-hidden ring-2 ${avatarRing} shadow-md mt-0.5 bg-white/10">
                    <img src="${avatarSrc}" alt="${avatarAlt}" class="w-full h-full object-cover">
                </div>
                <div class="${bubbleClass}" data-event-bubble>
                    <div class="flex justify-between items-center mb-1.5 gap-3">
                        ${nameTimeHTML}
                    </div>
                    <p class="text-black text-sm leading-relaxed break-words">${safeContent}</p>
                    ${ showSoothe ? `
                        <div class="mt-2 text-right">
                            <button onclick="window.app.sootheUser('${item.id}')" class="text-xs bg-red-500 text-white px-3 py-1 rounded-full shadow animate-bounce">
                                🤗 哄好了
                            </button>
                        </div>
                    ` : '' }
                </div>
            `;
            let _lpTimer = null;
            const bubble = el.querySelector('.glass, [data-event-bubble]') || el;
            bubble.addEventListener('touchstart', (e) => {
                _lpTimer = setTimeout(() => {
                    _lpTimer = null;
                    this._showMsgMenu(e, item);
                }, 500);
            }, { passive: true });
            bubble.addEventListener('touchend', () => { if (_lpTimer) clearTimeout(_lpTimer); });
            bubble.addEventListener('touchmove', () => { if (_lpTimer) clearTimeout(_lpTimer); });

            container.appendChild(el);
        });

        container.querySelectorAll('.time-display').forEach(el => {
            el.addEventListener('click', function() {
                const cur = this.textContent.trim();
                this.textContent = (cur === this.dataset.timeShort) ? this.dataset.timeFull : this.dataset.timeShort;
            });
        });
    },

    _formatTimeShort(time) {
        const diffDays = diffChinaCalendarDays(new Date(), time);

        if (diffDays === 0) return formatChinaTime(time);
        if (diffDays === 1) return '昨天 ' + formatChinaTime(time);
        if (diffDays < 7) return formatChinaWeekdayTime(time);
        return `${formatChinaMonthDay(time)} ${formatChinaTime(time)}`;
    },

    _formatTimeFull(time) {
        return formatChinaDateTimeFull(time);
    },

    renderCalendarGrid() {
        const grid = document.getElementById('calendar-grid');
        const title = document.getElementById('calendar-month-title');
        if (!grid || !title) return;

        grid.innerHTML = '';
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        title.innerText = `${year}年 ${month + 1}月`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('div'));
        }

        const todayStr = toChinaDateISO(new Date());

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateISO = toLocalISO(dateObj);

            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell';

            const dayEvents = this.events.filter(e => {
                return toLocalISO(new Date(e.created_at)) === dateISO;
            });

            const daySchedules = this.schedules.filter(s => s.date === dateISO);

            if (dateISO === todayStr) {
                cell.classList.add('is-today');
            }

            let mainIcon = '';
            if (daySchedules.length > 0) {
                const firstLabel = daySchedules[0].label || 'date';
                mainIcon = SCHEDULE_LABELS[firstLabel]?.icon || '📅';
            } else if (dayEvents.some(e => e.mood === 'angry')) mainIcon = '😡';
            else if (dayEvents.some(e => e.mood === 'sad')) mainIcon = '😭';
            else if (dayEvents.some(e => e.mood === 'sos')) mainIcon = '🆘';
            else if (dayEvents.some(e => e.type === 'checkin')) mainIcon = '✨';
            else if (dayEvents.length > 0) mainIcon = '📝';

            let dotsHTML = '';
            if (dayEvents.length > 0) {
                const hasGogo = dayEvents.some(e => (e.author_name || e.profiles?.nickname || '').includes('Gogo'));
                const hasGigi = dayEvents.some(e => (e.author_name || e.profiles?.nickname || '').includes('Gigi'));
                if (hasGogo) dotsHTML += '<span class="w-1.5 h-1.5 rounded-full bg-blue-400 mx-0.5"></span>';
                if (hasGigi) dotsHTML += '<span class="w-1.5 h-1.5 rounded-full bg-pink-400 mx-0.5"></span>';
                if (!hasGogo && !hasGigi) dotsHTML += '<span class="w-1.5 h-1.5 rounded-full bg-white/50 mx-0.5"></span>';
            }
            if (daySchedules.length > 0) {
                dotsHTML += '<span class="w-1.5 h-1.5 rounded-full bg-green-400 mx-0.5"></span>';
            }

            cell.innerHTML = `
                <span class="calendar-day-number">${day}</span>
                <div class="calendar-day-icon">${mainIcon}</div>
                <div class="calendar-day-dots">${dotsHTML}</div>
            `;

            cell.onclick = () => this.openDateModal(dateObj, dayEvents, daySchedules);
            grid.appendChild(cell);
        }
    },

    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.renderCalendarGrid();
    },

    openDateModal(dateObj, events, schedules = []) {
        const modal = document.getElementById('date-modal');
        const title = document.getElementById('modal-date-title');
        const list = document.getElementById('modal-events-list');
        if (!modal) return;

        this._currentModalDate = dateObj;
        const titleParts = getChinaDateParts(dateObj);
        const titleWeekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        title.innerText = `${titleParts.month}月${titleParts.day}日 ${titleWeekdays[titleParts.weekday]}`;
        list.innerHTML = '';

        if (schedules.length > 0) {
            schedules.forEach(sch => {
                const labelInfo = SCHEDULE_LABELS[sch.label] || SCHEDULE_LABELS.date;
                const colorMap = { pink: 'border-pink-400 bg-pink-100/70', yellow: 'border-yellow-400 bg-yellow-100/70', green: 'border-green-400 bg-green-100/70', purple: 'border-purple-400 bg-purple-100/70' };
                const colorCls = colorMap[labelInfo.color] || colorMap.pink;
                const completedCls = sch.completed ? 'opacity-50 line-through' : '';

                const div = document.createElement('div');
                div.className = `p-3 rounded-2xl border-l-4 ${colorCls} flex justify-between items-center shadow-[0_6px_18px_rgba(126,76,94,0.08)]`;
                div.innerHTML = `
                    <div class="${completedCls}">
                        <span class="text-sm font-bold text-stone-700">${labelInfo.icon} ${escapeHtml(sch.title)}</span>
                        <div class="text-[10px] text-stone-500 mt-0.5">${escapeHtml(labelInfo.name)} · ${escapeHtml(sch.author_name || '')}</div>
                    </div>
                    ${!sch.completed ? `
                        <button onclick="window.app.completeSchedule(${sch.id})" class="text-[10px] bg-green-500/15 text-green-700 px-2 py-1 rounded-lg hover:bg-green-500 hover:text-white transition">
                            ✓ 完成
                        </button>
                    ` : '<span class="text-[10px] text-stone-500">已完成</span>'}
                `;
                list.appendChild(div);
            });
        }

        if (events.length > 0) {
            events.forEach(item => {
                const nickname = this._getNickname(item);
                const safeNickname = escapeHtml(nickname);
                const safeContent = escapeHtml(item.content);
                const isGogo = nickname.includes('Gogo') || nickname.includes('Boy');
                const colorClass = isGogo ? 'text-blue-500' : 'text-pink-500';
                const time = formatChinaTime(new Date(item.created_at));

                const div = document.createElement('div');
                div.className = 'p-3 rounded-2xl flex gap-3 items-start bg-white/62 border border-white/70 shadow-[0_6px_18px_rgba(126,76,94,0.08)] backdrop-blur-sm';
                div.innerHTML = `
                    <div class="flex-1">
                        <div class="flex justify-between mb-1">
                            <span class="text-xs font-bold ${colorClass}">${safeNickname}</span>
                            <span class="text-xs text-stone-500">${time}</span>
                        </div>
                        <p class="text-sm text-stone-700">${safeContent}</p>
                    </div>
                `;
                list.appendChild(div);
            });
        }

        if (events.length === 0 && schedules.length === 0) {
            list.innerHTML = '<p class="text-center text-stone-500 py-4">这一天什么也没发生... 💤</p>';
        }

        const addForm = document.getElementById('schedule-add-form');
        const addBtn = document.getElementById('schedule-add-btn');
        if (addForm) addForm.classList.add('hidden');
        if (addBtn) addBtn.classList.remove('hidden');

        modal.classList.remove('hidden');
    },

    toggleScheduleForm() {
        const form = document.getElementById('schedule-add-form');
        const btn = document.getElementById('schedule-add-btn');
        if (form) form.classList.toggle('hidden');
        if (btn) btn.classList.toggle('hidden');
    },

    async addSchedule() {
        const titleEl = document.getElementById('schedule-title');
        const labelEl = document.getElementById('schedule-label');
        if (!titleEl || !titleEl.value.trim()) return alert('请输入日程内容');

        const dateISO = toLocalISO(this._currentModalDate);
        const { error } = await supabase.from('schedules').insert({
            title: titleEl.value.trim(),
            date: dateISO,
            label: labelEl?.value || 'date',
            author_name: Auth.getMyNickname() || '未知',
            completed: false
        });

        if (error) {
            alert('添加失败: ' + error.message);
            return;
        }

        titleEl.value = '';
        await this.loadSchedules();
        this.renderCalendarGrid();

        const daySchedules = this.schedules.filter(s => s.date === dateISO);
        const dayEvents = this.events.filter(e => toLocalISO(new Date(e.created_at)) === dateISO);
        this.openDateModal(this._currentModalDate, dayEvents, daySchedules);
    },

    async completeSchedule(id) {
        const { error } = await supabase.from('schedules').update({ completed: true }).eq('id', id);
        if (error) return alert('操作失败');

        await this.loadSchedules();
        this.renderCalendarGrid();

        const dateISO = toLocalISO(this._currentModalDate);
        const daySchedules = this.schedules.filter(s => s.date === dateISO);
        const dayEvents = this.events.filter(e => toLocalISO(new Date(e.created_at)) === dateISO);
        this.openDateModal(this._currentModalDate, dayEvents, daySchedules);
    },

    closeDateModal() {
        document.getElementById('date-modal').classList.add('hidden');
    },

    _buildInsertRow(extra) {
        return { ...extra, author_name: Auth.getMyNickname() || '未知' };
    },

    async checkDailyCheckIn() {
        const myName = Auth.getMyNickname();
        if (!myName) return;
        const today = toLocalISO(new Date());

        const { data } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('type', 'checkin')
            .eq('date', today)
            .eq('author_name', myName)
            .limit(1);

        const box = document.getElementById('checkin-box');
        if (box) {
            box.classList[(!data || data.length === 0) ? 'remove' : 'add']('hidden');
        }
    },

    async doCheckIn() {
        if (this.isCheckingIn) return;
        const myName = Auth.getMyNickname();
        if (!myName) return;
        this.isCheckingIn = true;
        const checkinBox = document.getElementById('checkin-box');
        const checkinButton = checkinBox?.querySelector('button');
        if (checkinButton) checkinButton.disabled = true;

        const today = toLocalISO(new Date());
        const { data: existingCheckIn } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('type', 'checkin')
            .eq('date', today)
            .eq('author_name', myName)
            .limit(1);

        if (existingCheckIn && existingCheckIn.length > 0) {
            if (checkinBox) checkinBox.classList.add('hidden');
            this.isCheckingIn = false;
            return;
        }

        const { error: checkInError } = await supabase.from('calendar_events').insert(
            this._buildInsertRow({ content: '完成了今日恋爱签到 ✨', date: today, type: 'checkin', mood: 'happy' })
        );
        if (checkInError) {
            this.isCheckingIn = false;
            if (checkinButton) checkinButton.disabled = false;
            alert(`签到失败：${checkInError.message || '未知错误'}`);
            return;
        }
        await Auth.updatePoints(10);

        const box = document.getElementById('checkin-box');
        if (box) box.classList.add('hidden');

        this.loadEvents();
        document.dispatchEvent(new CustomEvent('points-updated'));
        this.playConfetti();
    },

    async addEvent({ content, type = 'diary', mood = null }) {
        if (!content) return;
        let finalContent = content;
        if (this._quotedEvent) {
            const qNick = this._getNickname(this._quotedEvent);
            const qText = this._quotedEvent.content.slice(0, 40);
            finalContent = `「${qNick}: ${qText}」\n${content}`;
            this.clearQuote();
        }
        const { error } = await supabase.from('calendar_events').insert(
            this._buildInsertRow({ content: finalContent, date: toLocalISO(new Date()), type, mood })
        );
        if (!error) this.loadEvents();
        return error;
    },

    async sootheUser(eventId) {
        const evt = this.events.find(e => String(e.id) === String(eventId));
        if (!evt) return;
        const evtNickname = this._getNickname(evt);
        const myName = Auth.getMyNickname();
        if (myName && evtNickname.includes(myName)) {
            return alert('不能哄自己哦~');
        }

        await supabase.from('calendar_events').update({ mood: 'happy', content: '已经哄好啦 ❤️' }).eq('id', eventId);
        await Auth.updatePoints(50);
        alert('太棒了！奖励 50 熊熊币！');
        this.loadEvents();
        document.dispatchEvent(new CustomEvent('points-updated'));
    },

    _showMsgMenu(e, item) {
        const existing = document.getElementById('msg-ctx-menu');
        if (existing) existing.remove();

        const touch = e.touches?.[0] || e;
        const menu = document.createElement('div');
        menu.id = 'msg-ctx-menu';
        menu.className = 'fixed z-[9999] bg-gray-800 rounded-xl shadow-2xl border border-white/10 py-1 px-1 flex gap-1';
        menu.style.left = `${Math.min(touch.clientX, window.innerWidth - 160)}px`;
        menu.style.top = `${Math.max(touch.clientY - 50, 10)}px`;

        const actions = [
            { icon: '💬', label: '引用', fn: () => this.setQuote(item.id) },
            { icon: '📋', label: '复制', fn: () => { navigator.clipboard?.writeText(item.content); } }
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'flex flex-col items-center px-4 py-2 rounded-lg hover:bg-white/10 transition text-white text-xs';
            btn.innerHTML = `<span class="text-lg mb-0.5">${a.icon}</span>${a.label}`;
            btn.onclick = () => { a.fn(); menu.remove(); };
            menu.appendChild(btn);
        });

        document.body.appendChild(menu);
        const dismiss = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('touchstart', dismiss); document.removeEventListener('click', dismiss); }};
        setTimeout(() => { document.addEventListener('touchstart', dismiss); document.addEventListener('click', dismiss); }, 50);
    },

    playConfetti() {
        alert('🎉 签到成功！熊熊币 +10');
    }
};

async function initTimelinePage() {
    const loggedIn = await Auth.init();
    if (!loggedIn) {
        LoadingScreen.goTo('../../');
        return;
    }

    let isSending = false;
    let lastSubmit = { key: '', at: 0 };

    const setSubmitting = (submitting) => {
        const input = document.getElementById('new-diary');
        const button = document.getElementById('diary-send-btn');
        if (input) input.disabled = submitting;
        if (button) button.disabled = submitting;
    };

    const sendDiary = async () => {
        const input = document.getElementById('new-diary');
        if (!input || isSending) return;
        const content = input.value.trim();
        if (!content) return;

        const now = Date.now();
        if (lastSubmit.key === content && now - lastSubmit.at < 1800) return;
        lastSubmit = { key: content, at: now };

        const originalContent = input.value;
        isSending = true;
        setSubmitting(true);
        input.value = '';

        try {
            const error = await Calendar.addEvent({ content });
            if (error) {
                input.value = originalContent;
                alert('发送失败：' + (error.message || '未知错误'));
            }
        } finally {
            isSending = false;
            setSubmitting(false);
            input.focus();
        }
    };

    window.app = {
        sendDiary,
        doCheckIn: () => Calendar.doCheckIn(),
        sootheUser: (id) => Calendar.sootheUser(id),
        clearQuote: () => Calendar.clearQuote(),
        toggleMoodPanel() {
            document.getElementById('mood-panel')?.classList.toggle('hidden');
        },
        sendSOS(moodType) {
            const contentMap = {
                angry: '我现在很生气！😠',
                sad: '我好难过... 😭',
                sos: '紧急求救！需要抱抱！🆘'
            };
            Calendar.addEvent({ content: contentMap[moodType], type: 'diary', mood: moodType });
            document.getElementById('mood-panel')?.classList.add('hidden');
        }
    };

    await Calendar.initTimeline();
    document.getElementById('new-diary')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!event.repeat && !event.isComposing) sendDiary();
        }
    });
}

if (document.body?.dataset.app === 'timeline') {
    LoadingScreen.withLoading(initTimelinePage).catch(error => {
        console.error(error);
        alert('时光加载失败：' + (error.message || '未知错误'));
    });
}
