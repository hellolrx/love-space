import { Auth } from '../home/js/auth.js';
import { LoadingScreen } from '../load/loading.js?v=load-4';
import { escapeAttribute, escapeHtml } from '../shared/html.js';
import { toChinaDateISO } from '../shared/china-time.js';

async function storeRequest(path, options = {}) {
    const accessToken = Auth.getAccessToken();
    if (!accessToken) throw new Error('登录状态已失效，请重新登录');

    const response = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {})
        }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || '商店服务暂时不可用');
    return payload;
}

const CATEGORY_META = {
    all: { label: '全部', subtitle: '全部心意补给' },
    food: { label: '吃喝', subtitle: '奶茶、小吃和好吃的' },
    play: { label: '玩乐', subtitle: '电影、游戏和出门玩' },
    sweet: { label: '亲密', subtitle: '抱抱、亲亲和小浪漫' },
    care: { label: '照顾', subtitle: '按摩、跑腿和照顾' },
    rest: { label: '休息', subtitle: '睡觉、放空和休息' },
    reward: { label: '奖励', subtitle: '特别奖励和惊喜' }
};

const ICONS = {
    'heart-beat': '💗',
    kiss: '😘',
    hug: '🤗',
    massage: '💆',
    drink: '🥤',
    dessert: '🍰',
    meal: '🍜',
    ticket: '🎫',
    movie: '🎬',
    game: '🎮',
    walk: '🚶',
    sleep: '😴',
    crown: '👑',
    gift: '🎁'
};

const ICON_CATEGORY = {
    'heart-beat': 'sweet',
    kiss: 'sweet',
    hug: 'sweet',
    massage: 'care',
    drink: 'food',
    dessert: 'food',
    meal: 'food',
    ticket: 'play',
    movie: 'play',
    game: 'play',
    walk: 'play',
    sleep: 'rest',
    crown: 'reward',
    gift: 'reward'
};

const KEYWORD_RULES = [
    { keys: ['奶茶', '咖啡', '饮料', '喝', '小炸鸡', '炸鸡', '鸡', '寿司', '饭', '面', '蛋糕', '甜品', '吃', '麦当劳', '薯条'], icon: 'drink', category: 'food' },
    { keys: ['电影', '影院', '票'], icon: 'movie', category: 'play' },
    { keys: ['游戏', '转盘', '玩'], icon: 'game', category: 'play' },
    { keys: ['散步', '出门', '逛', '走走'], icon: 'walk', category: 'play' },
    { keys: ['按摩', '捏', '肩', '腿', '背'], icon: 'massage', category: 'care' },
    { keys: ['睡', '午睡', '觉', '休息'], icon: 'sleep', category: 'rest' },
    { keys: ['亲', '亲亲', '啵', 'muamua', '抱', '抱抱', '贴贴'], icon: 'heart-beat', category: 'sweet' },
    { keys: ['奖励', '皇冠', '夸夸', '惊喜'], icon: 'crown', category: 'reward' }
];

function ownerMatches(item, ownerKey) {
    return getOwnerKeyFromName(item.owner) === ownerKey;
}

function getOwnerKeyFromName(name) {
    const value = String(name || '').trim();
    if (value.includes('Gogo') || value.includes('Boy') || value.includes('daddy') || value.includes('Daddy')) {
        return 'gogo';
    }
    return 'gigi';
}

function getOppositeOwnerKey(ownerKey) {
    return ownerKey === 'gogo' ? 'gigi' : 'gogo';
}

function inferStyle(title, selectedCategory = 'auto') {
    const text = String(title || '').trim();
    const category = selectedCategory === 'auto' ? null : selectedCategory;

    for (const rule of KEYWORD_RULES) {
        if (rule.keys.some(key => text.includes(key))) {
            if (!category || category === rule.category) {
                return { iconKey: rule.icon, category: rule.category };
            }
        }
    }

    const fallbackByCategory = {
        food: 'drink',
        play: 'ticket',
        sweet: 'heart-beat',
        care: 'massage',
        rest: 'sleep',
        reward: 'gift'
    };
    const nextCategory = category || 'sweet';
    return { iconKey: fallbackByCategory[nextCategory] || 'heart-beat', category: nextCategory };
}

