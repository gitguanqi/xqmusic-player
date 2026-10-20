/**
 * 纯函数单元测试。零依赖，只针对 lib/js/xqmusic-utils.mjs。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, findLyricIndex, formatTime, pad2, parseLyric } from '../lib/js/xqmusic-utils.mjs';

describe('formatTime', () => {
    it('10 秒不能再被补成 010（历史缺陷）', () => {
        assert.equal(formatTime(10).m, '00:10');
        assert.equal(formatTime(10).h, '00:00:10');
    });

    it('覆盖所有进位边界', () => {
        const cases = [
            [0, '00:00', '00:00:00'],
            [9, '00:09', '00:00:09'],
            [59, '00:59', '00:00:59'],
            [60, '01:00', '00:01:00'],
            [600, '10:00', '00:10:00'],
            [3599, '59:59', '00:59:59'],
            [3600, '00:00', '01:00:00'],
            [3661, '01:01', '01:01:01'],
        ];
        for (const [input, short, long] of cases) {
            assert.equal(formatTime(input).m, short, `${input}s 的 MM:SS`);
            assert.equal(formatTime(input).h, long, `${input}s 的 HH:MM:SS`);
        }
    });

    it('对负数 / NaN / 字符串容错', () => {
        assert.equal(formatTime(-5).m, '00:00');
        assert.equal(formatTime(NaN).m, '00:00');
        assert.equal(formatTime('75').m, '01:15');
        assert.equal(formatTime(undefined).m, '00:00');
    });
});

describe('pad2', () => {
    it('个位数补零，两位数原样', () => {
        assert.equal(pad2(0), '00');
        assert.equal(pad2(9), '09');
        assert.equal(pad2(10), '10');
        assert.equal(pad2(99), '99');
    });
});

describe('escapeHtml', () => {
    it('转义五个危险字符', () => {
        assert.equal(escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
        assert.equal(escapeHtml("it's"), 'it&#39;s');
        assert.equal(escapeHtml('a & b'), 'a &amp; b');
    });

    it('null / undefined 变成空串而不是 "null"', () => {
        assert.equal(escapeHtml(null), '');
        assert.equal(escapeHtml(undefined), '');
        assert.equal(escapeHtml(0), '0');
    });
});

describe('parseLyric', () => {
    it('空输入返回空结构（旧实现返回 undefined）', () => {
        for (const input of ['', '   ', null, undefined, 42]) {
            const lrc = parseLyric(input);
            assert.ok(lrc && Array.isArray(lrc.ms), `${String(input)} 应返回对象`);
            assert.equal(lrc.ms.length, 0);
        }
    });

    it('解析元信息与时间轴', () => {
        const lrc = parseLyric('[ti:歌名]\n[ar:歌手]\n[offset:250]\n[00:01.20]第一行\n[00:03.40]第二行');
        assert.equal(lrc.ti, '歌名');
        assert.equal(lrc.ar, '歌手');
        assert.equal(lrc.offset, 250);
        assert.deepEqual(lrc.ms.map((m) => m.t), [1.2, 3.4]);
        assert.deepEqual(lrc.ms.map((m) => m.c), ['第一行', '第二行']);
    });

    it('一行多个时间标签会展开成多条', () => {
        const lrc = parseLyric('[00:01.00][00:05.00]重复副歌');
        assert.equal(lrc.ms.length, 2);
        assert.deepEqual(lrc.ms.map((m) => m.t), [1, 5]);
        assert.equal(lrc.ms[0].c, '重复副歌');
    });

    it('时间轴的 t 是数字，排序稳定', () => {
        const lrc = parseLyric('[00:10.00]后\n[00:02.00]前');
        assert.equal(typeof lrc.ms[0].t, 'number');
        assert.deepEqual(lrc.ms.map((m) => m.c), ['前', '后']);
    });

    it('忽略没有时间标签的行与空行', () => {
        const lrc = parseLyric('\n不是歌词的行\n[00:02.00]有效行\n');
        assert.equal(lrc.ms.length, 1);
    });

    it('容忍 CRLF', () => {
        const lrc = parseLyric('[00:01.00]a\r\n[00:02.00]b\r\n');
        assert.equal(lrc.ms.length, 2);
    });
});

describe('findLyricIndex', () => {
    const list = parseLyric('[00:00.00]a\n[00:05.00]b\n[00:10.00]c').ms;

    it('返回最后一个 t <= time 的下标', () => {
        assert.equal(findLyricIndex(list, 0), 0);
        assert.equal(findLyricIndex(list, 4.99), 0);
        assert.equal(findLyricIndex(list, 5), 1);
        assert.equal(findLyricIndex(list, 7), 1);
        assert.equal(findLyricIndex(list, 999), 2);
    });

    it('早于第一行时返回 -1', () => {
        assert.equal(findLyricIndex(parseLyric('[00:05.00]a').ms, 1), -1);
    });

    it('空列表返回 -1', () => {
        assert.equal(findLyricIndex([], 1), -1);
        assert.equal(findLyricIndex(null, 1), -1);
    });
});
