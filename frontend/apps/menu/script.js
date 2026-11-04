import { LoadingScreen } from '../load/loading.js?v=load-4';

const categories = [
    { id: 'all', label: '全部', emoji: '🍽️' },
    { id: 'staple', label: '主食', emoji: '🍚' },
    { id: 'meat', label: '肉菜', emoji: '🥩' },
    { id: 'vegetable', label: '蔬菜', emoji: '🥬' },
    { id: 'soup', label: '汤羹', emoji: '🥣' },
    { id: 'snack', label: '小食', emoji: '🥟' },
    { id: 'drink', label: '饮品', emoji: '🥤' }
];

const dishes = [
    {
        id: 'tomato-beef',
        name: '番茄牛腩',
        category: 'meat',
        emoji: '🍲',
        description: '酸甜浓郁的番茄汤底，牛腩炖到软烂入味。',
        tag: '番茄 · 牛腩 · 土豆',
        color: '#f6d8c9'
    },
    {
        id: 'chicken-rice',
        name: '照烧鸡腿饭',
        category: 'staple',
        emoji: '🍗',
        description: '焦香鸡腿配一碗热米饭，忙碌日子的安心选择。',
        tag: '鸡腿 · 米饭 · 西兰花',
        color: '#eadcc1'
    },
    {
        id: 'shrimp-tofu',
        name: '虾仁豆腐煲',
        category: 'soup',
        emoji: '🦐',
        description: '鲜甜虾仁与嫩豆腐，小火咕嘟出来的温柔味道。',
        tag: '虾仁 · 豆腐 · 菌菇',
        color: '#d9e6dd'
    },
    {
        id: 'seasonal-vegetable',
        name: '清炒时蔬',
        category: 'vegetable',
        emoji: '🥬',
        description: '跟着季节换蔬菜，清爽脆嫩，给餐桌添一点绿。',
        tag: '当季蔬菜 · 蒜',
        color: '#dcebcf'
    },
    {
        id: 'dumpling',
        name: '鲜肉蒸饺',
        category: 'snack',
        emoji: '🥟',
        description: '薄皮包住鲜香肉馅，适合早餐，也适合夜宵。',
        tag: '猪肉 · 香菇 · 面皮',
        color: '#f0e0c5'
    },
    {
        id: 'egg-noodle',
        name: '溏心蛋拌面',
        category: 'staple',
        emoji: '🍜',
        description: '十分钟就能完成，酱香拌面配一颗流心蛋。',
        tag: '面条 · 鸡蛋 · 葱油',
        color: '#f4dfbd'
    },
    {
        id: 'corn-soup',
        name: '玉米排骨汤',
        category: 'soup',
        emoji: '🌽',
        description: '清甜不腻，慢慢煲一锅，连汤里的玉米都很好吃。',
        tag: '玉米 · 排骨 · 胡萝卜',
        color: '#f3e3a9'
    },
    {
        id: 'plum-soda',
        name: '青梅气泡饮',
        category: 'drink',
        emoji: '🫧',
        description: '酸甜青梅加满冰块和气泡水，夏天的专属快乐。',
        tag: '青梅 · 气泡水 · 冰块',
        color: '#d8e8df'
    }
];

const state = {
    activeCategory: 'all',
    keyword: '',
    quantities: new Map(),
    manageMode: false
};

const els = {
    categoryList: document.getElementById('category-list'),
    dishGrid: document.getElementById('dish-grid'),
    emptyState: document.getElementById('empty-state'),
    resultSummary: document.getElementById('result-summary'),
    search: document.getElementById('dish-search'),
    surpriseButton: document.getElementById('surprise-button'),
    manageButton: document.getElementById('manage-button'),
    addDishButton: document.getElementById('add-dish-button'),
    modal: document.getElementById('dish-modal'),
    form: document.getElementById('dish-form'),
    categorySelect: document.getElementById('dish-category'),
    dishTotal: document.getElementById('dish-total'),
    selectedTotal: document.getElementById('selected-total'),
    dockCount: document.getElementById('dock-count'),
    dockSummary: document.getElementById('dock-summary'),
    clearOrderButton: document.getElementById('clear-order-button'),
    toast: document.getElementById('toast')
};

let toastTimer = null;

function categoryById(categoryId) {
    return categories.find((category) => category.id === categoryId) || categories[0];
}

