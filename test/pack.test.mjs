/**
 * 打包产物测试。
 *
 * 前面的契约测试只检查 package.json 里的 `files` 数组「写了什么」，但真正决定 npm 包里
 * 有什么的是 npm 自己的打包结果：白名单条目写错路径、被 .npmignore 覆盖、或者新增的
 * 元数据文件忘了加进白名单，磁盘上的断言全会通过，发出去的包里却没有那个文件。
 *
 * 这里直接跑一次 `npm pack --dry-run --json`，对着真实 tarball 清单做断言。
 * 只在内存里模拟打包，不落盘、不跑生命周期脚本，几秒内结束。
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

/** `./llms.txt` → `llms.txt` */
const strip = (p) => p.replace(/^\.\//, '');

/**
 * 跑一次 dry-run 打包，取回实际文件清单。
 *
 * 结果缓存起来：一次 npm 调用要一两秒，五个断言没必要各跑一遍。
 * @returns {{ entryCount: number, size: number, files: { path: string, size: number }[] }}
 */
let packed;
function manifest() {
    if (packed) return packed;
    const raw = execSync('npm pack --dry-run --json --ignore-scripts', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
    });
    // npm 有时会在 JSON 前面掺一行 warning，从第一个 '[' 开始截
    packed = JSON.parse(raw.slice(raw.indexOf('[')))[0];
    return packed;
}

/** tarball 内的文件路径集合 */
const paths = () => new Set(manifest().files.map((f) => f.path));

describe('npm 打包产物', () => {
    it('dry-run 能跑通并返回文件清单', () => {
        const result = manifest();
        assert.ok(result.entryCount > 0, '打包结果为空，npm pack 可能失败了');
        assert.equal(result.entryCount, result.files.length);
    });

    it('agent 元数据文件真的进包了', () => {
        const set = paths();
        const required = [
            'llms.txt',
            strip(pkg.agents),
            path.posix.join(path.posix.dirname(strip(pkg.agents)), 'agents/openai.yaml'),
            path.posix.join(path.posix.dirname(strip(pkg.agents)), 'references/api.md'),
        ];
        for (const file of required) {
            assert.ok(set.has(file), `${file} 不在打包产物里——检查 files 白名单或 .npmignore`);
        }
    });

    it('运行入口与样式都能从包里取到', () => {
        const set = paths();
        const entries = [
            pkg.main,
            pkg.browser,
            pkg.unpkg,
            pkg.style,
            strip(pkg.llms),
            'lib/js/xqmusic.min.js',
            'lib/css/xqmusic.min.css',
            'lib/js/xqmusic-utils.mjs',
            'lib/vue/xqmusic.js',
            'lib/vue/xqmusic.vue',
            'package.json',
            'LICENSE',
            'README.md',
        ];
        for (const entry of entries) {
            assert.ok(set.has(entry), `入口 ${entry} 没被打进包`);
        }
    });

    it('exports 里每个具体路径都在包内', () => {
        const set = paths();
        for (const [subpath, target] of Object.entries(pkg.exports)) {
            if (subpath.includes('*') || typeof target !== 'string') continue;
            assert.ok(set.has(strip(target)), `exports["${subpath}"] -> ${target} 不在打包产物里`);
        }
    });

    it('仓库专有目录没被误打进包', () => {
        const junk = ['test/', 'scripts/', 'docs/', '.workbuddy/', 'node_modules/', '.git/', '.build-check'];
        for (const file of paths()) {
            for (const prefix of junk) {
                assert.ok(!file.startsWith(prefix), `${file} 不该出现在 npm 包里`);
            }
            assert.ok(!file.endsWith('.map'), `${file} 是构建中间产物，不该发布`);
        }
    });

    it('技能里引用的文件都能在包内解析到', () => {
        const set = paths();
        const skill = strip(pkg.agents);
        const dir = path.posix.dirname(skill);
        const text = readFileSync(path.join(root, skill), 'utf8');
        const links = [...text.matchAll(/\]\(([^)#]+)\)/g)]
            .map((m) => m[1])
            .filter((href) => !/^(?:https?:|mailto:)/.test(href));
        assert.ok(links.length > 0, 'SKILL.md 至少要链到 references/api.md');
        for (const href of links) {
            const target = path.posix.normalize(path.posix.join(dir, href));
            assert.ok(set.has(target), `SKILL.md 里的 ${href} 解析成 ${target}，但包里没有`);
        }
    });

    it('技能本体与引用文件都非空', () => {
        const sizes = new Map(manifest().files.map((f) => [f.path, f.size]));
        for (const file of ['llms.txt', strip(pkg.agents)]) {
            assert.ok(sizes.get(file) > 200, `${file} 只有 ${sizes.get(file)} 字节，内容可能被截断`);
        }
    });
});

describe('打包前的本地一致性', () => {
    it('元数据字段指向的文件在磁盘上存在', () => {
        for (const key of ['llms', 'agents']) {
            assert.ok(existsSync(path.join(root, strip(pkg[key]))), `${key} -> ${pkg[key]} 不存在`);
        }
    });

    it('技能目录里的 agent 描述文件与技能名对得上', () => {
        const skill = strip(pkg.agents);
        const yamlPath = path.join(root, path.posix.dirname(skill), 'agents/openai.yaml');
        assert.ok(existsSync(yamlPath), '缺少 agents/openai.yaml');
        const yaml = readFileSync(yamlPath, 'utf8');
        assert.match(yaml, /^\s*display_name:\s*\S+/m, 'openai.yaml 缺少 display_name');
        assert.match(yaml, /^\s*default_prompt:\s*\S+/m, 'openai.yaml 缺少 default_prompt');
        assert.ok(
            yaml.includes(`$${path.posix.basename(path.posix.dirname(skill))}`),
            'default_prompt 应该用 $<技能名> 引用本技能'
        );
    });
});
