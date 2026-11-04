// 游戏配置
const CONFIG = {
    canvasWidth: 400,
    canvasHeight: 600,
    playerSpeed: 5,
    bulletSpeed: 12,
    enemyBaseSpeed: 0.5,
    fireRate: 120,
    enemySpawnRate: 1500,
    maxEnemies: 8
};

// 游戏状态
let gameState = {
    score: 0,
    lives: 3,
    level: 1,
    enemiesKilled: 0,
    isRunning: false,
    isPaused: false,
    lastFireTime: 0,
    lastEnemySpawn: 0,
    // 连击系统
    combo: 0,
    lastKillTime: 0,
    maxCombo: 0,
    // 能量系统
    energy: 0,
    maxEnergy: 100,
    // Boss系统
    bossActive: false,
    bossDefeated: 0
};

// 获取DOM元素
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// 设置画布尺寸
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// 按键状态
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

// 游戏对象数组
let player = null;
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let boss = null;
let bossBullets = [];

// 玩家飞机类
class Player {
    constructor() {
        this.width = 50;
        this.height = 60;
        this.x = CONFIG.canvasWidth / 2 - this.width / 2;
        this.y = CONFIG.canvasHeight - this.height - 20;
    }

    update() {
        // 左右移动
        if (keys.left && this.x > 0) {
            this.x -= CONFIG.playerSpeed;
        }
        if (keys.right && this.x < CONFIG.canvasWidth - this.width) {
            this.x += CONFIG.playerSpeed;
        }
        // 上下移动（限制在屏幕下半部分）
        const minY = CONFIG.canvasHeight / 2;
        const maxY = CONFIG.canvasHeight - this.height - 10;
        if (keys.up && this.y > minY) {
            this.y -= CONFIG.playerSpeed;
        }
        if (keys.down && this.y < maxY) {
            this.y += CONFIG.playerSpeed;
        }
    }

