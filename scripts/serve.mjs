/**
 * 零依赖静态服务器，用于在真实浏览器里跑 test/*.html。
 *
 * 替代原来 `live-server`（需要全局安装，干净环境跑不起来）。这里只用 Node 标准库。
 *
 * 用法：
 *   node scripts/serve.mjs
 *   HOST=0.0.0.0 PORT=8080 node scripts/serve.mjs
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4001);

/** 需要精确 MIME 的扩展名；.mjs / .lrc 用错类型会导致模块加载或 fetch 失败 */
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.lrc': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
};

/**
 * 把请求路径解析成仓库内的绝对路径，越界或进入 node_modules 一律返回 null
 * @param {string} urlPath
 * @returns {string|null}
 */
function resolvePath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const target = path.resolve(root, '.' + path.posix.normalize(decoded));

    // 目录穿越与 node_modules 防护
    if (!target.startsWith(root + path.sep) && target !== root) return null;
    if (target.includes(path.sep + 'node_modules' + path.sep)) return null;
    return target;
}

/**
 * 第三方运行时别名：测试页要用到 Vue 浏览器构建，但不应该在仓库里塞一份二进制副本，
 * 也不应该依赖外网 CDN（离线就跑不了自检）。这里把它映射到 node_modules 里的那份。
 * 注意这是唯一一处刻意允许访问 node_modules 的路径，白名单写死，不走通用解析。
 */
const NODE_MODULES_ALIAS = {
    '/test/vendor/vue.esm-browser.prod.js': 'vue/dist/vue.esm-browser.prod.js',
    '/test/vendor/vue.esm-browser.js': 'vue/dist/vue.esm-browser.js',
};

const server = createServer((req, res) => {
    const urlPath = req.url || '/';

    if (urlPath === '/' || urlPath === '') {
        res.writeHead(302, { Location: '/test/' });
        res.end();
        return;
    }

    const alias = NODE_MODULES_ALIAS[urlPath.split('?')[0]];
    if (alias) {
        const aliased = path.resolve(root, 'node_modules', alias);
        if (!existsSync(aliased)) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 缺少依赖，请先执行 npm install：' + alias);
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME['.mjs'],
            'Cache-Control': 'no-store',
        });
        createReadStream(aliased).pipe(res);
        return;
    }

    const target = resolvePath(urlPath);
    if (!target) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 越界路径');
        return;
    }

    let filePath = target;
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 找不到: ' + urlPath);
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
});

const PAGES = ['index.html', 'umd.html', 'esm.html', 'vue3.html'];

server.listen(port, host, () => {
    console.log(`xqmusic-player 测试服务器: http://${host}:${port}/`);
    for (const page of PAGES) {
        console.log(`  http://${host}:${port}/test/${page}`);
    }
});
