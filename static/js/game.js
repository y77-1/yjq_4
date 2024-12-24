// 音频设置
const ENABLE_AUDIO = true;  // 保持启用音频

// 只保留背景音乐
const bgMusic = new Audio('data/audio/background.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3;

class Game {
    constructor() {
        // 从 localStorage 获取玩家信息
        const savedInfo = localStorage.getItem('playerInfo');
        if (!savedInfo) {
            window.location.href = '/';
            return;
        }

        const playerData = JSON.parse(savedInfo);
        this.playerInfo = {
            id: playerData.id,
            nickname: playerData.nickname,
            history: [],
            score: 0
        };

        this.inventory = new Set();
        this.initGame();
        this.initInventoryUI();

        // 添加物品图片映射
        this.itemImages = {
            '古籍': 'book.png',
            '符文钥匙': 'key.png',
            '通行证': 'pass.png',
            '金币': 'gold.png',
            '宝石': 'gem.png',
            '古老卷轴': 'scroll.png',
            '神秘法器': 'artifact.png',
            '龙之宝石': 'dragon-gem.png',
            '凤凰羽毛': 'feather.png',
            '魔法水晶': 'crystal.png',
            '珍珠': 'pearl.png',
            '玉佩': 'jade.png',
            '古币': 'coin.png',
            '宝石戒指': 'ring.png',
            '潜水装备': 'diving.png'
        };

        // 初始化音频
        this.soundEnabled = true;
        this.bgMusic = new Audio('/data/audio/background.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.3;

        // 添加音频错误处理
        this.bgMusic.addEventListener('error', (e) => {
            console.warn('背景音乐加载失败:', e);
            this.soundEnabled = false;
        });
    }

    async initGame() {
        try {
            const response = await fetch('data/locations.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.text();
            this.locations = this.parseLocationData(data);
            this.renderLocations();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showMessage('游戏数据加载失败，请刷新页面重试！');
        }
    }

    parseLocationData(data) {
        try {
            return data.split('\n').filter(line => line.trim()).map(line => {
                const parts = line.split('|');
                if (parts.length < 6) {
                    throw new Error(`数据格式不正确: ${line}`);
                }
                const [name, description, hint, isAccessible, action, taskHint] = parts;
                return {
                    name,
                    description,
                    hint,
                    isAccessible: isAccessible === 'true',
                    action,
                    taskHint
                };
            });
        } catch (error) {
            console.error('解析数据失败:', error);
            throw error;
        }
    }

    renderLocations() {
        const gameContainer = document.getElementById('game-container');
        gameContainer.innerHTML = this.locations
            .map(location => `
                <div class="location ${location.isAccessible ? 'accessible' : 'locked'}"
                     onclick="game.handleLocationClick(${JSON.stringify(location).replace(/"/g, '&quot;')})">
                    <h3>${this.escapeHtml(location.name)}</h3>
                    <p>${this.escapeHtml(location.description)}</p>
                    <p class="hint">${this.escapeHtml(location.hint)}</p>
                    ${location.isAccessible ? 
                        `<p class="task-hint">${this.escapeHtml(location.taskHint)}</p>` : 
                        '<p class="locked-message">🔒 暂未解锁</p>'}
                    ${this.getLocationStatus(location)}
                </div>
            `).join('');
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    loadPlayerInfo() {
        const savedInfo = localStorage.getItem('playerInfo');
        if (savedInfo) {
            const info = JSON.parse(savedInfo);
            // 恢复背包物品
            if (info.inventory) {
                this.inventory = new Set(info.inventory);
            }
            return info;
        }
        return null;
    }

    savePlayerInfo() {
        const playerData = {
            ...this.playerInfo,
            inventory: Array.from(this.inventory) // 将 Set 转换为数组保存
        };
        localStorage.setItem('playerInfo', JSON.stringify(playerData));
    }

    addToHistory(action) {
        if (!this.playerInfo.history) {
            this.playerInfo.history = [];
        }
        this.playerInfo.history.push({
            action,
            timestamp: new Date().toISOString()
        });
        this.savePlayerInfo();
    }

    toggleMusic() {
        if (!this.soundEnabled) {
            this.showMessage('音频功能未启用，请确保音频文件存在');
            return;
        }

        try {
            if (this.bgMusic.paused) {
                this.bgMusic.play().then(() => {
                    this.showMessage('音乐已开启');
                }).catch(e => {
                    console.warn('播放失败:', e);
                    this.showMessage('点击播放按钮来启用音乐');
                });
            } else {
                this.bgMusic.pause();
                this.showMessage('音乐已暂停');
            }
        } catch (error) {
            console.warn('音乐控制失败:', error);
        }
    }

    async handleLocationClick(location) {
        if (!location.isAccessible) {
            this.showMessage('这个地点暂时无法访问！');
            return;
        }

        try {
            const result = await this[location.action](location);
            if (result) {
                this.addToHistory(`在${location.name}完成了任务：${result}`);
                this.updateLocations(location);
                await this.saveScore();  // 保存分数
            }
        } catch (error) {
            console.error('任务执行失败:', error);
            this.showMessage('任务失败，请重试！');
        }
    }

    async findBook() {
        const result = await this.showPuzzle('书架密码', 
            '找到一个写着数字的纸条：1-3-5，这可能是打开书架的密码...',
            async (answer) => answer === '135'
        );
        
        if (result) {
            this.addToInventory('古籍');
            this.showMessage('你找到了一本神秘的古籍！书中记载着关于神庙的秘密...', 3000);
            return '找到古籍';
        }
    }

    async solvePuzzle() {
        if (!this.inventory.has('古籍')) {
            this.showMessage('需要先在图书馆找到古籍！');
            return;
        }

        const result = await this.showPuzzle('符文谜题',
            '古籍上记载：东南西北，依次点亮符文。提示：用英文字母 E、N、S、W 表示方向...',
            async (answer) => answer.toLowerCase() === 'ensw'
        );

        if (result) {
            this.addToInventory('符文钥匙');
            this.showMessage('符文发出耀眼的光芒，你获得了符文钥匙！', 3000);
            return '解开符文谜题';
        }
    }

    async negotiateGuard() {
        if (!this.inventory.has('符文钥匙')) {
            this.showMessage('守卫拦住了你：没有符文钥匙，不能通过！');
            return;
        }

        await this.showProgress('正在与守卫交涉...', 3000);
        this.addToInventory('通行证');
        this.showMessage('守卫看到符文钥匙，恭敬地为你让开了道路。', 3000);
        return '获得守卫的信任';
    }

    async searchTreasure() {
        if (!this.inventory.has('通行证')) {
            this.showMessage('没有通行证，无法进入密室！');
            return;
        }

        await this.showProgress('正在搜索宝藏...', 5000);
        const treasureTypes = ['金币', '宝石', '古老卷轴', '神秘法器'];
        const randomTreasure = treasureTypes[Math.floor(Math.random() * treasureTypes.length)];
        this.addToInventory(randomTreasure);
        this.showMessage(`恭喜！你找到了传说中的宝藏：${randomTreasure}！`, 5000);
        return `找到宝藏：${randomTreasure}`;
    }

    showMessage(text, duration = 3000) {
        const dialog = document.createElement('div');
        dialog.className = 'dialog-box';
        dialog.textContent = text;
        document.body.appendChild(dialog);
        setTimeout(() => dialog.remove(), duration);
    }

    async showPuzzle(title, hint, validateFn) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'dialog-box';
            dialog.innerHTML = `
                <h3>${title}</h3>
                <p>${hint}</p>
                <input type="text" placeholder="输入答案">
                <button>确认</button>
            `;
            
            const input = dialog.querySelector('input');
            const button = dialog.querySelector('button');
            
            const checkAnswer = async () => {
                if (await validateFn(input.value)) {
                    dialog.remove();
                    resolve(true);
                } else {
                    this.showMessage('答案不正确，请重试！');
                }
            };
            
            // 添加回车键支持
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await checkAnswer();
                }
            });
            
            button.onclick = checkAnswer;
            
            document.body.appendChild(dialog);
            input.focus(); // 自动聚焦输入框
        });
    }

    async showProgress(text, duration) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'dialog-box';
            dialog.innerHTML = `
                <p>${text}</p>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: 0%"></div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            const fill = dialog.querySelector('.progress-bar-fill');
            const startTime = Date.now();
            
            const updateProgress = () => {
                const elapsed = Date.now() - startTime;
                const progress = (elapsed / duration) * 100;
                
                if (progress < 100) {
                    fill.style.width = `${progress}%`;
                    requestAnimationFrame(updateProgress);
                } else {
                    dialog.remove();
                    resolve();
                }
            };
            
            requestAnimationFrame(updateProgress);
        });
    }

    updateLocations(completedLocation) {
        if (completedLocation.name === '图书馆') {
            this.locations.find(l => l.name === '神庙').isAccessible = true;
        } else if (completedLocation.name === '神庙') {
            this.locations.find(l => l.name === '守卫营地').isAccessible = true;
        } else if (completedLocation.name === '守卫营地') {
            this.locations.find(l => l.name === '密室').isAccessible = true;
        } else if (completedLocation.name === '密室' && this.inventory.has('神秘法器')) {
            this.locations.find(l => l.name === '藏宝洞').isAccessible = true;
            this.locations.find(l => l.name === '古井').isAccessible = true;
        }
        
        this.renderLocations();
        this.savePlayerInfo();
    }

    // 添加 HTML 转义方法
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    initInventoryUI() {
        const inventoryDiv = document.createElement('div');
        inventoryDiv.id = 'inventory';
        inventoryDiv.className = 'inventory-container';
        document.body.appendChild(inventoryDiv);
        this.updateInventoryUI();
    }

    updateInventoryUI() {
        const inventoryDiv = document.getElementById('inventory');
        inventoryDiv.innerHTML = `
            <h3>背包物品</h3>
            <div class="inventory-items">
                ${Array.from(this.inventory).map(item => `
                    <div class="inventory-item">
                        <img src="/images/items/${this.itemImages[item]}" alt="${item}">
                        <span>${this.escapeHtml(item)}</span>
                    </div>
                `).join('') || '<p>背包是空的</p>'}
            </div>
        `;
    }

    addToInventory(item) {
        this.inventory.add(item);
        this.updateInventoryUI();
        this.savePlayerInfo();
        this.saveScore();

        // 显示获得物品的动画
        const itemDialog = document.createElement('div');
        itemDialog.className = 'item-obtained';
        itemDialog.innerHTML = `
            <img src="/images/items/${this.itemImages[item]}" alt="${item}">
            <p>获得物品：${item}</p>
        `;
        document.body.appendChild(itemDialog);
        setTimeout(() => itemDialog.remove(), 2000);
    }

    getLocationStatus(location) {
        if (location.name === '图书馆' && this.inventory.has('古籍')) {
            return '<p class="completed">✅ 已找到古籍</p>';
        }
        if (location.name === '神庙' && this.inventory.has('符文钥匙')) {
            return '<p class="completed">✅ 已解开符文</p>';
        }
        if (location.name === '守卫营地' && this.inventory.has('通行证')) {
            return '<p class="completed">✅ 已获得通行证</p>';
        }
        return '';
    }

    // 添加与后端交互的方法
    async createPlayer() {
        try {
            const response = await fetch('/api/player', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: this.playerInfo.id,
                    nickname: this.playerInfo.nickname
                })
            });
            const data = await response.json();
            console.log(data.message);
        } catch (error) {
            console.error('创建玩家失败:', error);
        }
    }

    async saveScore() {
        try {
            const response = await fetch('/api/score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_id: this.playerInfo.id,
                    score: this.calculateScore(),
                    items: Array.from(this.inventory)
                })
            });
            if (!response.ok) {
                throw new Error('保存分数失败');
            }
        } catch (error) {
            console.error('保存分数失败:', error);
        }
    }

    async loadPlayerHistory() {
        try {
            const response = await fetch(`/api/player/${this.playerInfo.id}`);
            if (!response.ok) {
                throw new Error('加载历史记录失败');
            }
            const data = await response.json();
            return data.scores || [];
        } catch (error) {
            console.error('加载历史记录失败:', error);
            return [];
        }
    }

    calculateScore() {
        let score = 0;
        const itemScores = {
            '古籍': 100,
            '符文钥匙': 200,
            '通行证': 300,
            '金币': 500,
            '宝石': 600,
            '古老卷轴': 700,
            '神秘法器': 800,
            '龙之宝石': 1000,
            '凤凰羽毛': 1200,
            '远古卷轴': 1500,
            '魔法水晶': 1800,
            '珍珠': 400,
            '玉佩': 600,
            '古币': 800,
            '宝石戒指': 1000,
            '潜水装备': 300
        };

        for (const item of this.inventory) {
            if (itemScores[item]) {
                score += itemScores[item];
            }
        }
        return score;
    }

    async exploreSecret() {
        if (!this.inventory.has('神秘法器')) {
            this.showMessage('需要神秘法器才能进入藏宝洞！');
            return;
        }

        await this.showProgress('正在探索藏宝洞...', 4000);
        const secretItems = ['龙之宝石', '凤凰羽毛', '远古卷轴', '魔法水晶'];
        const randomItem = secretItems[Math.floor(Math.random() * secretItems.length)];
        this.addToInventory(randomItem);
        this.showMessage(`在藏宝洞深处，你发现了${randomItem}！`, 3000);
        return `发现秘宝：${randomItem}`;
    }

    async divingWell() {
        if (!this.inventory.has('潜水装备')) {
            const result = await this.showPuzzle('获取潜水装备', 
                '古老的商人说：解开这个谜语就给你潜水装备。\n"白天是绳子，晚上是银河，天亮时不见。"',
                async (answer) => answer === '月光' || answer === '月亮'
            );
            
            if (result) {
                this.addToInventory('潜水装备');
                this.showMessage('你获得了潜水装备！');
            } else {
                return;
            }
        }

        await this.showProgress('正在潜入古井...', 5000);
        const wellItems = ['珍珠', '玉佩', '古币', '宝石戒指'];
        const randomItem = wellItems[Math.floor(Math.random() * wellItems.length)];
        this.addToInventory(randomItem);
        this.showMessage(`在井底，你找到了${randomItem}！`, 3000);
        return `打捞到：${randomItem}`;
    }
}

// 创建全局游戏实例
window.game = new Game(); 

// 移除页面点击事件监听器，只保留游戏实例创建
window.game = new Game();

// 移除 DOMContentLoaded 事件监听器中的音频相关代码
document.addEventListener('DOMContentLoaded', () => {
    const playerDetails = document.getElementById('player-details');
    playerDetails.innerHTML = `
        <p>ID: ${game.playerInfo.id}</p>
        <p>昵称: ${game.playerInfo.nickname}</p>
    `;
    
    function updateHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = game.playerInfo.history
            .map(h => `<div>${new Date(h.timestamp).toLocaleString()} - ${h.action}</div>`)
            .join('');
    }
    updateHistory();
}); 