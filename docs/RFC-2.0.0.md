# RFC：xqmusic-player 2.0.0（征求意见稿）

- 状态：**草案**，等待维护者决定
- 提出日期：2026-10-21
- 涉及版本：2.0.0（major）
- 作者：维护者 + 本次重构贡献者

## 为什么要单独开一个 RFC

1.2.0 之前这一轮修的都是「错了」的部分：崩溃、XSS、事件泄漏、装了没法用、文档对不上代码。
这些都是**向后兼容**的，可以直接发 patch / minor。

下面这些则不是修 bug，而是**设计取舍**。它们会让某些现有用法失效、变更模块格式或引入新的构建复杂度。
按语义化版本的要求，必须单独一个 major，并且先把动机、代价、迁移路径摊开来讲清楚。

> 本 RFC 只做提案，**尚未实施**。1.x 分支不受影响。

---

## 提案 1：去掉外置 `$g`，改为零运行时依赖

### 现状

构造函数硬性依赖宿主提供全局 `$g`（来自 `xqgjs`），只用到两个成员：

| 用法 | 位置 | 说明 |
| --- | --- | --- |
| `$g.dom(el)` | `lib/js/xqmusic.js` 构造函数 | 解析宿主元素，等价于「选择器就 `querySelector`，否则原样返回」 |
| `$g.Drag(root)` | `boxDrag()` | 只在 `mode: 'move'` 时生效 |

没加载 `$g` 就直接抛错。这个依赖在 1.0.x 里既没写在 `dependencies` 里，也没写进 README。

### 问题

- 一个 300 行的播放器要求先引入一个 20KB+ 的工具库，成本与合作意愿都不成比例。
- `$g` 是**全局变量**：宿主页面里任何一个第三方脚本都能覆写它。
- `xqgjs` 没有 TypeScript 声明，`$g` 的类型无法推导。

### 提案

1. `$g.dom` → 内置 `resolveHost(el)`（约 6 行），`$g` 变成可选。
2. 拖拽（`mode: 'move'`）自己实现，约 25 行（pointerdown / pointermove / pointerup + `setPointerCapture`），
   比现在的 `Drag` 更好的是它同时支持触摸与笔输入。
3. `xqgjs` 从 `peerDependencies` 移除。

### 影响

- **正面**：`npm i xqmusic-player` 之后真的「开箱即用」，不需要第二行安装命令。
- **负面**：`mode: 'move'` 的手感可能与旧版有细微差异（比如不再继承 `$g.Drag` 的边界约束）。

### 迁移

对绝大多数使用者**无感**——只有真的用了 `move` 模式的人才需要重新验证拖拽行为。
旧页面里继续引入 `$g` 也不会报错（只是不再被用到）。

---

## 提案 2：UMD + ESM 双产物

### 现状

只有一份 UMD：`<script>` 能用、`require()` 能用，但**不能被 `import` 静态分析**，也没有 tree-shaking。
`lib/js/xqmusic-utils.mjs` 是唯一真正的 ESM，而且是纯函数，不含类本身。

### 提案

用 esbuild 产出两/三份，并补上 `exports` 的条件导出：

```
dist/xqmusic.cjs      # CommonJS（等价于现在的 lib/js/xqmusic.js）
dist/xqmusic.mjs      # ESM（新的）
dist/xqmusic.min.js   # 浏览器全局 + CDN 用（等价于现在的 min 产物）
```

```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/xqmusic.mjs",
    "require": "./dist/xqmusic.cjs",
    "browser": "./dist/xqmusic.min.js",
    "default": "./dist/xqmusic.cjs"
  }
}
```

### 影响

- **正面**：打包器能 tree-shake；不需要 veneer；原生 `<script type="module">` 可直接 `import`。
- **负面**：构建从「一个 esbuild transform」升级成真正的多目标流水线；`lib/` 不再是源码，
  开发与产物分离，仓库里要多一个 `dist/`。

### 争议点

本仓库长期把**构建产物提交进仓库**，这也是 `browser-check.mjs` 能直接用 min 产物跑页面自检的前提。
双产物会放大「忘了重新 build」的风险。`build:check` 已经能兜住这一点，建议把它挂到 CI 的必经步骤。

> 需要维护者决定：是否接受「源码在 `src/`、产物在 `dist/` 并提交」这套结构。
> 这属于包结构变更，超出了修复类改动的护栏范围。

---

## 提案 3：TypeScript 声明与类型化 API

### 现状

