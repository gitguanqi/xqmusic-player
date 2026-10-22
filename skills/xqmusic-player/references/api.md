# xqmusic-player API reference

Everything below is shipped in the npm tarball: `lib/` is the runtime, this file documents it.

## Entries

| Specifier | File | Shape |
| --- | --- | --- |
| `xqmusic-player` | `lib/js/xqmusic.js` | UMD constructor (`module.exports = XqMusic`, also `window.XqMusic`, AMD) |
| `xqmusic-player/lib/js/xqmusic.min.js` | `lib/js/xqmusic.min.js` | committed minified build of the same file |
| `xqmusic-player/utils` | `lib/js/xqmusic-utils.mjs` | native ESM pure helpers |
| `xqmusic-player/vue` | `lib/vue/xqmusic.js` | Vue 3 plugin + named `XqMusic` component |
| `xqmusic-player/xqmusic.vue` | `lib/vue/xqmusic.vue` | raw single-file component (`<script setup>`) |
| `xqmusic-player/lib/css/xqmusic.css` | `lib/css/xqmusic.css` | stylesheet, also `.min.css` |

The package also exposes `./lib/*` and `./*` so historical deep paths keep resolving.

## Constructor options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `el` | `string \| Element` | — (**required**) | resolved with `$g.dom(el)`; throws when missing or unmatched |
| `list` | `Song[]` | `[]` | interaction handlers are only bound when the list is non-empty |
| `mode` | `'slide' \| 'move'` | `'slide'` | `slide` = fixed bottom-right with hover reveal; `move` = `$g.Drag` on the root |

### `Song`

| Field | Type | Required | Effect |
| --- | --- | --- | --- |
| `id` | `number \| string` | yes, unique | playlist `data-id`, compared with `String()` |
| `name` | `string` | yes | title, HTML-escaped |
| `author` | `string` | no | rendered as `author - name` |
| `pic` | `string` | no | `background-image` of the cover div |
| `url` | `string` | yes | `<audio src>` |
| `lyric_url` | `string` | no | LRC source; absent → `暂无歌词` |

`id` and `name` pass through `escapeHtml` before `innerHTML`, so titles cannot inject markup.

## Instance methods

| Method | Returns | Behaviour |
| --- | --- | --- |
| `playSong()` | `void` | toggles play/pause, swallows autoplay rejection, syncs button classes and progress |
| `togglePrevSong()` | `void` | previous track, wraps; resets playback state |
| `toggleNextSong()` | `void` | next track, wraps; resets playback state |
| `toggleMusic()` | `void` | re-renders the current song, zeroes progress, pauses audio |
| `toggleListSong(event)` | `void` | delegated playlist handler; reads `data-id` from the clicked node |
| `setMuted(flag)` | `boolean` | the only mute entry point; mirrors to `audio.muted` and button classes |
| `setLyricSource(url)` | `Promise<Object\|null>` | invalidates current lyric state, then loads `url` (or clears when omitted) |
| `getLyric(url)` | `Promise<Object\|null>` | fetch + parse; on failure reads the cache, then `{ ms: [] }` |
| `parseLyric(text)` | `Lyric` | instance wrapper around the pure parser |
| `showLyric(lrc)` | `void` | renders `lrc.ms`, resets highlight caches |
| `showLyricPos(time)` | `void` | binary-search highlight + scroll for the current second |
| `scrollLyricTo(index)` | `void` | centres a line using the cached 36px line height |
| `showList()` | `void` | renders the playlist from `songList` |
| `showCurrentHigh()` | `void` | rewrites `active` classes and row icons only |
| `showDefault()` | `void` | applies current song cover / audio / title / lyrics |
| `getTime()` | `void` | reads `audio.currentTime`/`duration`, writes time text and bar width |
| `calcTimeStr(second)` | `{ h, m }` | same as `formatTime` |
| `lyricPageToggle()` / `songPageToggle()` | `void` | panel switches; each closes the other |
| `initPage()` | `boolean` | injects the skeleton; idempotent, returns whether it created one |
| `initElem()` | `void` | caches node references inside `this.root` |
| `initEvents()` | `void` | binds listeners once (guarded by `_eventsBound`) |
| `boxDrag()` | `boolean` | enables drag mode when `$g.Drag` exists |
| `cacheLyric(lrc)` / `readCachedLyric()` | `void` / `Lyric\|null` | localStorage fallback, silent on quota/privacy errors |
| `storageKey()` | `string` | `xqmusic:lyric:<instanceId>` |
| `destroy()` | `void` | idempotent teardown: listeners, audio, cache, DOM |

