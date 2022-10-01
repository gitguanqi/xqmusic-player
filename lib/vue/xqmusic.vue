<template>
    <div class="xqmusic" ref="xqmusic">
        <div class="xqmusic-top active">
            <ul v-show="musics.showList" class="xqmusic-menu-ls scroll-box">
                <li v-for="item in musics.list" :key="item.id" :class="{'active': musics.index === (item.id-1)}" @click="songPlay(item.id-1)">
                    <span class="overflow">{{item.name}}</span>
                    <button class="song-play">
                        <i :class="{'fa': true, [(musics.isPlay && item.id === musics.index+1) ? 'fa-pause' : 'fa-play']: true}"></i>
                    </button>
                </li>
            </ul>
            <ul v-if="musics.showLrc && musics.lyrics && musics.lyrics.length" ref="xqmusic-lyric-ls" class="xqmusic-lyric-ls scroll-box">
                <li v-for="(item, index) in musics.lyrics" :key="index">
                    {{ item.c }}
                </li>
            </ul>
            <ul v-if="musics.showLrc && musics.lyrics && musics.lyrics.length === 0">
                <li>暂无歌词</li>
            </ul>
        </div>
        <div class="xqmusic-bottom">
            <audio id="xqmusic-audio" ref="xqmusic-audio" :src="`${musics.list && musics.list.length ? musics.list[musics.index].url : ''}`"></audio>
            <!-- 歌曲封面图 -->
            <div class="xqmusic-img">
                <div id="xqmusic-cover-img" :class="{'active': musics.isPlay}" :style="{'backgroundImage': `url(${musics.list && musics.list.length ? musics.list[musics.index].pic : ''})`}"></div>
            </div>
            <div class="xqmusic-main">
                <!-- 歌曲标题 -->
                <div class="xqmusic-title">
                    <small class="overflow" id="xqmusic-song-title">{{musics.list && musics.list.length ? musics.list[musics.index].author : '歌手'}} - {{musics.list && musics.list.length ? musics.list[musics.index].name : '歌曲名'}}</small>
                </div>
                <!-- 歌曲进度条 -->
                <div class="xqmusic-progress">
                    <small id="xqmusic-current">{{ musics.currentTime }}</small>
                    <span>
                        <i id="xqmusic-progress-bar" :style="{'width': musics.progress+'%'}"></i>
                    </span>
                    <small id="xqmusic-total">{{ musics.totalTime }}</small>
                </div>
                <!-- 歌曲操作按钮 -->
                <div class="xqmusic-btns">
                    <button id="xqmusic-muted" title="静音" v-show="musics.showVol" @click="toggleVol(false)">
                        <i class="fa fa-volume-down"></i>
                    </button>
                    <button id="xqmusic-volumn" title="声音" v-show="!musics.showVol" @click="toggleVol(true)">
                        <i class="fa fa-volume-mute"></i>
                    </button>
                    <button id="xqmusic-prev" title="上一首" @click="playPrev">
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    <button id="xqmusic-pause" title="暂停" v-show="musics.isPlay" @click="togglePlay('pause')">
                        <i class="fa fa-pause"></i>
                    </button>
                    <button id="xqmusic-play" class="active" title="播放" v-show="!musics.isPlay" @click="togglePlay('play')">
                        <i class="fa fa-play"></i>
                    </button>
                    <button id="xqmusic-next" title="下一首" @click="playNext">
                        <i class="fa fa-chevron-right"></i>
                    </button>
                    <button id="xqmusic-word" title="歌词" @click="toggleList('lrc')">
                        <i class="fa fa-file-word"></i>
                    </button>
                    <button id="xqmusic-list" title="列表" @click="toggleList('list')">
                        <i class="fa fa-list"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { onMounted, reactive, getCurrentInstance, defineProps, toRefs } from 'vue'

    const { proxy } = getCurrentInstance();

    const props = defineProps({
        list: Array,
    });
    
    const musics = reactive({
        list: [], // 歌曲数据
        index: 0, // 当前索引
        lyrics: [], // 歌词列表
        showLrc: false, // 显示歌词框
        showList: false, // 显示歌曲列表
        showVol: true, // 是否静音
        isPlay: false, // 是否播放
        currentTime: '00:00', // 当前播放时间
        totalTime: '00:00', // 总时间
        progress: 0, // 进度条时间
    })
    
    onMounted(() => {
        init();
    })

    // 初始化
    function init () {
        // 获取列表
        getList();
    }

    // 获取列表
    function getList () {
        let { list } = props;
        for (const key in list) {
            let item = list[key];
            musics.list.push(item);
        }
        if (musics.list && musics.list.length) {
            getLyric(musics.list[musics.index].lyric_url);
        }
    }

    // 获取歌词
    async function getLyric (url) {  
        let data = await proxy.$http.get(url);
        let lrcs = parseLyric(data.data);
        showLyric(lrcs);
    }

    // 解析歌词
    function parseLyric (data) {
        let lrc = {
            ti: '', // 歌名
            ar: '', // 歌手
            al: '', // 专辑
            by: '', // 歌词作者
            offset: 0, // 时间毫秒，调整歌词位置
            ms: [] // 歌词{t:时间，c:歌词}
        }
        if (data.length === 0) return;
        let lrcs = data.split('\n');
        for (let key in lrcs) {
            lrcs[key] = lrcs[key].replace(/(^\s*)|(\s*$)/g, '');
            let t = lrcs[key].substring(lrcs[key].indexOf("[") + 1, lrcs[key].indexOf("]"));
            let s = t.split(":");
            if (isNaN(parseInt(s[0]))) { // 非数值
                for (const lKey in lrc) {
                    if (lKey !== 'ms' &&
                        lKey == s[0].toLowerCase()) {
                        lrc[lKey] = s[1];
                    }
                }
            } else {
                let arr = lrcs[key].match(/\[(\d+:.+?)\]/g); // 时间
                let start = 0;
                for (const k in arr) {
                    start += arr[k].length; // 歌词位置
                }
                let content = lrcs[key].substring(start); // 歌词内容
                for (const k in arr) {
                    let t = arr[k].substring(1, arr[k].length - 1);
                    let s = t.split(":");
                    lrc.ms.push({
                        t: (parseFloat(s[0]) * 60 + parseFloat(s[1])).toFixed(3),
                        c: content,
                    })
                }
            }
        }
        lrc.ms.sort(function (a, b) {
            return a.t - b.t;
        })
        return lrc;
    }

    // 显示歌词
    function  showLyric (lrc) {
        let lrcs = [];
        for (const item of lrc.ms) {
            lrcs.push(item);
        }
        musics.lyrics = [...lrcs];
    }

    // 显示歌词位置
    function showLyricPos (time) {
        let xqLyricBox = document.querySelector('.xqmusic-lyric-ls');
        let lrcItem = document.querySelectorAll('.xqmusic-lyric-ls li');
        if (musics.lyrics && musics.lyrics.length === 0) return;
        for (let i = 0; i < musics.lyrics.length; i++) {
            let item = musics.lyrics[i];
            let diff = time - item.t;
            if (diff >= 0 && diff < 1) {
                for (const item of lrcItem) {
                    item.className = '';
                }
                if (!lrcItem[i]) return;
                lrcItem[i].className = 'active';
                let lyrTop = lrcItem[i].offsetTop - proxy.$refs.xqmusic.offsetTop;
                let midTop = xqLyricBox.offsetHeight / 2;
                let allowLineNum = midTop / 36;
                let diffTop = lyrTop - midTop;
                if (i >= allowLineNum && diffTop > 0) {
                    xqLyricBox.scrollTop = diffTop;
                } else {
                    xqLyricBox.scrollTop = 0;
                }
            }
        }
    }

    // 切换列表
    function toggleList (type) {
        if (type === 'lrc') {
            musics.showList = false;
            musics.showLrc = !musics.showLrc;
        } else {
            musics.showLrc = false;
            musics.showList = !musics.showList;
        }
    }

    // 切换声音
    function toggleVol (type) {  
        musics.showVol = type;
        proxy.$refs['xqmusic-audio'].muted = type ? false : true;
    }

    // 是否播放
    function togglePlay (type) {  
        musics.isPlay = type == 'play' ? true: false;
        if (musics.isPlay) {
            proxy.$refs['xqmusic-audio'].play();
        } else {
            proxy.$refs['xqmusic-audio'].pause();
        }
        proxy.$refs['xqmusic-audio'].addEventListener('timeupdate', getTime, false);
    }

    // 上一首
    function playPrev () {  
        if (musics.index === 0) {
            musics.index = musics.list.length;
        }
        musics.index--;
        playSong();
    }

    // 下一首
    function playNext () {  
        if (musics.index >= 0 && musics.index <= musics.list.length) {
        musics.index++;
        }
        if (musics.index == musics.list.length) {
            musics.index = 0;
        }
        playSong();
    }

    // 歌曲切换
    function songPlay (index) {  
        musics.index = index;
        playSong();
    }

    // 播放歌曲
    function playSong () {  
        let item = musics.list[musics.index];
        getLyric(item.lyric_url);
        musics.isPlay = false;
        musics.currentTime = '00:00';
        musics.progress = 0;
        musics.totalTime = '00:00';
        proxy.$refs['xqmusic-audio'].load();
    }

    // 获取时间
    function  getTime (e) {
        if (!musics.isPlay) return;
        let currentTime = proxy.$refs['xqmusic-audio'].currentTime || e.timeStamp / 1000;
        musics.currentTime = calcTimeStr(currentTime).m;
        musics.progress = (currentTime / proxy.$refs['xqmusic-audio'].duration) * 100;
        musics.totalTime = proxy.$refs['xqmusic-audio'].duration ? calcTimeStr(proxy.$refs['xqmusic-audio'].duration).m : '00:00';
        if (musics.list[musics.index].lyric_url) {
            showLyricPos(currentTime);
        }
    }

    // 计算时间字符串
    function calcTimeStr (second) {
        let s = 0;
        let m = 0;
        let h = 0;
        let sNum = second % 60;
        let res = '';
        if (second < 3600) {
            s = sNum;
            m = parseInt(second / 60);
            h = 0;
        } else {
            let mNum = second % 3600;
            if (mNum % 60 < 60) {
                s = mNum % 60;
                m = parseInt(mNum / 60)
            }
            m = parseInt(mNum / 60);
            h = parseInt(second / 3600);
        }
        s = s > 10 ? parseInt(s) : '0' + parseInt(s);
        m = m > 10 ? m : '0' + m;
        h = h > 10 ? h : '0' + h;
        res = h + ':' + m + ':' + s;
        return {
            h: res,
            m: m + ':' + s,
        };
    }

    function getId (id) {  
        return document.getElementById(id);
    }