    draw() {
        // 飞机主体
        ctx.save();

        // 发光效果
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 20;

        // 机身
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 15);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // 机身内部
        ctx.fillStyle = '#0a2a4a';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + 15);
        ctx.lineTo(this.x + this.width - 10, this.y + this.height - 10);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 20);
        ctx.lineTo(this.x + 10, this.y + this.height - 10);
        ctx.closePath();
        ctx.fill();

        // 驾驶舱
        ctx.fillStyle = '#7b2fff';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + 25, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 引擎火焰
        const flameHeight = 15 + Math.random() * 10;
        const gradient = ctx.createLinearGradient(
            this.x + this.width / 2, this.y + this.height,
            this.x + this.width / 2, this.y + this.height + flameHeight
        );
        gradient.addColorStop(0, '#ff8c00');
        gradient.addColorStop(0.5, '#ff2d75');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 - 8, this.y + this.height - 5);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height + flameHeight);
        ctx.lineTo(this.x + this.width / 2 + 8, this.y + this.height - 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// 子弹类
class Bullet {
    constructor(x, y) {
        this.width = 8;
        this.height = 20;
        this.x = x - this.width / 2;
        this.y = y;
        this.speed = CONFIG.bulletSpeed;
    }

    update() {
        this.y -= this.speed;
    }

    draw() {
        ctx.save();
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;

        const gradient = ctx.createLinearGradient(this.x, this.y + this.height, this.x, this.y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, '#00ff88');
        gradient.addColorStop(1, '#ffffff');

        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }

    isOffScreen() {
        return this.y + this.height < 0;
    }
}

// 敌机类型定义
const ENEMY_TYPES = {
    NORMAL: { name: 'normal', speedMult: 1, score: 100, color: '#ff2d75' },
    FAST: { name: 'fast', speedMult: 2, score: 150, color: '#ffd700' },
    ZIGZAG: { name: 'zigzag', speedMult: 0.8, score: 200, color: '#9b59b6' }
};

// 敌机类
class Enemy {
    constructor(type = null) {
        this.width = 40;
        this.height = 45;
        this.x = Math.random() * (CONFIG.canvasWidth - this.width);
        this.y = -this.height;

        // 随机选择敌机类型（权重：普通60%，快速25%，曲线15%）
        if (!type) {
            const rand = Math.random();
            if (rand < 0.6) type = ENEMY_TYPES.NORMAL;
            else if (rand < 0.85) type = ENEMY_TYPES.FAST;
            else type = ENEMY_TYPES.ZIGZAG;
        }
        this.enemyType = type;

        // 速度计算
        const levelBonus = Math.log(gameState.level + 1) * 0.3;
        this.baseSpeed = (CONFIG.enemyBaseSpeed + Math.random() * 0.3 + levelBonus) * type.speedMult;
        this.speed = this.baseSpeed;

        // 曲线移动参数
        this.phase = Math.random() * Math.PI * 2;
        this.amplitude = 2;
        this.frequency = 0.05;

        // 视觉类型（用于不同外观）
        this.visualType = Math.floor(Math.random() * 3);
    }

    update() {
        this.y += this.speed;

        // 曲线敌机左右摇摆
        if (this.enemyType.name === 'zigzag') {
            this.phase += this.frequency;
            this.x += Math.sin(this.phase) * this.amplitude;
            // 边界检测
            if (this.x < 0) this.x = 0;
            if (this.x > CONFIG.canvasWidth - this.width) this.x = CONFIG.canvasWidth - this.width;
        }
    }

    draw() {
        ctx.save();
        ctx.shadowColor = this.enemyType.color;
        ctx.shadowBlur = 15;

        // 敌机主体
        ctx.fillStyle = this.enemyType.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + 15);
        ctx.lineTo(this.x, this.y);
        ctx.closePath();
        ctx.fill();

        // 快速敌机有尾焰
        if (this.enemyType.name === 'fast') {
            ctx.fillStyle = '#ff8c00';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2 - 5, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y - 15 - Math.random() * 5);
            ctx.lineTo(this.x + this.width / 2 + 5, this.y);
            ctx.closePath();
            ctx.fill();
        }

        // 曲线敌机有光环
        if (this.enemyType.name === 'zigzag') {
            ctx.strokeStyle = this.enemyType.color + '80';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 25, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 敌机装饰
        ctx.fillStyle = '#ffffff80';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y + this.height - 15, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    isOffScreen() {
        return this.y > CONFIG.canvasHeight;
    }
}

// 粒子类（爆炸效果）
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 6 + 2;
        this.speedX = (Math.random() - 0.5) * 8;
        this.speedY = (Math.random() - 0.5) * 8;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.96;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 背景星星类
class Star {
    constructor() {
        this.reset();
        this.y = Math.random() * CONFIG.canvasHeight;
    }

    reset() {
        this.x = Math.random() * CONFIG.canvasWidth;
        this.y = -5;
        this.size = Math.random() * 2 + 0.5;
        this.speed = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.3;
    }

    update() {
        this.y += this.speed;
        if (this.y > CONFIG.canvasHeight) {
            this.reset();
        }
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 道具类型定义
const POWERUP_TYPES = {
    HEALTH: { name: 'health', color: '#ff69b4', icon: '❤️', duration: 0 },
    DOUBLE_SHOT: { name: 'doubleShot', color: '#ff8c00', icon: '🔥', duration: 10000 },
    RAPID_FIRE: { name: 'rapidFire', color: '#ffd700', icon: '⚡', duration: 10000 },
    SHIELD: { name: 'shield', color: '#00d4ff', icon: '🛡️', duration: 10000 },
    BOMB: { name: 'bomb', color: '#ff4444', icon: '💣', duration: 0 },
    HOMING: { name: 'homing', color: '#9b59b6', icon: '🎯', duration: 10000 },
    LASER: { name: 'laser', color: '#00ff00', icon: '🔫', duration: 10000 }
};

// 道具数组
let powerUps = [];

// 当前激活的效果
let activeEffects = {
    doubleShot: false,
    rapidFire: false,
    shield: false,
    homing: false,
    laser: false,
    doubleShotEndTime: 0,
    rapidFireEndTime: 0,
    shieldEndTime: 0,
    homingEndTime: 0,
    laserEndTime: 0
};

// 道具类
class PowerUp {
    constructor(x, y) {
        this.width = 30;
        this.height = 30;
        this.x = x - this.width / 2;
        this.y = y;
        this.speed = 2;
        this.rotation = 0;
        this.pulsePhase = 0;

        // 随机选择道具类型
        const types = Object.values(POWERUP_TYPES);
        this.type = types[Math.floor(Math.random() * types.length)];
    }

    update() {
        this.y += this.speed;
        this.rotation += 0.05;
        this.pulsePhase += 0.1;
    }

    draw() {
        ctx.save();

        // 脉冲发光效果
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.2;
        const glowSize = 20 * pulse;

        // 外发光
        ctx.shadowColor = this.type.color;
        ctx.shadowBlur = glowSize;

        // 绘制六边形背景
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        // 外圈
        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const px = Math.cos(angle) * 15 * pulse;
            const py = Math.sin(angle) * 15 * pulse;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // 内部填充
        ctx.fillStyle = this.type.color + '40';
        ctx.fill();

        // 绘制图标
        ctx.rotate(-this.rotation);
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.icon, 0, 0);

        ctx.restore();
    }

    isOffScreen() {
        return this.y > CONFIG.canvasHeight;
    }
}

// 跟踪弹类
class HomingBullet {
    constructor(x, y) {
        this.width = 10;
        this.height = 10;
        this.x = x - this.width / 2;
        this.y = y;
        this.speed = 8;
        this.target = null;
    }

    findTarget() {
        if (enemies.length === 0) return null;
        let closest = null;
        let minDist = Infinity;
        for (const enemy of enemies) {
            const dx = enemy.x + enemy.width / 2 - this.x;
            const dy = enemy.y + enemy.height / 2 - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                closest = enemy;
            }
        }
        return closest;
    }

    update() {
        this.target = this.findTarget();
        if (this.target) {
            const tx = this.target.x + this.target.width / 2;
            const ty = this.target.y + this.target.height / 2;
            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }
        } else {
            this.y -= this.speed;
        }
    }

    draw() {
        ctx.save();
        ctx.shadowColor = '#9b59b6';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        // 尾迹
        ctx.fillStyle = '#9b59b680';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2 + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isOffScreen() {
        return this.y + this.height < 0 || this.y > CONFIG.canvasHeight;
    }
}

// 激光数组
let lasers = [];

// 激光类
class Laser {
    constructor(x) {
        this.x = x;
        this.width = 20;
        this.height = CONFIG.canvasHeight;
        this.y = 0;
        this.alpha = 1;
        this.duration = 100; // 激光持续帧数
    }

    update() {
        this.duration--;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.duration / 20);

        // 激光核心
        const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, '#00ff00');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(0.7, '#00ff00');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 30;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.restore();
    }

    isDead() {
        return this.duration <= 0;
    }
}