Deprecated aliases: `showMuted()` → `setMuted(false)`, `showVolumn()` → `setMuted(true)`. Their names
are inverted relative to their behaviour; do not use them in new code.

## Readable instance state

`options`, `elem`, `root`, `songList`, `currentIndex`, `playStatus`, `lyricShow`, `songShow`,
`lyricData` (`{ ti, ar, al, by, offset, ms }`), `instanceId`, `version` (`'v1.4.1'`),
`pluginName` (`'XQMusicPlayer'`), `author`, `date`, plus cached node refs `xqAudio`, `xqSongBox`,
`xqLyricBox`, `xqCoverImg`, `xqSongTitle`, `xqCurrentTime`, `xqProgressBar`, `xqTotal`, `xqPlay`,
`xqPause`, `xqPrev`, `xqNext`, `xqMuted`, `xqVolumn`, `xqWord`, `xqList`, `xqTop`.

## Static members

```js
XqMusic.VERSION;  // '1.4.1' — the instance property `version` adds the 'v' prefix
XqMusic.utils;    // { escapeHtml, pad2, formatTime, parseLyric, findLyricIndex }
```

## Pure helpers (`xqmusic-player/utils`)

| Function | Signature | Notes |
| --- | --- | --- |
| `escapeHtml` | `(value) => string` | escapes `& < > " '`; `null`/`undefined` → `''` |
| `pad2` | `(value) => string` | floors and uses `Math.abs`; `10` stays `'10'` |
| `formatTime` | `(second) => { h, m }` | `h` is `HH:MM:SS`, `m` is `MM:SS`; negatives clamp to 0 |
| `parseLyric` | `(text) => Lyric` | `Lyric = { ti, ar, al, by, offset, ms: [{ t, c }] }`, `ms` sorted |
| `findLyricIndex` | `(list, time) => number` | binary search, `-1` when `time` precedes the first line |

Supported LRC forms: `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss:xx]`, multiple time tags per line, and metadata
tags `[ti:] [ar:] [al:] [by:] [offset:]`. Unknown tags and non-lyric lines are skipped.

The UMD file keeps an inline copy of these five functions because a `<script>` build cannot import
ESM; the repository's parity test runs both implementations against one fixture set, so changing one
without the other fails the test suite.

## Vue component contract

- Props: `list: Array` (default `[]`), `mode: String` (default `'slide'`).
- No emits, no slots, no exposed methods; control it through `list` and user clicks.
- Internally: `watch(props.list)` copies the array, mounts one `timeupdate` listener, removes it in
  `onBeforeUnmount`, and fetches `lyric_url` itself with `fetch(url, { credentials: 'same-origin' })`.
- Panel visibility is applied as inline `display` on purpose — the stylesheet sets `display: none` on
  those containers, so `v-show` would lose the specificity battle.
- Plugin `install(app)` registers both `xq-music` and `xqMusic`; the component `name` is `XqMusic`.

## DOM and CSS hooks

Root `.xqmusic` (plus `.slide` in slide mode). Structural classes: `.xqmusic-top`, `.xqmusic-bottom`,
`.xqmusic-menu-ls`, `.xqmusic-lyric-ls`, `.xqmusic-audio`, `.xqmusic-img`, `.xqmusic-cover-img`,
`.xqmusic-main`, `.xqmusic-title`, `.xqmusic-song-title`, `.xqmusic-progress`,
`.xqmusic-progress-bar`, `.xqmusic-current`, `.xqmusic-total`, `.xqmusic-btns`, `.xqmusic-muted`,
`.xqmusic-volumn`, `.xqmusic-prev`, `.xqmusic-pause`, `.xqmusic-play`, `.xqmusic-next`,
`.xqmusic-word`, `.xqmusic-list`, active lyric line `.active`.

All rules are scoped under `.xqmusic`, so overriding them from a host page requires at least equal
specificity (`.xqmusic .xqmusic-progress-bar { … }`). Legacy `xqmusic-*` ids remain in the UMD markup
for `getElementById` callers and repeat across instances — never select by them.

## Known limits

- Playback is delegated to `<audio>`: no volume slider, no seek-on-drag on the progress bar, no
  shuffle/repeat modes, no playlist persistence.
- Lyric line height is assumed to be 36px (14px font, `line-height: 2`) for scroll centring; changing
  the font size in CSS requires updating that constant in the source.
- The Vue component ignores the UMD lyric cache entirely; it refetches on every track change.
- Vue 2 is unsupported (`<script setup>`); the repo's 2.0.0 RFC sketches a dual-major plan, but that
  document is not shipped in the published package.
