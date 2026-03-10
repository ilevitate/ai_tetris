/**
 * 俄罗斯方块游戏 - 核心逻辑
 * 
 * 游戏架构:
 * - TetrisGame 类: 游戏主控制器
 * - 游戏循环: requestAnimationFrame 实现 60fps
 * - 渲染系统: Canvas 2D 绘制
 * - 输入处理: 键盘 + 触摸 + 按钮
 * - 动画系统: 消除行时的渐隐动画
 * 
 * 坐标系统:
 * - 游戏板: 15列 x 25行
 * - 方块大小: 20px
 * - 画布尺寸: 300px x 500px
 */

class TetrisGame {
    /**
     * 构造函数 - 初始化游戏状态和配置
     */
    constructor() {
        // ========== 画布配置 ==========
        // 游戏主画布 - 显示当前游戏状态
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 下一个方块预览画布 - 桌面端侧边显示
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // ========== 游戏配置 ==========
        this.cols = 15;       // 游戏板列数
        this.rows = 25;       // 游戏板行数
        this.blockSize = 20;  // 每个方块的像素大小
        
        // ========== 游戏状态 ==========
        this.board = [];          // 二维数组，存储已固定的方块颜色
        this.currentPiece = null; // 当前下落的方块对象
        this.nextPiece = null;    // 下一个方块对象（用于预览）
        this.score = 0;           // 当前得分
        this.level = 1;           // 当前等级（1-10）
        this.lines = 0;           // 已消除行数
        
        // ========== 游戏循环状态 ==========
        this.gameLoop = null;      // requestAnimationFrame ID
        this.isRunning = false;    // 游戏是否进行中
        this.isPaused = false;     // 游戏是否暂停
        this.dropCounter = 0;      // 下落计时器（毫秒）
        this.dropInterval = 1000;  // 下落间隔（随等级减少）
        this.lastTime = 0;         // 上一帧时间戳
        
        // ========== 消除动画状态 ==========
        this.clearingLines = [];        // 正在播放消除动画的行索引
        this.clearAnimationProgress = 0; // 动画进度 0.0 - 1.0
        this.isClearing = false;        // 是否正在播放消除动画
        
        // ========== 方块形状定义 ==========
        // 7种经典俄罗斯方块形状和颜色
        this.pieces = {
            I: {
                shape: [[1, 1, 1, 1]],  // 长条
                color: '#00f0f0'         // 青色
            },
            O: {
                shape: [[1, 1], [1, 1]], // 正方形
                color: '#f0f000'          // 黄色
            },
            T: {
                shape: [[0, 1, 0], [1, 1, 1]], // T形
                color: '#a000f0'                // 紫色
            },
            S: {
                shape: [[0, 1, 1], [1, 1, 0]], // S形
                color: '#00f000'                // 绿色
            },
            Z: {
                shape: [[1, 1, 0], [0, 1, 1]], // Z形
                color: '#f00000'                // 红色
            },
            J: {
                shape: [[1, 0, 0], [1, 1, 1]], // J形
                color: '#0000f0'                // 蓝色
            },
            L: {
                shape: [[0, 0, 1], [1, 1, 1]], // L形
                color: '#f0a000'                // 橙色
            }
        };
        
        this.pieceNames = Object.keys(this.pieces);
        
        // 初始化游戏
        this.init();
    }
    
