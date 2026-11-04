import { Auth } from '../home/js/auth.js';
import { LoadingScreen } from '../load/loading.js?v=load-4';
import {
    createMemoryAlbumEntry,
    fetchMemoryAlbumEntries,
    formatAlbumDate,
    uploadMemoryAlbumImage
} from './album-service.js';
import { toChinaDateISO } from '../shared/china-time.js';
import { escapeAttribute, escapeHtml } from '../shared/html.js';

const formEl = document.getElementById('album-form');
const publishBtn = document.getElementById('publish-btn');
const fileInput = document.getElementById('photo-file');
const dateInput = document.getElementById('shot-date');
const captionInput = document.getElementById('caption');
const captionCount = document.getElementById('caption-count');
const previewImage = document.getElementById('preview-image');
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewDate = document.getElementById('preview-date');
const previewCaption = document.getElementById('preview-caption');
const submitStatus = document.getElementById('submit-status');
const recentList = document.getElementById('recent-list');
const authorBadge = document.getElementById('author-badge');
const loginHint = document.getElementById('login-hint');
const openUploadBtn = document.getElementById('open-upload');
const floatingUploadBtn = document.getElementById('floating-upload');
const closeUploadBtn = document.getElementById('close-upload');
const uploadModal = document.getElementById('upload-modal');
const modalBackdrop = document.getElementById('modal-backdrop');

let previewObjectUrl = '';
let currentUserKey = '';
let currentAuthorName = '';
let imageObserver = null;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;

function setStatus(message, type = '') {
    submitStatus.textContent = message;
    submitStatus.classList.remove('is-success', 'is-error');
    if (type) submitStatus.classList.add(type);
}

function setUploadDisabled(disabled) {
    publishBtn.disabled = disabled;
    openUploadBtn.disabled = disabled;
    floatingUploadBtn.disabled = disabled;
}

function cleanupPreviewObjectUrl() {
    if (!previewObjectUrl) return;
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
}

function updatePreviewImage(file) {
    cleanupPreviewObjectUrl();

    if (!file) {
        previewImage.removeAttribute('src');
        previewImage.hidden = true;
        previewPlaceholder.hidden = false;
        return;
    }

    previewObjectUrl = URL.createObjectURL(file);
    previewImage.src = previewObjectUrl;
    previewImage.hidden = false;
    previewPlaceholder.hidden = true;
}

function updatePreviewText() {
    const rawDate = dateInput.value;
    const caption = captionInput.value.trim();

    previewDate.textContent = rawDate ? formatAlbumDate(rawDate) : '2026.04.08';
    previewCaption.textContent = caption || '这里会显示你的文字描述。';
    captionCount.textContent = String(captionInput.value.length);
}

function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('浏览器无法压缩这张图片'));
            }
        }, 'image/jpeg', quality);
    });
}

function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('无法读取这张图片，请换一张再试'));
        };
        image.src = objectUrl;
    });
}

