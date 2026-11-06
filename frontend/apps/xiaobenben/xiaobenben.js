import { Auth } from '../home/js/auth.js';
import { LoadingScreen } from '../load/loading.js?v=load-4';
import {
    createSharedNote,
    fetchSharedNotes,
    updateSharedNote
} from '../shared/shared-notes-service.js';
import { escapeAttribute, escapeHtml } from '../shared/html.js';

const state = {
    notes: [],
    currentNickname: '',
    syncTimer: null,
    isRefreshing: false,
    saveTimers: new Map()
};

const els = {
    loginHint: document.getElementById('login-hint'),
    notesList: document.getElementById('notes-list'),
    newNoteInput: document.getElementById('new-note-input')
};

function noteText(note) {
    return String(note.title || note.content || '').trim();
}

function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function formatMetaDate(value) {
    if (!value) return '刚刚';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '刚刚';
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
    });
}

function sortNotes(notes) {
    return [...notes].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
    });
}

function isRedeemNote(note) {
    return note.note_type === 'redeem' || note.source_type === 'store_purchase';
}

function normalizedRedeemName(note) {
    return noteText(note)
        .replace(/^待兑现\s*[：:]\s*/u, '')
        .normalize('NFKC')
        .replace(/\s+/gu, ' ')
        .trim();
}

function groupNotes(notes) {
    const groups = [];
    const redeemGroups = new Map();

    sortNotes(notes).forEach((note) => {
        if (!isRedeemNote(note)) {
            groups.push({ key: `note:${note.id}`, notes: [note], isRedeem: false });
            return;
        }

        const displayName = normalizedRedeemName(note) || '未命名兑换';
        const key = `${note.status || 'active'}:${displayName.toLocaleLowerCase('zh-CN')}`;
        const existing = redeemGroups.get(key);
        if (existing) {
            existing.notes.push(note);
            return;
        }

        const group = {
            key: `redeem:${key}`,
            notes: [note],
            isRedeem: true,
            displayName
        };
        redeemGroups.set(key, group);
        groups.push(group);
    });

    return groups;
}

function updateLocalNote(updated) {
    state.notes = state.notes.map((note) => String(note.id) === String(updated.id) ? updated : note);
}

async function saveText(noteId, text, { shouldRender = false } = {}) {
    const note = state.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;

    const cleanText = text.trim();
    if (cleanText === noteText(note)) return;

    const updated = await updateSharedNote(note.id, {
        title: cleanText || '未命名',
        content: '',
        note_type: note.note_type || 'note',
        status: note.status || 'active',
        is_pinned: note.is_pinned === true,
        updated_by_nickname: state.currentNickname,
        updated_at: new Date().toISOString()
    });

    updateLocalNote(updated);
    if (shouldRender) render();
}

function queueSaveText(noteId, text) {
    if (state.saveTimers.has(noteId)) {
        clearTimeout(state.saveTimers.get(noteId));
    }

    state.saveTimers.set(noteId, setTimeout(async () => {
        state.saveTimers.delete(noteId);
        try {
            await saveText(noteId, text);
        } catch (error) {
            alert(`保存失败：${error.message || '未知错误'}`);
        }
    }, 650));
}

async function toggleDone(noteId) {
    const note = state.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;

    const updated = await updateSharedNote(note.id, {
        status: note.status === 'done' ? 'active' : 'done',
        is_pinned: false,
        updated_by_nickname: state.currentNickname,
        updated_at: new Date().toISOString()
    });

    updateLocalNote(updated);
    render();
}

async function createNoteFromInput() {
    const text = els.newNoteInput.value.trim();
    if (!text) return;

    els.newNoteInput.value = '';
    const now = new Date().toISOString();
    const created = await createSharedNote({
        title: text,
        content: '',
        note_type: 'note',
        status: 'active',
        is_pinned: false,
        created_by_nickname: state.currentNickname,
        updated_by_nickname: state.currentNickname,
        source_type: 'manual',
        source_ref: null,
        created_at: now,
        updated_at: now
    });

    state.notes = [created, ...state.notes];
    render();
    els.newNoteInput.focus();
}

function renderNoteGroup(group) {
    const note = group.notes[0];
    const isDone = note.status === 'done';
    const editor = note.updated_by_nickname || note.created_by_nickname || '未知';
    const time = formatMetaDate(note.updated_at || note.created_at);
    const quantity = group.notes.length;
    const title = group.isRedeem ? group.displayName : noteText(note);
    const quantityMarkup = group.isRedeem && quantity > 1
        ? `<span class="quantity-badge" aria-label="共 ${quantity} 份">×${quantity}</span>`
        : '';
    const contentMarkup = group.isRedeem
        ? `<div class="note-title">${escapeHtml(title)}</div>`
        : `<textarea class="note-input" rows="1" data-role="note-text" spellcheck="false">${escapeHtml(title)}</textarea>`;
    const typeLabel = group.isRedeem ? '商店兑换' : '共同记录';

    return `
        <article class="note-card ${group.isRedeem ? 'is-redeem' : 'is-manual'} ${isDone ? 'is-done' : ''}"
            data-id="${escapeAttribute(note.id)}">
            <button class="check-button ${isDone ? 'is-done' : ''}" type="button" data-role="toggle-done"
                aria-label="${isDone ? '恢复一份' : (group.isRedeem ? '兑现一份' : '标记为完成')}"></button>
            <div class="note-card-body">
                <div class="note-card-main">
                    ${contentMarkup}
                    ${quantityMarkup}
                </div>
                <div class="note-meta">
                    <span>${escapeHtml(typeLabel)}</span>
                    <span aria-hidden="true">·</span>
                    <span>${escapeHtml(editor)}</span>
                    <span>${escapeHtml(time)}</span>
                </div>
            </div>
        </article>
    `;
}

