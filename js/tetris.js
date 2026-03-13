/**
 * @fileoverview 俄罗斯方块游戏 - 核心逻辑控制器
 * 
 * @description
 * 一个功能完整的俄罗斯方块游戏实现，支持桌面端和移动端。
 * 采用面向对象架构，使用 Canvas 2D 进行渲染，requestAnimationFrame 实现流畅动画。
 * 
 * @architecture
 * - TetrisGame 类: 游戏主控制器，管理游戏状态和逻辑
 * - 游戏循环: requestAnimationFrame 实现 60fps 流畅体验
 * - 渲染系统: Canvas 2D 绘制 + 离屏渲染优化性能
 * - 输入处理: 键盘事件 + 触摸滑动 + 移动端方向按钮
 * - 动画系统: 消除行时的缩放渐隐动画效果
 * - 移动端优化: 无延迟触摸 + 长按连击 + 触觉反馈
 * 
 * @gameMechanics
 * - 标准 10列 x 20行 游戏板
 * - 7种经典方块（I、O、T、S、Z、J、L）
 * - 踢墙系统（Wall Kick）：旋转时自动调整位置
 * - 等级系统：最高10级，速度递增
 * - 得分系统：消除得分 + 软降/硬降奖励
 * - 阴影提示：预览落点位置（随等级消失）
 * 
 * @coordinateSystem
 * - 游戏板: 10列 x 20行（标准尺寸）
 * - 方块大小: 25px
 * - 画布尺寸: 250px x 500px（桌面端固定）
 * - 移动端画布: 自适应宽度，保持1:2比例
 * 
 * @performanceOptimization
 * - 离屏 Canvas 预渲染静态网格
 * - imageSmoothingEnabled = false 确保像素清晰
 * - 整数坐标绘制避免子像素模糊
 * - desynchronized: true 减少渲染延迟
 * 
 * @author 游戏开发团队
 * @version 1.4.0
 * @since 2026-03-13
 * @license MIT
 */

/**
 * 游戏配置常量
 * 集中管理所有可配置的游戏参数
 * @readonly
 */
const TETRIS_CONFIG = {
    // ========== 游戏板配置 ==========
    COLS: 10,
    ROWS: 24,
    BLOCK_SIZE: 25,
    
    // ========== 画布尺寸 ==========
    CANVAS_WIDTH: 250,
    CANVAS_HEIGHT: 600,
    
    // ========== 游戏循环配置 ==========
    INITIAL_DROP_INTERVAL: 1000,
    MIN_DROP_INTERVAL: 100,
    DROP_INTERVAL_DECREMENT: 100,
    
    // ========== 等级系统 ==========
    MAX_LEVEL: 10,
    LINES_PER_LEVEL: 10,
    
    // ========== 得分系统 ==========
    BASE_SCORES: [0, 100, 300, 600, 1000],
    BONUS_SCORES: [0, 0, 100, 300, 600],
    
    // ========== 阴影提示配置 ==========
    SHADOW_MAX_LEVEL: 2,
    SHADOW_ALPHA_LEVEL1: 0.3,
    SHADOW_ALPHA_LEVEL2: 0.15,
    
    // ========== 动画配置 ==========
    CLEAR_ANIMATION_SPEED: 2,
    
    // ========== 移动端控制配置 ==========
    LONG_PRESS_DELAY: 200,
    REPEAT_INTERVAL: 80,
    MIN_SWIPE_DISTANCE: 30,
    
    // ========== 音效配置 ==========
    AUDIO_VOLUME: 0.3
};

