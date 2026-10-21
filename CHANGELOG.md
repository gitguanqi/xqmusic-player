# Changelog

本项目的所有重要变更都记录在这里，格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.2.1] - 2026-10-21

示例资源善后版：把仓库里带版权风险的素材换成自制占位件，**运行时代码无改动**，
从 1.2.0 升级无需改任何调用方式。

### 变更

- `test/img/preview.jpg` 重制为「当前播放器 UI」的真实截图，替换掉原先引用真实专辑封面的旧截图。
  `README.md` / `zh.md` 的预览图引用路径不变。
- 新增 `test/img/cover-demo.jpg`：纯 SVG 绘制的自制占位封面（渐变底 + 音符 + 包名），
  `test/mock/music.json` 三首歌的 `pic` 全部改用它。
- 示例歌名 / 歌手名统一换成中性占位：示例歌曲一 / 二 / 三、示例歌手A / B / C。
  同步更新 `song-a.lrc`、`song-b.lrc` 的 `[ti]` / `[ar]` 与歌词文本。
- 同步更新受命名影响的断言：`test/umd.html`、`test/esm.html`、`test/vue3.html`、`scripts/dom-harness.mjs`。
- `test/contract.test.mjs` 新增一条断言：占位封面 `test/img/cover-demo.jpg` 必须存在，防止资源再被误删。

## [1.2.0] - 2026-10-21

这一版把 1.0.8 / 1.1.0 的修复做完了收尾：实例隔离、去重、生命周期与性能。
仍然向后兼容，但有两处**可见变化**，升级前请扫一眼下面的「变更」。

### 新增

- `destroy()`：解绑全部监听、清空音频源、移除 DOM、释放歌词缓存。SPA 里切路由不再留悬空监听。
- `setMuted(flag)`：静音状态的唯一入口，返回值是当前状态。
- `XqMusic.utils`：暴露 `escapeHtml` / `pad2` / `formatTime` / `parseLyric` / `findLyricIndex`。
- `lib/js/xqmusic-utils.mjs`：同一组纯函数的 ESM 版本，Vue 封装直接 import 它。
- `scrollLyricTo(index)`：歌词滚动定位，不再逐行读 `offsetTop`。
- `scripts/browser-check.mjs` + `npm run verify:browser`：用本机 Chrome / Edge 自动跑四个测试页，
  除了 `window.__TEST_RESULTS__`，还会断言「没有未捕获异常 / console.error」「页面结束时仍有可交互实例」「390px 窄屏不横向溢出」。
- Vue 插件同时注册 `xq-music` 与 `xqMusic` 两个组件名。

### 变更

- **样式选择器从 id 改为 class**：`#xqmusic-cover-img`、`#xqmusic-muted` 等改为 `.xqmusic-cover-img`、`.xqmusic-muted`。
  DOM 上的 `id` 属性**仍然保留**，`getElementById` 不受影响；但如果你在项目里覆写过 `#xqmusic-*` 的样式，需要改成类名。
- 样式不再全局重置 `body` / `ul,li` / `button`，也不再占用通用的 `.overflow` / `.scroll-box`，全部收敛到 `.xqmusic` 作用域内。宿主页面不会再被改写。
- `.xqmusic` 的 `max-width` 统一为 `320px`、补上 `margin: 10px auto` 与 `border-radius: 5px`（此前 UMD 版与 Vue 版差 2px 且边距不一致）。
- 歌词高亮改为「保持高亮直到下一句」，不再在两句之间的空隙把高亮清掉。
- `progress` 的过渡从 `transition: all .5s` 改为 `transition: width .5s linear`。
- 歌词缓存键从全局 `lyrcis` 改为 `xqmusic:lyric:<实例号>`，并自动清理旧的全局键。
- `showMuted()` / `showVolumn()` 标记为废弃（历史命名与实际语义相反），内部转发到 `setMuted()`。
- Vue 封装不再声明 `lang="less"`，也不再内联一份 `<style>`，改为 `import '../css/xqmusic.css'`——**样式只有一份**。
- 测试页不再引用任何外网 CDN：图标用本地替身 `test/assets/icon-shim.css`，Vue 由 `scripts/serve.mjs` 映射到 `node_modules` 里的浏览器构建。断网也能跑自检。
- 自检运行器的检查项从并行改为串行。此前多条断言共享同一个实例，会互相踩（上一条刚切到第三首，下一条已经在断言第一首的歌词）。
- `test/index.html` 从纯导航页变成也是自检页：校验链接与产物是否齐全，并挂一个可直接播放的实例。

### 修复

- 同页多个实例互相串台：所有节点查询都收敛在实例自己的根节点内；列表按钮改用事件委托。
- 切换歌曲后，上一首的歌词请求返回时会覆盖当前歌词（竞态）。
- `showList` / `showLyric` 把歌名与歌词正文直接拼进 `innerHTML` 造成的 XSS。
- 列表内按钮的 `click` 监听随每次切歌重复注册。

### 性能

