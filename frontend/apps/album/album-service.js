import { requestApi } from '../shared/api.js';

export function formatAlbumDate(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).replace(/-/g, '.');
}

export function getMemoryAlbumImageUrl(imagePath) {
    if (!imagePath) return '';
    return `/api/album/images/${imagePath.split('/').map(encodeURIComponent).join('/')}`;
}

function mapAlbumRow(row) {
    return {
        id: row.id,
        imagePath: row.image_path,
        imageUrl: getMemoryAlbumImageUrl(row.image_path),
        shotDate: formatAlbumDate(row.shot_date),
        caption: row.caption || '',
        authorName: row.author_name || '',
        createdAt: row.created_at || null,
        isPublished: row.is_published !== false,
        sortOrder: row.sort_order ?? null
    };
}

export async function fetchMemoryAlbumEntries() {
    const data = await requestApi('/api/album/entries');
    return (data || []).map(mapAlbumRow);
}

export async function fetchRecentMemoryEntries(limit = null) {
    const query = new URLSearchParams({ recent: 'true' });
    if (limit != null) query.set('limit', String(limit));
    const data = await requestApi(`/api/album/entries?${query}`);
    return (data || []).map(mapAlbumRow);
}

export async function createMemoryAlbumEntry({ file, shotDate, caption }) {
    const query = new URLSearchParams({ shot_date: shotDate, caption });
    const data = await requestApi(`/api/album/entries?${query}`, {
        method: 'POST', body: file, headers: { 'Content-Type': file.type }
    });
    return mapAlbumRow(data);
}
