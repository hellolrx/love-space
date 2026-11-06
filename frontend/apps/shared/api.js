import { CONFIG } from '../home/js/config.js';

export async function requestApi(path, options = {}) {
    let accessToken;
    try {
        accessToken = JSON.parse(localStorage.getItem('love-space-auth') || '{}').accessToken;
    } catch {
        accessToken = null;
    }
    if (!accessToken) throw new Error('请先登录');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetch(new URL(path, CONFIG.API_BASE_URL?.trim() || window.location.origin), {
            ...options,
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(typeof payload.detail === 'string' ? payload.detail : '数据操作失败，请稍后重试');
        }
        return payload;
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('连接超时，请检查网络后重试');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