async function compressImageIfNeeded(file) {
    if (file.size <= MAX_IMAGE_BYTES) return file;
    if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
    }

    const image = await loadImageFile(file);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const edgeScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(originalWidth, originalHeight));
    const sizeScales = [edgeScale, edgeScale * 0.82, edgeScale * 0.67, edgeScale * 0.54];
    const qualities = [0.84, 0.7, 0.58];
    const canvas = document.createElement('canvas');

    for (const scale of sizeScales) {
        canvas.width = Math.max(1, Math.round(originalWidth * scale));
        canvas.height = Math.max(1, Math.round(originalHeight * scale));

        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of qualities) {
            const blob = await canvasToJpeg(canvas, quality);
            if (blob.size > MAX_IMAGE_BYTES) continue;

            const baseName = String(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
            return new File([blob], `${baseName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });
        }
    }

    throw new Error('自动压缩后仍超过 2MB，请换一张较小的图片');
}

function resetUploadForm() {
    formEl.reset();
    dateInput.value = toChinaDateISO(new Date());
    updatePreviewImage(null);
    updatePreviewText();
    setStatus('等待保存');
}

function openUploadModal() {
    uploadModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
    uploadModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderAlbumEntries(entries) {
    if (!entries.length) {
        recentList.innerHTML = '<div class="photo-empty">还没有照片，点右下角上传第一张。</div>';
        return;
    }

    recentList.innerHTML = entries.map((entry) => `
        <article class="photo-card">
            <div class="photo-card-media">
                <div class="photo-card-placeholder">加载中...</div>
                <img data-src="${escapeAttribute(entry.imageUrl)}" alt="${escapeAttribute(entry.caption || entry.shotDate)}" loading="lazy" decoding="async" fetchpriority="auto">
            </div>
            <div class="photo-info">
                <div class="photo-date">${escapeHtml(entry.shotDate)}</div>
                <div class="photo-caption">${escapeHtml(entry.caption)}</div>
            </div>
        </article>
    `).join('');

    hydrateAlbumImages();
}

function sortNewestFirst(entries) {
    return [...entries].sort((a, b) => {
        const dateCompare = String(b.shotDate || '').localeCompare(String(a.shotDate || ''));
        if (dateCompare !== 0) return dateCompare;

        const createdCompare = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        if (createdCompare !== 0) return createdCompare;

        return String(b.id || '').localeCompare(String(a.id || ''));
    });
}

function hydrateAlbumImages() {
    if (imageObserver) imageObserver.disconnect();

    const reveal = (img) => {
        img.classList.add('is-loaded');
        const placeholder = img.previousElementSibling;
        if (placeholder) placeholder.classList.add('is-hidden');
    };

    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            const src = img.dataset.src;
            if (!src) {
                imageObserver.unobserve(img);
                return;
            }

            img.src = src;
            img.removeAttribute('data-src');
            img.addEventListener('load', () => reveal(img), { once: true });
            img.addEventListener('error', () => {
                const placeholder = img.previousElementSibling;
                if (placeholder) {
                    placeholder.textContent = '图片加载失败';
                    placeholder.classList.remove('is-hidden');
                }
            }, { once: true });
            imageObserver.unobserve(img);
        });
    }, { rootMargin: '420px 0px' });

    recentList.querySelectorAll('img[data-src]').forEach((img, index) => {
        if (index < 4) img.setAttribute('fetchpriority', 'high');
        imageObserver.observe(img);
    });
}

async function loadAlbumEntries() {
    recentList.innerHTML = '<div class="photo-empty">正在加载照片...</div>';

    try {
        const entries = await fetchMemoryAlbumEntries();
        renderAlbumEntries(sortNewestFirst(entries));
    } catch (error) {
        recentList.innerHTML = `<div class="photo-empty">照片加载失败：${escapeHtml(error.message || '未知错误')}</div>`;
    }
}

function deriveCurrentUserKey() {
    if (Auth.user?.id) return String(Auth.user.id);
    if (Auth.user?.username) return String(Auth.user.username);
    if (Auth.user?.email) return String(Auth.user.email);
    if (Auth.profile?.nickname) return String(Auth.profile.nickname);
    return `guest-${Date.now()}`;
}

async function ensureLogin() {
    const isLoggedIn = await Auth.init();
    if (!isLoggedIn) {
        loginHint.classList.remove('hidden');
        setStatus('当前未登录，正在返回主页...', 'is-error');
        setTimeout(() => {
            LoadingScreen.goTo('../../');
        }, 700);
        return false;
    }

    currentUserKey = deriveCurrentUserKey();
    currentAuthorName = Auth.getMyNickname() || 'Love Space 用户';
    authorBadge.textContent = `当前上传：${currentAuthorName}`;
    return true;
}

async function handleSubmit() {
    const file = fileInput.files?.[0];
    const shotDate = dateInput.value;
    const caption = captionInput.value.trim();

    if (!file) {
        setStatus('先选择一张图片。', 'is-error');
        return;
    }
    if (!file.type.startsWith('image/')) {
        setStatus('请选择图片文件。', 'is-error');
        return;
    }
    if (!shotDate) {
        setStatus('请选择照片时间。', 'is-error');
        return;
    }
    if (!caption) {
        setStatus('请写一句文案。', 'is-error');
        return;
    }

    setUploadDisabled(true);

    try {
        let uploadFile = file;
        if (file.size > MAX_IMAGE_BYTES) {
            setStatus('图片较大，正在本地压缩...');
            uploadFile = await compressImageIfNeeded(file);
            updatePreviewImage(uploadFile);
            setStatus(`已压缩至 ${(uploadFile.size / 1024 / 1024).toFixed(2)}MB，正在保存...`);
        } else {
            setStatus('正在保存...');
        }

        const imagePath = await uploadMemoryAlbumImage(uploadFile, currentUserKey);
        await createMemoryAlbumEntry({
            imagePath,
            shotDate,
            caption,
            authorName: currentAuthorName,
            createdBy: currentUserKey,
            isPublished: true
        });

        resetUploadForm();
        setStatus('保存成功。', 'is-success');
        closeUploadModal();
        await loadAlbumEntries();
    } catch (error) {
        setStatus(`保存失败：${error.message || '未知错误'}`, 'is-error');
    } finally {
        setUploadDisabled(false);
    }
}

function bindEvents() {
    fileInput.addEventListener('change', () => {
        updatePreviewImage(fileInput.files?.[0] || null);
    });
    dateInput.addEventListener('input', updatePreviewText);
    captionInput.addEventListener('input', updatePreviewText);
    publishBtn.addEventListener('click', handleSubmit);
    openUploadBtn.addEventListener('click', openUploadModal);
    floatingUploadBtn.addEventListener('click', openUploadModal);
    closeUploadBtn.addEventListener('click', closeUploadModal);
    modalBackdrop.addEventListener('click', closeUploadModal);
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeUploadModal();
    });
}

async function init() {
    bindEvents();
    resetUploadForm();

    const ready = await ensureLogin();
    if (!ready) return;

    await loadAlbumEntries();
}

window.addEventListener('beforeunload', cleanupPreviewObjectUrl);

LoadingScreen.withLoading(init).catch((error) => {
    setStatus(`初始化失败：${error.message || '未知错误'}`, 'is-error');
});