const StoreApp = {
    items: [],
    inventory: [],
    ownerKey: 'gigi',
    activeCategory: 'all',
    addCategory: 'auto',

    async init() {
        const loggedIn = await Auth.init();
        if (!loggedIn) {
            LoadingScreen.goTo('../../');
            return;
        }

        this.ownerKey = getOppositeOwnerKey(getOwnerKeyFromName(Auth.getMyNickname()));
        this.bindEvents();
        await this.reload();
    },

    bindEvents() {
        document.addEventListener('click', (event) => {
            const ownerBtn = event.target.closest('[data-owner]');
            if (ownerBtn) {
                this.ownerKey = ownerBtn.dataset.owner;
                if (this.activeCategory === 'inventory') this.activeCategory = 'all';
                this.render();
                return;
            }

            const categoryBtn = event.target.closest('[data-category]');
            if (categoryBtn) {
                this.activeCategory = categoryBtn.dataset.category;
                this.render();
                return;
            }

            const panelBtn = event.target.closest('[data-panel="inventory"]');
            if (panelBtn) {
                this.activeCategory = 'inventory';
                this.render();
                return;
            }

            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action === 'open-add') this.openAddModal();
            if (action === 'close-add') this.closeAddModal();

            const buyBtn = event.target.closest('[data-buy-id]');
            if (buyBtn) this.buyItem(Number(buyBtn.dataset.buyId));

            const removeBtn = event.target.closest('[data-remove-id]');
            if (removeBtn) this.deleteItem(Number(removeBtn.dataset.removeId));

            const useBtn = event.target.closest('[data-use-id]');
            if (useBtn) this.useItem(useBtn.dataset.useId);
        });

        document.getElementById('item-title')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('item-price')?.addEventListener('input', (event) => {
            document.getElementById('price-value').textContent = event.target.value;
        });
        document.getElementById('category-picker')?.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-add-category]');
            if (!chip) return;
            this.addCategory = chip.dataset.addCategory;
            document.querySelectorAll('.category-chip').forEach(el => el.classList.toggle('is-active', el === chip));
            this.updatePreview();
        });
        document.getElementById('add-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.saveNewItem();
        });
    },

    async reload() {
        await Promise.all([this.loadItems(), this.loadInventory()]);
        this.render();
    },

    async loadItems() {
        this.items = await storeRequest('/api/store/items');
    },

    async loadInventory() {
        this.inventory = await storeRequest('/api/store/inventory');
    },

    render() {
        this.renderPoints();
        this.renderNavigation();
        if (this.activeCategory === 'inventory') {
            this.renderInventory();
        } else {
            this.renderStore();
        }
    },

    renderPoints() {
        const el = document.getElementById('points-value');
        if (el) el.textContent = `🧸 ${Auth.profile?.points || 0}`;
    },

    renderNavigation() {
        document.querySelectorAll('.side-button').forEach(button => {
            const isCategory = button.dataset.category === this.activeCategory;
            const isInventory = button.dataset.panel === 'inventory' && this.activeCategory === 'inventory';
            button.classList.toggle('is-active', isCategory || isInventory);
        });

        document.querySelectorAll('.shop-tab').forEach(button => {
            button.classList.toggle('is-active', button.dataset.owner === this.ownerKey);
        });

        const title = document.getElementById('shop-title');
        const subtitle = document.getElementById('shop-subtitle');
        const panel = document.getElementById('shop-panel');
        const inventory = document.getElementById('inventory-panel');

        const ownerName = this.ownerKey === 'gigi' ? 'Gigi' : 'Gogo';
        if (title) title.textContent = this.activeCategory === 'inventory' ? '我的背包' : `${ownerName}的小店`;
        if (subtitle) {
            subtitle.textContent = this.activeCategory === 'inventory'
                ? '兑换后在这里核销'
                : (CATEGORY_META[this.activeCategory]?.subtitle || '心意补给');
        }
        panel?.classList.toggle('hidden', this.activeCategory === 'inventory');
        inventory?.classList.toggle('hidden', this.activeCategory !== 'inventory');
    },

    getItemCategory(item) {
        const iconCategory = ICON_CATEGORY[item.icon_key] || null;
        return iconCategory || inferStyle(item.title).category;
    },

    renderStore() {
        const container = document.getElementById('store-items');
        if (!container) return;

        const items = this.items.filter(item => {
            if (!ownerMatches(item, this.ownerKey)) return false;
            if (this.activeCategory === 'all') return true;
            return this.getItemCategory(item) === this.activeCategory;
        });

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-state">这里暂时没有商品<br>可以从左侧上架一个</p>';
            return;
        }

        const myOwnerKey = getOwnerKeyFromName(Auth.getMyNickname());
        container.innerHTML = items.map(item => {
            const icon = ICONS[item.icon_key] || ICONS[inferStyle(item.title).iconKey] || '🎁';
            const isMine = getOwnerKeyFromName(item.owner) === myOwnerKey;
            const action = isMine
                ? `<button class="remove-button" data-remove-id="${escapeAttribute(item.id)}">🗑️ 下架</button>`
                : `<button class="buy-button" data-buy-id="${escapeAttribute(item.id)}">🧸 ${escapeHtml(item.price)}</button>`;

            return `
                <article class="product-card">
                    <span class="stock-text">库存 ${escapeHtml(item.stock)}</span>
                    <div class="product-icon-wrap">
                        <div class="product-icon">${icon}</div>
                    </div>
                    <h3 class="product-title">${escapeHtml(item.title)}</h3>
                    ${action}
                </article>
            `;
        }).join('');
    },

    renderInventory() {
        const container = document.getElementById('inventory-list');
        if (!container) return;

        if (!this.inventory.length) {
            container.innerHTML = '<p class="empty-state">背包里还没有东西哦</p>';
            return;
        }

        const ownItemTitles = new Set(
            this.items
                .filter(item => getOwnerKeyFromName(item.owner) === getOwnerKeyFromName(Auth.getMyNickname()))
                .map(item => item.title)
        );
        const displayInventory = this.inventory.filter(item => !ownItemTitles.has(item.item_name));

        if (!displayInventory.length) {
            container.innerHTML = '<p class="empty-state">背包里还没有可核销的兑换</p>';
            return;
        }

        const active = displayInventory.filter(item => !item.is_used);
        const used = displayInventory.filter(item => item.is_used);
        const rows = [...active, ...used.slice(0, 1)].map(item => this.renderInventoryItem(item)).join('');
        const more = used.length > 1
            ? `<button class="more-used" id="more-used-toggle">展开更多已核销 (${used.length - 1})</button>
               <div class="hidden" id="used-hidden">${used.slice(1).map(item => this.renderInventoryItem(item)).join('')}</div>`
            : '';

        container.innerHTML = rows + more;
        document.getElementById('more-used-toggle')?.addEventListener('click', () => {
            const hidden = document.getElementById('used-hidden');
            const button = document.getElementById('more-used-toggle');
            if (!hidden || !button) return;
            const isHidden = hidden.classList.toggle('hidden');
            button.textContent = isHidden ? `展开更多已核销 (${used.length - 1})` : '收起已核销';
        });
    },

    renderInventoryItem(item) {
        const used = item.is_used;
        return `
            <article class="inventory-item ${used ? 'is-used' : ''}">
                <div>
                    <div class="inventory-name">${escapeHtml(item.item_name)}</div>
                    <div class="inventory-date">${toChinaDateISO(new Date(item.created_at)).replace(/-/g, '.')}</div>
                </div>
                ${used
                    ? '<span class="used-label">已核销</span>'
                    : `<button class="use-button" data-use-id="${escapeAttribute(item.id)}">使用</button>`}
            </article>
        `;
    },

    openAddModal() {
        const modal = document.getElementById('add-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('item-title')?.focus();
        this.updatePreview();
    },

    closeAddModal() {
        const modal = document.getElementById('add-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    },

    updatePreview() {
        const title = document.getElementById('item-title')?.value || '';
        const inferred = inferStyle(title, this.addCategory);
        document.getElementById('preview-icon').textContent = ICONS[inferred.iconKey] || '🎁';
        document.getElementById('preview-title').textContent = title.trim() || '新的小心意';
        document.getElementById('preview-category').textContent = CATEGORY_META[inferred.category]?.label || '自动匹配样式';
    },

    async saveNewItem() {
        const title = document.getElementById('item-title')?.value.trim();
        const price = Number(document.getElementById('item-price')?.value || 50);
        if (!title) return alert('请填写商品名称');

        const myName = Auth.getMyNickname();
        const inferred = inferStyle(title, this.addCategory);
        try {
            await storeRequest('/api/store/items', {
                method: 'POST',
                body: JSON.stringify({ title, price, icon_key: inferred.iconKey })
            });
        } catch (error) {
            alert('上架失败: ' + error.message);
            return;
        }

        document.getElementById('add-form')?.reset();
        document.getElementById('price-value').textContent = '50';
        this.addCategory = 'auto';
        document.querySelectorAll('.category-chip').forEach(el => {
            el.classList.toggle('is-active', el.dataset.addCategory === 'auto');
        });
        this.ownerKey = getOwnerKeyFromName(myName);
        this.activeCategory = inferred.category;
        this.closeAddModal();
        await this.reload();
    },

    async deleteItem(itemId) {
        if (!confirm('确定要下架这个商品吗？')) return;

        try {
            await storeRequest(`/api/store/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
        } catch (error) {
            alert('下架失败: ' + error.message);
            return;
        }

        await this.loadItems();
        this.render();
    },

    async buyItem(itemId) {
        const item = this.items.find(row => row.id === itemId);
        if (!item) return;
        if (getOwnerKeyFromName(item.owner) === getOwnerKeyFromName(Auth.getMyNickname())) {
            alert('这是你自己上架的商品，不能自己购买哦');
            return;
        }

        if (item.stock <= 0) return alert('库存不足啦！');

        const points = Auth.profile?.points || 0;
        if (points < item.price) return alert('熊熊币不足，攒攒再来吧');
        if (!confirm(`确定花费 ${item.price} 熊熊币购买「${item.title}」吗？`)) return;

        let purchase;
        try {
            purchase = await storeRequest('/api/store/purchases', {
                method: 'POST',
                body: JSON.stringify({ item_id: itemId })
            });
        } catch (error) {
            alert(`购买失败：${error.message || '请稍后重试'}`);
            return;
        }

        if (Auth.profile && purchase?.remaining_points !== undefined) {
            Auth.profile.points = Number(purchase.remaining_points);
            document.dispatchEvent(new CustomEvent('points-updated'));
        }

        const noteSynced = purchase.note_synced !== false;

        alert(noteSynced
            ? '购买成功！已放入背包，也同步写进小笨笨啦'
            : '购买成功并已放入背包，但同步小笨笨失败，请稍后再试');
        await this.reload();
    },

    async useItem(inventoryId) {
        const item = this.inventory.find(row => String(row.id) === String(inventoryId));
        if (!item) return;
        if (!confirm(`确定要使用「${item.item_name}」吗？对方会在时光轴看到通知。`)) return;

        let result;
        try {
            result = await storeRequest(`/api/store/inventory/${encodeURIComponent(inventoryId)}/use`, {
                method: 'POST'
            });
        } catch (error) {
            alert('使用失败: ' + error.message);
            return;
        }

        const synced = result.event_synced && result.note_synced;
        alert(synced
            ? '使用成功！对方会在时光轴看到通知，小笨笨里也已标记完成'
            : '物品已标记使用，但部分通知同步失败，请检查时光轴和小笨笨');
        await this.loadInventory();
        this.render();
    }
};

LoadingScreen.withLoading(() => StoreApp.init()).catch(error => {
    console.error(error);
    alert('商店加载失败：' + (error.message || '未知错误'));
});