    /**
     * 初始化游戏 - 设置初始状态
     */
    init() {
        this.createBoard();      // 创建空游戏板
        this.bindEvents();       // 绑定键盘和触摸事件
        this.detectOrientation(); // 设置横屏检测
        this.draw();             // 绘制初始画面
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
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        
        // ========== 移动端按钮控制 ==========
        document.getElementById('leftBtn').addEventListener('click', () => this.move(-1));
        document.getElementById('rightBtn').addEventListener('click', () => this.move(1));
        document.getElementById('downBtn').addEventListener('click', () => this.drop());
        
        // 下键长按快速下落功能
        let dropInterval = null;
        const downBtn = document.getElementById('downBtn');
        
        const startFastDrop = () => {
            if (dropInterval) return;
            this.drop();
            dropInterval = setInterval(() => {
                if (this.isRunning && !this.isPaused) {
                    this.drop();
                }
            }, 100);
        };
        
        const stopFastDrop = () => {
            if (dropInterval) {
                clearInterval(dropInterval);
                dropInterval = null;
            }
        };
        
        // 鼠标事件（桌面端）
        downBtn.addEventListener('mousedown', startFastDrop);
        downBtn.addEventListener('mouseup', stopFastDrop);
        downBtn.addEventListener('mouseleave', stopFastDrop);
        // 触摸事件（移动端）
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startFastDrop();
        });
        downBtn.addEventListener('touchend', stopFastDrop);
        
        document.getElementById('rotateBtn').addEventListener('click', () => this.rotate());
        
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
            
            const minSwipe = 30;  // 最小滑动距离（像素）
            
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
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.move(1);   // 右移
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.drop();    // 加速下落
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.rotate();  // 旋转
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
     */
    rotate() {
        if (!this.currentPiece || this.isPaused) return;
        
        // 计算旋转后的形状（顺时针90度）
        const rotated = this.currentPiece.shape[0].map((_, i) =>
            this.currentPiece.shape.map(row => row[i]).reverse()
        );
        
        const previousShape = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        
        // 如果旋转后发生碰撞，则恢复原形状（防止旋转到墙内）
        if (this.collision()) {
            this.currentPiece.shape = previousShape;
        }
        
        this.draw();
    }
    
    /**
     * 左右移动方块
     * @param {number} dir - 移动方向：-1 左移，1 右移
     */
    move(dir) {
        if (!this.currentPiece || this.isPaused) return;
        
        this.currentPiece.x += dir;
        
        // 如果移动后碰撞，则回退
        if (this.collision()) {
            this.currentPiece.x -= dir;
        }
        
        this.draw();
    }
    
    /**
     * 下落一格
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
        
        // 一直下落直到碰撞
        while (!this.collision()) {
            this.currentPiece.y++;
        }
        
        this.currentPiece.y--;  // 回退到有效位置
        this.merge();
        this.clearLines();
        this.spawnPiece();
        this.dropCounter = 0;
        this.draw();
    }
    
    /**
     * 检测碰撞
     * 检查当前方块是否与墙壁或其他方块重叠
     * @returns {boolean} true 表示发生碰撞
     */
    collision() {
        const piece = this.currentPiece;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const boardX = piece.x + x;
                    const boardY = piece.y + y;
                    
                    // 检测墙壁碰撞
                    if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) {
                        return true;
                    }
                    
                    // 检测与其他方块碰撞（只检测游戏板内的部分）
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
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const boardX = this.currentPiece.x + x;
                    const boardY = testY + y;
                    
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
            
            // 更新游戏数据
            this.lines += linesToClear.length;
            this.score += this.calculateScore(linesToClear.length);
            this.level = Math.floor(this.lines / 10) + 1;
            // 等级上限为10级
            this.level = Math.min(this.level, 10);
            // 计算新的下落间隔（每升1级减少100ms，最低100ms）
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            
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
        
        // 动画速度：0.5秒内完成（speed = 2 表示每秒完成2次动画）
        const animationSpeed = 2;
        this.clearAnimationProgress += deltaTime / 1000 * animationSpeed;
        
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
     * @param {number} lines - 同时消除的行数（1-4）
     * @returns {number} 得分
     */
    calculateScore(lines) {
        // 连消奖励：1行100分，2行300分，3行600分，4行1000分
        const scores = [0, 100, 300, 600, 1000];
        return scores[lines] * this.level;  // 乘以当前等级
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
        
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        this.createBoard();
        this.spawnPiece();
        this.updateUI();
        
        document.getElementById('startBtn').textContent = '游戏中';
        document.getElementById('startBtn').disabled = true;
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
            document.getElementById('pauseModal').classList.remove('hidden');
            document.getElementById('pauseBtn').textContent = '继续';
        } else {
            document.getElementById('pauseModal').classList.add('hidden');
            document.getElementById('pauseBtn').textContent = '暂停';
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
        
        // 显示最终统计
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLines').textContent = this.lines;
        document.getElementById('finalLevel').textContent = this.level;
        document.getElementById('gameOverModal').classList.remove('hidden');
        document.getElementById('startBtn').textContent = '开始游戏';
        document.getElementById('startBtn').disabled = false;
    }
    
    /**
     * 重新开始游戏
     */
    restart() {
        document.getElementById('gameOverModal').classList.add('hidden');
        this.start();
    }
    
    /**
     * 更新UI显示
     * 更新桌面端和移动端的分数、等级、消除行数显示
     */
    updateUI() {
        // 桌面端
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        // 消除行数超过99显示"99+"
        document.getElementById('lines').textContent = this.lines > 99 ? '99+' : this.lines;
        
        // 移动端
        const mobileScore = document.getElementById('mobileScore');
        const mobileLevel = document.getElementById('mobileLevel');
        const mobileLines = document.getElementById('mobileLines');
        if (mobileScore) mobileScore.textContent = this.score;
        if (mobileLevel) mobileLevel.textContent = this.level;
        if (mobileLines) mobileLines.textContent = this.lines > 99 ? '99+' : this.lines;
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
     * 绘制顺序：背景 -> 网格 -> 已固定方块 -> 当前方块 -> 阴影
     */
    draw() {
        // 清空画布
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格线
        this.drawGrid();
        
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
     * 绘制网格线
     */
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.cols; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.blockSize, 0);
            this.ctx.lineTo(x * this.blockSize, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.rows; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.blockSize);
            this.ctx.lineTo(this.canvas.width, y * this.blockSize);
            this.ctx.stroke();
        }
    }
    
    /**
     * 绘制单个方块
     * 包含主体、高光、阴影三层效果
     * @param {number} x - 游戏板 X 坐标（列）
     * @param {number} y - 游戏板 Y 坐标（行）
     * @param {string} color - 方块颜色
     */
    drawBlock(x, y, color) {
        const px = x * this.blockSize;      // 像素 X 坐标
        const py = y * this.blockSize;      // 像素 Y 坐标
        const size = this.blockSize - 2;    // 方块大小（留出间隙）
        
        // 1. 主体
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + 1, py + 1, size, size);
        
        // 2. 高光（左上角）
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(px + 1, py + 1, size, 4);      // 顶部高光
        this.ctx.fillRect(px + 1, py + 1, 4, size);      // 左侧高光
        
        // 3. 阴影（右下角）
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(px + 1, py + size - 3, size, 4);   // 底部阴影
        this.ctx.fillRect(px + size - 3, py + 1, 4, size);   // 右侧阴影
    }
    
    /**
     * 绘制正在消除的方块（带动画效果）
     * 动画效果：缩放 + 渐隐 + 发光 + 闪光
     * @param {number} x - 游戏板 X 坐标
     * @param {number} y - 游戏板 Y 坐标
     * @param {string} color - 方块颜色
     */
    drawClearingBlock(x, y, color) {
        const px = x * this.blockSize;
        const py = y * this.blockSize;
        const size = this.blockSize - 2;
        const progress = this.clearAnimationProgress;  // 0.0 - 1.0
        
        // 计算动画参数
        const scale = 1 - progress * 0.3;        // 从 100% 缩小到 70%
        const alpha = 1 - progress;              // 从 100% 透明到 0%
        const offset = (1 - scale) * size / 2;   // 居中偏移量
        const scaledSize = size * scale;
        
        // 发光效果（中间最亮）
        const glowIntensity = Math.sin(progress * Math.PI);
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 20 * glowIntensity;
        
        // 绘制主体（带透明度）
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + 1 + offset, py + 1 + offset, scaledSize, scaledSize);
        
        // 重置阴影和透明度
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        
        // 闪光效果（前半段）
        if (progress < 0.5) {
            const flashAlpha = (0.5 - progress) * 2;  // 从 1 降到 0
            this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.5})`;
            this.ctx.fillRect(px + 1 + offset, py + 1 + offset, scaledSize, scaledSize);
        }
    }
    
    /**
     * 绘制阴影（预览落点）
     * 显示方块最终落点位置，随等级提升逐渐消失
     */
    drawShadow() {
        if (!this.currentPiece) return;
        
        // 3级及以上不显示阴影（增加难度）
        if (this.level >= 3) return;
        
        // 计算落点 Y 坐标
        let shadowY = this.currentPiece.y;
        while (!this.checkShadowCollision(shadowY + 1)) {
            shadowY++;
        }
        
        // 如果已经在底部则不绘制
        if (shadowY === this.currentPiece.y) return;
        
        // 根据等级计算透明度：1级30%，2级15%
        const shadowAlpha = this.level === 1 ? 0.3 : 0.15;
        
        // 绘制阴影方块
        this.ctx.globalAlpha = shadowAlpha;
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const px = (this.currentPiece.x + x) * this.blockSize;
                    const py = (shadowY + y) * this.blockSize;
                    this.ctx.fillStyle = this.currentPiece.color;
                    this.ctx.fillRect(px + 1, py + 1, this.blockSize - 2, this.blockSize - 2);
                }
            }
        }
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
            // 移动端使用更小的方块尺寸，60px画布适配4格方块
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
        // 计算居中偏移量
        const offsetX = (canvas.width - this.nextPiece.shape[0].length * blockSize) / 2;
        const offsetY = (canvas.height - this.nextPiece.shape.length * blockSize) / 2;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制方块
        for (let y = 0; y < this.nextPiece.shape.length; y++) {
            for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                if (this.nextPiece.shape[y][x]) {
                    const px = offsetX + x * blockSize;
                    const py = offsetY + y * blockSize;
                    
                    // 主体
                    ctx.fillStyle = this.nextPiece.color;
                    ctx.fillRect(px + 1, py + 1, blockSize - 2, blockSize - 2);
                    
                    // 高光
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.fillRect(px + 1, py + 1, blockSize - 2, 2);
                    ctx.fillRect(px + 1, py + 1, 2, blockSize - 2);
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
