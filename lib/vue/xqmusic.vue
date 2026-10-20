<template>
    <div class="xqmusic" :class="{ slide: mode === 'slide' }" ref="rootRef">
        <div class="xqmusic-top" :class="{ active: !showLrc && !showList }">
            <!-- 列表 / 歌词的显隐一律用行内 display：
                 外部样式表对这两个容器有 display:none，v-show 移除行内值后会被样式表压回去 -->
            <ul class="xqmusic-menu-ls scroll-box" :style="{ display: showList ? 'block' : 'none' }">
                <li
                    v-for="(item, index) in songs"
                    :key="item.id !== undefined ? item.id : index"
                    :class="{ active: index === currentIndex }"
                    @click="playFrom(index)"
                >
                    <span class="overflow" :title="item.name">{{ item.name }}</span>
                    <button type="button" class="song-play" :title="index === currentIndex && isPlay ? '暂停' : '播放'">
                        <i class="fa" :class="index === currentIndex && isPlay ? 'fa-pause' : 'fa-play'"></i>
                    </button>
                </li>
            </ul>
            <ul
                ref="lyricRef"
                class="xqmusic-lyric-ls scroll-box"
                :style="{ display: showLrc ? 'block' : 'none' }"
            >
                <li v-if="!lyrics.length">暂无歌词</li>
                <li v-for="(line, index) in lyrics" :key="index">{{ line.c }}</li>
            </ul>
        </div>
        <div class="xqmusic-bottom">
            <audio class="xqmusic-audio" ref="audioRef" :src="current ? current.url : ''"></audio>
            <!-- 歌曲封面图 -->
            <div class="xqmusic-img">
                <div
                    class="xqmusic-cover-img"
                    :class="{ active: isPlay }"
                    :style="{ backgroundImage: coverStyle }"
                ></div>
            </div>
            <div class="xqmusic-main">
                <!-- 歌曲标题 -->
                <div class="xqmusic-title">
                    <small class="overflow xqmusic-song-title">{{ title }}</small>
                </div>
                <!-- 歌曲进度条 -->
                <div class="xqmusic-progress">
                    <small class="xqmusic-current">{{ currentTime }}</small>
                    <span><i class="xqmusic-progress-bar" :style="{ width: progress + '%' }"></i></span>
                    <small class="xqmusic-total">{{ totalTime }}</small>
                </div>
                <!-- 歌曲操作按钮 -->
                <div class="xqmusic-btns">
                    <button
                        type="button"
                        class="xqmusic-muted"
                        :class="{ active: muted }"
                        :style="{ display: muted ? 'block' : 'none' }"
                        title="取消静音"
                        @click="setMuted(false)"
                    >
                        <i class="fa fa-volume-mute"></i>
                    </button>
                    <button
                        type="button"
                        class="xqmusic-volumn"
                        :class="{ active: !muted }"
                        :style="{ display: muted ? 'none' : 'block' }"
                        title="静音"
                        @click="setMuted(true)"
                    >
                        <i class="fa fa-volume-down"></i>
                    </button>
                    <button type="button" class="xqmusic-prev" title="上一首" @click="playPrev">
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    <button
                        type="button"
                        class="xqmusic-pause"
                        :class="{ active: isPlay }"
                        :style="{ display: isPlay ? 'block' : 'none' }"
                        title="暂停"
                        @click="togglePlay"
                    >
                        <i class="fa fa-pause"></i>
                    </button>
                    <button
                        type="button"
                        class="xqmusic-play"
                        :class="{ active: !isPlay }"
                        :style="{ display: isPlay ? 'none' : 'block' }"
                        title="播放"
                        @click="togglePlay"
                    >
                        <i class="fa fa-play"></i>
                    </button>
                    <button type="button" class="xqmusic-next" title="下一首" @click="playNext">
                        <i class="fa fa-chevron-right"></i>
                    </button>
                    <button type="button" class="xqmusic-word" title="歌词" @click="toggleList('lrc')">
                        <i class="fa fa-file-word"></i>
                    </button>
                    <button type="button" class="xqmusic-list" title="列表" @click="toggleList('list')">
                        <i class="fa fa-list"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
    import { findLyricIndex, formatTime, parseLyric } from '../js/xqmusic-utils.mjs'
    // 直接消费 UMD 版同一份样式表：不再内联一份 <style>，也不需要 less 预处理器。
    // 所有选择器都以 .xqmusic 开头，不会污染宿主页面。
    import '../css/xqmusic.css'

    const props = defineProps({
        /** 歌曲列表，字段见 README：id / name / author / pic / url / lyric_url */
        list: { type: Array, default: () => [] },
        /** 'slide' 固定在右下角，'move' 由宿主自行定位 */
        mode: { type: String, default: 'slide' },
    })

    const LYRIC_LINE_HEIGHT = 36

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
</script>
