import { supabase } from '../home/js/supabase.js';

export const SHARED_NOTES_TABLE = 'shared_notes';

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
    const { data, error } = await supabase
        .from(SHARED_NOTES_TABLE)
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSharedNote);
}

export async function createSharedNote(payload) {
    const { data, error } = await supabase
        .from(SHARED_NOTES_TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error) throw error;
    return mapSharedNote(data);
}

export async function updateSharedNote(noteId, payload) {
    const { data, error } = await supabase
        .from(SHARED_NOTES_TABLE)
        .update(payload)
        .eq('id', noteId)
        .select('*')
        .single();

    if (error) throw error;
    return mapSharedNote(data);
}

export async function deleteSharedNote(noteId) {
    const { error } = await supabase
        .from(SHARED_NOTES_TABLE)
        .delete()
        .eq('id', noteId);

    if (error) throw error;
    return true;
}

export async function createStoreRedeemNote({ itemName, buyerNickname, inventoryId }) {
    const safeItemName = String(itemName || '').trim();
    const safeBuyerNickname = String(buyerNickname || '').trim() || '某人';
    const sourceRef = inventoryId == null ? null : String(inventoryId);

    if (!safeItemName) {
        throw new Error('缺少兑换商品名称，无法创建小笨笨提醒');
    }

    if (sourceRef) {
        const { data: existing, error: existingError } = await supabase
            .from(SHARED_NOTES_TABLE)
            .select('*')
            .eq('source_type', 'store_purchase')
            .eq('source_ref', sourceRef)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existing) return mapSharedNote(existing);
    }

    const now = new Date().toISOString();
    return await createSharedNote({
        title: `待兑现：${safeItemName}`,
        content: `${safeBuyerNickname} 在商店兑换了「${safeItemName}」，记得尽快兑现这份心意。`,
        note_type: 'redeem',
        status: 'active',
        is_pinned: true,
        created_by_nickname: safeBuyerNickname,
        updated_by_nickname: safeBuyerNickname,
        source_type: 'store_purchase',
        source_ref: sourceRef,
        created_at: now,
        updated_at: now
    });
}

export async function completeStoreRedeemNote({ inventoryId, itemName, operatorNickname }) {
    const sourceRef = inventoryId == null ? null : String(inventoryId);
    const safeOperatorNickname = String(operatorNickname || '').trim() || '某人';
    const safeItemName = String(itemName || '').trim();

    let query = supabase
        .from(SHARED_NOTES_TABLE)
        .select('*')
        .eq('source_type', 'store_purchase');

    if (sourceRef) {
        query = query.eq('source_ref', sourceRef);
    } else if (safeItemName) {
        query = query.eq('title', `待兑现：${safeItemName}`).eq('status', 'active');
    } else {
        return null;
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const nextContent = String(data.content || '').includes('已兑现')
        ? data.content
        : `${data.content}\n\n已兑现：${safeOperatorNickname} 已经完成了这条兑换。`;

    return await updateSharedNote(data.id, {
        status: 'done',
        is_pinned: false,
        content: nextContent,
        updated_by_nickname: safeOperatorNickname,
        updated_at: new Date().toISOString()
    });
}
