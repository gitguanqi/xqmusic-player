/**
 * xqmusic-player 纯函数工具集（ESM）
 *
 * 这个文件是歌词解析 / 时间格式化 / HTML 转义 / 歌词行定位的**唯一 ESM 实现**，
 * 供 Vue 封装（lib/vue/xqmusic.vue）直接 import。
 *
 * 为什么 UMD 版（lib/js/xqmusic.js）里还有一份内联实现：
 * UMD 文件必须能被 <script> 直接引入、不依赖任何模块系统，所以无法 import 本文件。
 * 两份实现的一致性由 test/utils-parity.test.mjs 用同一组用例对拍保证——
 * 改动其中一份而不同步另一份时，`npm test` 会失败。
 */

/** HTML 文本与属性值的转义表 */
const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/**
 * 把任意值转成可安全插入 innerHTML 的文本。
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * 两位补零。注意必须用 >= 10 判断，否则 10 会被补成 "010"。
 * @param {number} value
 * @returns {string}
 */
export function pad2(value) {
    const n = Math.floor(Math.abs(Number(value) || 0));
    return n < 10 ? '0' + n : String(n);
}

/**
 * 秒数格式化为时间串。
 * @param {number} second 秒
 * @returns {{h: string, m: string}} h 为 HH:MM:SS，m 为 MM:SS
 */
export function formatTime(second) {
    const total = Math.max(0, Math.floor(Number(second) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return {
        h: pad2(h) + ':' + pad2(m) + ':' + pad2(s),
        m: pad2(m) + ':' + pad2(s),
    };
}

/** 行首/行中的时间标签，如 [00:12.34] / [01:02:03] */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
/** 元信息标签，如 [ti:歌名] / [offset:500] */
const META_TAG = /^\[(ti|ar|al|by|offset):(.*)\]$/i;

/**
 * 把时间标签片段转成秒。
 * @param {string} mm 分
 * @param {string} ss 秒（可带小数或再带一段百分秒）
 * @returns {number}
 */
function toSeconds(mm, ss) {
    const minutes = Number(mm);
    const seconds = Number(String(ss).replace(':', '.'));
    if (!isFinite(minutes) || !isFinite(seconds)) return 0;
    return Math.round((minutes * 60 + seconds) * 1000) / 1000;
}

/**
 * 解析 LRC 歌词。
 *
 * 与旧实现的行为差异（均为修正）：
 * - 空输入 / 非字符串返回 `{ ms: [] }` 而不是 `undefined`（旧实现在无歌词时会
 *   把 "undefined" 写进 localStorage，下一帧 JSON.parse 直接抛错）；
 * - 一行多个时间标签时只剥离标签本身，不再用「累加标签长度」的偏移估算；
 * - `t` 存数字而不是 `toFixed` 出来的字符串，排序稳定。
 *
 * @param {string} text LRC 原文
 * @returns {{ti: string, ar: string, al: string, by: string, offset: number, ms: Array<{t: number, c: string}>}}
 */
export function parseLyric(text) {
    const lrc = { ti: '', ar: '', al: '', by: '', offset: 0, ms: [] };
    if (typeof text !== 'string' || text.trim() === '') return lrc;

    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        const meta = line.match(META_TAG);
        if (meta) {
            const key = meta[1].toLowerCase();
            const value = meta[2].trim();
            if (key === 'offset') {
                const offset = parseInt(value, 10);
                if (!isNaN(offset)) lrc.offset = offset;
            } else if (key !== 'ms' && Object.prototype.hasOwnProperty.call(lrc, key)) {
                lrc[key] = value;
            }
            continue;
        }

        TIME_TAG.lastIndex = 0;
        const stamps = [];
        let match;
        while ((match = TIME_TAG.exec(line)) !== null) {
            stamps.push(toSeconds(match[1], match[2]));
        }
        if (!stamps.length) continue;

        const content = line.replace(TIME_TAG, '').trim();
        for (const t of stamps) {
            lrc.ms.push({ t, c: content });
        }
    }

    lrc.ms.sort((a, b) => a.t - b.t);
    return lrc;
}

/**
 * 二分查找「最后一个时间点 <= time」的歌词下标。
 * 每帧调用，必须 O(log n)，不能全表扫描。
 * @param {Array<{t: number}>} list
 * @param {number} time 秒
 * @returns {number} 未命中返回 -1
 */
export function findLyricIndex(list, time) {
    if (!Array.isArray(list) || list.length === 0) return -1;
    const target = Number(time) || 0;
    let low = 0;
    let high = list.length - 1;
    let found = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (list[mid].t <= target) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return found;
}
