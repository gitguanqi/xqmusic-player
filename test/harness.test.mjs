/**
 * 桩 DOM 行为测试。
 *
 * 把 lib/js/xqmusic.js 与它压缩后的产物分别跑进 jsdom 沙箱，逐个场景断言。
 * 这是「压缩产物真的能跑」的唯一证据——`node --check` 只证明能被解析。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { run } from '../scripts/dom-harness.mjs';

const ENTRIES = ['lib/js/xqmusic.js', 'lib/js/xqmusic.min.js'];

const SCENARIOS = [
    'construct',
    'no-el',
    'missing-$g',
    'start-play',
    'progress',
    'empty-lyric',
    'legacy-storage',
    'lyric',
    'listener-count',
    'xss',
    'dual-instance',
    'destroy',
];

for (const entry of ENTRIES) {
    describe(`桩 DOM: ${entry}`, () => {
        for (const scenario of SCENARIOS) {
            it(scenario, async () => {
                const [result] = await run({ entry, scenario });
                assert.ok(result, '没有返回结果');
                assert.equal(result.ok, true, `${scenario} 失败: ${result.detail}`);
            });
        }
    });
}

describe('两个产物行为一致', () => {
    it('同一场景在源文件与压缩产物上结论相同', async () => {
        for (const scenario of SCENARIOS) {
            const results = await run({ entry: 'lib/js/xqmusic.js', scenario });
            const minResults = await run({ entry: 'lib/js/xqmusic.min.js', scenario });
            assert.equal(
                results[0].ok,
                minResults[0].ok,
                `${scenario} 在源与产物上结论不同: 源=${results[0].detail} / 产物=${minResults[0].detail}`
            );
        }
    });
});
