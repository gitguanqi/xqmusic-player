/**
 * 在真实浏览器里跑 test/*.html 的自动检查。
 *
 * 为什么必须有这一步：jsdom 只能证明逻辑，证明不了布局、样式优先级、真实事件与媒体元素。
 * 本脚本会等每个页面自报 window.__TEST_RESULTS__，并要求：
 *   - status === 'passed'
 *   - liveInstances > 0（页面结束时必须留着可交互的 demo，不能是空白面板）
 *   - 没有未捕获异常 / console.error
 *   - 390px 窄屏下没有横向溢出
 *
 * 用 playwright-core + 本机已安装的 Chrome/Edge，不额外下载浏览器。
 *
 * 用法：node scripts/browser-check.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4011);
const BASE = `http://${HOST}:${PORT}`;

const PAGES = ['umd.html', 'esm.html', 'vue3.html', 'index.html'];

/** 本机可用的 Chromium 系浏览器（playwright-core 不自带） */
const CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

/**
 * 起静态服务器（用独立进程，退出时确保结束）
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
function startServer() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(here, 'serve.mjs')], {
            cwd: root,
            env: { ...process.env, HOST, PORT: String(PORT) },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => reject(new Error('服务器启动超时')), 10000);
        child.stdout.on('data', (chunk) => {
            if (String(chunk).includes('测试服务器')) {
                clearTimeout(timer);
                resolve(child);
            }
        });
        child.stderr.on('data', (chunk) => process.stderr.write(chunk));
        child.on('exit', (code) => {
            clearTimeout(timer);
            if (code !== 0) reject(new Error('服务器退出，code=' + code));
        });
    });
}

const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
    console.error('找不到本机 Chrome / Edge，无法做真实浏览器验证。请安装其中一个，或设置 CHROME_PATH。');
    process.exit(2);
}

const server = await startServer();
const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || executablePath,
    headless: true,
});

let failed = 0;
const report = [];

try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const page of PAGES) {
        const tab = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];

        tab.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        tab.on('pageerror', (err) => pageErrors.push(err.message));

        const url = `${BASE}/test/${page}`;
        await tab.goto(url, { waitUntil: 'load' });

        let results = null;
        try {
            await tab.waitForFunction(() => !!window.__TEST_RESULTS__, null, { timeout: 20000 });
            results = await tab.evaluate(() => window.__TEST_RESULTS__);
        } catch (err) {
            results = { status: 'timeout', checks: [], liveInstances: 0 };
        }

        // 窄屏横向溢出检查：光说「超宽了」没法定位，顺带把越界的元素记下来
        await tab.setViewportSize({ width: 390, height: 800 });
        await tab.waitForTimeout(150);
        const overflow = await tab.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            // position:fixed 的元素（slide 模式本来就停在屏幕右侧待命）不算越界
            offenders: [...document.querySelectorAll('*')]
                .map((el) => {
                    // slide 模式整体是 position:fixed 停在屏幕右侧待命，它和它的子树都不算越界
                    for (let p = el; p; p = p.parentElement) {
                        if (getComputedStyle(p).position === 'fixed') return null;
                    }
                    const r = el.getBoundingClientRect();
                    return r.right > window.innerWidth + 1 || r.width > window.innerWidth + 1
                        ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} → right=${Math.round(r.right)} w=${Math.round(r.width)}`
                        : null;
                })
                .filter(Boolean)
                .slice(0, 6),
        }));

        const ok = results
            && results.status === 'passed'
            && results.liveInstances > 0
            && pageErrors.length === 0
            && consoleErrors.length === 0
            && overflow.scrollWidth <= overflow.innerWidth + 1;

        if (!ok) failed++;
        report.push({ page, ok, results, pageErrors, consoleErrors, overflow });

        const failures = (results?.checks || []).filter((c) => !c.ok);
        console.log(
            `${ok ? 'PASS' : 'FAIL'}  ${page.padEnd(12)} ` +
            `status=${results ? results.status : 'n/a'} live=${results ? results.liveInstances : 0} ` +
            `checks=${(results?.checks || []).length} errors=${pageErrors.length + consoleErrors.length} ` +
            `width=${overflow.scrollWidth}/${overflow.innerWidth}`
        );
        for (const f of failures) console.log(`      失败项: ${f.name} —— ${f.detail}`);
        for (const e of pageErrors) console.log(`      未捕获异常: ${e}`);
        for (const e of consoleErrors) console.log(`      console.error: ${e}`);
        for (const o of overflow.offenders) console.log(`      越界元素: ${o}`);

        await tab.close();
    }
} finally {
    await browser.close();
    server.kill();
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${report.length - failed}/${report.length} 个页面通过真实浏览器验证`);
if (failed > 0) {
    console.log(JSON.stringify(report.filter((r) => !r.ok), null, 2));
    process.exit(1);
}