function filteredDishes() {
    const keyword = state.keyword.toLocaleLowerCase('zh-CN');
    return dishes.filter((dish) => {
        const categoryMatches = state.activeCategory === 'all' || dish.category === state.activeCategory;
        const searchableText = `${dish.name} ${dish.description} ${dish.tag}`.toLocaleLowerCase('zh-CN');
        return categoryMatches && (!keyword || searchableText.includes(keyword));
    });
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

function renderCategories() {
    els.categoryList.replaceChildren(...categories.map((category) => {
        const button = createElement('button', `category-chip${category.id === state.activeCategory ? ' is-active' : ''}`);
        button.type = 'button';
        button.dataset.category = category.id;
        button.textContent = `${category.emoji} ${category.label}`;
        button.addEventListener('click', () => {
            state.activeCategory = category.id;
            renderCategories();
            renderDishes();
        });
        return button;
    }));
}

function updateQuantity(dishId, delta) {
    const nextQuantity = Math.max(0, (state.quantities.get(dishId) || 0) + delta);
    if (nextQuantity === 0) {
        state.quantities.delete(dishId);
    } else {
        state.quantities.set(dishId, nextQuantity);
    }
    renderDishes();
    renderOrder();
}

function createQuantityControl(dish) {
    const quantity = state.quantities.get(dish.id) || 0;
    const control = createElement('div', 'quantity-control');
    const minusButton = createElement('button', 'quantity-button is-minus', '−');
    const value = createElement('span', 'quantity-value', String(quantity));
    const plusButton = createElement('button', 'quantity-button', '+');

    minusButton.type = 'button';
    plusButton.type = 'button';
    minusButton.setAttribute('aria-label', `减少一份${dish.name}`);
    plusButton.setAttribute('aria-label', `增加一份${dish.name}`);
    minusButton.addEventListener('click', () => updateQuantity(dish.id, -1));
    plusButton.addEventListener('click', () => updateQuantity(dish.id, 1));
    control.append(minusButton, value, plusButton);
    return control;
}

function createDishCard(dish) {
    const card = createElement('article', 'dish-card');
    card.dataset.id = dish.id;

    const art = createElement('div', 'dish-art');
    art.style.setProperty('--dish-color', dish.color);
    art.append(createElement('span', 'dish-emoji', dish.emoji));

    const info = createElement('div', 'dish-info');
    const category = categoryById(dish.category);
    info.append(
        createElement('span', 'dish-category', `${category.emoji} ${category.label}`),
        createElement('h3', 'dish-name', dish.name),
        createElement('p', 'dish-description', dish.description)
    );

    const actions = createElement('div', 'dish-actions');
    actions.append(createElement('span', 'dish-tag', dish.tag));
    actions.append(createQuantityControl(dish));

    const manageAction = createElement('button', 'manage-action', '编辑');
    manageAction.type = 'button';
    manageAction.addEventListener('click', () => showToast('编辑与删除逻辑将在后端阶段接入'));
    actions.append(manageAction);

    info.append(actions);
    card.append(art, info);
    return card;
}

function renderDishes() {
    const visibleDishes = filteredDishes();
    els.dishGrid.replaceChildren(...visibleDishes.map(createDishCard));
    els.dishGrid.classList.toggle('hidden', visibleDishes.length === 0);
    els.emptyState.classList.toggle('hidden', visibleDishes.length !== 0);

    const activeCategory = categoryById(state.activeCategory);
    els.resultSummary.textContent = `${activeCategory.label} · ${visibleDishes.length} 道`;
    els.dishTotal.textContent = String(dishes.length);
}

function renderOrder() {
    const selections = dishes
        .map((dish) => ({ dish, quantity: state.quantities.get(dish.id) || 0 }))
        .filter((item) => item.quantity > 0);
    const total = selections.reduce((sum, item) => sum + item.quantity, 0);

    els.selectedTotal.textContent = String(total);
    els.dockCount.textContent = String(total);
    els.dockSummary.textContent = selections.length
        ? selections.map((item) => `${item.dish.name} ×${item.quantity}`).join('、')
        : '还没有选择菜品';
}

function openModal() {
    els.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => document.getElementById('dish-name').focus());
}

function closeModal() {
    els.modal.classList.add('hidden');
    document.body.style.overflow = '';
    els.form.reset();
    document.getElementById('dish-emoji').value = '🍲';
}

function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
}

function addPrototypeDish(formData) {
    const name = String(formData.get('name') || '').trim();
    if (!name) return;

    const category = String(formData.get('category') || 'staple');
    const emoji = String(formData.get('emoji') || '').trim() || '🍲';
    const description = String(formData.get('description') || '').trim() || '刚刚记录的新菜，详细做法以后再慢慢补充。';
    dishes.unshift({
        id: `prototype-${Date.now()}`,
        name,
        category,
        emoji,
        description,
        tag: '前端临时记录',
        color: '#e8dfcf'
    });

    state.activeCategory = 'all';
    state.keyword = '';
    els.search.value = '';
    closeModal();
    renderCategories();
    renderDishes();
    showToast(`已把「${name}」加入本次菜单`);
}

function bindEvents() {
    els.search.addEventListener('input', () => {
        state.keyword = els.search.value.trim();
        renderDishes();
    });

    els.surpriseButton.addEventListener('click', () => {
        const candidates = filteredDishes().length ? filteredDishes() : dishes;
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        if (!selected) return;
        updateQuantity(selected.id, 1);
        document.querySelector(`[data-id="${CSS.escape(selected.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`今天试试「${selected.name}」吧`);
    });

    els.manageButton.addEventListener('click', () => {
        state.manageMode = !state.manageMode;
        document.body.classList.toggle('manage-mode', state.manageMode);
        els.manageButton.setAttribute('aria-pressed', String(state.manageMode));
        els.manageButton.textContent = state.manageMode ? '完成管理' : '管理菜单';
    });

    els.addDishButton.addEventListener('click', openModal);
    els.modal.querySelectorAll('[data-role="close-modal"]').forEach((button) => button.addEventListener('click', closeModal));
    els.form.addEventListener('submit', (event) => {
        event.preventDefault();
        addPrototypeDish(new FormData(els.form));
    });

    els.clearOrderButton.addEventListener('click', () => {
        state.quantities.clear();
        renderDishes();
        renderOrder();
        showToast('已清空当前点单');
    });
}

function init() {
    els.categorySelect.replaceChildren(...categories
        .filter((category) => category.id !== 'all')
        .map((category) => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.emoji} ${category.label}`;
            return option;
        }));

    renderCategories();
    renderDishes();
    renderOrder();
    bindEvents();
}

LoadingScreen.withLoading(init).catch((error) => {
    console.error('菜单页面初始化失败：', error);
    LoadingScreen.hide({ force: true });
});
