import { CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { isSameChinaDay } from '../../shared/china-time.js';

const LEGACY_USERNAME_BY_IDENTITY = {
    Gogo: 'lrx',
    Gigi: 'zjt'
};

async function requestAuth(path, options = {}) {
    const baseUrl = CONFIG.API_BASE_URL?.trim().replace(/\/$/, '');
    if (!baseUrl) throw new Error('登录服务地址尚未配置');

    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.detail || '登录服务暂时不可用');
    }
    return payload;
}

export const Auth = {
    user: null,
    profile: null,

    getMyNickname() {
        if (this.profile?.nickname) return this.profile.nickname;
        if (this.user?.identity) return this.user.identity;
        if (this.user?.username) return LEGACY_USERNAME_BY_IDENTITY[this.user.username] || 'Gogo';
        return null;
    },

    _isSameDay(dateStr) {
        if (!dateStr) return false;
        return isSameChinaDay(dateStr, new Date());
    },

    async init() {
        const saved = localStorage.getItem('love-space-auth');
        if (!saved) return false;

        try {
            const authData = JSON.parse(saved);
            if (!authData.loggedIn || !authData.accessToken || !authData.identity || !this._isSameDay(authData.loginDate)) {
                localStorage.removeItem('love-space-auth');
                return false;
            }

            const session = await requestAuth('/api/auth/session', {
                headers: { Authorization: `Bearer ${authData.accessToken}` }
            });
            if (session.profile_id !== authData.profileId || session.identity !== authData.identity) {
                localStorage.removeItem('love-space-auth');
                return false;
            }

            this.user = {
                id: session.profile_id,
                identity: session.identity,
                username: LEGACY_USERNAME_BY_IDENTITY[session.identity]
            };
            await this.loadProfile();
            if (!this.profile) {
                localStorage.removeItem('love-space-auth');
                this.user = null;
                return false;
            }
            return true;
        } catch (error) {
            localStorage.removeItem('love-space-auth');
            this.user = null;
            this.profile = null;
            return false;
        }
    },

    _saveSession(session) {
        localStorage.setItem('love-space-auth', JSON.stringify({
            loggedIn: true,
            loginType: 'password',
            loginDate: new Date().toISOString(),
            identity: session.identity,
            profileId: session.profile_id,
            accessToken: session.access_token
        }));
    },

    async loginWithPassword(identity, password) {
        if (!identity || !password) throw new Error('请选择身份并确认密码');

        const session = await requestAuth('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identity, password })
        });
        this.user = {
            id: session.profile_id,
            identity: session.identity,
            username: LEGACY_USERNAME_BY_IDENTITY[session.identity]
        };
        await this.loadProfile();
        if (!this.profile) {
            this.user = null;
            throw new Error('登录成功，但找不到对应的个人资料');
        }
        this._saveSession(session);
        return { user: this.user, profile: this.profile };
    },

    async loadProfile() {
        if (!this.user?.id) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .maybeSingle();

        if (error) throw error;
        this.profile = data || null;
    },

    async updatePoints(amount) {
        if (!this.profile) return;
        const nickname = this.profile.nickname || this.getMyNickname();
        if (!nickname) return;

        this.profile.points = (this.profile.points || 0) + amount;

        await supabase
            .from('profiles')
            .update({ points: this.profile.points })
            .eq('nickname', nickname);

        return this.profile.points;
    },

    async logout() {
        localStorage.removeItem('love-space-auth');
        this.user = null;
        this.profile = null;
    }
};
