/**
 * 桩 DOM 行为验证器。
 *
 * 为什么需要它：`node --check` 只能证明文件能被解析，证明不了行为。
 * 这个脚本把 lib/js/xqmusic.js（或它压缩后的产物）真正跑在一个 jsdom 沙箱里，
 * 逐个场景断言——包括构造、首次播放、空歌词、多实例、监听器计数、XSS、销毁。
 *
 * 用法：
 *   node scripts/dom-harness.mjs                                  # 默认跑源文件 + 产物
 *   node scripts/dom-harness.mjs --entry lib/js/xqmusic.min.js    # 只跑指定文件
 *   node scripts/dom-harness.mjs --scenario all --json            # 机器可读输出
 *
 * 注意：本文件不是测试文件（不以 .test 命名），避免被 `node --test` 误当用例执行。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const SAMPLE_LRC = [
    '[ti:测试歌曲]',
    '[ar:测试歌手]',
    '[00:00.00]第一行歌词',
    '[00:05.00]第二行歌词',
    '[00:10.00]第三行歌词',
    '[00:15.50]第四行歌词',
].join('\n');

const SAMPLE_LIST = [
    { id: 1, name: '第一首', author: '甲', pic: './a.jpg', url: './a.mp3', lyric_url: './a.lrc' },
    { id: 2, name: '第二首', author: '乙', pic: './b.jpg', url: './b.mp3', lyric_url: './b.lrc' },
    { id: 3, name: '第三首', author: '丙', pic: './c.jpg', url: './c.mp3' }, // 故意没有歌词
];

/**
 * 建立一个浏览器沙箱：jsdom window + 假 $g + 假媒体元素 + 假 fetch
 * @param {{html?: string, lrc?: string}} [config]
 */
function createSandbox(config = {}) {
    const html = config.html || '<div id="a"></div><div id="b"></div>';
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
        url: 'http://localhost/',
        pretendToBeVisual: true,
        // outside-only：提供 window.eval 让我们手动执行待测文件，但不自动执行页面里的 <script>
        runScripts: 'outside-only',
    });
    const { window } = dom;

    /** 记录所有监听器注册/移除，用于断言「不会越绑越多」 */
    const listenerLog = { add: [], remove: [] };
    const proto = window.EventTarget.prototype;
    const originalAdd = proto.addEventListener;
    const originalRemove = proto.removeEventListener;
    proto.addEventListener = function (type, handler, options) {
        listenerLog.add.push({ target: this, type });
        return originalAdd.call(this, type, handler, options);
    };
    proto.removeEventListener = function (type, handler, options) {
        listenerLog.remove.push({ target: this, type });
        return originalRemove.call(this, type, handler, options);
    };

    /** 媒体元素在 jsdom 里是半成品：play/pause/load 会往控制台抛 not-implemented */
    const media = window.HTMLMediaElement.prototype;
    media.play = function () {
        this.dispatchEvent(new window.Event('play'));
        return Promise.resolve();
    };
    media.pause = function () {
        this.dispatchEvent(new window.Event('pause'));
    };
    media.load = function () {};

    /** 假 xqgjs：只实现本包用到的 dom / gId / Drag */
    window.$g = {
        dom(selector) {
            if (typeof selector === 'string') return window.document.querySelector(selector);
            return selector || null;
        },
        gId(id) {
            return window.document.getElementById(id);
        },
        Drag: function Drag(element) {
            this.element = element;
        },
    };

    /** 假 fetch：一律返回同一份 LRC */
    window.fetch = function () {
        const body = config.lrc === undefined ? SAMPLE_LRC : config.lrc;
        return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(body),
        });
    };

    return { dom, window, listenerLog, SAMPLE_LIST };
}

/**
 * 在沙箱里执行待测文件，返回构造器
 * @param {ReturnType<typeof createSandbox>} sandbox
 * @param {string} entry 相对仓库根的路径
 */
function loadEntry(sandbox, entry) {
    const code = readFileSync(path.join(root, entry), 'utf8');
    sandbox.window.eval(code);
    const XqMusic = sandbox.window.XqMusic;
    if (typeof XqMusic !== 'function') {
        throw new Error('加载后没有拿到全局 XqMusic：' + entry);
    }
    return XqMusic;
}

/** 让 setTimeout / promise 链跑完 */
function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// ------------------------------------------------------------------ 场景

/**
 * 每个场景返回 { name, ok, detail }。
 * 场景之间互不共享沙箱，保证顺序无关。
 */