class TetrisGame {
    /**
     * 构造函数 - 初始化游戏实例
     * 配置画布、初始化游戏状态、绑定事件
     * @constructor
     */
    constructor() {
        const cfg = TETRIS_CONFIG;
        
        // ========== 画布配置 ==========
        /** @type {HTMLCanvasElement} 游戏主画布 */
        this.canvas = document.getElementById('gameCanvas');
        /** @type {CanvasRenderingContext2D} 主画布2D上下文 */
        this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
        
        // 设置画布尺寸
        this.canvas.width = cfg.CANVAS_WIDTH;
        this.canvas.height = cfg.CANVAS_HEIGHT;
        
        // 禁用图像平滑以保持像素清晰
        this.ctx.imageSmoothingEnabled = false;
        
        /** @type {HTMLCanvasElement} 下一个方块预览画布（桌面端） */
        this.nextCanvas = document.getElementById('nextCanvas');
        /** @type {CanvasRenderingContext2D} 预览画布上下文 */
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // ========== 离屏渲染画布（性能优化） ==========
        /** @type {HTMLCanvasElement} 离屏画布，用于预渲染静态元素 */
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = cfg.CANVAS_WIDTH;
        this.offscreenCanvas.height = cfg.CANVAS_HEIGHT;
        /** @type {CanvasRenderingContext2D} 离屏画布上下文 */
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: true });
        this.offscreenCtx.imageSmoothingEnabled = false;
        
        // ========== 游戏板配置 ==========
        /** @type {number} 游戏板列数 */
        this.cols = cfg.COLS;
        /** @type {number} 游戏板行数 */
        this.rows = cfg.ROWS;
        /** @type {number} 方块大小（像素） */
        this.blockSize = cfg.BLOCK_SIZE;
        
        // ========== 游戏状态 ==========
        /** @type {(string|0)[][]} 游戏板二维数组，0表示空，字符串表示颜色 */
        this.board = [];
        /** @type {Object|null} 当前下落的方块对象 */
        this.currentPiece = null;
        /** @type {Object|null} 下一个方块对象（用于预览） */
        this.nextPiece = null;
        /** @type {number} 当前得分 */
        this.score = 0;
        /** @type {number} 当前等级（1-10） */
        this.level = 1;
        /** @type {number} 已消除行数 */
        this.lines = 0;
        /** @type {number} 最高分记录 */
        this.highScore = this.loadHighScore();
        
        // ========== 音效管理器 ==========
        /** @type {AudioManager} 音效管理器实例 */
        this.audio = new AudioManager();
        
        // ========== 游戏循环状态 ==========
        /** @type {number|null} requestAnimationFrame ID */
        this.gameLoop = null;
        /** @type {boolean} 游戏是否进行中 */
        this.isRunning = false;
        /** @type {boolean} 游戏是否暂停 */
        this.isPaused = false;
        /** @type {number} 下落计时器（毫秒） */
        this.dropCounter = 0;
        /** @type {number} 当前下落间隔（毫秒） */
        this.dropInterval = cfg.INITIAL_DROP_INTERVAL;
        /** @type {number} 上一帧时间戳 */
        this.lastTime = 0;
        
        // ========== 消除动画状态 ==========
        /** @type {number[]} 正在播放消除动画的行索引 */
        this.clearingLines = [];
        /** @type {number} 消除动画进度（0.0 - 1.0） */
        this.clearAnimationProgress = 0;
        /** @type {boolean} 是否正在播放消除动画 */
        this.isClearing = false;
        
        // ========== 方块形状定义 ==========
        /**
         * 7种经典俄罗斯方块定义
         * @type {Object.<string, {shape: number[][], color: string}>}
         */
        this.pieces = {
            I: { shape: [[1, 1, 1, 1]], color: '#00f0f0' },      // 长条 - 青色
            O: { shape: [[1, 1], [1, 1]], color: '#f0f000' },     // 正方形 - 黄色
            T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' }, // T形 - 紫色
            S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' }, // S形 - 绿色
            Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' }, // Z形 - 红色
            J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' }, // J形 - 蓝色
            L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' }  // L形 - 橙色
        };
        
        /** @type {string[]} 方块类型名称数组 */
        this.pieceNames = Object.keys(this.pieces);
        
        // 初始化游戏
        this.init();
    }
    
    /**
     * 初始化游戏 - 设置初始状态
     */
    init() {
        this.createBoard();      // 创建空游戏板
        this.renderStaticGrid(); // 预渲染静态网格
        this.bindEvents();       // 绑定键盘和触摸事件
        this.detectOrientation(); // 设置横屏检测
        this.draw();             // 绘制初始画面
        this.updateUI();         // 更新UI显示最高分
    }
    
    /**
     * 预渲染静态网格到离屏Canvas
     * 避免每帧重复绘制网格线，提升性能
     * 使用整数坐标确保线条清晰锐利
     */
    renderStaticGrid() {
        const ctx = this.offscreenCtx;
        const cfg = TETRIS_CONFIG;
        
        // 清空离屏画布
        ctx.clearRect(0, 0, cfg.CANVAS_WIDTH, cfg.CANVAS_HEIGHT);
        
        // 绘制网格线 - 使用0.5偏移确保1px线条清晰
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.cols; x++) {
            const px = Math.floor(x * this.blockSize) + 0.5;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, cfg.CANVAS_HEIGHT);
            ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.rows; y++) {
            const py = Math.floor(y * this.blockSize) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(cfg.CANVAS_WIDTH, py);
            ctx.stroke();
        }
    }
    
    /**
     * 从本地存储加载最高分
     * @returns {number} 最高分
     */
    loadHighScore() {
        try {
            const saved = localStorage.getItem('tetrisHighScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            return 0;
        }
    }
    
    /**
     * 保存最高分到本地存储
     * @param {number} score - 分数
     */
    saveHighScore(score) {
        try {
            localStorage.setItem('tetrisHighScore', score.toString());
        } catch (e) {
            console.warn('Failed to save high score:', e);
        }
    }
    
    /**
     * 检测屏幕方向 - 移动端横屏时暂停游戏
     * 本游戏设计为竖屏游玩，横屏时显示提示
     */
    detectOrientation() {
        const checkOrientation = () => {
            const isLandscape = window.innerWidth > window.innerHeight;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isLandscape && isMobile && window.innerHeight < 500) {
                // 横屏状态，暂停游戏并显示提示
                if (this.isRunning && !this.isPaused) {
                    this.wasPausedByOrientation = true;
                    this.togglePause();
                }
                document.getElementById('orientationModal').classList.remove('hidden');
            } else {
                // 竖屏状态，恢复游戏
                document.getElementById('orientationModal').classList.add('hidden');
                if (this.wasPausedByOrientation && this.isPaused) {
                    this.wasPausedByOrientation = false;
                    this.togglePause();
                }
            }
        };
        
        // 监听方向变化
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);
        
        // 初始检测
        checkOrientation();
    }
    
    /**
     * 创建游戏板 - 初始化二维数组
     * board[y][x] = 0 表示空，= 颜色值表示有方块
     */
    createBoard() {
        this.board = Array(this.rows).fill(null).map(() => 
            Array(this.cols).fill(0)
        );
    }
    
    /**
     * 绑定事件 - 键盘、按钮、触摸控制
     */
    bindEvents() {
        // ========== 键盘控制 ==========
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // ========== 按钮控制 ==========
        document.getElementById('startBtn').addEventListener('click', () => {
            this.audio.playButtonClick();
            this.start();
        });
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.audio.playButtonClick();
            this.togglePause();
        });
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.audio.playButtonClick();
            this.restart();
        });
        
        // 音效开关按钮
        const muteBtn = document.getElementById('muteBtn');
        const headerMuteBtn = document.getElementById('headerMuteBtn');
        
        const updateMuteButtons = (isEnabled) => {
            const newText = isEnabled ? '🔊' : '🔇';
            if (muteBtn) muteBtn.textContent = newText;
            if (headerMuteBtn) {
                headerMuteBtn.textContent = newText;
                headerMuteBtn.classList.toggle('muted', !isEnabled);
            }
        };
        
        if (muteBtn) {
            muteBtn.addEventListener('click', () => updateMuteButtons(this.audio.toggle()));
        }
        
        if (headerMuteBtn) {
            headerMuteBtn.addEventListener('click', () => updateMuteButtons(this.audio.toggle()));
        }
        
        // 已消除旁边的开始/暂停按钮（移动端）
        const mobileStartBtn = document.getElementById('mobileStartBtn');
        if (mobileStartBtn) {
            mobileStartBtn.addEventListener('click', () => {
                this.audio.playButtonClick();
                if (!this.isRunning) {
                    this.start();
                } else {
                    this.togglePause();
                }
            });
        }
        
        // ========== 移动端按钮控制 - 使用touchstart消除300ms延迟 ==========
        this.setupMobileButton('leftBtn', () => this.move(-1));
        this.setupMobileButton('rightBtn', () => this.move(1));
        this.setupMobileButton('rotateBtn', () => this.rotate());
        
        // 下落按钮 - 支持单击下落一格和长按持续快速下落
        this.setupDropButton();
        
        // ========== 触摸滑动控制 ==========
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, {passive: true});
        
        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isRunning || this.isPaused) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            
            const cfg = TETRIS_CONFIG;
            const minSwipe = cfg.MIN_SWIPE_DISTANCE;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // 水平滑动 - 左右移动
                if (Math.abs(dx) > minSwipe) {
                    this.move(dx > 0 ? 1 : -1);
                }
            } else {
                // 垂直滑动 - 下落或旋转
                if (dy > minSwipe) {
                    this.drop();      // 向下滑 - 下落
                } else if (dy < -minSwipe) {
                    this.rotate();    // 向上滑 - 旋转
                }
            }
        }, {passive: true});
        
        // ========== 防止双击缩放 ==========
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, {passive: false});
    }
    
    /**
     * 设置移动端按钮 - 支持无延迟触摸和长按连续操作
     * @param {string} btnId - 按钮ID
     * @param {Function} action - 执行的动作函数
     */
    setupMobileButton(btnId, action) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const cfg = TETRIS_CONFIG;
        let touchStarted = false;
        let longPressTimer = null;
        let repeatTimer = null;
        
        // 执行动作并添加触觉反馈
        const doAction = () => {
            if (this.isRunning && !this.isPaused) {
                action();
                // 添加触觉反馈（如果设备支持）
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
            }
        };
        
        // 播放对应音效
        const playSound = () => {
            if (!this.isRunning || this.isPaused) return;
            switch(btnId) {
                case 'leftBtn':
                case 'rightBtn':
                    this.audio.playMove();
                    break;
                case 'rotateBtn':
                    this.audio.playRotate();
                    break;
                case 'dropBtn':
                    this.audio.playDrop();
                    break;
            }
        };
        
        const startRepeat = () => {
            if (btnId === 'leftBtn' || btnId === 'rightBtn') {
                btn.classList.add('pressing');
                repeatTimer = setInterval(doAction, cfg.REPEAT_INTERVAL);
            }
        };
        
        const clearTimers = () => {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
            btn.classList.remove('pressing');
        };
        
        const onTouchStart = (e) => {
            e.preventDefault();
            touchStarted = true;
            doAction();
            playSound();
            longPressTimer = setTimeout(startRepeat, cfg.LONG_PRESS_DELAY);
        };
        
        const onTouchEnd = (e) => {
            e.preventDefault();
            touchStarted = false;
            clearTimers();
        };
        
        btn.addEventListener('touchstart', onTouchStart, {passive: false});
        btn.addEventListener('touchend', onTouchEnd);
        btn.addEventListener('touchcancel', () => { touchStarted = false; clearTimers(); });
        
        btn.addEventListener('mousedown', () => {
            if (!touchStarted) { doAction(); playSound(); longPressTimer = setTimeout(startRepeat, cfg.LONG_PRESS_DELAY); }
        });
        btn.addEventListener('mouseup', clearTimers);
        btn.addEventListener('mouseleave', clearTimers);
    }
    
    /**
     * 设置加速下落按钮 - 支持单击下落一格和长按持续快速下落
     */
    setupDropButton() {
        const btn = document.getElementById('dropBtn');
        if (!btn) return;
        
        const cfg = TETRIS_CONFIG;
        let touchStarted = false;
        let longPressTimer = null;
        let repeatTimer = null;
        
        const doDrop = () => {
            if (this.isRunning && !this.isPaused) {
                this.drop();
                this.audio.playDrop();
            }
        };
        
        const startRepeat = () => {
            btn.classList.add('pressing');
            repeatTimer = setInterval(doDrop, cfg.REPEAT_INTERVAL);
        };
        
        const clearTimers = () => {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
            btn.classList.remove('pressing');
        };
        
        const onTouchStart = (e) => {
            e.preventDefault();
            touchStarted = true;
            doDrop();
            longPressTimer = setTimeout(startRepeat, cfg.LONG_PRESS_DELAY);
        };
        
        const onTouchEnd = (e) => {
            e.preventDefault();
            touchStarted = false;
            clearTimers();
        };
        
        btn.addEventListener('touchstart', onTouchStart, {passive: false});
        btn.addEventListener('touchend', onTouchEnd);
        btn.addEventListener('touchcancel', () => { touchStarted = false; clearTimers(); });
        
        btn.addEventListener('mousedown', () => {
            if (!touchStarted) { doDrop(); longPressTimer = setTimeout(startRepeat, cfg.LONG_PRESS_DELAY); }
        });
        btn.addEventListener('mouseup', clearTimers);
        btn.addEventListener('mouseleave', clearTimers);
    }
    
    /**
     * 处理键盘按键事件
     * @param {KeyboardEvent} e - 键盘事件对象
     */
    handleKeydown(e) {
        // 游戏未开始时，回车键开始游戏
        if (!this.isRunning) {
            if (e.keyCode === 13 || e.key === 'Enter') {
                this.start();
            }
            return;
        }
        
        // 空格键暂停/继续
        if (e.key === ' ' || e.keyCode === 32) {
            e.preventDefault();
            this.togglePause();
            return;
        }
        
        // 暂停状态下不响应其他按键
        if (this.isPaused) return;
        
        // 方向键和 WASD 控制
        switch(e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.move(-1);  // 左移
                this.audio.playMove();
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.move(1);   // 右移
                this.audio.playMove();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.drop();    // 加速下落
                this.audio.playDrop();
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.rotate();  // 旋转
                this.audio.playRotate();
                break;
        }
    }
    
    /**
     * 生成随机方块
     * @returns {Object} 方块对象，包含 shape(形状数组)、color(颜色)、x/y(位置)
     */
    randomPiece() {
        const name = this.pieceNames[Math.floor(Math.random() * this.pieceNames.length)]
        const piece = this.pieces[name];
        return {
            shape: piece.shape.map(row => [...row]),  // 深拷贝形状数组
            color: piece.color,
            x: Math.floor(this.cols / 2) - Math.floor(piece.shape[0].length / 2),  // 水平居中
            y: 0  // 从顶部开始
        };
    }
    
    /**
     * 旋转当前方块
     * 使用矩阵转置算法：new[y][x] = old[x][height-1-y]
     * 支持基础踢墙（Wall Kick）：旋转后碰撞时尝试左右移动适应
     */
    rotate() {
        if (!this.currentPiece || this.isPaused) return;
        
        // 计算旋转后的形状（顺时针90度）
        const rotated = this.currentPiece.shape[0].map((_, i) =>
            this.currentPiece.shape.map(row => row[i]).reverse()
        );
        
        const previousShape = this.currentPiece.shape;
        const previousX = this.currentPiece.x;
        this.currentPiece.shape = rotated;
        
        // 基础踢墙系统：尝试不同偏移量来适应旋转
        // 偏移顺序：0（原位）、左1、右1、左2、右2、上移1（针对I方块）
        const kicks = [0, -1, 1, -2, 2];
        let kickSuccess = false;
        
        for (const kick of kicks) {
            this.currentPiece.x = previousX + kick;
            if (!this.collision()) {
                kickSuccess = true;
                break;
            }
        }
        
        // 如果水平踢墙都失败，尝试上移（针对I方块顶部旋转）
        if (!kickSuccess) {
            this.currentPiece.x = previousX;
            this.currentPiece.y -= 1;
            if (!this.collision()) {
                kickSuccess = true;
            } else {
                this.currentPiece.y += 1; // 回退上移
            }
        }
        
        // 如果所有踢墙都失败，恢复原状态
        if (!kickSuccess) {
            this.currentPiece.shape = previousShape;
            this.currentPiece.x = previousX;
        }
        
        this.draw();
    }
    
    /**
     * 左右移动方块
     * @param {number} dir - 移动方向：-1 左移，1 右移
     */
    move(dir) {
        if (!this.currentPiece || this.isPaused) return;
        
        const oldX = this.currentPiece.x;
        this.currentPiece.x += dir;
        
        // 如果移动后碰撞，则回退
        if (this.collision()) {
            this.currentPiece.x = oldX;
        }
        
        this.draw();
    }
    
    /**
     * 下落一格（软降）
     * 如果下落到底部或碰到其他方块，则固定并生成新方块
     */
    drop() {
        if (!this.currentPiece || this.isPaused) return;
        
        this.currentPiece.y++;
        
        // 检测碰撞
        if (this.collision()) {
            this.currentPiece.y--;  // 回退一格
            this.merge();           // 固定到游戏板
            this.clearLines();      // 检测消除
            this.spawnPiece();      // 生成新方块
        }
        
        this.dropCounter = 0;  // 重置下落计时器
        this.draw();
    }
    
    /**
     * 快速下落（硬降）- 直接落到最底部
     */
    hardDrop() {
        if (!this.currentPiece || this.isPaused) return;
        
        // 计算可下落的距离
        let dropDistance = 0;
        while (!this.collision(this.currentPiece.x, this.currentPiece.y + dropDistance + 1)) {
            dropDistance++;
        }
        
        // 直接移动到底部
        this.currentPiece.y += dropDistance;
        this.score += dropDistance * 2; // 硬降得分
        
        this.merge();
        this.clearLines();
        this.spawnPiece();
        this.dropCounter = 0;
        this.draw();
    }
    

    
    /**
     * 检测碰撞（通用版）
     * @param {number} [testX] - 测试的 X 坐标（默认为当前方块X）
     * @param {number} [testY] - 测试的 Y 坐标（默认为当前方块Y）
     * @param {number[][]} [shape] - 测试的形状（默认为当前方块形状）
     * @returns {boolean} true 表示会发生碰撞
     */
    collision(testX, testY, shape) {
        const piece = this.currentPiece;
        const x = testX !== undefined ? testX : piece.x;
        const y = testY !== undefined ? testY : piece.y;
        const s = shape || piece.shape;
        
        for (let row = 0; row < s.length; row++) {
            for (let col = 0; col < s[row].length; col++) {
                if (s[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) {
                        return true;
                    }
                    
                    if (boardY >= 0 && this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    /**
     * 检测阴影碰撞 - 用于计算落点位置
     * @param {number} testY - 测试的 Y 坐标
     * @returns {boolean} true 表示会发生碰撞
     */
    checkShadowCollision(testY) {
        return this.collision(this.currentPiece.x, testY, this.currentPiece.shape);
    }
    
    /**
     * 合并方块到游戏板
     * 将当前方块固定到游戏板上
     */
    merge() {
        const piece = this.currentPiece;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const boardY = piece.y + y;
                    if (boardY >= 0) {
                        this.board[boardY][piece.x + x] = piece.color;
                    }
                }
            }
        }
    }
    
    /**
     * 消除完整行
     * 检测并消除填满的行，播放消除动画
     */
    clearLines() {
        const linesToClear = [];
        
        // 找出所有需要消除的行（从底部向上检测）
        for (let y = this.rows - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
            }
        }
        
        if (linesToClear.length > 0) {
            // 开始消除动画
            this.clearingLines = linesToClear;
            this.clearAnimationProgress = 0;
            this.isClearing = true;
            
            // 播放消除音效
            this.audio.playClear(linesToClear.length);
            
            // 更新游戏数据
            const cfg = TETRIS_CONFIG;
            this.lines += linesToClear.length;
            const oldLevel = this.level;
            this.score += this.calculateScore(linesToClear.length);
            this.level = Math.floor(this.lines / cfg.LINES_PER_LEVEL) + 1;
            // 等级上限
            this.level = Math.min(this.level, cfg.MAX_LEVEL);
            
            // 播放升级音效
            if (this.level > oldLevel) {
                this.audio.playLevelUp();
            }
            
            // 计算新的下落间隔
            this.dropInterval = Math.max(
                cfg.MIN_DROP_INTERVAL, 
                cfg.INITIAL_DROP_INTERVAL - (this.level - 1) * cfg.DROP_INTERVAL_DECREMENT
            );
            
            this.updateUI();
        }
    }
    
    /**
     * 更新消除动画
     * 每帧更新动画进度，动画完成后真正移除行
     * @param {number} deltaTime - 距离上一帧的时间（毫秒）
     */
    updateClearAnimation(deltaTime) {
        if (!this.isClearing) return;
        
        const cfg = TETRIS_CONFIG;
        this.clearAnimationProgress += deltaTime / 1000 * cfg.CLEAR_ANIMATION_SPEED;
        
        if (this.clearAnimationProgress >= 1) {
            // 动画完成，真正消除行
            this.clearingLines.sort((a, b) => b - a); // 从大到小排序，避免索引错乱
            for (const y of this.clearingLines) {
                this.board.splice(y, 1);                    // 删除该行
                this.board.unshift(Array(this.cols).fill(0)); // 顶部添加新空行
            }
            this.clearingLines = [];
            this.clearAnimationProgress = 0;
            this.isClearing = false;
        }
    }
    
    /**
     * 计算消除得分
     * 基础分 + 多行消除奖励分，再乘以当前等级
     * @param {number} lines - 同时消除的行数（1-4）
     * @returns {number} 得分
     */
    calculateScore(lines) {
        const cfg = TETRIS_CONFIG;
        const baseScore = cfg.BASE_SCORES[lines];
        const bonusScore = cfg.BONUS_SCORES[lines];
        return (baseScore + bonusScore) * this.level;
    }
    
    /**
     * 生成新方块
     * 将 nextPiece 设为当前方块，并生成新的 nextPiece
     */
    spawnPiece() {
        this.currentPiece = this.nextPiece || this.randomPiece();
        this.nextPiece = this.randomPiece();
        
        // 检查游戏结束（新方块生成即碰撞）
        if (this.collision()) {
            this.gameOver();
            return;
        }
        
        this.drawNext();  // 更新下一个方块预览
    }
    
    /**
     * 开始游戏
     * 重置所有状态并开始游戏循环
     */
    start() {
        if (this.isRunning) return;
        
        const cfg = TETRIS_CONFIG;
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = cfg.INITIAL_DROP_INTERVAL;
        this.createBoard();
        this.spawnPiece();
        this.updateUI();
        
        // 使用透明度变化代替文字变化，避免布局闪烁
        const startBtn = document.getElementById('startBtn');
        startBtn.style.opacity = '0.6';
        startBtn.style.cursor = 'not-allowed';
        startBtn.disabled = true;
        
        // 更新移动端开始按钮状态
        this.updateStartBtnState('暂停', false);
        
        document.getElementById('gameOverModal').classList.add('hidden');
        
        this.lastTime = performance.now();
        this.gameLoop = requestAnimationFrame((time) => this.update(time));
    }
    
    /**
     * 暂停/继续游戏
     */
    togglePause() {
        if (!this.isRunning) return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.drawPauseScreen();
            document.getElementById('pauseBtn').textContent = '继续';
            this.updateStartBtnState('继续', true);
        } else {
            document.getElementById('pauseBtn').textContent = '暂停';
            this.updateStartBtnState('暂停', false);
            this.lastTime = performance.now();
            this.gameLoop = requestAnimationFrame((time) => this.update(time));
        }
    }
    
    /**
     * 游戏结束
     */
    gameOver() {
        this.isRunning = false;
        cancelAnimationFrame(this.gameLoop);
        
        // 播放游戏结束音效
        this.audio.playGameOver();
        
        // 更新最高分
        let isNewRecord = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore(this.highScore);
            isNewRecord = true;
        }
        
        // 显示最终统计
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLines').textContent = this.lines;
        document.getElementById('finalLevel').textContent = this.level;
        
        // 添加新纪录标识
        const gameOverModal = document.getElementById('gameOverModal');
        let newRecordHtml = '';
        if (isNewRecord) {
            newRecordHtml = '<p class="new-record">🏆 新纪录!</p>';
        }
        
        // 更新游戏结束界面内容
        gameOverModal.innerHTML = `
            <h2>游戏结束</h2>
            <p>最终得分: <span id="finalScore">${this.score}</span></p>
            <p>消除行数: <span id="finalLines">${this.lines}</span></p>
            <p>最高等级: <span id="finalLevel">${this.level}</span></p>
            ${newRecordHtml}
            <button id="restartBtn">重新开始</button>
        `;
        
        // 重新绑定重新开始按钮事件
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.audio.playButtonClick();
            this.restart();
        });
        
        gameOverModal.classList.remove('hidden');
        // 恢复开始按钮状态
        const startBtn = document.getElementById('startBtn');
        startBtn.style.opacity = '1';
        startBtn.style.cursor = 'pointer';
        startBtn.disabled = false;
        
        // 重置移动端开始按钮状态
        this.updateStartBtnState('开始', false);
        
        // 更新最高分显示
        this.updateUI();
    }
    
    /**
     * 重新开始游戏
     */
    restart() {
        document.getElementById('gameOverModal').classList.add('hidden');
        this.start();
    }
    
    /**
     * 更新开始按钮状态
     * @param {string} text - 按钮文字
     * @param {boolean} isPaused - 是否暂停状态
     */
    updateStartBtnState(text, isPaused) {
        const mobileStartBtn = document.getElementById('mobileStartBtn');
        const headerStartBtn = document.querySelector('.header-start-btn');
        
        [mobileStartBtn, headerStartBtn].forEach(btn => {
            if (btn) {
                btn.textContent = text;
                btn.classList.toggle('paused', isPaused);
            }
        });
    }
    
    /**
     * 更新UI显示
     * 更新桌面端和移动端的分数、等级、消除行数显示
     */
    updateUI() {
        const linesText = this.lines > 99 ? '99+' : this.lines;
        
        // 桌面端
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = linesText;
        
        // 移动端
        const mobileScore = document.getElementById('mobileScore');
        const mobileLevel = document.getElementById('mobileLevel');
        const mobileLines = document.getElementById('mobileLines');
        if (mobileScore) mobileScore.textContent = this.score;
        if (mobileLevel) mobileLevel.textContent = this.level;
        if (mobileLines) mobileLines.textContent = linesText;
        
        // 更新最高分显示
        document.querySelectorAll('.high-score').forEach(el => {
            el.textContent = this.highScore;
        });
    }
    
    /**
     * 游戏主循环
     * 使用 requestAnimationFrame 实现 60fps 流畅动画
     * @param {number} time - 当前时间戳（毫秒）
     */
    update(time = 0) {
        if (!this.isRunning || this.isPaused) return;
        
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        
        // 如果正在播放消除动画，优先处理动画
        if (this.isClearing) {
            this.updateClearAnimation(deltaTime);
            this.draw();
            this.gameLoop = requestAnimationFrame((time) => this.update(time));
            return;
        }
        
        // 自动下落
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.drop();
        }
        
        this.draw();
        this.gameLoop = requestAnimationFrame((time) => this.update(time));
    }
    
    /**
     * 绘制游戏画面
     * 绘制顺序：背景 -> 网格(离屏渲染) -> 已固定方块 -> 当前方块 -> 阴影
     */
    draw() {
        const cfg = TETRIS_CONFIG;
        
        // 清空画布
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, cfg.CANVAS_WIDTH, cfg.CANVAS_HEIGHT);
        
        // 绘制预渲染的网格（离屏渲染优化）
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
        
        // 绘制已固定的方块
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.board[y][x]) {
                    // 如果这一行正在消除，绘制动画效果
                    if (this.clearingLines.includes(y)) {
                        this.drawClearingBlock(x, y, this.board[y][x]);
                    } else {
                        this.drawBlock(x, y, this.board[y][x]);
                    }
                }
            }
        }
        
        // 绘制当前下落的方块
        if (this.currentPiece) {
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                    if (this.currentPiece.shape[y][x]) {
                        this.drawBlock(
                            this.currentPiece.x + x,
                            this.currentPiece.y + y,
                            this.currentPiece.color
                        );
                    }
                }
            }
            
            // 绘制落点阴影提示
            this.drawShadow();
        }
    }
    
    /**
     * 绘制暂停画面
     * 在保持当前游戏画面的基础上添加半透明遮罩和暂停文字
     */
    drawPauseScreen() {
        // 绘制当前游戏画面
        this.draw();
        
        // 添加半透明遮罩
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 计算居中坐标（使用整数坐标）
        const centerX = Math.floor(this.canvas.width / 2);
        const centerY = Math.floor(this.canvas.height / 2);
        
        // 绘制暂停文字
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = 'bold 40px Microsoft YaHei, Arial, sans-serif';
        
        // 文字发光效果 - 使用单层描边
        this.ctx.strokeStyle = '#00d9ff';
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';
        this.ctx.strokeText('已暂停', centerX, centerY);
        
        // 主文字
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('已暂停', centerX, centerY);
        
        // 绘制提示文字
        this.ctx.font = '14px Microsoft YaHei, Arial, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillText('点击继续游戏按钮恢复', centerX, centerY + 45);
    }
    

    
    /**
     * 绘制单个方块
     * 包含主体、高光、阴影三层效果
     * 使用整数坐标避免子像素模糊
     * @param {number} x - 游戏板 X 坐标（列）
     * @param {number} y - 游戏板 Y 坐标（行）
     * @param {string} color - 方块颜色
     */
    drawBlock(x, y, color) {
        // 使用整数坐标避免子像素模糊
        const px = Math.floor(x * this.blockSize);
        const py = Math.floor(y * this.blockSize);
        const size = this.blockSize - 2;
        const innerSize = Math.floor(size);
        
        // 1. 主体
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + 1, py + 1, innerSize, innerSize);
        
        // 2. 高光（左上角）- 使用整数坐标
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        const highlightSize = Math.max(2, Math.floor(innerSize * 0.15));
        this.ctx.fillRect(px + 1, py + 1, innerSize, highlightSize);
        this.ctx.fillRect(px + 1, py + 1, highlightSize, innerSize);
        
        // 3. 阴影（右下角）- 使用整数坐标
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        const shadowSize = Math.max(2, Math.floor(innerSize * 0.15));
        this.ctx.fillRect(px + 1, py + innerSize - shadowSize + 1, innerSize, shadowSize);
        this.ctx.fillRect(px + innerSize - shadowSize + 1, py + 1, shadowSize, innerSize);
        
        // 4. 内部边框增强清晰度
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px + 1.5, py + 1.5, innerSize - 1, innerSize - 1);
    }
    
    /**
     * 绘制正在消除的方块（带动画效果）
     * 动画效果：缩放 + 渐隐 + 发光 + 闪光
     * 使用整数坐标避免子像素模糊
     * @param {number} x - 游戏板 X 坐标
     * @param {number} y - 游戏板 Y 坐标
     * @param {string} color - 方块颜色
     */
    drawClearingBlock(x, y, color) {
        const px = Math.floor(x * this.blockSize);
        const py = Math.floor(y * this.blockSize);
        const size = this.blockSize - 2;
        const progress = this.clearAnimationProgress;
        
        // 计算动画参数
        const scale = 1 - progress * 0.3;
        const alpha = 1 - progress;
        const scaledSize = Math.floor(size * scale);
        const offset = Math.floor((size - scaledSize) / 2);
        
        // 发光效果（中间最亮）
        const glowIntensity = Math.sin(progress * Math.PI);
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = Math.floor(20 * glowIntensity);
        
        // 绘制主体（带透明度）
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + 1 + offset, py + 1 + offset, scaledSize, scaledSize);
        
        // 重置阴影和透明度
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        
        // 闪光效果（前半段）
        if (progress < 0.5) {
            const flashAlpha = (0.5 - progress) * 2;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.5})`;
            this.ctx.fillRect(px + 1 + offset, py + 1 + offset, scaledSize, scaledSize);
        }
    }
    
    /**
     * 绘制阴影（预览落点）
     * 显示方块最终落点位置，随等级提升逐渐消失
     * 使用整数坐标避免子像素模糊
     */
    drawShadow() {
        if (!this.currentPiece) return;
        
        const cfg = TETRIS_CONFIG;
        
        // 超过配置等级不显示阴影（增加难度）
        if (this.level > cfg.SHADOW_MAX_LEVEL) return;
        
        // 计算落点 Y 坐标
        let shadowY = this.currentPiece.y;
        while (!this.checkShadowCollision(shadowY + 1)) {
            shadowY++;
        }
        
        // 如果已经在底部则不绘制
        if (shadowY === this.currentPiece.y) return;
        
        // 根据等级计算透明度
        const shadowAlpha = this.level === 1 ? cfg.SHADOW_ALPHA_LEVEL1 : cfg.SHADOW_ALPHA_LEVEL2;
        
        // 绘制阴影方块 - 使用虚线边框代替填充，更清晰
        this.ctx.globalAlpha = shadowAlpha;
        const blockInnerSize = this.blockSize - 2;
        
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const px = Math.floor((this.currentPiece.x + x) * this.blockSize);
                    const py = Math.floor((shadowY + y) * this.blockSize);
                    
                    // 绘制虚线边框阴影
                    this.ctx.strokeStyle = this.currentPiece.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([4, 2]);
                    this.ctx.strokeRect(px + 2, py + 2, blockInnerSize - 2, blockInnerSize - 2);
                    
                    // 填充半透明内部
                    this.ctx.fillStyle = this.currentPiece.color;
                    this.ctx.fillRect(px + 4, py + 4, blockInnerSize - 6, blockInnerSize - 6);
                }
            }
        }
        
        // 重置绘制状态
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;
    }
    
    /**
     * 绘制下一个方块预览
     * 同时更新桌面端和移动端的预览画布
     */
    drawNext() {
        if (!this.nextPiece) return;
        
        // 桌面端预览（侧边栏）
        this.drawNextOnCanvas(this.nextCtx, this.nextCanvas, 25);
        
        // 移动端预览（信息栏）
        const mobileNextCanvas = document.getElementById('mobileNextCanvas');
        if (mobileNextCanvas) {
            const mobileCtx = mobileNextCanvas.getContext('2d');
            this.drawNextOnCanvas(mobileCtx, mobileNextCanvas, 12);
        }
    }
    
    /**
     * 在指定画布上绘制下一个方块
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {number} blockSize - 方块大小（像素）
     */
    drawNextOnCanvas(ctx, canvas, blockSize) {
        // 计算居中偏移量 - 使用整数坐标
        const offsetX = Math.floor((canvas.width - this.nextPiece.shape[0].length * blockSize) / 2);
        const offsetY = Math.floor((canvas.height - this.nextPiece.shape.length * blockSize) / 2);
        const innerSize = Math.floor(blockSize - 2);
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制方块
        for (let y = 0; y < this.nextPiece.shape.length; y++) {
            for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                if (this.nextPiece.shape[y][x]) {
                    const px = Math.floor(offsetX + x * blockSize);
                    const py = Math.floor(offsetY + y * blockSize);
                    
                    // 主体
                    ctx.fillStyle = this.nextPiece.color;
                    ctx.fillRect(px + 1, py + 1, innerSize, innerSize);
                    
                    // 高光
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    const highlightSize = Math.max(1, Math.floor(innerSize * 0.1));
                    ctx.fillRect(px + 1, py + 1, innerSize, highlightSize);
                    ctx.fillRect(px + 1, py + 1, highlightSize, innerSize);
                    
                    // 内部边框
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px + 1.5, py + 1.5, innerSize - 1, innerSize - 1);
                }
            }
        }
    }
}

// ========== 启动游戏 ==========
// 页面加载完成后创建游戏实例
window.onload = () => {
    new TetrisGame();
};
