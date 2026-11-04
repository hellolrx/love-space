import { CONFIG } from './config.js';

if (typeof window.supabase === 'undefined') {
    throw new Error('Supabase SDK 未加载，请检查 supabase-js@2.js 是否正确引入');
}

export const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
