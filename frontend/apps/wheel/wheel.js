const STORAGE_KEY = 'gigo-wheel-items-v2';
const MIN_SEGMENTS = 2;
const MAX_SEGMENTS = 10;
const FULL_SPINS_MIN = 5;
const FULL_SPINS_MAX = 8;

const DEFAULT_ITEMS = [
    '奶茶',
    '看电影',
    '散步',
    '抱抱',
    '按摩',
    '火锅'
];

const EXTRA_ITEMS = [
    '拍美照',
    '夸夸',
    '吃蛋糕',
    '贴贴'
];

const PALETTE = [
    '#ff8fab',
    '#ffb66e',
    '#ffe082',
    '#a8ef6b',
    '#72dfc4',
    '#79d8f4',
    '#7aa7ff',
    '#a88bff',
    '#d78cff',
    '#ff9bd6',
    '#ff9187',
    '#ffd36f',
    '#8ee3d0',
    '#b3d2ff',
    '#f4a6c9',
    '#c9e477'
];

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const wheelDisc = document.getElementById('wheel-disc');
const wheelButton = document.getElementById('wheel-button');
const centerVideo = document.getElementById('center-video');
const spinAction = document.getElementById('spin-action');
const spinStatus = document.getElementById('spin-status');
const editorModal = document.getElementById('editor-modal');
const segmentEditor = document.getElementById('segment-editor');
const segmentCount = document.getElementById('segment-count');
const openEditorButton = document.getElementById('open-editor');
const countMinus = document.getElementById('count-minus');
const countPlus = document.getElementById('count-plus');
const resetButton = document.getElementById('reset-wheel');

let items = loadItems();
let currentRotation = 0;
let isSpinning = false;
let resizeFrame = null;
let spinFallbackTimer = null;
let centerVideoPlayId = 0;

function loadItems() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (Array.isArray(saved) && saved.length >= MIN_SEGMENTS) {
            return normalizeItems(saved.slice(0, MAX_SEGMENTS));
        }
    } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
    }
    return [...DEFAULT_ITEMS];
}

function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalizeItems(nextItems) {
    return nextItems.map((item, index) => {
        const text = String(item || '').trim();
        return isPlaceholder(text) ? getDefaultItem(index) : (text || getDefaultItem(index));
    });
}

function getDefaultItem(index) {
    return [...DEFAULT_ITEMS, ...EXTRA_ITEMS][index % (DEFAULT_ITEMS.length + EXTRA_ITEMS.length)];
}

function isPlaceholder(text) {
    return /^第\s*\d+\s*格$/.test(text);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function seededNoise(seed) {
    const x = Math.sin(seed * 999.13) * 10000;
    return x - Math.floor(x);
}

function drawRoughArc(cx, cy, radius, start, end, color, width, seed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass += 1) {
        const offset = (seededNoise(seed + pass) - 0.5) * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + offset, start, end);
        ctx.stroke();
    }
    ctx.restore();
}