function renderGroupList(groups) {
    return groups.map(renderNoteGroup).join('');
}

function render() {
    const activeGroups = groupNotes(state.notes.filter((note) => note.status !== 'done'));
    const doneGroups = groupNotes(state.notes.filter((note) => note.status === 'done'));
    const activeCount = activeGroups.reduce((total, group) => total + group.notes.length, 0);
    const doneCount = doneGroups.reduce((total, group) => total + group.notes.length, 0);

    if (!state.notes.length) {
        els.notesList.innerHTML = '<div class="empty-state">点下面空白处，写下第一条小笨笨。</div>';
    } else {
        const activeMarkup = activeGroups.length
            ? renderGroupList(activeGroups)
            : '<div class="section-empty">现在没有待完成的事情啦。</div>';
        const doneMarkup = doneGroups.length
            ? `
                <details class="completed-section">
                    <summary>
                        <span>已完成</span>
                        <span class="section-count">${doneCount}</span>
                    </summary>
                    <div class="completed-list">${renderGroupList(doneGroups)}</div>
                </details>
            `
            : '';

        els.notesList.innerHTML = `
            <section class="notes-section" aria-labelledby="active-notes-title">
                <div class="section-heading">
                    <h2 id="active-notes-title">待完成</h2>
                    <span class="section-count">${activeCount}</span>
                </div>
                <div class="active-list">${activeMarkup}</div>
            </section>
            ${doneMarkup}
        `;
    }

    els.notesList.querySelectorAll('.note-card').forEach((noteCard) => {
        const noteId = noteCard.dataset.id;

        noteCard.querySelector('[data-role="toggle-done"]').addEventListener('click', async (event) => {
            event.stopPropagation();
            try {
                await toggleDone(noteId);
            } catch (error) {
                alert(`切换完成状态失败：${error.message || '未知错误'}`);
            }
        });

        const input = noteCard.querySelector('[data-role="note-text"]');
        if (!input) return;
        autoGrow(input);
        input.addEventListener('input', () => {
            autoGrow(input);
            queueSaveText(noteId, input.value);
        });
        input.addEventListener('blur', async () => {
            if (state.saveTimers.has(noteId)) {
                clearTimeout(state.saveTimers.get(noteId));
                state.saveTimers.delete(noteId);
            }
            try {
                await saveText(noteId, input.value, { shouldRender: true });
            } catch (error) {
                alert(`保存失败：${error.message || '未知错误'}`);
            }
        });
    });
}

async function ensureLogin() {
    const isLoggedIn = await Auth.init();
    if (!isLoggedIn) {
        els.loginHint.classList.remove('hidden');
        setTimeout(() => {
            LoadingScreen.goTo('../../');
        }, 700);
        return false;
    }

    state.currentNickname = Auth.getMyNickname() || 'Love Space 用户';
    return true;
}

async function refreshNotes() {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    try {
        state.notes = await fetchSharedNotes();
        render();
    } finally {
        state.isRefreshing = false;
    }
}

function setupNoteSync() {
    if (state.syncTimer) return;
    state.syncTimer = setInterval(async () => {
        if (document.hidden || state.saveTimers.size || els.notesList.contains(document.activeElement)) return;
        try {
            await refreshNotes();
        } catch (error) {
            console.error('小笨笨同步失败：', error);
        }
    }, 10000);
}

function teardownNoteSync() {
    if (!state.syncTimer) return;
    clearInterval(state.syncTimer);
    state.syncTimer = null;
}

function bindEvents() {
    els.newNoteInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        try {
            await createNoteFromInput();
        } catch (error) {
            alert(`新增失败：${error.message || '未知错误'}`);
        }
    });

    els.newNoteInput.addEventListener('blur', async () => {
        try {
            await createNoteFromInput();
        } catch (error) {
            alert(`新增失败：${error.message || '未知错误'}`);
        }
    });

}

async function init() {
    bindEvents();
    const ready = await ensureLogin();
    if (!ready) return;
    await refreshNotes();
    setupNoteSync();
}

window.addEventListener('beforeunload', teardownNoteSync);

LoadingScreen.withLoading(init).catch((error) => {
    console.error(error);
    alert(`小笨笨初始化失败：${error.message || '未知错误'}`);
});
