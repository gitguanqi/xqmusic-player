# xqmusic-player

A lightweight music player widget for the browser: play list, cover, progress bar, mute switch and
scrolling lyrics, shipped as a UMD build plus a Vue 3 component.

English | [中文文档](./zh.md)

## Requirements

This package is deliberately small, but it does expect two things from the host page:

| Dependency | Required | Why | How to provide |
| --- | --- | --- | --- |
| `$g` global ([xqgjs](https://www.npmjs.com/package/xqgjs)) | **Yes** | used to resolve the host element (`$g.dom`) and to enable drag mode (`$g.Drag`) | `npm i xqgjs`, or load `https://xqgj.cc/xqcdn/libs/xqgjs/xqgjs.min.js` |
| Font Awesome 6 | Recommended | the rendered markup uses `fa fa-*` classes for every button icon | load `font-awesome/css/all.min.css`, or override `.fa` with your own icons |
| `fetch` | Recommended | lyrics are fetched with `fetch`; it falls back to a global `axios` only when `fetch` is missing | built into every modern browser |

If `$g` is missing, the constructor throws immediately with `[xqmusic-player] 缺少前置依赖 $g…`
instead of failing later with a confusing `undefined is not a function`.

## Install

```sh
npm i xqmusic-player xqgjs
```

## Usage in the browser (UMD / global)

```html
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.2.0/css/all.min.css">
<link rel="stylesheet" href="node_modules/xqmusic-player/lib/css/xqmusic.min.css">

<div id="music"></div>

<script src="https://xqgj.cc/xqcdn/libs/xqgjs/xqgjs.min.js"></script>
<script src="node_modules/xqmusic-player/lib/js/xqmusic.min.js"></script>
<script>
    new XqMusic({
        el: '#music',
        list: [],
        mode: 'slide', // 'slide' | 'move'
    });
</script>
```

`lib/js/xqmusic.min.js` is the committed build of the readable `lib/js/xqmusic.js`; the two are kept
byte-comparable by `npm run build:check`, so either one behaves identically.

## Usage as a module

```js
// CommonJS — works after "npm i xqmusic-player"
const XqMusic = require('xqmusic-player');
// XqMusic itself is also exposed as XqMusic.XqMusic / XqMusic.default

// Pure helpers with no DOM dependency, shipped separately as real ESM
import { escapeHtml, pad2, formatTime, parseLyric, findLyricIndex } from 'xqmusic-player/utils';
```

```html
<!-- directly in the browser -->
<script type="module">
    import { formatTime } from './node_modules/xqmusic-player/lib/js/xqmusic-utils.mjs';
    console.log(formatTime(610).m); // 10:10
</script>
```

## Vue 3 component

```js
import { createApp } from 'vue';
import App from './App.vue';
import xqMusic from 'xqmusic-player/vue';

createApp(App).use(xqMusic).mount('#app');
```

```vue
<template>
    <xq-music :list="list" />
</template>

<script setup>
import { onMounted, ref } from 'vue';

const list = ref([]);

onMounted(async () => {
    const res = await fetch('/mock/music.json');
    list.value = await res.json();
});
</script>
```

The plugin registers the component under `xq-music` and `xqMusic`, so both tag styles work.
You can also import the single file component directly: `import XqMusic from 'xqmusic-player/xqmusic.vue'`.

> **Vue 2 is not supported.** The component uses `<script setup>`, which requires Vue 3 (compiled with
> `@vue/compiler-sfc` ≥ 3.2). See [`docs/RFC-2.0.0.md`](./docs/RFC-2.0.0.md) for the plan to support both majors.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `el` | `string \| Element` | — (**required**) | host element or selector the player is injected into |
| `list` | `Array` | `[]` | song list, see the schema below |
| `mode` | `'slide' \| 'move'` | `'slide'` | `slide` parks the player at the bottom-right corner and slides it out on hover; `move` makes it draggable (needs `$g.Drag`) |

### Song schema

```json
[
    {
        "id": 1,
        "name": "麻雀",
        "author": "李荣浩",
        "pic": "./lrh-mq.jpg",
        "lyric_url": "./lrh-mq.lrc",
        "url": "./lrh-mq.mp3"
    }
]
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number \| string` | unique within the list; used to highlight the active row |
| `name` | `string` | title, rendered escaped |
| `author` | `string` | shown before the title |
| `pic` | `string` | cover image URL, used as `background-image` |
| `url` | `string` | audio file URL |
| `lyric_url` | `string` | optional. When missing the panel renders `暂无歌词` / “No lyrics” |

Both `id` and `name` are HTML-escaped before they reach `innerHTML`, so a song title cannot inject markup.

## Public API

```js
const player = new XqMusic({ el: '#music', list });

player.playSong();              // play / pause toggle
player.togglePrevSong();
player.toggleNextSong();
player.toggleListSong(event);   // play the row that was clicked
player.toggleMusic();           // re-render the current song without playing
player.setMuted(true);          // returns the new muted state
player.setLyricSource(url);     // switch lyrics source; pass nothing to clear it
player.getLyric(url);           // returns a Promise<Object|null>
player.parseLyric(text);        // { ti, ar, al, by, offset, ms: [{ t, c }] }
player.calcTimeStr(610);        // { h: '00:10:10', m: '10:10' }
player.destroy();               // unbind every listener, pause the audio, remove the DOM

XqMusic.VERSION;                // '1.4.0'
XqMusic.utils;                  // { escapeHtml, pad2, formatTime, parseLyric, findLyricIndex }
```

Notes on behaviour:

- **Multiple instances** can live on the same page. Everything is queried inside the player's own root
  element by class name; the `id` attributes kept in the markup are only there for consumers who
  relied on `getElementById`.
- **Lyrics** live in memory first and are mirrored into `localStorage` under a per-instance key
  (`xqmusic:lyric:<n>`); when a fetch fails they are read back from there. The legacy shared
  `lyrcis` key (yes, misspelled in older versions) is migrated once and then removed.
- **Switching songs** cancels any in-flight lyric request, so a slow response can never overwrite the
  song you just started playing.
- **`destroy()`** is idempotent. Always call it when you remove the host node, or the `timeupdate`
  listener keeps running.

## For AI agents

`llms.txt` is the compact API reference (entries, options, song schema, constraints);
`skills/xqmusic-player/SKILL.md` is a portable integration skill covering entry selection, load order
and the error messages this package throws. Both ship in the npm tarball and are wired through the
`llms` / `agents` fields of `package.json`.

The skill directory holds three files, in reading order:

- `SKILL.md` — integration flow plus a symptom → cause → fix table; enough to start writing code.
- `references/api.md` — full method table, DOM/CSS hooks, cache internals, known limits.
- `agents/openai.yaml` — display name and default prompt for agent hosts that read skill-local config.

`test/pack.test.mjs` runs a real `npm pack --dry-run` during `npm test` and asserts these files are in
the tarball, so the whitelist cannot drift away from what actually gets published.

## Development

```sh
npm install
npm test            # pure helpers, file contracts, stub-DOM behaviour (source + minified build)
npm run test:harness   # run the stub-DOM scenarios only
npm run build       # regenerate lib/js/xqmusic.min.js + lib/css/xqmusic.min.css with esbuild
npm run build:check # fail if the committed artifacts differ from what the build produces
npm run build:demo     # precompile lib/vue/xqmusic.vue for test/vue3.html
npm run build:fixtures # regenerate test/mock/tone.wav (generated asset, not committed)
npm run test:browser   # serve ./test over HTTP for manual checks
npm run verify:browser # drive the four test pages in your local Chrome / Edge
```

The four pages under `test/` are self-checking: each one renders `PASS / FAIL` in a live region and
keeps a working player mounted, so a human sees the same result a machine reads from
`window.__TEST_RESULTS__`.

## Preview

![preview](./test/img/preview.jpg)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md). Breaking-change proposals live in [docs/RFC-2.0.0.md](./docs/RFC-2.0.0.md).

## Issues

[Submit your question](https://github.com/gitguanqi/xqmusic-player/issues/new)

## Author

[@gitguanqi](https://github.com/gitguanqi)

## License

MIT