没有任何 `.d.ts`。TS 项目里 `import XqMusic from 'xqmusic-player'` 会得到隐式 `any`，
`options.list` 的字段形状全靠猜。

### 提案

手写 `types/index.d.ts`（不引入 `tsc` 编译，只做签名声明）：

```ts
export interface SongItem {
    id: number | string;
    name: string;
    author?: string;
    pic?: string;
    url: string;
    lyric_url?: string;
}

export interface XqMusicOptions {
    el: string | Element;
    list?: SongItem[];
    mode?: 'slide' | 'move';
}

export declare class XqMusic {
    constructor(options: XqMusicOptions);
    playSong(): void;
    togglePrevSong(): void;
    toggleNextSong(): void;
    setMuted(flag: boolean): boolean;
    destroy(): void;
    static VERSION: string;
}
```

### 影响

- **正面**：TS 用户获得补全与类型检查；`SongItem` 成为可引用的契约类型。
- **负面**：声明必须与实现同步维护，需要和 `type: types` 测试一起才能保证不漂移。

### 依赖

建议在提案 2（UMD 单文件不再兼任所有角色）之后做，避免声明文件与多种模块格式纠缠。

---

## 提案 4：Vue 2 / Vue 3 单源双兼容

### 现状

`lib/vue/xqmusic.vue` 用的是 `<script setup>`，**只有 Vue 3 能编译**。
README 与 CHANGELOG 里已经明确写了「不支持 Vue 2」，但这与最初「同一套组件代码服务两种 Vue 用法」的设想有落差。

### 提案

两条路，各有权衡：

| 方案 | 做法 | 优点 | 代价 |
| --- | --- | --- | --- |
| A. 降级到 Options API | 组件改成 `export default { props, data, methods }`，双 `destroyed` / `onUnmounted` 清理钩子 | 一份源文件同时支持 Vue 2.7 与 Vue 3；无需构建 | 失去 `<script setup>` 的简洁；需要手动兼容 `modelValue` 与旧 `value` |
| B. 双构建产物 | 保留 `<script setup>` 源码，构建时额外编译一份 Vue 2 产物 | 源码保持现代写法 | 需要 `vue2` 的 compile 依赖与两套 CI 矩阵 |

倾向 **A**：这个组件的状态很少（歌词数组、当前索引、播放标志、两个面板显隐），
改写成 Options API 的成本远低于长期维护两套构建。

### 影响

- **正面**：Vue 2.7 的存量项目可以继续用，Claims 与文档终于一致。
- **负面**：Vue 2 已 EOL，为它付出复杂度是否值得，需要维护者拍板。

---

## 提案 5：`deploy.sh` 的强制推送

### 现状

```sh
git push origin main -f
```

### 提案

改为普通推送，并在失败时提示人工处理：

```sh
git push origin main || {
    echo "推送失败：远端有新提交，请先 git pull --rebase"
    exit 1
}
```

`-f` 会在多人协作或 CI 自动提交时静默丢掉别人的提交。这条不属于规格变动，
但因为改的是发布脚本，仍然建议随 2.0.0 一起走，而不是在 1.x 里悄悄改。

---

## 不在本次范围内的已有建议

以下项目虽然有价值，但与上述提案无依赖关系，可以各自独立排期，不阻塞 2.0.0：

- 播放模式（单曲循环 / 列表循环 / 随机）与播放速率控制
- 键盘无障碍（`aria-label`、`role`、`tabindex`、空格键播放）
- 进度条拖拽定位（目前只读）
- 音量滑块（目前只有静音开关）
- Media Session API 集成（系统级播放控制）
- 多主题与 CSS 变量抽取

---

## 决策清单

请维护者在每一项上选择「采纳 / 推迟 / 否决」：

| # | 提案 | 破坏性 | 建议 | 决定 |
| --- | --- | --- | --- | --- |
| 1 | 移除 `$g` 依赖 | 低（`move` 模式需重验） | 采纳 | ☐ |
| 2 | UMD + ESM 双产物 | 中（`lib/` → `dist/`） | 采纳 | ☐ |
| 3 | TypeScript 声明 | 无 | 采纳（依赖 #2） | ☐ |
| 4 | Vue 2/3 双兼容（方案 A） | 无 | 待定 | ☐ |
| 5 | `deploy.sh` 去掉 `-f` | 无（流程变更） | 采纳 | ☐ |

全部采纳则发布 **2.0.0**；若 #2 / #4 被否决，余下项可以合进 **1.3.0**（新增 TS 声明、内置 `$g` 兜底仍算兼容）。
