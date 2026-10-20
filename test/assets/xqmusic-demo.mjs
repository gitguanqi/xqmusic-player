/* 自动生成，请勿手改。
 * 来源: lib/vue/xqmusic.vue
 * 生成: node scripts/build-vue-demo.mjs
 */
import { createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle } from "vue"

const _hoisted_1 = ["onClick"]
const _hoisted_2 = ["title"]
const _hoisted_3 = ["title"]
const _hoisted_4 = { key: 0 }
const _hoisted_5 = { class: "xqmusic-bottom" }
const _hoisted_6 = ["src"]
const _hoisted_7 = { class: "xqmusic-img" }
const _hoisted_8 = { class: "xqmusic-main" }
const _hoisted_9 = { class: "xqmusic-title" }
const _hoisted_10 = { class: "overflow xqmusic-song-title" }
const _hoisted_11 = { class: "xqmusic-progress" }
const _hoisted_12 = { class: "xqmusic-current" }
const _hoisted_13 = { class: "xqmusic-total" }
const _hoisted_14 = { class: "xqmusic-btns" }

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
    import { findLyricIndex, formatTime, parseLyric } from '../../lib/js/xqmusic-utils.mjs'
    // 直接消费 UMD 版同一份样式表：不再内联一份 <style>，也不需要 less 预处理器。
    // 所有选择器都以 .xqmusic 开头，不会污染宿主页面。
    const LYRIC_LINE_HEIGHT = 36

    
