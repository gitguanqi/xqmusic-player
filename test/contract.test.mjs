/**
 * 文件契约测试。
 *
 * 这些断言很快，也不启动浏览器，但能拦住最常见的一类回归：
 * 路径写错、产物没重新生成、页面漏了共享资源、文档和清单字段对不上。
 *
 * 它们不替代真实浏览器里的验证（见 test/*.html 与 npm run test:browser）。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEMO_PATH, compileSfc } from '../scripts/build-vue-demo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));

const PAGES = ['test/index.html', 'test/umd.html', 'test/esm.html', 'test/vue3.html'];

describe('package.json 清单', () => {
    it('提供完整的入口字段', () => {
        assert.equal(pkg.main, 'lib/js/xqmusic.js');
        assert.equal(pkg.browser, 'lib/js/xqmusic.js');
        assert.equal(pkg.unpkg, 'lib/js/xqmusic.min.js');
        assert.equal(pkg.style, 'lib/css/xqmusic.css');
        assert.ok(pkg.exports['.'], 'exports 必须包含 "."');
        assert.ok(pkg.exports['./lib/*'], 'exports 必须保留 ./lib/* 通配，否则历史深路径会断');
        assert.ok(pkg.exports['./vue'], 'exports 必须暴露 Vue 入口');
    });

    it('入口字段指向的文件真实存在', () => {
        for (const key of ['main', 'browser', 'unpkg', 'style']) {
            assert.ok(existsSync(path.join(root, pkg[key])), `${key} -> ${pkg[key]} 不存在`);
        }
    });

    it('files 白名单包含运行时需要的目录', () => {
        assert.ok(pkg.files.includes('lib'));
        assert.ok(pkg.files.includes('README.md'));
        assert.ok(pkg.files.includes('LICENSE'));
        // 测试页与 RFC 是给维护者看的，不该进 npm 包
        for (const excluded of ['test', 'docs', 'scripts']) {
            assert.ok(!pkg.files.includes(excluded), `files 不应包含 ${excluded}`);
        }
    });

    it('test 脚本不再是必然失败的占位符', () => {
        assert.ok(!/exit\s+1/.test(pkg.scripts.test), 'npm test 不能无条件退出 1');
        assert.ok(/node --test/.test(pkg.scripts.test));
        assert.ok(!/live-server/.test(pkg.scripts['test:browser']), 'test:browser 不应依赖全局安装的 live-server');
    });

    it('声明了运行时前置依赖', () => {
        assert.ok(pkg.peerDependencies.xqgjs, '必须声明 xqgjs 前置依赖');
        assert.equal(pkg.peerDependenciesMeta.xqgjs.optional, true);
        assert.ok(pkg.peerDependencies.vue);
    });
});

describe('版本号一致性', () => {
    it('源码 banner、VERSION 常量、CSS banner、Vue 插件都等于 package.json', () => {
        const version = pkg.version;
        assert.equal(pkg.version, '1.2.1');
        assert.match(read('lib/js/xqmusic.js'), new RegExp(`xqmusic-player v${version.replace(/\./g, '\\.')}`));
        assert.match(read('lib/js/xqmusic.js'), new RegExp(`var VERSION = '${version.replace(/\./g, '\\.')}'`));
        assert.match(read('lib/js/xqmusic.min.js'), new RegExp(`xqmusic-player v${version.replace(/\./g, '\\.')}`));
        assert.match(read('lib/css/xqmusic.css'), new RegExp(`xqmusic-player v${version.replace(/\./g, '\\.')}`));
        assert.match(read('lib/vue/xqmusic.js'), new RegExp(`version: '${version.replace(/\./g, '\\.')}'`));
    });

    it('不再残留 0.0.1 老版本号', () => {
        for (const file of ['lib/js/xqmusic.js', 'lib/css/xqmusic.css']) {
            assert.ok(!/version:\s*0\.0\.1/.test(read(file)), `${file} 还留着 0.0.1`);
        }
    });
});

describe('UMD 导出形态', () => {
    it('源码保留经典脚本的全局名，同时支持 CommonJS 与 AMD', () => {
        const source = read('lib/js/xqmusic.js');
        assert.match(source, /window\.XqMusic = XqMusic/);
        assert.match(source, /module\.exports = XqMusic/);
        assert.match(source, /define\.amd/);
        assert.match(source, /function XqMusic\(/, '构造器函数名不能改，外部依赖 new XqMusic()');
    });

    it('压缩产物同样保留全局名', () => {
        assert.match(read('lib/js/xqmusic.min.js'), /window\.XqMusic=/);
    });
});

describe('样式表契约', () => {
    /** 去掉注释再断言，避免把说明文字当成真实规则 */
    const stripCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

    it('不再用 #xqmusic-* 这种 id 选择器（多实例会串台）', () => {
        for (const file of ['lib/css/xqmusic.css', 'lib/css/xqmusic.min.css']) {
            const css = stripCss(read(file));
            assert.ok(!/#xqmusic-/.test(css), `${file} 仍在使用 id 选择器`);
        }
    });

    it('不再全局重置 body / ul / button', () => {
        const css = stripCss(read('lib/css/xqmusic.css'));
        assert.ok(!/^body\s*\{/m.test(css), '不应全局重置 body');
        assert.ok(!/^ul,\s*li\s*\{/m.test(css), '不应全局重置 ul,li');
        assert.ok(!/^button\s*\{/m.test(css), '不应全局重置 button');
    });

    it('进度条只过渡 width', () => {
        const css = stripCss(read('lib/css/xqmusic.css'));
        assert.ok(!/transition:\s*all/.test(css), 'transition: all 会把布局属性一起过渡');
        assert.match(css, /transition:\s*width \.5s linear/);
    });
});

describe('Vue 封装契约', () => {
    const sfc = read('lib/vue/xqmusic.vue');

    it('不再依赖 less 预处理器', () => {
        assert.ok(!/lang="less"/.test(sfc), 'SFC 不能声明 lang="less"，消费方没有 less 会编译失败');
    });

    it('不再依赖宿主注入的 $http', () => {
        assert.ok(!/proxy\.\$http|\$http\.get/.test(sfc), '组件不能依赖宿主注入的 $http');
        assert.match(sfc, /fetch\(/, '歌词请求应走原生 fetch');
    });

    it('用行内 display 而不是 v-show（外部 CSS 有 display:none）', () => {
        assert.ok(!/v-show=/.test(sfc), 'v-show 会被 xqmusic.css 的 display:none 压回');
        assert.match(sfc, /display: showList \? 'block' : 'none'/);
    });

    it('有单一 timeupdate 注册点与卸载钩子', () => {
        assert.equal((sfc.match(/addEventListener\('timeupdate'/g) || []).length, 1);
        assert.match(sfc, /onBeforeUnmount/);
        assert.match(sfc, /removeEventListener\('timeupdate'/);
    });

    it('消费共享的 ESM 工具模块与同一份样式表', () => {
        assert.match(sfc, /from '\.\.\/js\/xqmusic-utils\.mjs'/);
        assert.match(sfc, /import '\.\.\/css\/xqmusic\.css'/);
    });

    it('预编译产物与 SFC 保持同步', () => {
        assert.ok(existsSync(DEMO_PATH), '缺少 test/assets/xqmusic-demo.mjs，请运行 node scripts/build-vue-demo.mjs');
        assert.equal(read('test/assets/xqmusic-demo.mjs'), compileSfc(), '预编译产物已过期，请运行 node scripts/build-vue-demo.mjs');
    });
});

describe('测试页契约', () => {
    it('每个页面都用共享图标作 favicon', () => {
        for (const page of PAGES) {
            const html = read(page);
            assert.match(html, /<link rel="icon" href="\.\/assets\/test-icon\.svg"/, `${page} 缺共享图标`);
            assert.match(html, /<img src="\.\/assets\/test-icon\.svg"/, `${page} 缺页头图标`);
        }
    });

    it('自检页在使用前必须先加载共享运行器', () => {
        // check-runner.js 是经典脚本，必须排在页面自己的脚本之前，否则 XqDemo 是 undefined
        for (const page of PAGES.slice(1)) {
            const html = read(page);
            assert.match(html, /<script src="\.\/assets\/check-runner\.js"><\/script>/, `${page} 没有加载自检运行器`);
            const at = html.indexOf('assets/check-runner.js');
            const own = html.search(/<script(?: type="module")?>\s*\n\s*(?:\(function|import |window\.XqDemo)/);
            assert.ok(own === -1 || at < own, `${page} 的运行器顺序不对，XqDemo 会取不到`);
        }
    });

    it('UMD 页加载提交进仓库的压缩产物', () => {
        const html = read('test/umd.html');
        assert.match(html, /<script src="\.\.\/lib\/js\/xqmusic\.min\.js"><\/script>/);
        assert.match(html, /href="\.\.\/lib\/css\/xqmusic\.min\.css"/);
    });

    it('ESM 页用真正的模块脚本导入 ESM 产物', () => {
        const html = read('test/esm.html');
        assert.match(html, /<script type="module">/);
        assert.match(html, /from '\.\.\/lib\/js\/xqmusic-utils\.mjs'/);
    });

    it('Vue 页通过 CDN 引入运行时，版本锁在 devDependencies', () => {
        const html = read('test/vue3.html');
        assert.match(html, /"vue": "https:\/\/(unpkg\.com|cdn\.bootcdn\.net|registry\.npmmirror\.com)\/[^"]*vue@3\.\d+\.\d+[^"]*vue\.esm-browser\.prod\.js"/);
        assert.match(html, /from '\.\/assets\/xqmusic-demo\.mjs'/);
        assert.match(html, /type="importmap"/);
        // 版本锁在 devDependencies，页面 CDN 地址必须与之一致
        const pkg = JSON.parse(read('package.json'));
        assert.match(pkg.devDependencies.vue, /^[\^~]?3\.\d+\.\d+$/, 'vue 必须锁到具体版本');
        const locked = pkg.devDependencies.vue.replace(/^[\^~]/, '');
        assert.ok(html.includes(`vue@${locked}/`) || html.includes(`vue/${locked}/`), `页面 CDN 版本必须与 devDependencies 的 ${locked} 一致`);
    });

    it('页面不依赖第三方 CDN 上的 $g', () => {
        for (const page of PAGES) {
            const html = read(page);
            assert.ok(!/xqgjs\.min\.js/.test(html), `${page} 仍在从 CDN 拉 $g`);
            assert.ok(!/xqgj\.cc/.test(html), `${page} 仍引用第三方域名`);
        }
    });

    it('索引页链接了全部场景', () => {
        const html = read('test/index.html');
        for (const target of ['./umd.html', './esm.html', './vue3.html']) {
            assert.ok(html.includes(`href="${target}"`), `索引页缺少 ${target}`);
        }
    });

    it('每个页面都有可读的状态区与检查列表', () => {
        for (const page of ['test/umd.html', 'test/esm.html', 'test/vue3.html']) {
            const html = read(page);
            assert.match(html, /aria-live="polite"/, `${page} 缺 aria-live 状态区`);
            assert.match(html, /id="checks"/, `${page} 缺检查列表`);
            assert.match(html, /XqDemo\.report\(/, `${page} 没有汇报结论`);
        }
    });
});

describe('mock 素材', () => {
    it('music.json 引用的资源都存在', () => {
        // 注意基准是 test/（页面所在目录）而不是 test/mock/：
        // 浏览器按文档 URL 解析这些相对路径，music.json 只是恰好放在子目录里。
        const songs = JSON.parse(read('test/mock/music.json'));
        assert.ok(songs.length >= 3);
        assert.ok(songs.some((s) => !s.lyric_url), '需要一首没有歌词的样本，用来覆盖降级分支');
        for (const song of songs) {
            for (const key of ['pic', 'url', 'lyric_url']) {
                if (!song[key]) continue;
                const target = path.resolve(root, 'test', song[key]);
                assert.ok(existsSync(target), `music.json 的 ${key} 指向不存在的文件: ${song[key]}`);
            }
        }
    });

    it('测试页不再引用外网 CDN（离线也要能自检）', () => {
        const pages = ['test/index.html', 'test/umd.html', 'test/esm.html', 'test/vue3.html'];
        for (const page of pages) {
            const html = read(page);
            const cdn = html.match(/(?:src|href)="https?:\/\/[^"]+"/g);
            assert.ok(!cdn, `${page} 仍依赖外网资源: ${cdn ? cdn.join(', ') : ''}`);
        }
    });
});

describe('文档', () => {
    const docs = ['README.md', 'zh.md'];

    it('不再出现已经不存在的 libs/ 深路径', () => {
        for (const doc of docs) {
            assert.doesNotMatch(read(doc), /libs\/(vue|js|css)\//, `${doc} 仍在引用旧的 libs/ 目录`);
        }
    });

    it('写明了 $g / Font Awesome / fetch 三个前置依赖', () => {
        for (const doc of docs) {
            const text = read(doc);
            assert.match(text, /\$g/, `${doc} 没说要依赖 \$g`);
            assert.match(text, /xqgjs/, `${doc} 没给出 \$g 的来源`);
            assert.match(text, /Font Awesome/, `${doc} 没提图标依赖`);
            assert.match(text, /fetch/, `${doc} 没提歌词请求方式`);
        }
    });

    it('Vue 入口指向包导出的子路径', () => {
        assert.match(read('README.md'), /from 'xqmusic-player\/vue'/);
        assert.match(read('zh.md'), /from 'xqmusic-player\/vue'/);
    });

    it('明确写出不支持 Vue 2，并指向 2.0.0 RFC', () => {
        for (const doc of docs) {
            const text = read(doc);
            assert.match(text, /不支持 Vue 2|Vue 2 is not supported/, `${doc} 没写明 Vue 2 的兼容状态`);
            assert.match(text, /docs\/RFC-2\.0\.0\.md/, `${doc} 没指向 2.0.0 RFC`);
        }
    });

    it('预览图用仓库内的文件，不再挂在第三方域名上', () => {
        assert.match(read('README.md'), /!\[preview\]\(\.\/test\/img\/preview\.jpg\)/);
        assert.match(read('zh.md'), /!\[preview\]\(\.\/test\/img\/preview\.jpg\)/);
        assert.ok(existsSync(path.join(root, 'test/img/preview.jpg')));
        assert.ok(existsSync(path.join(root, 'test/img/cover-demo.jpg')), 'mock 数据引用的占位封面必须存在');
        for (const doc of docs) {
            assert.doesNotMatch(read(doc), /xqgj\.cc\/xqmusic-player\/test\//);
        }
    });

    it('RFC 文档存在且被 CHANGELOG 指向', () => {
        assert.ok(existsSync(path.join(root, 'docs/RFC-2.0.0.md')), '缺少 docs/RFC-2.0.0.md');
        assert.match(read('CHANGELOG.md'), /docs\/RFC-2\.0\.0\.md/);
    });

    it('CHANGELOG 记录了当前版本', () => {
        assert.match(read('CHANGELOG.md'), new RegExp(`## \\[${pkg.version.replace(/\./g, '\\.')}\\]`));
    });
});

describe('编码', () => {
    it('所有文本文件都是合法 UTF-8 且没有 BOM', () => {
        const files = [
            'lib/js/xqmusic.js',
            'lib/js/xqmusic-utils.mjs',
            'lib/css/xqmusic.css',
            'lib/vue/xqmusic.vue',
            'lib/vue/xqmusic.js',
            'README.md',
            'zh.md',
            'CHANGELOG.md',
            'docs/RFC-2.0.0.md',
            ...PAGES,
        ];
        for (const file of files) {
            const buffer = readFileSync(path.join(root, file));
            assert.notEqual(buffer[0], 0xef, `${file} 带 BOM`);
            const text = buffer.toString('utf8');
            assert.ok(!text.includes('\uFFFD'), `${file} 含替换字符，编码已损坏`);
        }
    });

    it('中文注释完好', () => {
        assert.match(read('lib/js/xqmusic.js'), /小奇|歌词|实例/);
        assert.match(read('lib/css/xqmusic.css'), /歌曲封面图/);
    });
});
