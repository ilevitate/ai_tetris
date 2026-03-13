/**
 * @fileoverview 俄罗斯方块音效管理器
 * 
 * @description
 * 使用 Web Audio API 生成程序化音效，无需外部音频文件。
 * 支持7种不同音效，自动处理浏览器自动播放策略限制。
 * 
 * @features
 * - 程序化音效生成：使用振荡器实时合成音效
 * - 7种游戏音效：移动、旋转、下落、消除（1-4行递进）、升级、游戏结束
 * - 自动播放策略处理：自动恢复被暂停的音频上下文
 * - 音量控制：支持全局音量调节和静音切换
 * 
 * @soundDesign
 * | 音效 | 类型 | 频率特性 | 描述 |
 * |------|------|----------|------|
 * | move | 正弦波 | 400→200Hz | 短促点击声 |
 * | rotate | 方波 | 300→500Hz | 机械转动声 |
 * | drop | 三角波 | 200→100Hz | 下落风声 |
 * | clear | 正弦波和弦 | 440-880Hz | 递进式消除音效 |
 * | levelUp | 三角波 | C大调和弦 | 庆祝式上升音阶 |
 * | gameOver | 锯齿波 | 下降音阶 | 失败下降音效 |
 * 
 * @author 游戏开发团队
 * @version 1.1.0
 * @since 2026-03-13
 * @license MIT
 */

/**
 * 音效管理器类
 * 使用 Web Audio API 生成程序化音效
 * @class
 */
class AudioManager {
    /**
     * 构造函数
     */
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.3;
        
        this.init();
    }

    /**
     * 初始化音频上下文
     * @returns {boolean} 初始化是否成功
     */
    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        } catch (e) {
            this.enabled = false;
        }
    }

    /**
     * 恢复音频上下文
     * 解决浏览器自动播放策略限制
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * 播放移动音效
     * 短促的点击声
     */
    playMove() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.05);
    }

    /**
     * 播放旋转音效
     * 机械转动声
     */
    playRotate() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    /**
     * 播放下落音效
     * 短促的风声效果
     */
    playDrop() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.08);
    }

    /**
     * 播放消除音效
     * @param {number} lines - 消除行数（1-4）
     */
    playClear(lines) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // 根据消除行数选择音调
        const baseFreqs = { 1: 440, 2: 554, 3: 659, 4: 880 };
        const baseFreq = baseFreqs[lines] || 440;

        // 播放和弦
        const frequencies = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
        
        frequencies.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + index * 0.03);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + index * 0.03);
            gain.gain.linearRampToValueAtTime(this.volume * 0.5, this.ctx.currentTime + index * 0.03 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + index * 0.03 + 0.3);

            osc.start(this.ctx.currentTime + index * 0.03);
            osc.stop(this.ctx.currentTime + index * 0.03 + 0.3);
        });
    }

    /**
     * 播放升级音效
     * 庆祝式上升音阶
     */
    playLevelUp() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C大调和弦上升
        
        frequencies.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + index * 0.08);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + index * 0.08);
            gain.gain.linearRampToValueAtTime(this.volume * 0.6, this.ctx.currentTime + index * 0.08 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + index * 0.08 + 0.4);

            osc.start(this.ctx.currentTime + index * 0.08);
            osc.stop(this.ctx.currentTime + index * 0.08 + 0.4);
        });
    }

    /**
     * 播放游戏结束音效
     * 下降音阶营造失败感
     */
    playGameOver() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const frequencies = [440, 415, 392, 370, 349]; // 下降音阶
        
        frequencies.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + index * 0.15);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + index * 0.15);
            gain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + index * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + index * 0.15 + 0.2);

            osc.start(this.ctx.currentTime + index * 0.15);
            osc.stop(this.ctx.currentTime + index * 0.15 + 0.2);
        });
    }

    /**
     * 播放按钮点击音效
     */
    playButtonClick() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.08);
    }

    /**
     * 设置音量
     * @param {number} vol - 音量值，范围 0-1
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    /**
     * 启用/禁用音效
     * @param {boolean} enabled - true 启用，false 禁用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * 切换音效开关
     * @returns {boolean} 切换后的状态
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
}
