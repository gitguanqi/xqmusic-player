---
name: xqmusic-player
description: Integrate the xqmusic-player widget (UMD script or Vue 3 component) into a web page or app — entry selection, $g / Font Awesome / stylesheet prerequisites, options and song schema, SPA teardown, and the error messages you actually hit. Load when adding an audio player, playlist, progress bar, or LRC lyric panel with this package.
---

# Integrating xqmusic-player

A player widget, not an audio engine: it renders playlist, cover, progress, mute and LRC lyrics and
delegates playback to a plain `<audio>` element. Pick the entry first — that choice drives every
subsequent step.

## 1. Choose the entry

| Situation | Entry | Needs `$g`? | Needs the stylesheet link? |
| --- | --- | --- | --- |
| Plain HTML page, no bundler | `lib/js/xqmusic.min.js` (global `XqMusic`) | **yes** | yes |
| Bundler, imperative use | `require('xqmusic-player')` / `lib/js/xqmusic.js` | **yes** | yes |
| Vue 3 app | `xqmusic-player/vue` plugin or `xqmusic-player/xqmusic.vue` | no | no (SFC imports it) |
| Only LRC parsing / time formatting | `xqmusic-player/utils` | no | no |

Never mix a Vue app with the UMD path just to get `$g`: the Vue component is self-contained, and
adding `$g` there only adds an unneeded global.

## 2. Order of operations (UMD path)

1. Load the `$g` global before the player script — `xqgjs` from npm or its CDN build. It is a
   declared *optional* peer dependency, but the constructor calls `$g.dom(el)` unconditionally.
2. Load Font Awesome 6 (or map `.fa` yourself) — every button glyph is a `fa fa-*` class.
3. Load `xqmusic.css` / `xqmusic.min.css`.
4. Provide a host element that exists **before** the constructor runs. The player appends a `.xqmusic`
   child; it does not create the host.
5. Build the `list` array, then `new XqMusic({ el, list, mode })`.
6. On teardown, call `destroy()` before removing the host node.

For `mode: 'move'` the widget sets no position of its own — position the host yourself, and the
drag behaviour comes from `$g.Drag`. For `mode: 'slide'` it parks itself at the bottom-right corner.

## 3. Minimal UMD integration

```html
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.2.0/css/all.min.css">
<link rel="stylesheet" href="./node_modules/xqmusic-player/lib/css/xqmusic.min.css">
<div id="music"></div>

<script src="https://xqgj.cc/xqcdn/libs/xqgjs/xqgjs.min.js"></script>
<script src="./node_modules/xqmusic-player/lib/js/xqmusic.min.js"></script>
<script>
    const player = new XqMusic({
        el: '#music',
        mode: 'slide',
        list: [
            { id: 1, name: 'Track One', author: 'Artist A', pic: './cover.jpg', url: './track.mp3', lyric_url: './track.lrc' },
        ],
    });
</script>
```

## 4. Minimal Vue 3 integration

```js
import { createApp } from 'vue';
import xqMusic from 'xqmusic-player/vue';
import App from './App.vue';

createApp(App).use(xqMusic).mount('#app');
```

```vue
<template>
    <xq-music :list="list" />
</template>

<script setup>
import { ref, onMounted } from 'vue';
const list = ref([]);
onMounted(async () => {
    list.value = await (await fetch('/api/songs')).json();
});
</script>
```

Replace the whole `list` array to update the track list; the component copies it in a `watch`, so
`list.value.push(...)` will not re-render. The component has no events or slots — to control playback
imperatively, use the UMD class instead.

## 5. Failure modes and what they mean

| Symptom | Cause | Fix |
| --- | --- | --- |
| `[xqmusic-player] 缺少前置依赖 $g：…` thrown at construction | `$g` not loaded, or loaded *after* the player script | move the `xqgjs` script above the player script |
| `[xqmusic-player] 找不到宿主元素: #x` | selector ran before the node existed, or wrong id | instantiate on `DOMContentLoaded` / after mount |
| `[xqmusic-player] options.el 是必填项` | `new XqMusic()` with no options | always pass `el` |
| Buttons render as empty squares | Font Awesome missing | load `all.min.css`, or style `.fa` yourself |
| Player renders but is invisible / unstyled | stylesheet not loaded, or host has `overflow: hidden` | load `xqmusic.css`; check host sizing |
| Lyric panel stuck on `暂无歌词` | `lyric_url` missing, request failed, or CORS refused | verify the URL, serve lyrics same-origin or with CORS headers |
| Nothing plays, no error | browser autoplay policy rejected `play()`; the rejection is swallowed by design | start playback from a user gesture |
| Playlist items dead | `list` empty at construction — handlers are only bound when `songList.length > 0` | pass a non-empty list up front, or rebuild the instance |
| Progress bar stays at 0 after first click | stale minified build | run `npm run build` in the package |

## 6. Lifecycle and state

- `destroy()` is idempotent; it unbinds every listener, pauses the audio, clears `src`, removes the
  DOM node, and deletes that instance's lyric cache. Call it on route change or unmount, or the
  `timeupdate` listener keeps firing against a detached node.
- Multiple players can share one page. Everything is queried by class inside the instance root; the
  `xqmusic-*` `id` attributes exist only for legacy `getElementById` users and repeat across instances.
- Lyrics are memory-first. `localStorage` holds a per-instance fallback key `xqmusic:lyric:<n>`; the
  legacy shared `lyrcis` key is migrated once and then removed. Private-mode Safari degrades silently.
- Switching songs invalidates in-flight lyric requests via a token, so a slow response can never
  overwrite the track you just selected. Do not "fix" this by removing the token check.
- `setMuted(true)` is the only mute entry point. `showMuted()` / `showVolumn()` are deprecated and
  inverted by name (`showMuted` unmutes) — do not wire them.

## 7. Verification

- Player visible in the host element, styled, with icons.
- Click a track row → title, cover, audio src, and lyric panel all change.
- Play via a click → progress bar and time advance; lyric line highlights and scrolls.
- Toggle mute twice → audio state and button visibility follow.
- Navigate away / unmount → no `timeupdate` errors, no orphaned `.xqmusic` node.

For the full method table, song schema, CSS hooks and cache behaviour, read
[references/api.md](references/api.md).
