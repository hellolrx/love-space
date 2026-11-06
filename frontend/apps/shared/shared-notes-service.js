import { requestApi } from './api.js';

function mapSharedNote(row) {
    return {
        id: row.id,
        title: row.title || '',
        content: row.content || '',
        note_type: row.note_type || 'note',
        status: row.status || 'active',
        is_pinned: row.is_pinned === true,
        created_by_nickname: row.created_by_nickname || '',
        updated_by_nickname: row.updated_by_nickname || row.created_by_nickname || '',
        source_type: row.source_type || 'manual',
        source_ref: row.source_ref || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
    };
}

export async function fetchSharedNotes() {
    const data = await requestApi('/api/notes');
    return (data || []).map(mapSharedNote);
}

export async function createSharedNote(payload) {
    const data = await requestApi('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
    return mapSharedNote(data);
}

export async function updateSharedNote(noteId, payload) {
    const data = await requestApi(`/api/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return mapSharedNote(data);
}

export async function deleteSharedNote(noteId) {
    await requestApi(`/api/notes/${noteId}`, { method: 'DELETE' });
    return true;
}