function drawWheel() {
    const rect = canvas.getBoundingClientRect();
    const cssSize = Math.max(280, Math.round(rect.width || 340));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    canvas.dataset.renderedSize = `${canvas.width}x${canvas.height}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const radius = cssSize * 0.45;
    const innerRadius = cssSize * 0.17;
    const segmentAngle = (Math.PI * 2) / items.length;
    const startOffset = -Math.PI / 2 - segmentAngle / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(74, 38, 31, 0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7dd';
    ctx.fill();
    ctx.restore();

    items.forEach((label, index) => {
        const start = startOffset + index * segmentAngle;
        const end = start + segmentAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = PALETTE[index % PALETTE.length];
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let line = 0; line < 5; line += 1) {
            const angle = start + segmentAngle * (0.2 + line * 0.13);
            const inner = innerRadius + 18 + seededNoise(index * 7 + line) * 12;
            const outer = radius - 26 - seededNoise(index * 9 + line) * 18;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
            ctx.lineTo(cx + Math.cos(angle + 0.03) * outer, cy + Math.sin(angle + 0.03) * outer);
            ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(74, 38, 31, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    drawGradientRing(cx, cy, radius + 4, 12);
    drawRoughArc(cx, cy, radius + 6, 0, Math.PI * 2, 'rgba(255,255,255,0.72)', 2, 14);
    drawRoughArc(cx, cy, radius - 34, 0, Math.PI * 2, 'rgba(255,255,255,0.42)', 2, 24);

    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    drawLabels(cx, cy, radius, segmentAngle, startOffset);
}

function drawGradientRing(cx, cy, radius, width) {
    ctx.save();
    let gradient;
    if (typeof ctx.createConicGradient === 'function') {
        gradient = ctx.createConicGradient(-Math.PI / 2, cx, cy);
        PALETTE.forEach((color, index) => {
            gradient.addColorStop(index / (PALETTE.length - 1), color);
        });
    } else {
        gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        gradient.addColorStop(0, '#ff8fab');
        gradient.addColorStop(0.45, '#ffd36f');
        gradient.addColorStop(1, '#79d8f4');
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawLabels(cx, cy, radius, segmentAngle, startOffset) {
    const labelRadius = radius * (items.length <= 4 ? 0.58 : 0.66);

    items.forEach((label, index) => {
        const middle = startOffset + index * segmentAngle + segmentAngle / 2;
        const x = cx + Math.cos(middle) * labelRadius;
        const y = cy + Math.sin(middle) * labelRadius;
        const text = label.length > 7 ? `${label.slice(0, 7)}…` : label;
        const fontSize = getLabelFontSize({
            count: items.length,
            radius: labelRadius,
            segmentAngle,
            text
        });

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(middle + Math.PI / 2);
        const normalized = (middle + Math.PI * 2) % (Math.PI * 2);
        if (normalized > Math.PI / 2 && normalized < Math.PI * 1.5) {
            ctx.rotate(Math.PI);
        }

        ctx.fillStyle = '#4a261f';
        ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, fontSize * 0.22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    });
}

function getLabelFontSize({ count, radius, segmentAngle, text }) {
    const arcLength = radius * segmentAngle * 0.9;
    const charWeight = Math.max(1.55, text.length * 0.58);
    const sizeByArc = arcLength / charWeight;
    const maxByCount = count <= 4 ? 30 : count <= 6 ? 26 : count <= 8 ? 24 : 22;
    return Math.max(16, Math.min(maxByCount, sizeByArc));
}

function requestDraw() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        drawWheel();
    });
}

function setSpinningState(spinning) {
    isSpinning = spinning;
    wheelButton.disabled = spinning;
    spinAction.disabled = spinning;
    spinStatus.textContent = spinning ? '一二正在想...' : '等待一二决定';
    if (spinning) {
        playCenterVideo();
    } else {
        stopCenterVideo();
    }
}

function prepareCenterVideoElement() {
    if (!centerVideo) return;
    centerVideo.muted = true;
    centerVideo.loop = true;
    centerVideo.playsInline = true;
    centerVideo.setAttribute('muted', '');
    centerVideo.setAttribute('playsinline', '');
    centerVideo.setAttribute('webkit-playsinline', '');
}

function resetCenterVideoToStart() {
    if (!centerVideo) return;
    try {
        centerVideo.currentTime = 0;
    } catch (error) {
        // Some browsers reject currentTime changes before metadata is ready.
    }
}

function waitForCenterVideoReady() {
    if (!centerVideo || centerVideo.readyState >= 2) return Promise.resolve();

    return new Promise((resolve) => {
        let done = false;
        const cleanup = () => {
            centerVideo.removeEventListener('loadeddata', finish);
            centerVideo.removeEventListener('canplay', finish);
            centerVideo.removeEventListener('error', finish);
        };
        const finish = () => {
            if (done) return;
            done = true;
            cleanup();
            resolve();
        };

        centerVideo.addEventListener('loadeddata', finish, { once: true });
        centerVideo.addEventListener('canplay', finish, { once: true });
        centerVideo.addEventListener('error', finish, { once: true });
        setTimeout(finish, 700);
    });
}

async function playCenterVideo() {
    if (!centerVideo) return;

    const playId = ++centerVideoPlayId;
    prepareCenterVideoElement();
    centerVideo.pause();
    resetCenterVideoToStart();
    centerVideo.load();

    await waitForCenterVideoReady();
    if (playId !== centerVideoPlayId || !isSpinning) return;

    resetCenterVideoToStart();
    try {
        await centerVideo.play();
    } catch (error) {
        try {
            centerVideo.load();
            await waitForCenterVideoReady();
            if (playId === centerVideoPlayId && isSpinning) {
                resetCenterVideoToStart();
                await centerVideo.play();
            }
        } catch (retryError) {
            // Mobile browsers may still refuse playback; the wheel should keep spinning.
        }
    }
}

function stopCenterVideo() {
    if (!centerVideo) return;
    centerVideoPlayId += 1;
    centerVideo.pause();
    resetCenterVideoToStart();
}

function spinWheel() {
    if (isSpinning || items.length < MIN_SEGMENTS) return;

    const winningIndex = randomInt(0, items.length - 1);
    const segmentAngle = 360 / items.length;
    const fullSpins = randomInt(FULL_SPINS_MIN, FULL_SPINS_MAX);
    const targetNormalized = (360 - winningIndex * segmentAngle) % 360;
    const currentNormalized = ((currentRotation % 360) + 360) % 360;
    const delta = (targetNormalized - currentNormalized + 360) % 360;

    currentRotation += fullSpins * 360 + delta;
    wheelDisc.dataset.resultIndex = String(winningIndex);
    setSpinningState(true);
    wheelDisc.style.transform = `rotate(${currentRotation}deg)`;
    clearTimeout(spinFallbackTimer);
    spinFallbackTimer = setTimeout(finishSpin, 4800);
}

function finishSpin() {
    if (!isSpinning) return;
    clearTimeout(spinFallbackTimer);
    spinFallbackTimer = null;

    const resultIndex = Number(wheelDisc.dataset.resultIndex || 0);
    const result = items[resultIndex] || '这一格';
    setSpinningState(false);
    spinStatus.textContent = `一二想${result}`;
}

function renderEditor() {
    segmentCount.textContent = String(items.length);
    countMinus.disabled = items.length <= MIN_SEGMENTS;
    countPlus.disabled = items.length >= MAX_SEGMENTS;

    segmentEditor.innerHTML = items.map((label, index) => `
        <label class="segment-field">
            <span>
                <i class="color-dot" style="background:${PALETTE[index % PALETTE.length]}"></i>
                第 ${index + 1} 格
            </span>
            <input type="text" value="${escapeAttribute(label)}" data-index="${index}" maxlength="12">
        </label>
    `).join('');
}

function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function setSegmentCount(count) {
    const nextCount = clamp(count, MIN_SEGMENTS, MAX_SEGMENTS);
    if (nextCount === items.length) return;

    if (nextCount > items.length) {
        while (items.length < nextCount) {
            items.push(getDefaultItem(items.length));
        }
    } else {
        items = items.slice(0, nextCount);
    }

    saveItems();
    renderEditor();
    requestDraw();
}

function openEditor() {
    renderEditor();
    editorModal.classList.remove('hidden');
    editorModal.setAttribute('aria-hidden', 'false');
}

function closeEditor() {
    editorModal.classList.add('hidden');
    editorModal.setAttribute('aria-hidden', 'true');
}

wheelDisc.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform') return;
    finishSpin();
});

wheelButton.addEventListener('click', spinWheel);
spinAction.addEventListener('click', spinWheel);
openEditorButton.addEventListener('click', openEditor);
countMinus.addEventListener('click', () => setSegmentCount(items.length - 1));
countPlus.addEventListener('click', () => setSegmentCount(items.length + 1));
resetButton.addEventListener('click', () => {
    items = [...DEFAULT_ITEMS];
    saveItems();
    renderEditor();
    requestDraw();
});

editorModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-editor]')) closeEditor();
});

segmentEditor.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-index]');
    if (!input) return;
    const index = Number(input.dataset.index);
    items[index] = input.value.trim() || getDefaultItem(index);
    saveItems();
    requestDraw();
});

window.addEventListener('resize', requestDraw);
prepareCenterVideoElement();
requestDraw();
