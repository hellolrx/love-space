import { supabase } from '../home/js/supabase.js';
import { toChinaDateISO } from '../shared/china-time.js';

export const MEMORY_ALBUM_BUCKET = 'memory-album';
export const MEMORY_ALBUM_TABLE = 'memory_album_entries';

export function formatAlbumDate(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).replace(/-/g, '.');
}

export function getMemoryAlbumImageUrl(imagePath) {
    if (!imagePath) return '';
    const { data } = supabase.storage.from(MEMORY_ALBUM_BUCKET).getPublicUrl(imagePath);
    return data?.publicUrl || '';
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
    const { data, error } = await supabase
        .from(MEMORY_ALBUM_TABLE)
        .select('*')
        .eq('is_published', true)
        .order('shot_date', { ascending: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapAlbumRow);
}

export async function fetchRecentMemoryEntries(limit = null) {
    const { data, error } = await supabase
        .from(MEMORY_ALBUM_TABLE)
        .select('*')
        .eq('is_published', true)
        .order('shot_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []).map(mapAlbumRow);
}

function sanitizeFileName(name) {
    return String(name || 'photo')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export async function uploadMemoryAlbumImage(file, userKey = 'guest') {
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || 'jpg';
    const safeBase = sanitizeFileName(String(file?.name || '').replace(/\.[^.]+$/, '')) || 'photo';
    const day = toChinaDateISO(new Date());
    const random = Math.random().toString(36).slice(2, 8);
    const path = `${sanitizeFileName(userKey) || 'guest'}/${day}/${Date.now()}-${random}-${safeBase}.${ext}`;

    const { error } = await supabase.storage
        .from(MEMORY_ALBUM_BUCKET)
        .upload(path, file, {
            cacheControl: '31536000',
            upsert: false
        });

    if (error) throw error;
    return path;
}

export async function createMemoryAlbumEntry({
    imagePath,
    shotDate,
    caption,
    authorName,
    createdBy,
    isPublished = true,
    sortOrder = null
}) {
    const payload = {
        image_path: imagePath,
        shot_date: shotDate,
        caption,
        author_name: authorName,
        created_by: createdBy,
        is_published: isPublished,
        sort_order: sortOrder
    };

    const { data, error } = await supabase
        .from(MEMORY_ALBUM_TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error) throw error;
    return mapAlbumRow(data);
}
