/**
 * 生成压缩产物：lib/js/xqmusic.min.js / lib/css/xqmusic.min.css
 *
 * 用法：
 *   node scripts/build.mjs           生成产物
 *   node scripts/build.mjs --check   只校验仓库里的产物是否与源码同步（CI 用）
 *
 * 两个刻意的实现选择：
 *
 * 1) 用 esbuild 的 transform 而不是 build。源码里有 `module.exports` 判断，
 *    esbuild 的 build 会把它识别成 CommonJS 模块并自动套一层 __commonJS 包装，
 *    结果 Node 里 `require()` 拿到的是 {}（导出被那层假 module 吞掉了）。
 *    transform 只做压缩、不改变模块语义，UMD 尾部原样保留。
 *
 * 2) 用解析器式压缩而不是正则压缩。本包大量使用模板字符串与嵌套函数，
 *    正则压缩器会把它们切坏。
 */
import { transform } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const banner = `/*! xqmusic-player v${pkg.version} | ${pkg.license} | author: ${pkg.author} */\n`;

/** 源文件 → 产物 的映射 */
const TARGETS = [
    { from: 'lib/js/xqmusic.js', to: 'lib/js/xqmusic.min.js', loader: 'js' },
    { from: 'lib/css/xqmusic.css', to: 'lib/css/xqmusic.min.css', loader: 'css' },
];

const checkOnly = process.argv.includes('--check');
const tmpDir = path.join(root, '.build-check');

/**
 * 统一换行后再比较。
 *
 * esbuild 的产物永远是 LF，但 Windows 上 core.autocrlf=true 会把 checkout 出来的文件变成 CRLF，
 * 不归一的话 build:check 在同事机器和 CI 上会误报「产物过期」。
 * @param {string} text
 * @returns {string}
 */
const normalize = (text) => text.replace(/\r\n/g, '\n');

/**
 * 压缩单个文件，返回完整产物文本
 * @param {{from: string, to: string, loader: 'js'|'css'}} target
 * @returns {Promise<string>}
 */
async function compile(target) {
    const source = readFileSync(path.join(root, target.from), 'utf8');
    const result = await transform(source, {
        loader: target.loader,
        minify: true,
        charset: 'utf8',
        legalComments: 'none',
        target: ['es2017'],
        logLevel: 'warning',
    });
    return banner + result.code;
}

if (!checkOnly) {
    for (const target of TARGETS) {
        const code = await compile(target);
        writeFileSync(path.join(root, target.to), code, 'utf8');
        console.log(`built  ${target.to}  (${Buffer.byteLength(code, 'utf8')} bytes)`);
    }
} else {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });

    let stale = 0;
    try {
        for (const target of TARGETS) {
            const fresh = await compile(target);
            const committed = normalize(readFileSync(path.join(root, target.to), 'utf8'));
            const freshText = normalize(fresh);
            if (freshText !== committed) {
                stale++;
                console.error(`stale  ${target.to} —— 与 ${target.from} 不一致，请运行 npm run build`);
            } else {
                console.log(`ok     ${target.to}`);
            }
        }
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }

    if (stale > 0) process.exit(1);
}
