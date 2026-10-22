/*!
 * xqmusic-player v1.4.0
 * author: gitguanqi
 * date: 2022-09-24
 * license: MIT
 *
 * 本文件是可直接用 <script> 引入的 UMD 单文件构建，内部不依赖任何模块系统。
 * 纯函数（parseLyric / formatTime / escapeHtml / findLyricIndex）的 ESM 版本在
 * ./xqmusic-utils.mjs，两份实现由 test/utils-parity.test.mjs 对拍保证同步。
 */
(function (factory) {
    var XqMusic = factory();

    if (typeof module === 'object' && module && module.exports) {
        module.exports = XqMusic;
        module.exports.XqMusic = XqMusic;
        module.exports.default = XqMusic;
    } else if (typeof define === 'function' && define.amd) {
        define([], function () { return XqMusic; });
    }

    // 保留经典 <script> 引入时的全局名，历史用法 new XqMusic(options) 不受影响
    if (typeof window !== 'undefined') {
        window.XqMusic = XqMusic;
    }
}(function () {
    'use strict';

    var VERSION = '1.4.0';

    /** 歌词缓存命名空间。旧版本用的是全局单键 'lyrcis'（拼写错误），见 readCachedLyric */
    var STORAGE_PREFIX = 'xqmusic:lyric:';
    var LEGACY_STORAGE_KEY = 'lyrcis';

    /** 歌词行高（与 .xqmusic-lyric-ls li 的 line-height: 2 / font-size: 14px 对应） */
    var LYRIC_LINE_HEIGHT = 36;

    var instanceSeq = 0;

    /** 所有内部查询都用类名，不用 id —— id 只在 DOM 上保留给外部 getElementById 用 */
    var SEL = {
        root: '.xqmusic',
        top: '.xqmusic-top',
        songBox: '.xqmusic-menu-ls',
        lyricBox: '.xqmusic-lyric-ls',
        audio: '.xqmusic-audio',
        cover: '.xqmusic-cover-img',
        title: '.xqmusic-song-title',
        current: '.xqmusic-current',
        progressBar: '.xqmusic-progress-bar',
        total: '.xqmusic-total',
        muted: '.xqmusic-muted',
        volume: '.xqmusic-volumn',
        prev: '.xqmusic-prev',
        pause: '.xqmusic-pause',
        play: '.xqmusic-play',
        next: '.xqmusic-next',
        word: '.xqmusic-word',
        list: '.xqmusic-list'
    };

    var TEMPLATE = [
        '<div class="xqmusic-top active">',
        // 面板初始显隐写死为行内样式：不依赖 xqmusic.css 是否加载、
        // 也不怕宿主页面的 ul 规则把 display:none 冲掉（默认必须关着）
        '    <ul class="xqmusic-menu-ls scroll-box" style="display: none;"></ul>',
        '    <ul class="xqmusic-lyric-ls scroll-box" style="display: none;"><li>暂无歌词</li></ul>',
        '</div>',
        '<div class="xqmusic-bottom">',
        '    <audio class="xqmusic-audio" id="xqmusic-audio" src=""></audio>',
        '    <div class="xqmusic-img">',
        '        <div class="xqmusic-cover-img" id="xqmusic-cover-img"></div>',
        '    </div>',
        '    <div class="xqmusic-main">',
        '        <div class="xqmusic-title">',
        '            <small class="overflow xqmusic-song-title" id="xqmusic-song-title">歌手 - 歌曲名</small>',
        '        </div>',
        '        <div class="xqmusic-progress">',
        '            <small class="xqmusic-current" id="xqmusic-current">00:00</small>',
        '            <span><i class="xqmusic-progress-bar" id="xqmusic-progress-bar"></i></span>',
        '            <small class="xqmusic-total" id="xqmusic-total">00:00</small>',
        '        </div>',
        '        <div class="xqmusic-btns">',
        '            <button type="button" class="xqmusic-muted" id="xqmusic-muted" title="取消静音"><i class="fa fa-volume-mute"></i></button>',
        '            <button type="button" class="xqmusic-volumn active" id="xqmusic-volumn" title="静音"><i class="fa fa-volume-down"></i></button>',
        '            <button type="button" class="xqmusic-prev" id="xqmusic-prev" title="上一首"><i class="fa fa-chevron-left"></i></button>',
        '            <button type="button" class="xqmusic-pause" id="xqmusic-pause" title="暂停"><i class="fa fa-pause"></i></button>',
        '            <button type="button" class="xqmusic-play active" id="xqmusic-play" title="播放"><i class="fa fa-play"></i></button>',
        '            <button type="button" class="xqmusic-next" id="xqmusic-next" title="下一首"><i class="fa fa-chevron-right"></i></button>',
        '            <button type="button" class="xqmusic-word" id="xqmusic-word" title="歌词"><i class="fa fa-file-word"></i></button>',
        '            <button type="button" class="xqmusic-list" id="xqmusic-list" title="列表"><i class="fa fa-list"></i></button>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('\n');

    // ---------------------------------------------------------------- 纯函数
    // 与 xqmusic-utils.mjs 保持同步（test/utils-parity.test.mjs 对拍）

    var HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, function (ch) { return HTML_ESCAPES[ch]; });
    }

    function pad2(value) {
        var n = Math.floor(Math.abs(Number(value) || 0));
        return n < 10 ? '0' + n : String(n);
    }

    function formatTime(second) {
        var total = Math.max(0, Math.floor(Number(second) || 0));
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        return {
            h: pad2(h) + ':' + pad2(m) + ':' + pad2(s),
            m: pad2(m) + ':' + pad2(s)
        };
    }

    var TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
    var META_TAG = /^\[(ti|ar|al|by|offset):(.*)\]$/i;

    function toSeconds(mm, ss) {
        var minutes = Number(mm);
        var seconds = Number(String(ss).replace(':', '.'));
        if (!isFinite(minutes) || !isFinite(seconds)) return 0;
        return Math.round((minutes * 60 + seconds) * 1000) / 1000;
    }

    function parseLyric(text) {
        var lrc = { ti: '', ar: '', al: '', by: '', offset: 0, ms: [] };
        if (typeof text !== 'string' || text.trim() === '') return lrc;

        var lines = text.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var meta = line.match(META_TAG);
            if (meta) {
                var key = meta[1].toLowerCase();
                var value = meta[2].trim();
                if (key === 'offset') {
                    var offset = parseInt(value, 10);
                    if (!isNaN(offset)) lrc.offset = offset;
                } else if (key !== 'ms' && Object.prototype.hasOwnProperty.call(lrc, key)) {
                    lrc[key] = value;
                }
                continue;
            }

            TIME_TAG.lastIndex = 0;
            var stamps = [];
            var match;
            while ((match = TIME_TAG.exec(line)) !== null) {
                stamps.push(toSeconds(match[1], match[2]));
            }
            if (!stamps.length) continue;

            var content = line.replace(TIME_TAG, '').trim();
            for (var j = 0; j < stamps.length; j++) {
                lrc.ms.push({ t: stamps[j], c: content });
            }
        }

        lrc.ms.sort(function (a, b) { return a.t - b.t; });
        return lrc;
    }

    function findLyricIndex(list, time) {
        if (!list || !list.length) return -1;
        var target = Number(time) || 0;
        var low = 0;
        var high = list.length - 1;
        var found = -1;
        while (low <= high) {
            var mid = (low + high) >> 1;
            if (list[mid].t <= target) {
                found = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return found;
    }

    // ---------------------------------------------------------------- 环境工具

    function getStorage() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return null;
            return window.localStorage;
        } catch (e) {
            // Safari 隐私模式下访问 localStorage 本身就会抛错
            return null;
        }
    }

    /**
     * 加载文本资源。优先用原生 fetch（零依赖），没有 fetch 时回退到全局 axios。
     * 旧实现硬依赖全局 axios，但 package.json 从未声明它。
     * @param {string} url
     * @returns {Promise<string>}
     */
    function loadText(url) {
        if (typeof fetch === 'function') {
            return fetch(url, { credentials: 'same-origin' }).then(function (res) {
                if (!res || !res.ok) {
                    throw new Error('[xqmusic-player] 歌词请求失败: ' + url + ' (' + (res && res.status) + ')');
                }
                return res.text();
            });
        }
        if (typeof axios !== 'undefined' && axios && typeof axios.get === 'function') {
            return axios.get(url).then(function (res) {
                return res && res.data !== undefined ? res.data : res;
            });
        }
        return Promise.reject(new Error('[xqmusic-player] 当前环境没有 fetch / axios，无法加载歌词'));
    }

    function require$g() {
        if (typeof $g === 'undefined' || !$g || typeof $g.dom !== 'function') {
            throw new Error('[xqmusic-player] 缺少前置依赖 $g：请先加载 xqgjs（npm i xqgjs 或引入 CDN 版本）');
        }
        return $g;
    }

    // ---------------------------------------------------------------- 构造

    /**
     * @constructor
     * @param {{el?: string|Element, list?: Array, mode?: 'slide'|'move'}} [options]
     */
    function XqMusic(options) {
        if (!options) options = { el: 'body', list: [], mode: 'slide' };
        if (!options.el) {
            throw new Error('[xqmusic-player] options.el 是必填项');
        }

        var $ = require$g();

        this.options = options;
        this.version = 'v' + VERSION;
        this.author = 'gitguanqi';
        this.date = '2022-09-24';
        this.pluginName = 'XQMusicPlayer';
        this.instanceId = ++instanceSeq;

        this.elem = $.dom(options.el);
        if (!this.elem) {
            throw new Error('[xqmusic-player] 找不到宿主元素: ' + options.el);
        }

        this.songList = options.list || [];
        this.currentIndex = 0;
        this.lyricShow = false;
        this.songShow = false;
        this.playStatus = false;

        /** 当前歌词数据（内存是主存储，localStorage 只是离线兜底） */
        this.lyricData = { ms: [] };
        this._handlers = [];
        this._lyricLines = null;
        this._lyricActive = null;
        this._lyricIndex = -1;
        this._lyricToken = 0;
        this._legacyPurged = false;
        this._destroyed = false;

        this.initPage();
        this.initElem();

        if (this.songList.length) {
            this.initEvents();
        }

        if (this.options.mode === 'move') {
            this.root.classList.add('move');
            this.boxDrag();
        }

        if (this.songList.length) {
            this.showList();
            this.showDefault();
        }
    }

    // ---------------------------------------------------------------- 初始化

    /**
     * 注入播放器骨架。重复调用是幂等的（靠 .xqmusic 是否存在判断，
     * 不再读 innerText 触发强制布局）。
     * @returns {boolean} 是否新建了骨架
     */
    XqMusic.prototype.initPage = function () {
        if (!this.elem) return false;

        var existing = this.elem.querySelector(SEL.root);
        if (existing) {
            this.root = existing;
            return false;
        }

        var node = document.createElement('div');
        node.className = this.options.mode === 'slide' ? 'xqmusic slide' : 'xqmusic';
        node.innerHTML = TEMPLATE;
        this.elem.appendChild(node);
        this.root = node;
        return true;
    };

    /**
     * 缓存节点引用。全部查询都收敛在 this.root 内，因此同页多个实例互不干扰。
     * @returns {void}
     */
    XqMusic.prototype.initElem = function () {
        var root = this.root;
        if (!root) return;

        this.xqTop = root.querySelector(SEL.top);
        this.xqSongBox = root.querySelector(SEL.songBox);
        this.xqLyricBox = root.querySelector(SEL.lyricBox);
        this.xqAudio = root.querySelector(SEL.audio);
        this.xqCoverImg = root.querySelector(SEL.cover);
        this.xqSongTitle = root.querySelector(SEL.title);
        this.xqCurrentTime = root.querySelector(SEL.current);
        this.xqProgressBar = root.querySelector(SEL.progressBar);
        this.xqTotal = root.querySelector(SEL.total);
        this.xqMuted = root.querySelector(SEL.muted);
        this.xqVolumn = root.querySelector(SEL.volume);
        this.xqPrev = root.querySelector(SEL.prev);
        this.xqPause = root.querySelector(SEL.pause);
        this.xqPlay = root.querySelector(SEL.play);
        this.xqNext = root.querySelector(SEL.next);
        this.xqWord = root.querySelector(SEL.word);
        this.xqList = root.querySelector(SEL.list);
    };

    /**
     * 统一注册监听并记录句柄，destroy() 时按记录逐个移除。
     * @param {EventTarget} target
     * @param {string} type
     * @param {Function} handler
     * @returns {void}
     */
    XqMusic.prototype._on = function (target, type, handler) {
        if (!target) return;
        var bound = handler.bind(this);
        target.addEventListener(type, bound, false);
        this._handlers.push({ target: target, type: type, handler: bound });
    };

    /**
     * 绑定交互事件。只在构造时调用一次——旧实现把列表按钮的监听放在
     * showCurrentHigh() 的循环里，每次切歌就再绑一轮。
     * @returns {void}
     */
    XqMusic.prototype.initEvents = function () {
        if (this._eventsBound) return;
        this._eventsBound = true;

        this._on(this.xqWord, 'click', this.lyricPageToggle);
        this._on(this.xqList, 'click', this.songPageToggle);
        this._on(this.xqMuted, 'click', this.showMuted);
        this._on(this.xqVolumn, 'click', this.showVolumn);
        this._on(this.xqPlay, 'click', this.playSong);
        this._on(this.xqPause, 'click', this.playSong);
        this._on(this.xqPrev, 'click', this.togglePrevSong);
        this._on(this.xqNext, 'click', this.toggleNextSong);
        this._on(this.xqAudio, 'timeupdate', this.getTime);
        // 列表内按钮用事件委托：只绑一次，切歌不重复绑定
        this._on(this.xqSongBox, 'click', this.toggleListSong);
    };

    /**
     * 拖拽模式。只在 mode === 'move' 且宿主提供 $g.Drag 时生效。
     * @returns {boolean}
     */
    XqMusic.prototype.boxDrag = function () {
        if (!this.root || typeof $g === 'undefined' || typeof $g.Drag !== 'function') {
            return false;
        }
        this.drag = new $g.Drag(this.root);
        return true;
    };

    // ---------------------------------------------------------------- 列表

    /**
     * 渲染歌曲列表。所有文本都经过 escapeHtml，避免歌名里的尖括号被当成标签。
     * @returns {void}
     */
    XqMusic.prototype.showList = function () {
        if (!this.xqSongBox) return;

        var html = '';
        for (var i = 0; i < this.songList.length; i++) {
            var item = this.songList[i];
            var id = escapeHtml(item.id);
            var name = escapeHtml(item.name);
            html += '<li data-id="' + id + '">'
                + '<span class="overflow" title="' + name + '">' + name + '</span>'
                + '<button type="button" class="song-play" data-id="' + id + '" title="播放">'
                + '<i class="fa fa-play" data-id="' + id + '"></i>'
                + '</button></li>';
        }
        this.xqSongBox.innerHTML = html;
        this.showCurrentHigh();
    };

    /**
     * 刷新当前歌曲的高亮与图标。只改 className，不绑定事件、不做全局查询。
     * @returns {void}
     */
    XqMusic.prototype.showCurrentHigh = function () {
        if (!this.xqSongBox) return;
        var current = this.songList[this.currentIndex];
        if (!current) return;

        var items = this.xqSongBox.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var icon = item.querySelector('i');
            var active = String(item.getAttribute('data-id')) === String(current.id);
            item.className = active ? 'active' : '';
            if (icon) {
                icon.className = active && this.playStatus ? 'fa fa-pause' : 'fa fa-play';
            }
        }
    };

    /**
     * 应用当前歌曲的封面 / 音频 / 标题 / 歌词。
     * @returns {void}
     */
    XqMusic.prototype.showDefault = function () {
        var item = this.songList[this.currentIndex];
        if (!item) return;

        if (this.xqCoverImg) {
            this.xqCoverImg.style.backgroundImage = item.pic ? 'url(' + item.pic + ')' : '';
        }
        if (this.xqAudio) {
            this.xqAudio.src = item.url || '';
        }
        if (this.xqSongTitle) {
            this.xqSongTitle.textContent = (item.author || '') + ' - ' + (item.name || '');
        }

        this.setLyricSource(item.lyric_url);
        this.showCurrentHigh();
    };

    // ---------------------------------------------------------------- 歌词

    /**
     * 按 URL 切换歌词源；无 URL 时直接渲染空态。
     * @param {string} [url]
     * @returns {Promise<Object|null>}
     */
    XqMusic.prototype.setLyricSource = function (url) {
        this._lyricToken = (this._lyricToken || 0) + 1;
        // 先把歌词状态作废：新歌词回来之前，旧歌词不能再参与进度定位与高亮，
        // 否则短时间内会出现「标题已经是第二首、高亮还按第一首的时间轴在走」。
        this._resetLyricState();
        if (!url) {
            this.showLyric({ ms: [] });
            return Promise.resolve(null);
        }
        return this.getLyric(url);
    };

    /** 清空歌词定位相关的中间状态（不影响已渲染的 DOM 节点） */
    XqMusic.prototype._resetLyricState = function () {
        this.lyricData = { ms: [] };
        this._lyricLines = null;
        this._lyricActive = null;
        this._lyricIndex = -1;
    };

    /**
     * 拉取并解析歌词。失败时回退到本地缓存，最终降级为「暂无歌词」——
     * 任何一步失败都不会抛出（旧实现把解析结果无保护地写入缓存）。
     *
     * 用 token 做竞态保护：快速切歌时，先前歌曲的响应回来不能再覆盖当前歌词。
     *
     * @param {string} url
     * @returns {Promise<Object|null>}
     */
    XqMusic.prototype.getLyric = function (url) {
        var self = this;
        var token = ++this._lyricToken;
        if (!url) {
            self.showLyric({ ms: [] });
            return Promise.resolve(null);
        }
        return loadText(url).then(function (text) {
            if (token !== self._lyricToken) return null; // 已切歌，丢弃过期响应
            var lrc = parseLyric(text);
            self.cacheLyric(lrc);
            self.showLyric(lrc);
            return lrc;
        }, function () {
            if (token !== self._lyricToken) return null;
            var cached = self.readCachedLyric();
            self.showLyric(cached || { ms: [] });
            return cached;
        });
    };

    /**
     * 解析歌词（实例方法，委托给内部实现，便于外部复用）。
     * @param {string} text
     * @returns {Object}
     */
    XqMusic.prototype.parseLyric = function (text) {
        return parseLyric(text);
    };

    /**
     * 渲染歌词列表，并重置高亮缓存。
     * @param {{ms?: Array<{t:number,c:string}>}} lrc
     * @returns {void}
     */
    XqMusic.prototype.showLyric = function (lrc) {
        var list = (lrc && lrc.ms) || [];
        this.lyricData = lrc || { ms: [] };
        this._lyricLines = null;
        this._lyricActive = null;
        this._lyricIndex = -1;

        if (!this.xqLyricBox) return;

        if (!list.length) {
            this.xqLyricBox.innerHTML = '<li>暂无歌词</li>';
            return;
        }

        var html = '';
        for (var i = 0; i < list.length; i++) {
            html += '<li>' + escapeHtml(list[i].c) + '</li>';
        }
        this.xqLyricBox.innerHTML = html;
        this.xqLyricBox.scrollTop = 0;
    };

    /**
     * 歌词高亮定位。
     *
     * 旧实现每帧（timeupdate ≈ 4Hz）遍历全部歌词行、逐行读 offsetTop：
     * 既是 O(n) 又触发强制同步布局。现在改成二分查找 + 只写 className，
     * 且行节点数组缓存复用。
     *
     * @param {number} time 当前播放秒数
     * @returns {void}
     */
    XqMusic.prototype.showLyricPos = function (time) {
        var ms = this.lyricData && this.lyricData.ms;
        if (!ms || !ms.length || !this.xqLyricBox) return;

        var index = findLyricIndex(ms, time);
        if (index < 0) return;
        if (index === this._lyricIndex && this._lyricActive) return;

        if (!this._lyricLines || this._lyricLines.length !== ms.length) {
            this._lyricLines = this.xqLyricBox.querySelectorAll('li');
        }
        var line = this._lyricLines[index];
        if (!line) return;

        if (this._lyricActive && this._lyricActive !== line) {
            this._lyricActive.className = '';
        }
        line.className = 'active';
        this._lyricActive = line;
        this._lyricIndex = index;
        this.scrollLyricTo(index);
    };

    /**
     * 把第 index 行滚到容器中部。用缓存行高计算，不读 offsetTop。
     * @param {number} index
     * @returns {void}
     */
    XqMusic.prototype.scrollLyricTo = function (index) {
        var box = this.xqLyricBox;
        if (!box) return;
        var height = box.clientHeight || 0;
        if (!height) return;
        var target = index * LYRIC_LINE_HEIGHT - (height - LYRIC_LINE_HEIGHT) / 2;
        if (target < 0) target = 0;
        if (Math.abs(box.scrollTop - target) < 1) return;
        box.scrollTop = target;
    };

    /**
     * 写入歌词缓存（仅作离线兜底，失败静默）。
     * @param {Object} lrc
     * @returns {void}
     */
    XqMusic.prototype.cacheLyric = function (lrc) {
        var store = getStorage();
        if (!store) return;
        if (!lrc || !lrc.ms || !lrc.ms.length) {
            try { store.removeItem(this.storageKey()); } catch (e) { /* ignore */ }
            return;
        }
        try {
            store.setItem(this.storageKey(), JSON.stringify({ v: 1, ms: lrc.ms }));
        } catch (e) { /* 配额或隐私模式，忽略 */ }

        // 旧版本的全局键 'lyrcis' 是跨实例共享的脏数据，本实例已有新鲜歌词后就没必要再留着
        if (!this._legacyPurged) {
            this._legacyPurged = true;
            try { store.removeItem(LEGACY_STORAGE_KEY); } catch (e) { /* ignore */ }
        }
    };

    /**
     * 读取歌词缓存。会顺带把旧版本全局键 'lyrcis' 迁移到实例键。
     * @returns {Object|null}
     */
    XqMusic.prototype.readCachedLyric = function () {
        var store = getStorage();
        if (!store) return null;

        var keys = [this.storageKey(), LEGACY_STORAGE_KEY];
        for (var i = 0; i < keys.length; i++) {
            var raw = null;
            try { raw = store.getItem(keys[i]); } catch (e) { raw = null; }
            if (!raw) continue;

            var parsed = null;
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
            if (!parsed) continue;

            var ms = Array.isArray(parsed.ms) ? parsed.ms : (Array.isArray(parsed) ? parsed : null);
            if (!ms || !ms.length) continue;

            var normalized = [];
            for (var j = 0; j < ms.length; j++) {
                var item = ms[j];
                if (!item) continue;
                normalized.push({
                    t: Number(item.t) || 0,
                    c: item.c === null || item.c === undefined ? '' : String(item.c)
                });
            }
            if (!normalized.length) continue;

            var lrc = { ti: '', ar: '', al: '', by: '', offset: 0, ms: normalized };

            if (keys[i] === LEGACY_STORAGE_KEY) {
                this.cacheLyric(lrc);
                try { store.removeItem(LEGACY_STORAGE_KEY); } catch (e) { /* ignore */ }
            }
            return lrc;
        }
        return null;
    };

    /**
     * 当前实例的缓存键。
     * @returns {string}
     */
    XqMusic.prototype.storageKey = function () {
        return STORAGE_PREFIX + this.instanceId;
    };

    // ---------------------------------------------------------------- 界面切换

    /**
     * 歌词面板开关。
     * @returns {void}
     */
    XqMusic.prototype.lyricPageToggle = function () {
        this.lyricShow = !this.lyricShow;
        this.songShow = false;
        if (this.xqLyricBox) this.xqLyricBox.style.display = this.lyricShow ? 'block' : 'none';
        if (this.xqSongBox) this.xqSongBox.style.display = 'none';
        if (this.xqTop) this.xqTop.classList.toggle('active', !this.lyricShow);
    };

    /**
     * 歌曲列表面板开关。
     * @returns {void}
     */
    XqMusic.prototype.songPageToggle = function () {
        this.songShow = !this.songShow;
        this.lyricShow = false;
        if (this.xqSongBox) this.xqSongBox.style.display = this.songShow ? 'block' : 'none';
        if (this.xqLyricBox) this.xqLyricBox.style.display = 'none';
        if (this.xqTop) this.xqTop.classList.toggle('active', !this.songShow);
    };

    /**
     * 设置静音状态（唯一入口）。
     * @param {boolean} flag true = 静音
     * @returns {boolean} 当前静音状态
     */
    XqMusic.prototype.setMuted = function (flag) {
        var muted = !!flag;
        if (this.xqAudio) this.xqAudio.muted = muted;
        if (this.xqMuted) this.xqMuted.classList.toggle('active', muted);
        if (this.xqVolumn) this.xqVolumn.classList.toggle('active', !muted);
        return muted;
    };

    /**
     * @deprecated 历史命名与实际语义相反（调它其实是取消静音）。请改用 setMuted(false)。
     * @returns {boolean}
     */
    XqMusic.prototype.showMuted = function () {
        return this.setMuted(false);
    };

    /**
     * @deprecated 历史命名与实际语义相反（调它其实是静音）。请改用 setMuted(true)。
     * @returns {boolean}
     */
    XqMusic.prototype.showVolumn = function () {
        return this.setMuted(true);
    };

    // ---------------------------------------------------------------- 播放

    /**
     * 播放 / 暂停。自动播放被浏览器拦截时吞掉 rejection，避免未捕获异常。
     * @returns {void}
     */
    XqMusic.prototype.playSong = function () {
        if (!this.xqAudio) return;

        if (!this.playStatus) {
            this.playStatus = true;
            var promise = this.xqAudio.play();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(function () { /* 自动播放被拦截，静默 */ });
            }
            this._togglePlayClass(true);
        } else {
            this.playStatus = false;
            this.xqAudio.pause();
            this._togglePlayClass(false);
        }

        // 先落 playStatus 再刷新时间：getTime 开头有 `if (!this.playStatus) return`，
        // 旧实现把这一步放在状态更新之前，首次播放时进度条永远是空字符串
        this.getTime();
        this.showCurrentHigh();
    };

    /**
     * 播放态按钮与封面动画同步。
     * @param {boolean} playing
     * @returns {void}
     */
    XqMusic.prototype._togglePlayClass = function (playing) {
        if (this.xqPlay) this.xqPlay.classList.toggle('active', !playing);
        if (this.xqPause) this.xqPause.classList.toggle('active', playing);
        if (this.xqCoverImg) this.xqCoverImg.classList.toggle('active', playing);
    };

    /**
     * 刷新进度条与时间。不再依赖事件对象——旧实现读 e.timeStamp，
     * 但 playSong() 是无参调用，且 currentTime 为 0 时恰好会走到那条分支。
     * @returns {void}
     */
    XqMusic.prototype.getTime = function () {
        if (!this.playStatus) return;
        var audio = this.xqAudio;
        if (!audio) return;

        var currentTime = Number(audio.currentTime) || 0;
        var duration = Number(audio.duration);
        var percent = duration > 0 ? (currentTime / duration) * 100 : 0;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        if (this.xqCurrentTime) this.xqCurrentTime.textContent = formatTime(currentTime).m;
        if (this.xqTotal) this.xqTotal.textContent = duration > 0 ? formatTime(duration).m : '00:00';
        if (this.xqProgressBar) this.xqProgressBar.style.width = percent + '%';

        if (this.lyricData && this.lyricData.ms && this.lyricData.ms.length) {
            this.showLyricPos(currentTime);
        }
    };

    /**
     * 秒数格式化为 { h: 'HH:MM:SS', m: 'MM:SS' }。
     * @param {number} second
     * @returns {{h: string, m: string}}
     */
    XqMusic.prototype.calcTimeStr = function (second) {
        return formatTime(second);
    };

    /**
     * 上一首（循环）。
     * @returns {void}
     */
    XqMusic.prototype.togglePrevSong = function () {
        var len = this.songList.length;
        if (!len) return;
        this.currentIndex = (this.currentIndex - 1 + len) % len;
        this.toggleMusic();
    };

    /**
     * 下一首（循环）。旧实现用 `<= length` 判断再补一次钳制，末曲会多走一格。
     * @returns {void}
     */
    XqMusic.prototype.toggleNextSong = function () {
        var len = this.songList.length;
        if (!len) return;
        this.currentIndex = (this.currentIndex + 1) % len;
        this.toggleMusic();
    };

    /**
     * 列表点击（事件委托入口）。target 是 <button> 或其中的 <i>，两者都带 data-id。
     * @param {Event} e
     * @returns {void}
     */
    XqMusic.prototype.toggleListSong = function (e) {
        var target = e && (e.target || e.srcElement);
        if (!target || typeof target.getAttribute !== 'function') return;

        var id = target.getAttribute('data-id');
        if (id === null) return;

        var index = -1;
        for (var i = 0; i < this.songList.length; i++) {
            if (String(this.songList[i].id) === String(id)) {
                index = i;
                break;
            }
        }
        if (index < 0) return;

        this.currentIndex = index;
        this.toggleMusic();
    };

    /**
     * 切歌：重置播放态与进度，加载新歌。
     * @returns {void}
     */
    XqMusic.prototype.toggleMusic = function () {
        this.showDefault();
        this.showCurrentHigh();

        if (this.xqCoverImg) this.xqCoverImg.classList.remove('active');
        if (this.xqTotal) this.xqTotal.textContent = '00:00';
        if (this.xqCurrentTime) this.xqCurrentTime.textContent = '00:00';
        if (this.xqProgressBar) this.xqProgressBar.style.width = '0%';
        if (this.xqLyricBox) this.xqLyricBox.scrollTop = 0;
        if (this.xqAudio) this.xqAudio.pause();

        this._togglePlayClass(false);
        this.playStatus = false;
        this._lyricIndex = -1;
        this._lyricActive = null;
    };

    // ---------------------------------------------------------------- 生命周期

    /**
     * 销毁实例：解绑全部监听、清空音频源、移除骨架节点、释放歌词缓存。
     * 旧版本没有任何 teardown 路径，SPA 里切路由会留下悬空监听。
     * @returns {void}
     */
    XqMusic.prototype.destroy = function () {
        if (this._destroyed) return;
        this._destroyed = true;

        for (var i = 0; i < this._handlers.length; i++) {
            var h = this._handlers[i];
            if (h.target && typeof h.target.removeEventListener === 'function') {
                h.target.removeEventListener(h.type, h.handler, false);
            }
        }
        this._handlers.length = 0;

        if (this.xqAudio) {
            try { this.xqAudio.pause(); } catch (e) { /* ignore */ }
            this.xqAudio.removeAttribute('src');
            if (typeof this.xqAudio.load === 'function') {
                try { this.xqAudio.load(); } catch (e) { /* ignore */ }
            }
        }

        var store = getStorage();
        if (store) {
            try { store.removeItem(this.storageKey()); } catch (e) { /* ignore */ }
        }

        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }

        this.root = null;
        this.xqAudio = null;
        this._lyricLines = null;
        this._lyricActive = null;
        this.lyricData = { ms: [] };
    };

    /** 对外暴露版本与纯函数，方便上层复用（Vue 封装消费的是 xqmusic-utils.mjs 的同名实现） */
    XqMusic.VERSION = VERSION;
    XqMusic.utils = {
        escapeHtml: escapeHtml,
        pad2: pad2,
        formatTime: formatTime,
        parseLyric: parseLyric,
        findLyricIndex: findLyricIndex
    };

    return XqMusic;
}));
