/**
 * 两份纯函数实现对拍。
 *
 * UMD 文件（lib/js/xqmusic.js）必须能被 <script> 直接引入，因此不能 import ESM 模块，
 * 只能内联一份实现；Vue 侧则 import lib/js/xqmusic-utils.mjs。
 * 这个测试用同一组输入同时喂给两边，输出不一致就失败——
 * 防止「改了一份忘了另一份」这种最难发现的漂移。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import * as esm from '../lib/js/xqmusic-utils.mjs';

const require = createRequire(import.meta.url);
const UMD = require('../lib/js/xqmusic.js');
const UMD_MIN = require('../lib/js/xqmusic.min.js');

const IMPLEMENTATIONS = [
    ['lib/js/xqmusic.js', UMD],
    ['lib/js/xqmusic.min.js', UMD_MIN],
];

describe('UMD 构建的导出形态', () => {
    it('require 拿到的是构造器本身', () => {
        for (const [name, build] of IMPLEMENTATIONS) {
            assert.equal(typeof build, 'function', `${name} 应导出函数`);
            assert.equal(build.XqMusic, build, `${name} 的具名导出应与默认导出同一引用`);
            assert.equal(build.default, build, `${name} 的 default 应与默认导出同一引用`);
        }
    });

    it('暴露版本号与纯函数工具', () => {
        for (const [name, build] of IMPLEMENTATIONS) {
            assert.equal(build.VERSION, '1.4.0', `${name} 的 VERSION`);
            for (const key of ['escapeHtml', 'pad2', 'formatTime', 'parseLyric', 'findLyricIndex']) {
                assert.equal(typeof build.utils[key], 'function', `${name}.utils.${key}`);
            }
        }
    });
});

const LRC_FIXTURES = [
    '',
    '   ',
    '[00:00.00]第一行',
    '[ti:标题]\n[ar:歌手]\n[al:专辑]\n[by:作者]\n[offset:500]\n[00:01.50]一\n[00:02.00]二',
    '[00:01.00][00:05.00][00:09.00]重复副歌',
    '[00:10.00]后\n[00:02.00]前\n不是歌词的行\n',
    '[00:01.00]a\r\n[00:02.00]b\r\n',
    '[00:00.00]空格  在中间',
    '[01:00:00]异常时间格式',
];

const TIME_FIXTURES = [0, 1, 9, 10, 11, 59, 60, 61, 600, 3599, 3600, 3661, -5, 0.4, 1.99];

const ESCAPE_FIXTURES = ['', '<img onerror="x">', "it's", 'a & b', '中文', null, undefined, 0, 123];

describe('UMD 内联实现 与 ESM 模块 输出一致', () => {
    for (const [name, build] of IMPLEMENTATIONS) {
        it(`${name}: parseLyric`, () => {
            for (const input of LRC_FIXTURES) {
                assert.deepEqual(build.utils.parseLyric(input), esm.parseLyric(input), `输入: ${JSON.stringify(input)}`);
            }
        });

        it(`${name}: formatTime / pad2 / escapeHtml`, () => {
            for (const second of TIME_FIXTURES) {
                assert.deepEqual(build.utils.formatTime(second), esm.formatTime(second), `秒数: ${second}`);
            }
            for (const value of TIME_FIXTURES) {
                assert.equal(build.utils.pad2(value), esm.pad2(value), `pad2: ${value}`);
            }
            for (const value of ESCAPE_FIXTURES) {
                assert.equal(build.utils.escapeHtml(value), esm.escapeHtml(value), `escapeHtml: ${String(value)}`);
            }
        });

        it(`${name}: findLyricIndex`, () => {
            const list = esm.parseLyric('[00:00.00]a\n[00:05.00]b\n[00:10.00]c').ms;
            for (const time of [-1, 0, 2.5, 5, 9.99, 10, 100]) {
                assert.equal(build.utils.findLyricIndex(list, time), esm.findLyricIndex(list, time), `时间: ${time}`);
            }
        });
    }
});