- 歌词定位：`timeupdate`（约 4Hz）从「遍历全部歌词行 + 逐行读 `offsetTop`」改为二分查找 + 只写 `className`，消除了强制同步布局。
- 行节点数组缓存复用，不再每帧 `querySelectorAll`。

## [1.1.0] - 2026-10-21

### 新增

- 补齐打包入口：`main` / `browser` / `unpkg` / `jsdelivr` / `style` / `exports` / `files`。
  此前 `package.json` 里**一个入口字段都没有**，`require('xqmusic-player')` 直接 `MODULE_NOT_FOUND`。
- UMD 导出尾：`window.XqMusic`（保持经典 `<script>` 用法）、`module.exports`、AMD `define`。
- `peerDependencies`：`xqgjs`（可选）、`vue`（可选）。
- `test/` 目录重组为四页自检矩阵（索引 / UMD / ESM / Vue 3），共用样式、图标与检查运行器。
- `scripts/serve.mjs`：零依赖静态服务器，替代需要全局安装的 `live-server`。
- `scripts/dom-harness.mjs`：桩 DOM 行为验证器，源文件与压缩产物各跑一遍。
- `npm test` 从占位符变为真实测试：纯函数、两份实现对拍、文件契约、桩 DOM 行为。
- `npm run build` / `build:check`：用 esbuild 生成并校验压缩产物。
- 测试素材：`test/mock/tone.wav`、`song-a.lrc`、`song-b.lrc`，一份「没有歌词」的样本。

### 修复

- `README.md` / `zh.md` 的 Vue 引入路径 `xqmusic-player/libs/vue/xqmusic` 改为 `xqmusic-player/lib/vue/xqmusic`（目录早就改名了，复制必报错）。
- Vue 示例补上 `onMounted` 导入、`demo.list` 与模板变量不一致、`$http` 缺失说明。
- 旧版 `test/index.html` 从第三方域名加载 `$g`，离线即整页失败；现在用本地替身。
- `test/mock/music.json` 指向的 `lrh-*.mp3|jpg|lrc` 在仓库里根本不存在，点播放必然 404。

## [1.0.8] - 2026-10-21

### 修复

- **首次播放必抛 `TypeError`**：`getTime(e)` 读 `e.timeStamp`，但 `playSong()` 是无参调用，且 `currentTime` 为 0 时恰好会走到那条分支。现在以 `audio.currentTime` 为准，并先更新 `playStatus` 再刷新进度。
- **无歌词歌曲会污染缓存并导致崩溃**：`parseLyric('')` 返回 `undefined`，被 `JSON.stringify` 成字符串 `"undefined"` 写进 localStorage，下一帧 `JSON.parse` 抛 `SyntaxError`。现在空输入返回 `{ ms: [] }`，解析与缓存全程有保护。
- **时间显示在 10 秒处变成 `00:010` / `00:010:00`**：补零判断写成了 `> 10`，应为 `>= 10`。
- **末曲点「下一首」会多走一格**：上界判断用了 `<= length` 再补一次钳制。
- Vue 封装挂载即抛：`proxy.$http` 从未有人注入。现在改用原生 `fetch`，并对缺失 `lyric_url` 短路。
- Vue 封装 `props.list` 只在 `onMounted` 拷贝一次，异步到达的列表永远不渲染。现在用 `watch`。
- Vue 封装的列表与歌词面板永远不显示：外部样式表对它们写了 `display:none`，`v-show` 恢复显示时被压回。现在用行内 `display`。
- 歌词缓存 `JSON.parse` 无保护，`lrcItem[i]` 无越界判断。
- `localStorage` 在隐私模式下抛错会中断初始化。
- 缺少 `$g` 时只得到一堆 `undefined` 报错。现在明确提示「请先加载 xqgjs」。
- 缺 `el` 时的报错从 `el is must!` 改为可定位的中文提示。

### 文档

- 补充 `$g`（npm 包名 `xqgjs`）、`axios`（现已可选）、Font Awesome 的前置依赖说明。

## [1.0.7] - 2022-09-24

- 初始发布版本。修复静态展示地址。

---

## 兼容性说明

| 消费方式 | 本版本状态 |
| --- | --- |
| `<script src=".../xqmusic.min.js">` + `new XqMusic()` | 支持，全局名不变 |
| `require('xqmusic-player')` | 支持（1.1.0 起） |
| `import XqMusic from 'xqmusic-player'` | 由打包器做 CJS 互操作，Vite / webpack / Rollup 均可 |
| `import utils from 'xqmusic-player/utils'` | 支持，纯 ESM |
| Vue 3（`app.use()` 或直接 `<xqMusic>`） | 支持，需要 Vue ≥ 3.2 |
| Vue 2 | **不支持**（SFC 使用 `<script setup>`，Vue 2.6 的 loader 无法编译）。计划在 2.0.0 里改为 Vue 2/3 双兼容 |
| 浏览器原生 ESM 构建（`import` 构造函数） | **未提供**，计划在 2.0.0 里补 ESM 产物 |

破坏性变更（移除外置 `$g` 依赖、ESM 双产物、TypeScript 声明）都排在 2.0.0，见 `docs/RFC-2.0.0.md`。