// Boss类
class Boss {
    constructor(level) {
        this.width = 120;
        this.height = 100;
        this.x = CONFIG.canvasWidth / 2 - this.width / 2;
        this.y = -this.height;
        this.targetY = 80;
        this.speed = 1;
        this.maxHealth = 500 + level * 100;
        this.health = this.maxHealth;
        this.phase = 0;
        this.attackTimer = 0;
        this.attackPattern = 0;
        this.entering = true;
    }

    update() {
        // 进场动画
        if (this.entering) {
            this.y += this.speed;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.entering = false;
            }
            return;
        }

        // 左右移动
        this.phase += 0.02;
        this.x = CONFIG.canvasWidth / 2 - this.width / 2 + Math.sin(this.phase) * 80;

        // 攻击计时
        this.attackTimer++;
        if (this.attackTimer > 60) {
            this.attack();
            this.attackTimer = 0;
            this.attackPattern = (this.attackPattern + 1) % 3;
        }
    }

    attack() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height;

        switch (this.attackPattern) {
            case 0: // 散射
                for (let i = -2; i <= 2; i++) {
                    bossBullets.push(new BossBullet(centerX, centerY, i * 0.3, 3));
                }
                break;
            case 1: // 直线
                bossBullets.push(new BossBullet(centerX - 30, centerY, 0, 4));
                bossBullets.push(new BossBullet(centerX + 30, centerY, 0, 4));
                break;
            case 2: // 追踪
                if (player) {
                    const dx = player.x + player.width / 2 - centerX;
                    const dy = player.y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    bossBullets.push(new BossBullet(centerX, centerY, dx / dist * 3, dy / dist * 3));
                }
                break;
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        // 屏幕震动效果
        canvas.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
        setTimeout(() => canvas.style.transform = '', 50);

        if (this.health <= 0) {
            return true; // Boss死亡
        }
        return false;
    }

    draw() {
        ctx.save();

        // Boss主体
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 30;

        // 外壳
        ctx.fillStyle = '#1a1a3a';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height * 0.7);
        ctx.lineTo(this.x + this.width * 0.8, this.y + this.height);
        ctx.lineTo(this.x + this.width * 0.2, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height * 0.7);
        ctx.closePath();
        ctx.fill();

        // 装甲
        ctx.fillStyle = '#ff2d75';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + 10);
        ctx.lineTo(this.x + this.width - 20, this.y + this.height * 0.6);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 20);
        ctx.lineTo(this.x + 20, this.y + this.height * 0.6);
        ctx.closePath();
        ctx.fill();

        // 核心
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 15 + Math.sin(this.phase * 3) * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // 血条
        const barWidth = this.width;
        const barHeight = 8;
        const barX = this.x;
        const barY = this.y - 20;
        const healthPercent = this.health / this.maxHealth;

        // 血条背景
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 血条
        const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * healthPercent, barY);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, '#ff8c00');
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // 血条边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Boss名称
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS Lv.${gameState.bossDefeated + 1}`, this.x + this.width / 2, barY - 5);
    }

    isDead() {
        return this.health <= 0;
    }
}

// Boss子弹类
class BossBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 8;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ff2d75';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isOffScreen() {
        return this.y > CONFIG.canvasHeight || this.x < 0 || this.x > CONFIG.canvasWidth;
    }
}

// 创建爆炸效果
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// 碰撞检测
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y;
}

// 连击系统 - 击杀敌机时调用
function addKill(score) {
    const now = Date.now();

    // 检查连击是否超时（3秒）
    if (now - gameState.lastKillTime < 3000) {
        gameState.combo++;
    } else {
        gameState.combo = 1;
    }

    gameState.lastKillTime = now;
    if (gameState.combo > gameState.maxCombo) {
        gameState.maxCombo = gameState.combo;
    }

    // 连击分数加成
    const comboMultiplier = 1 + Math.min(gameState.combo * 0.1, 2);
    const finalScore = Math.floor(score * comboMultiplier);
    gameState.score += finalScore;

    // 增加能量
    gameState.energy = Math.min(gameState.energy + 5, gameState.maxEnergy);

    gameState.enemiesKilled++;
    checkLevelUp();
    updateHUD();
}

// 更新连击状态（每帧调用）
function updateCombo() {
    const now = Date.now();
    if (gameState.combo > 0 && now - gameState.lastKillTime > 3000) {
        gameState.combo = 0;
    }
}

// 释放大招
function useUltimate() {
    if (gameState.energy >= gameState.maxEnergy) {
        gameState.energy = 0;

        // 超级激光效果
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                lasers.push(new Laser(player.x + player.width / 2 - 10 + (i - 2) * 30));
            }, i * 50);
        }

        // 大爆炸粒子
        for (let i = 0; i < 100; i++) {
            particles.push(new Particle(
                player.x + player.width / 2,
                player.y,
                ['#ffd700', '#ff8c00', '#ff2d75'][Math.floor(Math.random() * 3)]
            ));
        }

        updateHUD();
    }
}

// 检查是否需要生成Boss
function checkBossSpawn() {
    // 每5关出现Boss
    if (gameState.level > 0 &&
        gameState.level % 5 === 0 &&
        !gameState.bossActive &&
        gameState.bossDefeated < Math.floor(gameState.level / 5)) {
        spawnBoss();
    }
}

// 生成Boss
function spawnBoss() {
    boss = new Boss(gameState.bossDefeated + 1);
    gameState.bossActive = true;
    enemies = []; // 清空普通敌机
}

// 处理Boss死亡
function onBossDefeated() {
    // 大量粒子爆炸
    for (let i = 0; i < 80; i++) {
        particles.push(new Particle(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffd700'));
    }

    // 加分
    gameState.score += 2000 + gameState.bossDefeated * 500;
    gameState.bossDefeated++;
    gameState.bossActive = false;
    boss = null;
    bossBullets = [];

    // 必掉道具
    for (let i = 0; i < 3; i++) {
        powerUps.push(new PowerUp(
            CONFIG.canvasWidth / 2 + (i - 1) * 50,
            100
        ));
    }

    updateHUD();
}

// 生成敌机
function spawnEnemy() {
    if (enemies.length < CONFIG.maxEnemies && !gameState.bossActive) {
        enemies.push(new Enemy());
    }
}

// 生成道具（敌机被击毁时调用）
function spawnPowerUp(x, y) {
    if (Math.random() < 0.2) { // 20%概率掉落
        powerUps.push(new PowerUp(x, y));
    }
}

// 应用道具效果
function applyPowerUp(powerUp) {
    const now = Date.now();

    switch (powerUp.type.name) {
        case 'health':
            if (gameState.lives < 3) {
                gameState.lives++;
                updateHUD();
            }
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#ff69b4');
            break;

        case 'doubleShot':
            activeEffects.doubleShot = true;
            activeEffects.doubleShotEndTime = now + powerUp.type.duration;
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#ff8c00');
            break;

        case 'rapidFire':
            activeEffects.rapidFire = true;
            activeEffects.rapidFireEndTime = now + powerUp.type.duration;
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#ffd700');
            break;

        case 'shield':
            activeEffects.shield = true;
            activeEffects.shieldEndTime = now + powerUp.type.duration;
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#00d4ff');
            break;

        case 'bomb':
            // 清屏炸弹：消灭所有敌机
            enemies.forEach(enemy => {
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff4444');
                gameState.score += 100;
                gameState.enemiesKilled++;
            });
            enemies = [];
            // 大爆炸特效
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2, '#ff4444'));
            }
            checkLevelUp();
            updateHUD();
            break;

        case 'homing':
            activeEffects.homing = true;
            activeEffects.homingEndTime = now + powerUp.type.duration;
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#9b59b6');
            break;

        case 'laser':
            activeEffects.laser = true;
            activeEffects.laserEndTime = now + powerUp.type.duration;
            createExplosion(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2, '#00ff00');
            break;
    }

    updatePowerUpHUD();
}

// 更新道具效果状态
function updateActiveEffects() {
    const now = Date.now();

    if (activeEffects.doubleShot && now > activeEffects.doubleShotEndTime) {
        activeEffects.doubleShot = false;
    }
    if (activeEffects.rapidFire && now > activeEffects.rapidFireEndTime) {
        activeEffects.rapidFire = false;
    }
    if (activeEffects.shield && now > activeEffects.shieldEndTime) {
        activeEffects.shield = false;
    }
    if (activeEffects.homing && now > activeEffects.homingEndTime) {
        activeEffects.homing = false;
    }
    if (activeEffects.laser && now > activeEffects.laserEndTime) {
        activeEffects.laser = false;
    }

    updatePowerUpHUD();
}

// 更新道具HUD显示
function updatePowerUpHUD() {
    const container = document.getElementById('powerup-status');
    if (!container) return;

    const now = Date.now();
    let html = '';

    if (activeEffects.doubleShot) {
        const remaining = Math.ceil((activeEffects.doubleShotEndTime - now) / 1000);
        html += `<div class="powerup-active" style="--color: #ff8c00">🔥 ${remaining}s</div>`;
    }
    if (activeEffects.rapidFire) {
        const remaining = Math.ceil((activeEffects.rapidFireEndTime - now) / 1000);
        html += `<div class="powerup-active" style="--color: #ffd700">⚡ ${remaining}s</div>`;
    }
    if (activeEffects.shield) {
        const remaining = Math.ceil((activeEffects.shieldEndTime - now) / 1000);
        html += `<div class="powerup-active" style="--color: #00d4ff">🛡️ ${remaining}s</div>`;
    }
    if (activeEffects.homing) {
        const remaining = Math.ceil((activeEffects.homingEndTime - now) / 1000);
        html += `<div class="powerup-active" style="--color: #9b59b6">🎯 ${remaining}s</div>`;
    }
    if (activeEffects.laser) {
        const remaining = Math.ceil((activeEffects.laserEndTime - now) / 1000);
        html += `<div class="powerup-active" style="--color: #00ff00">🔫 ${remaining}s</div>`;
    }

    container.innerHTML = html;
}

// 发射子弹（自动开火）
function fireBullet() {
    const now = Date.now();
    const fireRate = activeEffects.rapidFire ? CONFIG.fireRate / 2 : CONFIG.fireRate;

    if (now - gameState.lastFireTime > fireRate) {
        // 激光模式
        if (activeEffects.laser) {
            lasers.push(new Laser(player.x + player.width / 2 - 10));
        }
        // 跟踪弹模式
        else if (activeEffects.homing) {
            bullets.push(new HomingBullet(player.x + player.width / 2, player.y));
        }
        // 双发模式
        else if (activeEffects.doubleShot) {
            bullets.push(new Bullet(player.x + player.width / 2 - 12, player.y));
            bullets.push(new Bullet(player.x + player.width / 2 + 12, player.y));
        }
        // 普通模式
        else {
            bullets.push(new Bullet(player.x + player.width / 2, player.y));
        }
        gameState.lastFireTime = now;
    }
}

// 更新HUD显示
function updateHUD() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;

    const livesContainer = document.getElementById('lives');
    const lifeIcons = livesContainer.querySelectorAll('.life-icon');
    lifeIcons.forEach((icon, index) => {
        if (index < gameState.lives) {
            icon.classList.remove('lost');
        } else {
            icon.classList.add('lost');
        }
    });
}

// 检查升级
function checkLevelUp() {
    const newLevel = Math.floor(gameState.score / 500) + 1;
    if (newLevel > gameState.level) {
        gameState.level = newLevel;
        CONFIG.enemySpawnRate = Math.max(400, 1000 - gameState.level * 100);
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameState.isRunning || gameState.isPaused) return;

    // 清空画布
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // 更新和绘制星星背景
    stars.forEach(star => {
        star.update();
        star.draw();
    });

    // 自动开火（无需按键）
    fireBullet();

    // 更新玩家
    player.update();
    player.draw();

    // 更新普通子弹和跟踪弹
    bullets = bullets.filter(bullet => {
        bullet.update();
        bullet.draw();
        return !bullet.isOffScreen();
    });

    // 更新激光
    lasers = lasers.filter(laser => {
        laser.update();
        laser.draw();

        // 激光与敌机碰撞检测
        enemies = enemies.filter(enemy => {
            if (laser.x < enemy.x + enemy.width &&
                laser.x + laser.width > enemy.x) {
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#00ff00');
                spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                addKill(enemy.enemyType.score);
                return false;
            }
            return true;
        });

        // 激光与Boss碰撞检测
        if (boss && !boss.entering) {
            if (laser.x < boss.x + boss.width &&
                laser.x + laser.width > boss.x &&
                laser.y < boss.y + boss.height) {
                if (boss.takeDamage(10)) {
                    onBossDefeated();
                }
            }
        }

        return !laser.isDead();
    });

    // 生成敌机
    const now = Date.now();
    if (now - gameState.lastEnemySpawn > CONFIG.enemySpawnRate) {
        spawnEnemy();
        gameState.lastEnemySpawn = now;
    }

    // 更新敌机
    enemies = enemies.filter(enemy => {
        enemy.update();
        enemy.draw();

        // 检测子弹击中敌机
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (checkCollision(bullets[i], enemy)) {
                bullets.splice(i, 1);
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.enemyType.color);
                spawnPowerUp(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                addKill(enemy.enemyType.score);
                return false;
            }
        }

        // 检测敌机撞到玩家
        if (checkCollision(enemy, player)) {
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff2d75');

            // 检查护盾
            if (activeEffects.shield) {
                activeEffects.shield = false;
                updatePowerUpHUD();
            } else {
                gameState.lives--;
                updateHUD();
                if (gameState.lives <= 0) {
                    gameOver();
                }
            }
            return false;
        }

        // 敌机飞出屏幕
        if (enemy.isOffScreen()) {
            return false;
        }

        return true;
    });

    // 更新粒子
    particles = particles.filter(particle => {
        particle.update();
        particle.draw();
        return !particle.isDead();
    });

    // 更新道具状态
    updateActiveEffects();

    // 更新和检测道具
    powerUps = powerUps.filter(powerUp => {
        powerUp.update();
        powerUp.draw();

        // 检测玩家拾取道具
        if (checkCollision(powerUp, player)) {
            applyPowerUp(powerUp);
            return false;
        }

        return !powerUp.isOffScreen();
    });

    // 绘制护盾效果
    if (activeEffects.shield) {
        ctx.save();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 更新连击状态
    updateCombo();

    // 检查Boss生成
    checkBossSpawn();

    // 更新Boss
    if (boss) {
        boss.update();
        boss.draw();

        // 子弹击中Boss
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (bullet.x < boss.x + boss.width &&
                bullet.x + bullet.width > boss.x &&
                bullet.y < boss.y + boss.height &&
                bullet.y + bullet.height > boss.y) {
                bullets.splice(i, 1);
                if (boss.takeDamage(20)) {
                    onBossDefeated();
                }
            }
        }

        // 更新Boss子弹
        bossBullets = bossBullets.filter(bullet => {
            bullet.update();
            bullet.draw();

            // Boss子弹击中玩家
            const dx = bullet.x - (player.x + player.width / 2);
            const dy = bullet.y - (player.y + player.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bullet.radius + 20) {
                if (activeEffects.shield) {
                    activeEffects.shield = false;
                    updatePowerUpHUD();
                } else {
                    gameState.lives--;
                    updateHUD();
                    if (gameState.lives <= 0) {
                        gameOver();
                    }
                }
                return false;
            }

            return !bullet.isOffScreen();
        });
    }

    // 绘制连击显示
    if (gameState.combo > 1) {
        ctx.save();
        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.fillText(`COMBO x${gameState.combo}`, CONFIG.canvasWidth / 2, 100);

        // 分数倍率提示
        const multiplier = (1 + Math.min(gameState.combo * 0.1, 2)).toFixed(1);
        ctx.font = '14px Orbitron';
        ctx.fillStyle = '#ff8c00';
        ctx.fillText(`x${multiplier} BONUS`, CONFIG.canvasWidth / 2, 120);
        ctx.restore();
    }

    // 绘制能量条
    const energyBarWidth = 150;
    const energyBarHeight = 12;
    const energyX = CONFIG.canvasWidth - energyBarWidth - 15;
    const energyY = 55;
    const energyPercent = gameState.energy / gameState.maxEnergy;

    // 能量条背景
    ctx.fillStyle = '#333';
    ctx.fillRect(energyX, energyY, energyBarWidth, energyBarHeight);

    // 能量条
    const energyGradient = ctx.createLinearGradient(energyX, energyY, energyX + energyBarWidth, energyY);
    energyGradient.addColorStop(0, '#00d4ff');
    energyGradient.addColorStop(1, '#ffd700');
    ctx.fillStyle = energyGradient;
    ctx.fillRect(energyX, energyY, energyBarWidth * energyPercent, energyBarHeight);

    // 能量条边框
    ctx.strokeStyle = energyPercent >= 1 ? '#ffd700' : '#666';
    ctx.lineWidth = energyPercent >= 1 ? 2 : 1;
    ctx.strokeRect(energyX, energyY, energyBarWidth, energyBarHeight);

    // 能量条标签
    ctx.font = '10px Orbitron';
    ctx.fillStyle = energyPercent >= 1 ? '#ffd700' : '#aaa';
    ctx.textAlign = 'right';
    ctx.fillText(energyPercent >= 1 ? 'PRESS Q!' : 'ENERGY', energyX - 5, energyY + 10);

    requestAnimationFrame(gameLoop);
}

// 初始化游戏
function initGame() {
    player = new Player();
    bullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    lasers = [];
    boss = null;
    bossBullets = [];

    // 重置道具效果
    activeEffects = {
        doubleShot: false,
        rapidFire: false,
        shield: false,
        homing: false,
        laser: false,
        doubleShotEndTime: 0,
        rapidFireEndTime: 0,
        shieldEndTime: 0,
        homingEndTime: 0,
        laserEndTime: 0
    };

    // 创建背景星星
    stars = [];
    for (let i = 0; i < 50; i++) {
        stars.push(new Star());
    }

    gameState = {
        score: 0,
        lives: 3,
        level: 1,
        enemiesKilled: 0,
        isRunning: true,
        isPaused: false,
        lastFireTime: 0,
        lastEnemySpawn: 0,
        combo: 0,
        lastKillTime: 0,
        maxCombo: 0,
        energy: 0,
        maxEnergy: 100,
        bossActive: false,
        bossDefeated: 0
    };

    CONFIG.enemySpawnRate = 1500;
    updateHUD();
    updatePowerUpHUD();
}

// 开始游戏
function startGame() {
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initGame();
    gameLoop();
}

// 暂停游戏
function pauseGame() {
    gameState.isPaused = true;
    pauseScreen.classList.remove('hidden');
}

// 继续游戏
function resumeGame() {
    gameState.isPaused = false;
    pauseScreen.classList.add('hidden');
    gameLoop();
}

// 游戏结束
function gameOver() {
    gameState.isRunning = false;
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('enemies-killed').textContent = gameState.enemiesKilled;
    document.getElementById('final-level').textContent = gameState.level;
    gameoverScreen.classList.remove('hidden');
}

// 重新开始
function restartGame() {
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    initGame();
    gameLoop();
}

// 键盘事件监听
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            break;
        case 'KeyQ':
            if (gameState.isRunning && !gameState.isPaused) {
                useUltimate();
            }
            break;
        case 'Escape':
            if (gameState.isRunning) {
                if (gameState.isPaused) {
                    resumeGame();
                } else {
                    pauseGame();
                }
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
    }
});

// 按钮事件监听
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('restart-pause-btn').addEventListener('click', restartGame);
