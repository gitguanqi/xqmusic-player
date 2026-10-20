/**
 * 把 lib/vue/xqmusic.vue 预编译成浏览器可直接 import 的模块，供 test/vue3.html 使用。
 *
 * 为什么需要这一步：SFC 里的 <script setup> 必须经过编译器处理才能在浏览器里执行。
 * 测试页不引入打包器，所以用 @vue/compiler-sfc 在仓库里预编译一份产物。
 *
 * 产物 test/assets/xqmusic-demo.mjs 会被提交；contract 测试会重新编译并与它对比，
 * 防止「改了 SFC 忘了重新生成」。
 *
 * 用法：node scripts/build-vue-demo.mjs
 */
import { compileScript, parse } from '@vue/compiler-sfc';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export const SFC_PATH = path.join(root, 'lib/vue/xqmusic.vue');
export const DEMO_PATH = path.join(root, 'test/assets/xqmusic-demo.mjs');

const HEADER = [
    '/* 自动生成，请勿手改。',
    ' * 来源: lib/vue/xqmusic.vue',
    ' * 生成: node scripts/build-vue-demo.mjs',
    ' */',
    '',
].join('\n');

/**
 * 编译 SFC，返回可直接被浏览器加载的 ESM 源码
 * @returns {string}
 */
export function compileSfc() {
    const source = readFileSync(SFC_PATH, 'utf8');
    const { descriptor, errors } = parse(source, { filename: 'xqmusic.vue' });
    if (errors.length) {
        throw new Error('SFC 解析失败: ' + errors.map((e) => e.message).join('; '));
    }

    const compiled = compileScript(descriptor, { id: 'xqmusic-demo', inlineTemplate: true });
    let code = compiled.content;

    // 1) 浏览器不能 import CSS 当 JS，样式由测试页的 <link> 负责
    code = code.replace(/^\s*import\s+['"][^'"]*\.css['"];?\s*$/gm, '');

    // 2) 产物挪到了 test/assets/，依赖的相对路径要跟着改
    code = code.replace(/(['"])\.\.\/js\/xqmusic-utils\.mjs\1/g, "'../../lib/js/xqmusic-utils.mjs'");

    return HEADER + code;
}

/** 生成产物（CLI 与测试共用） */
export function writeDemo() {
    writeFileSync(DEMO_PATH, compileSfc(), 'utf8');
    console.log('built  test/assets/xqmusic-demo.mjs');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) writeDemo();
