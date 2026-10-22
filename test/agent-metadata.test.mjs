/**
 * Agent 元数据契约测试。
 *
 * llms.txt 与 skills/ 是给 AI 编码代理看的「第二种文档」：它们随包发布，一旦路径写错、
 * 忘了进 files 白名单、或者代码加了新方法却没人补文档，代理就会照着旧信息写错代码。
 * 这里用源码当唯一事实来源，把「文档漏了哪个公开 API」变成会失败的断言。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));

/** `./llms.txt` → `llms.txt` */
const strip = (p) => p.replace(/^\.\//, '');

const LLMS = strip(pkg.llms);
const SKILL = strip(pkg.agents);
const SKILL_DIR = path.posix.dirname(SKILL);
const LLMS_PATH = path.join(root, LLMS);
const SKILL_PATH = path.join(root, SKILL);

/** 白名单里写目录等于收录整个目录，写文件等于只收该文件 */
const inFiles = (target) =>
    pkg.files.some((entry) => {
        const clean = strip(entry).replace(/\/$/, '');
        return target === clean || target.startsWith(clean + '/');
    });

/** 从 UMD 源码里抓公开实例方法（下划线开头的是内部方法，不算 API） */
const RUNTIME_METHODS = [...read('lib/js/xqmusic.js').matchAll(/XqMusic\.prototype\.(\w+)\s*=/g)]
    .map((m) => m[1])
    .filter((name) => !name.startsWith('_'));

/** 从 ESM 工具模块抓导出名 */
const UTIL_EXPORTS = [...read('lib/js/xqmusic-utils.mjs').matchAll(/export function (\w+)/g)].map((m) => m[1]);

describe('agent 元数据字段', () => {
    it('package.json 声明了 llms 与 agents', () => {
        assert.equal(pkg.llms, './llms.txt');
        assert.equal(pkg.agents, './skills/xqmusic-player/SKILL.md');
    });

    it('llms 与 agents 都指向真实存在的文件', () => {
        assert.ok(existsSync(LLMS_PATH), `缺少 ${LLMS}`);
        assert.ok(existsSync(SKILL_PATH), `缺少 ${SKILL}`);
    });

    it('元数据文件被 files 白名单收录，否则不会进 npm 包', () => {
        assert.ok(inFiles(LLMS), `${LLMS} 不在 files 白名单里`);
        assert.ok(inFiles(SKILL), `${SKILL} 不在 files 白名单里`);
        // 技能目录整个发布，references/ 才会跟着走
        assert.ok(inFiles(SKILL_DIR + '/references/api.md'), 'references/api.md 不在 files 白名单里');
    });

    it('元数据不改变入口字段', () => {
        assert.equal(pkg.main, 'lib/js/xqmusic.js');
        assert.equal(pkg.exports['.'], './lib/js/xqmusic.js');
        assert.equal(pkg.exports['./vue'], './lib/vue/xqmusic.js');
    });
});

describe('llms.txt 内容', () => {
    const llms = read(LLMS);

    it('写明了每个公开工具函数', () => {
        for (const name of UTIL_EXPORTS) {
            assert.ok(llms.includes(name), `llms.txt 没提纯函数 ${name}`);
        }
        assert.ok(UTIL_EXPORTS.length >= 5, '工具函数的导出名没抓到，正则可能失效');
    });

    it('写明了核心实例方法与静态成员', () => {
        const required = [
            'playSong',
            'togglePrevSong',
            'toggleNextSong',
            'toggleMusic',
            'setMuted',
            'setLyricSource',
            'getLyric',
            'parseLyric',
            'calcTimeStr',
            'destroy',
            'XqMusic.VERSION',
            'XqMusic.utils',
        ];
        for (const name of required) {
            assert.ok(llms.includes(name), `llms.txt 没提 ${name}`);
        }
    });

    it('写明了三个构造选项与歌曲字段', () => {
        for (const token of ['el', 'list', 'mode', 'lyric_url', 'pic', 'author']) {
            assert.ok(llms.includes(token), `llms.txt 没提 ${token}`);
        }
    });

    it('写明了入口子路径与前置约束', () => {
        for (const token of ['xqmusic-player/utils', 'xqmusic-player/vue', '$g', 'xqgjs', 'Font Awesome', 'fetch']) {
            assert.ok(llms.includes(token), `llms.txt 没提 ${token}`);
        }
    });

    it('版本号与 package.json 同步', () => {
        assert.ok(llms.includes(pkg.version), `llms.txt 里的版本号不是 ${pkg.version}`);
    });
});

describe('技能文件', () => {
    const skill = read(SKILL);
    const front = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);

    it('frontmatter 齐全且 name 与目录名一致', () => {
        assert.ok(front, 'SKILL.md 缺少 YAML frontmatter');
        const fields = {};
        for (const line of front[1].split(/\r?\n/)) {
            const at = line.indexOf(':');
            if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
        }
        assert.match(fields.name || '', /^[a-z0-9]+(-[a-z0-9]+)*$/, 'name 必须是全小写连字符');
        assert.equal(fields.name, path.posix.basename(SKILL_DIR), 'name 应与技能目录名一致');
        assert.ok((fields.description || '').length >= 40, 'description 要同时说明能力与加载时机');
        assert.match(fields.description, /xqmusic-player/);
    });

    it('相对引用都存在，且都被包在白名单内', () => {
        const links = [...skill.matchAll(/\]\(([^)#]+)\)/g)]
            .map((m) => m[1])
            .filter((href) => !/^(?:https?:|mailto:)/.test(href));
        assert.ok(links.length > 0, 'SKILL.md 至少要链到 references/api.md');
        for (const href of links) {
            const target = path.posix.normalize(path.posix.join(SKILL_DIR, href));
            assert.ok(target.startsWith(SKILL_DIR + '/'), `${href} 跑到技能目录外了，发布后会失效`);
            assert.ok(existsSync(path.join(root, target)), `引用的 ${href} 不存在`);
            assert.ok(inFiles(target), `引用的 ${href} 不在 files 白名单里`);
        }
    });

    it('详细参考覆盖了源码里的全部公开实例方法', () => {
        const api = read(path.join(SKILL_DIR, 'references/api.md'));
        assert.ok(RUNTIME_METHODS.length > 20, '没抓到实例方法，正则可能失效');
        for (const name of RUNTIME_METHODS) {
            assert.ok(api.includes(name), `references/api.md 漏了实例方法 ${name}`);
        }
    });

    it('详细参考里的版本号与 package.json 同步', () => {
        assert.ok(read(path.join(SKILL_DIR, 'references/api.md')).includes(pkg.version), 'api.md 里的版本号过期了');
    });

    it('没有 TODO 占位或仓库专有路径', () => {
        for (const [name, text] of [
            ['SKILL.md', skill],
            ['references/api.md', read(path.join(SKILL_DIR, 'references/api.md'))],
            ['llms.txt', read(LLMS)],
        ]) {
            assert.doesNotMatch(text, /\b(?:TODO|FIXME|TBD)\b/, `${name} 还留着占位符`);
            assert.doesNotMatch(text, /\b(?:test|scripts|docs)\//, `${name} 引用了不随包发布的目录`);
        }
    });
});

describe('编码', () => {
    it('新文件都是无 BOM 的 UTF-8', () => {
        for (const file of [LLMS, SKILL, SKILL_DIR + '/references/api.md']) {
            const buffer = readFileSync(path.join(root, file));
            assert.notEqual(buffer[0], 0xef, `${file} 带 BOM`);
            assert.ok(!buffer.toString('utf8').includes('\uFFFD'), `${file} 含替换字符`);
        }
    });
});