export default {
  __name: 'xqmusic',
  props: {
        /** 歌曲列表，字段见 README：id / name / author / pic / url / lyric_url */
        list: { type: Array, default: () => [] },
        /** 'slide' 固定在右下角，'move' 由宿主自行定位 */
        mode: { type: String, default: 'slide' },
    },
  setup(__props) {

    const props = __props

    const rootRef = ref(null)
    const audioRef = ref(null)
    const lyricRef = ref(null)

    const songs = ref([])
    const currentIndex = ref(0)
    const lyrics = ref([])
    const showLrc = ref(false)
    const showList = ref(false)
    const isPlay = ref(false)
    const muted = ref(false)
    const currentTime = ref('00:00')
    const totalTime = ref('00:00')
    const progress = ref(0)

    let activeLine = null
    let lyricToken = 0

    const current = computed(() => songs.value[currentIndex.value] || null)

    const title = computed(() => {
        const song = current.value
        if (!song) return '歌手 - 歌曲名'
        return (song.author || '') + ' - ' + (song.name || '')
    })

    const coverStyle = computed(() => {
        const song = current.value
        return song && song.pic ? `url(${song.pic})` : ''
    })

    // props.list 可能晚于挂载才到（异步请求），必须 watch 而不是只拷一次
    watch(
        () => props.list,
        (list) => {
            songs.value = Array.isArray(list) ? list.slice() : []
            if (currentIndex.value >= songs.value.length) currentIndex.value = 0
            if (songs.value.length) {
                loadLyric(current.value)
            } else {
                lyrics.value = []
            }
        },
        { immediate: true }
    )

    onMounted(() => {
        // timeupdate 只在挂载时注册一次；旧实现放在 togglePlay 里，点几次就有几个监听
        if (audioRef.value) audioRef.value.addEventListener('timeupdate', onTimeUpdate)
    })

    onBeforeUnmount(() => {
        if (audioRef.value) {
            audioRef.value.removeEventListener('timeupdate', onTimeUpdate)
            try {
                audioRef.value.pause()
            } catch (e) {
                /* ignore */
            }
        }
        activeLine = null
    })

    /**
     * 加载并解析歌词。用原生 fetch，不再要求宿主注入 $http / axios。
     * 任何失败都降级成「暂无歌词」，不抛出。
     */
    async function loadLyric(song) {
        const token = ++lyricToken
        lyrics.value = []
        activeLine = null
        if (!song || !song.lyric_url) return
        try {
            const res = await fetch(song.lyric_url, { credentials: 'same-origin' })
            if (!res.ok) throw new Error('HTTP ' + res.status)
            const text = await res.text()
            if (token !== lyricToken) return // 期间已切歌，丢弃过期结果
            lyrics.value = parseLyric(text).ms
        } catch (e) {
            lyrics.value = []
        }
    }

    /**
     * 歌词高亮：二分查找当前行，只写 className，不做全表 offsetTop 扫描。
     */
    function highlight(time) {
        const box = lyricRef.value
        if (!box || !lyrics.value.length) return
        const index = findLyricIndex(lyrics.value, time)
        if (index < 0) return
        const lines = box.querySelectorAll('li')
        const line = lines[index]
        if (!line || line === activeLine) return

        if (activeLine) activeLine.classList.remove('active')
        line.classList.add('active')
        activeLine = line

        const height = box.clientHeight || 0
        if (!height) return
        const target = Math.max(0, index * LYRIC_LINE_HEIGHT - (height - LYRIC_LINE_HEIGHT) / 2)
        if (Math.abs(box.scrollTop - target) >= 1) box.scrollTop = target
    }

    function onTimeUpdate() {
        const audio = audioRef.value
        if (!audio) return
        const time = Number(audio.currentTime) || 0
        const duration = Number(audio.duration)
        currentTime.value = formatTime(time).m
        totalTime.value = duration > 0 ? formatTime(duration).m : '00:00'
        progress.value = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
        highlight(time)
    }

    function toggleList(type) {
        if (type === 'lrc') {
            showList.value = false
            showLrc.value = !showLrc.value
        } else {
            showLrc.value = false
            showList.value = !showList.value
        }
    }

    function setMuted(flag) {
        muted.value = !!flag
        if (audioRef.value) audioRef.value.muted = muted.value
    }

    async function togglePlay() {
        const audio = audioRef.value
        if (!audio) return
        if (isPlay.value) {
            audio.pause()
            isPlay.value = false
            return
        }
        try {
            await audio.play()
            isPlay.value = true
        } catch (e) {
            // 自动播放被浏览器拦截：保持未播放态，不要骗用户
            isPlay.value = false
        }
    }

    function resetAndLoad() {
        const audio = audioRef.value
        currentTime.value = '00:00'
        totalTime.value = '00:00'
        progress.value = 0
        isPlay.value = false
        activeLine = null
        loadLyric(current.value)
        if (audio) {
            try {
                audio.pause()
                audio.load()
            } catch (e) {
                /* ignore */
            }
        }
    }

    function playFrom(index) {
        if (!songs.value.length) return
        if (index === currentIndex.value) {
            togglePlay()
            return
        }
        currentIndex.value = index
        resetAndLoad()
    }

    function playPrev() {
        const len = songs.value.length
        if (!len) return
        currentIndex.value = (currentIndex.value - 1 + len) % len
        resetAndLoad()
    }

    function playNext() {
        const len = songs.value.length
        if (!len) return
        currentIndex.value = (currentIndex.value + 1) % len
        resetAndLoad()
    }

return (_ctx, _cache) => {
  return (_openBlock(), _createElementBlock("div", {
    class: _normalizeClass(["xqmusic", { slide: __props.mode === 'slide' }]),
    ref_key: "rootRef",
    ref: rootRef
  }, [
    _createElementVNode("div", {
      class: _normalizeClass(["xqmusic-top", { active: !showLrc.value && !showList.value }])
    }, [
      _createCommentVNode(" 列表 / 歌词的显隐一律用行内 display：\r\n                 外部样式表对这两个容器有 display:none，v-show 移除行内值后会被样式表压回去 "),
      _createElementVNode("ul", {
        class: "xqmusic-menu-ls scroll-box",
        style: _normalizeStyle({ display: showList.value ? 'block' : 'none' })
      }, [
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(songs.value, (item, index) => {
          return (_openBlock(), _createElementBlock("li", {
            key: item.id !== undefined ? item.id : index,
            class: _normalizeClass({ active: index === currentIndex.value }),
            onClick: $event => (playFrom(index))
          }, [
            _createElementVNode("span", {
              class: "overflow",
              title: item.name
            }, _toDisplayString(item.name), 9 /* TEXT, PROPS */, _hoisted_2),
            _createElementVNode("button", {
              type: "button",
              class: "song-play",
              title: index === currentIndex.value && isPlay.value ? '暂停' : '播放'
            }, [
              _createElementVNode("i", {
                class: _normalizeClass(["fa", index === currentIndex.value && isPlay.value ? 'fa-pause' : 'fa-play'])
              }, null, 2 /* CLASS */)
            ], 8 /* PROPS */, _hoisted_3)
          ], 10 /* CLASS, PROPS */, _hoisted_1))
        }), 128 /* KEYED_FRAGMENT */))
      ], 4 /* STYLE */),
      _createElementVNode("ul", {
        ref_key: "lyricRef",
        ref: lyricRef,
        class: "xqmusic-lyric-ls scroll-box",
        style: _normalizeStyle({ display: showLrc.value ? 'block' : 'none' })
      }, [
        (!lyrics.value.length)
          ? (_openBlock(), _createElementBlock("li", _hoisted_4, "暂无歌词"))
          : _createCommentVNode("v-if", true),
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(lyrics.value, (line, index) => {
          return (_openBlock(), _createElementBlock("li", { key: index }, _toDisplayString(line.c), 1 /* TEXT */))
        }), 128 /* KEYED_FRAGMENT */))
      ], 4 /* STYLE */)
    ], 2 /* CLASS */),
    _createElementVNode("div", _hoisted_5, [
      _createElementVNode("audio", {
        class: "xqmusic-audio",
        ref_key: "audioRef",
        ref: audioRef,
        src: current.value ? current.value.url : ''
      }, null, 8 /* PROPS */, _hoisted_6),
      _createCommentVNode(" 歌曲封面图 "),
      _createElementVNode("div", _hoisted_7, [
        _createElementVNode("div", {
          class: _normalizeClass(["xqmusic-cover-img", { active: isPlay.value }]),
          style: _normalizeStyle({ backgroundImage: coverStyle.value })
        }, null, 6 /* CLASS, STYLE */)
      ]),
      _createElementVNode("div", _hoisted_8, [
        _createCommentVNode(" 歌曲标题 "),
        _createElementVNode("div", _hoisted_9, [
          _createElementVNode("small", _hoisted_10, _toDisplayString(title.value), 1 /* TEXT */)
        ]),
        _createCommentVNode(" 歌曲进度条 "),
        _createElementVNode("div", _hoisted_11, [
          _createElementVNode("small", _hoisted_12, _toDisplayString(currentTime.value), 1 /* TEXT */),
          _createElementVNode("span", null, [
            _createElementVNode("i", {
              class: "xqmusic-progress-bar",
              style: _normalizeStyle({ width: progress.value + '%' })
            }, null, 4 /* STYLE */)
          ]),
          _createElementVNode("small", _hoisted_13, _toDisplayString(totalTime.value), 1 /* TEXT */)
        ]),
        _createCommentVNode(" 歌曲操作按钮 "),
        _createElementVNode("div", _hoisted_14, [
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["xqmusic-muted", { active: muted.value }]),
            style: _normalizeStyle({ display: muted.value ? 'block' : 'none' }),
            title: "取消静音",
            onClick: _cache[0] || (_cache[0] = $event => (setMuted(false)))
          }, _cache[4] || (_cache[4] = [
            _createElementVNode("i", { class: "fa fa-volume-mute" }, null, -1 /* HOISTED */)
          ]), 6 /* CLASS, STYLE */),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["xqmusic-volumn", { active: !muted.value }]),
            style: _normalizeStyle({ display: muted.value ? 'none' : 'block' }),
            title: "静音",
            onClick: _cache[1] || (_cache[1] = $event => (setMuted(true)))
          }, _cache[5] || (_cache[5] = [
            _createElementVNode("i", { class: "fa fa-volume-down" }, null, -1 /* HOISTED */)
          ]), 6 /* CLASS, STYLE */),
          _createElementVNode("button", {
            type: "button",
            class: "xqmusic-prev",
            title: "上一首",
            onClick: playPrev
          }, _cache[6] || (_cache[6] = [
            _createElementVNode("i", { class: "fa fa-chevron-left" }, null, -1 /* HOISTED */)
          ])),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["xqmusic-pause", { active: isPlay.value }]),
            style: _normalizeStyle({ display: isPlay.value ? 'block' : 'none' }),
            title: "暂停",
            onClick: togglePlay
          }, _cache[7] || (_cache[7] = [
            _createElementVNode("i", { class: "fa fa-pause" }, null, -1 /* HOISTED */)
          ]), 6 /* CLASS, STYLE */),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["xqmusic-play", { active: !isPlay.value }]),
            style: _normalizeStyle({ display: isPlay.value ? 'none' : 'block' }),
            title: "播放",
            onClick: togglePlay
          }, _cache[8] || (_cache[8] = [
            _createElementVNode("i", { class: "fa fa-play" }, null, -1 /* HOISTED */)
          ]), 6 /* CLASS, STYLE */),
          _createElementVNode("button", {
            type: "button",
            class: "xqmusic-next",
            title: "下一首",
            onClick: playNext
          }, _cache[9] || (_cache[9] = [
            _createElementVNode("i", { class: "fa fa-chevron-right" }, null, -1 /* HOISTED */)
          ])),
          _createElementVNode("button", {
            type: "button",
            class: "xqmusic-word",
            title: "歌词",
            onClick: _cache[2] || (_cache[2] = $event => (toggleList('lrc')))
          }, _cache[10] || (_cache[10] = [
            _createElementVNode("i", { class: "fa fa-file-word" }, null, -1 /* HOISTED */)
          ])),
          _createElementVNode("button", {
            type: "button",
            class: "xqmusic-list",
            title: "列表",
            onClick: _cache[3] || (_cache[3] = $event => (toggleList('list')))
          }, _cache[11] || (_cache[11] = [
            _createElementVNode("i", { class: "fa fa-list" }, null, -1 /* HOISTED */)
          ]))
        ])
      ])
    ])
  ], 2 /* CLASS */))
}
}

}