</script>

<style lang="less" scoped>
.xqmusic {
    margin: 10px auto;
    max-width: 320px;
    border-radius: 5px;

    .overflow {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .scroll-box::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    .scroll-box::-webkit-scrollbar-thumb {
        border-radius: 20px;
        -webkit-box-shadow: inset 0 0 5px #d32d2d;
        box-shadow: inset 0 0 5px #d32d2d;
        background: #d32d2d;
    }

    .scroll-box::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 5px white;
        box-shadow: inset 0 0 5px white;
        border-radius: 8px;
        background: white;
    }

    @keyframes donut-spin {
        0% {
            transform: rotate(0deg);
        }

        100% {
            transform: rotate(360deg);
        }
    }

    & {
        width: 100%;
        &.slide {
            position: fixed;
            bottom: 25px;
            right: -252px;
            transition: all .5s;
            &:hover {
                right: 0;
            }
        }
        &.move {
            position: absolute;
            &:hover {
                cursor: move;
            }
        }
    }

    .xqmusic-top {
        padding: 10px 0;
        width: 100%;
        border: 1px solid #ccc;
        border-bottom: none;
        &.active {
            padding: 0;
        }
    }

    .xqmusic-menu-ls,
    .xqmusic-lyric-ls {
        box-sizing: border-box;
        padding: 10px 5px;
        width: 100%;
        height: 100%;
        max-height: 200px;
        overflow-x: hidden;
        overflow-y: auto;
        transition: all .5s;
    }

    .xqmusic-menu-ls {
        li {
            box-sizing: border-box;
            padding: 5px 10px;
            height: 35px;
            font-size: 14px;
            border-bottom: 1px dashed #ccc;
            span {
                display: inline-block;
                width: 85%;
                height: 25px;
                line-height: 25px;
            }
            button {
                position: relative;
                top: -8px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid #333;
                cursor: pointer;
                &.active {
                    display: inline-block;
                }
            }
            i {
                position: relative;
                left: -2px;
                top: -2px;
                font-size: 12px;
            }
            &.active {
                color: #d32d2d;
                button {
                    border-color: #d32d2d;
                }
                i {
                    color: #d32d2d;
                }
            }
        }
    }

    .xqmusic-lyric-ls {
        li {
            font-size: 14px;
            line-height: 2;
            color: #333;
            text-align: center;
            &.active {
                color: #d32d2d;
                font-weight: bold;
            }
        }
    }

    .xqmusic-bottom {
        display: flex;
        align-items: center;
        width: 100%;
        height: 65px;
        overflow: hidden;
        border: 1px solid #ccc;
        /* 歌曲封面图 */
        .xqmusic-img {
            width: 65px;
            height: 100%;
            background: #333;
            overflow: hidden;
            #xqmusic-cover-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: #ccc;
                background-size: cover;
                animation: donut-spin 10s linear infinite;
                animation-play-state: paused;
                overflow: hidden;
                &.active {
                    animation-play-state: running;
                }
            }
        }
    }

    .xqmusic-main {
        flex: 1;
        height: 100%;
        box-sizing: border-box;
        padding: 2px;
        /* 歌曲标题 */
        .xqmusic-title {
            max-width: 180px;
            box-sizing: border-box;
            padding-left: 5px;
            font-size: 14px;
            small {
                display: inline-block;
                width: auto;
                max-width: 100%;
            }

        }
        /* 歌曲进度条 */
        .xqmusic-progress {
            margin: 2px 0;
            display: flex;
            align-items: center;
            text-align: center;
            font-size: 12px;
            span {
                position: relative;
                flex: 1;
                height: 3px;
                border-radius: 5px;
                background: #ccc;
                overflow: hidden;
                i {
                    position: absolute;
                    left: 0;
                    top: 0;
                    display: inline-block;
                    height: 100%;
                    background-color: #d32d2d;
                    transition: all .5s;
                }
            }
            small {
                width: 40px;
            }
        }
        /* 歌曲操作按钮 */
        .xqmusic-btns {
            display: flex;
            align-items: center;
            justify-content: space-between;
            button {
                cursor: pointer;
                i {
                    font-size: 16px;
                    color: #333;
                }
            }
        }
    }

}
</style>