const SCENARIOS = {
    /** 基础构造：骨架注入、列表渲染、首曲信息 */
    async construct() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST, mode: 'slide' });

        const rootEl = sb.window.document.querySelector('#a .xqmusic');
        const items = rootEl.querySelectorAll('.xqmusic-menu-ls li');
        const title = rootEl.querySelector('.xqmusic-song-title').textContent;
        const cover = rootEl.querySelector('.xqmusic-cover-img').style.backgroundImage;

        return {
            ok: !!rootEl
                && rootEl.classList.contains('slide')
                && items.length === 3
                && title === '甲 - 第一首'
                && cover.includes('a.jpg'),
            detail: `root=${!!rootEl} items=${items.length} title="${title}" cover="${cover}"`,
        };
    },

    /** 缺 el 时必须抛可读错误，而不是 TypeError */
    async 'no-el'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        try {
            new XqMusic({});
            return { ok: false, detail: '没有抛错' };
        } catch (err) {
            return { ok: /options\.el/.test(err.message), detail: err.message };
        }
    },

    /** 缺 $g 时必须提示前置依赖，而不是 undefined 一堆 */
    async 'missing-$g'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        delete sb.window.$g;
        try {
            new XqMusic({ el: '#a', list: SAMPLE_LIST });
            return { ok: false, detail: '没有抛错' };
        } catch (err) {
            return { ok: /\$g/.test(err.message) && /xqgjs/.test(err.message), detail: err.message };
        }
    },

    /** 首次播放：currentTime 为 0 时旧实现会读 e.timeStamp 抛 TypeError */
    async 'start-play'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });

        try {
            inst.playSong(); // 旧实现在这里抛 TypeError
        } catch (err) {
            return { ok: false, detail: 'playSong 抛错: ' + err.message };
        }

        const rootEl = sb.window.document.querySelector('#a .xqmusic');
        const current = rootEl.querySelector('.xqmusic-current').textContent;
        const width = rootEl.querySelector('.xqmusic-progress-bar').style.width;
        return {
            ok: current === '00:00' && width === '0%' && inst.playStatus === true,
            detail: `current="${current}" width="${width}" playStatus=${inst.playStatus}`,
        };
    },

    /** 进度刷新：时长已知时进度条与时间要跟上 */
    async progress() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });
        inst.playSong();

        const audio = sb.window.document.querySelector('#a .xqmusic-audio');
        Object.defineProperty(audio, 'duration', { configurable: true, value: 100 });
        audio.currentTime = 10;
        audio.dispatchEvent(new sb.window.Event('timeupdate'));

        const rootEl = sb.window.document.querySelector('#a .xqmusic');
        const current = rootEl.querySelector('.xqmusic-current').textContent;
        const total = rootEl.querySelector('.xqmusic-total').textContent;
        const width = rootEl.querySelector('.xqmusic-progress-bar').style.width;

        return {
            // 10 秒必须显示 00:10，不是旧实现的 00:010
            ok: current === '00:10' && total === '01:40' && width === '10%',
            detail: `current="${current}" total="${total}" width="${width}"`,
        };
    },

    /** 无歌词歌曲：不得抛错，且必须显示空态 */
    async 'empty-lyric'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });
        inst.playSong();
        inst.currentIndex = 2; // 第三首没有 lyric_url
        inst.toggleMusic();
        await flush();

        const audio = sb.window.document.querySelector('#a .xqmusic-audio');
        Object.defineProperty(audio, 'duration', { configurable: true, value: 60 });
        audio.currentTime = 1;
        try {
            audio.dispatchEvent(new sb.window.Event('timeupdate'));
        } catch (err) {
            return { ok: false, detail: 'timeupdate 抛错: ' + err.message };
        }

        const box = sb.window.document.querySelector('#a .xqmusic-lyric-ls');
        return { ok: box.textContent.includes('暂无歌词'), detail: `lyricBox="${box.textContent.trim()}"` };
    },

    /** 旧版本把 "undefined" 写进 localStorage，这里必须既迁移又不崩 */
    async 'legacy-storage'() {
        const sb = createSandbox();
        sb.window.localStorage.setItem('lyrcis', 'undefined');
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });
        try {
            inst.playSong();
            inst.showLyricPos(0);
        } catch (err) {
            return { ok: false, detail: '污染缓存导致抛错: ' + err.message };
        }
        // 坏缓存必须被忽略；真正的歌词随后由 fetch 成功写入实例键
        await flush();
        await flush();
        const keys = Object.keys(sb.window.localStorage);
        return {
            ok: !sb.window.localStorage.getItem('lyrcis') && keys.some((k) => k.startsWith('xqmusic:lyric:')),
            detail: 'keys=' + JSON.stringify(keys),
        };
    },

    /** 歌词渲染与高亮：解析结果行数正确，且能命中第 N 行 */
    async lyric() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });
        inst.playSong();
        await flush();
        await flush();

        const box = sb.window.document.querySelector('#a .xqmusic-lyric-ls');
        const lines = box.querySelectorAll('li');
        inst.showLyricPos(5.2);
        const active = box.querySelector('li.active');

        return {
            ok: lines.length === 4 && active && active.textContent === '第二行歌词',
            detail: `lines=${lines.length} active="${active ? active.textContent : 'null'}"`,
        };
    },

    /** 监听器不得随切歌累积 */
    async 'listener-count'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });

        const before = sb.listenerLog.add.length;
        for (let i = 0; i < 5; i++) inst.toggleNextSong();
        inst.playSong();
        inst.playSong();
        const after = sb.listenerLog.add.length;

        const boxClicks = sb.listenerLog.add.filter(
            (e) => e.type === 'click' && e.target === inst.xqSongBox
        ).length;

        return {
            ok: after === before && boxClicks === 1,
            detail: `add ${before} -> ${after}, 列表容器 click 监听=${boxClicks}`,
        };
    },

    /** 歌名里的 HTML 必须被转义 */
    async xss() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const evil = '<img src=x onerror="window.__pwned=1">';
        new XqMusic({ el: '#a', list: [{ id: 1, name: evil, author: 'x', url: './a.mp3' }] });

        const box = sb.window.document.querySelector('#a .xqmusic-menu-ls');
        const injected = box.querySelector('img');
        return {
            ok: !injected && box.textContent.includes('<img'),
            detail: `img 注入=${!!injected} text="${box.textContent.trim().slice(0, 40)}"`,
        };
    },

    /** 同页两个实例互不干扰 */
    async 'dual-instance'() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const a = new XqMusic({ el: '#a', list: SAMPLE_LIST });
        const b = new XqMusic({ el: '#b', list: SAMPLE_LIST });
        await flush();

        a.toggleNextSong();

        const titleA = sb.window.document.querySelector('#a .xqmusic-song-title').textContent;
        const titleB = sb.window.document.querySelector('#b .xqmusic-song-title').textContent;
        const lyricA = sb.window.document.querySelector('#a .xqmusic-lyric-ls').textContent.trim();
        const lyricB = sb.window.document.querySelector('#b .xqmusic-lyric-ls').textContent.trim();

        a.setMuted(true);
        const mutedA = a.xqMuted.classList.contains('active');
        const mutedB = b.xqMuted.classList.contains('active');

        return {
            ok: titleA === '乙 - 第二首'
                && titleB === '甲 - 第一首'
                && lyricA === lyricB
                && mutedA === true
                && mutedB === false,
            detail: `A="${titleA}" B="${titleB}" mutedA=${mutedA} mutedB=${mutedB}`,
        };
    },

    /** destroy 必须解绑全部监听并移除骨架 */
    async destroy() {
        const sb = createSandbox();
        const XqMusic = loadEntry(sb, this.entry);
        const inst = new XqMusic({ el: '#a', list: SAMPLE_LIST });

        // 只统计本实例自己注册的监听：沙箱里还有 jsdom 内部注册的，不能混在一起算
        const own = inst._handlers.map((h) => ({ target: h.target, type: h.type }));
        inst.destroy();

        const allRemoved = own.every((o) =>
            sb.listenerLog.remove.some((r) => r.target === o.target && r.type === o.type)
        );
        const stillThere = sb.window.document.querySelector('#a .xqmusic');

        const removedOnce = sb.listenerLog.remove.length;
        inst.destroy(); // 幂等：不得重复移除
        const removedTwice = sb.listenerLog.remove.length;

        return {
            ok: own.length === 10
                && allRemoved
                && !stillThere
                && inst._handlers.length === 0
                && removedTwice === removedOnce,
            detail: `own=${own.length} 全部解绑=${allRemoved} 残留节点=${!!stillThere} 重复 destroy 增量为 ${removedTwice - removedOnce}`,
        };
    },
};

// ------------------------------------------------------------------ 运行

/**
 * @param {{entry: string, scenario: string}} options
 * @returns {Promise<Array<{entry: string, name: string, ok: boolean, detail: string}>>}
 */
export async function run(options) {
    const entry = options.entry;
    const names = options.scenario === 'all' ? Object.keys(SCENARIOS) : [options.scenario];
    const results = [];

    for (const name of names) {
        const scenario = SCENARIOS[name];
        if (!scenario) throw new Error('未知场景: ' + name);
        const ctx = { entry };
        try {
            const outcome = await scenario.call(ctx);
            results.push({ entry, name, ok: !!outcome.ok, detail: outcome.detail });
        } catch (err) {
            results.push({ entry, name, ok: false, detail: '抛出异常: ' + (err && err.message) });
        }
    }

    return results;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
    const argv = process.argv.slice(2);
    const getArg = (flag, fallback) => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
    };
    const scenario = getArg('--scenario', 'all');
    const json = argv.includes('--json');
    const entries = argv.includes('--entry')
        ? [getArg('--entry')]
        : ['lib/js/xqmusic.js', 'lib/js/xqmusic.min.js'];

    let failed = 0;
    const all = [];
    for (const entry of entries) {
        const results = await run({ entry, scenario });
        all.push(...results);
        for (const r of results) {
            if (!r.ok) failed++;
            if (!json) {
                console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${path.basename(entry)}  ${r.name.padEnd(16)} ${r.detail}`);
            }
        }
    }

    if (json) {
        console.log(JSON.stringify({ ok: failed === 0, results: all }, null, 2));
    } else {
        console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${all.length - failed}/${all.length} 场景通过`);
    }
    process.exit(failed === 0 ? 0 : 1);
}
