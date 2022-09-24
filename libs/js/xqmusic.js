/* 
author: gitguanqi,
date: 2022-09-24,
version: 0.0.1
*/
// 小奇音乐播放器插件
function XqMusic (options = {
    el: 'body',
    list: [],
    move: false,
    slide: false,
    slideBottom: 0,
}) {
    this.options = options;
    if (!options.el) {
        throw new Error('el is must!');
    }
    
    this.version = 'v0.0.1';
    this.author = 'gitguanqi';
    this.date = '2022-09-24';
    this.pluginName = 'XQMusicPlayer';

    this.elem = $g.dom(options.el);
    this.songList = this.options.list; // 歌曲列表
    this.currentIndex = 0; // 当前歌曲索引
    this.lyricShow = false; // 歌词界面显示
    this.songShow = false; // 歌曲界面显示
    this.playStatus = false; // 暂停播放

    this.initPage(options.el);
    this.initElem();

    if (this.options.list && this.options.list.length) {
        this.initEvents();
    }
    
    // 是否移动
    if (this.options.move) {
        this.elem.firstChild.classList.add('move');
        this.boxDrag();
    }

    if (this.songList &&
    this.songList.length) {
        this.showList();
        this.showDefault();
    }
    
}

// 初始化页面
XqMusic.prototype.initPage = function () {  
    let elem = this.elem;
    if (elem && elem.innerText === '') {
        let xqMusicElem = document.createElement('div');
        xqMusicElem.className = this.options.slide ? 'xqmusic slide' : 'xqmusic';
        xqMusicElem.style.bottom = this.options.slideBottom || this.options.slideBottom === 0 ? this.options.slideBottom === 0 ? 0 : this.options.slideBottom + 'px' : 25 + 'px';
        xqMusicElem.innerHTML = `<div class="xqmusic-top active">
                <ul class="xqmusic-menu-ls scroll-box"></ul>
                <ul class="xqmusic-lyric-ls scroll-box">
                    <li>暂无歌词</li>
                </ul>
            </div>
            <div class="xqmusic-bottom">
                <audio id="xqmusic-audio" src=""></audio>
                <!-- 歌曲封面图 -->
                <div class="xqmusic-img">
                    <div id="xqmusic-cover-img"></div>
                </div>
                <div class="xqmusic-main">
                    <!-- 歌曲标题 -->
                    <div class="xqmusic-title">
                        <small class="overflow" id="xqmusic-song-title">歌手 - 歌曲名</small>
                    </div>
                    <!-- 歌曲进度条 -->
                    <div class="xqmusic-progress">
                        <small id="xqmusic-current">00:00</small>
                        <span>
                            <i id="xqmusic-progress-bar"></i>
                        </span>
                        <small id="xqmusic-total">00:00</small>
                    </div>
                    <!-- 歌曲操作按钮 -->
                    <div class="xqmusic-btns">
                        <button id="xqmusic-muted" title="静音">
                            <i class="fa fa-volume-mute"></i>
                        </button>
                        <button id="xqmusic-volumn" class="active" title="声音">
                            <i class="fa fa-volume-down"></i>
                        </button>
                        <button id="xqmusic-prev" title="上一首">
                            <i class="fa fa-chevron-left"></i>
                        </button>
                        <button id="xqmusic-pause" title="暂停">
                            <i class="fa fa-pause"></i>
                        </button>
                        <button id="xqmusic-play" class="active" title="播放">
                            <i class="fa fa-play"></i>
                        </button>
                        <button id="xqmusic-next" title="下一首">
                            <i class="fa fa-chevron-right"></i>
                        </button>
                        <button id="xqmusic-word" title="歌词">
                            <i class="fa fa-file-word"></i>
                        </button>
                        <button id="xqmusic-list" title="列表">
                            <i class="fa fa-list"></i>
                        </button>
                    </div>
                </div>
            </div>`
        ;
        elem.appendChild(xqMusicElem);
    }
    return true;
}

// 初始化元素
XqMusic.prototype.initElem = function () {  
    this.xqCoverImg = $g.gId('xqmusic-cover-img'); // 封面图
    this.xqSongTitle = $g.gId('xqmusic-song-title'); // 标题
    this.xqProgressBar = $g.gId('xqmusic-progress-bar'); // 进度条
    this.xqCurrentTime = $g.gId('xqmusic-current'); // 当前播放
    this.xqTotal = $g.gId('xqmusic-total'); // 总时间
    this.xqMuted = $g.gId('xqmusic-muted'); // 静音
    this.xqVolumn = $g.gId('xqmusic-volumn'); // 声音
    this.xqPrev = $g.gId('xqmusic-prev'); // 上一首
    this.xqPause = $g.gId('xqmusic-pause'); // 暂停
    this.xqPlay = $g.gId('xqmusic-play'); // 播放
    this.xqNext = $g.gId('xqmusic-next'); // 下一首
    this.xqWord = $g.gId('xqmusic-word'); // 显示歌词
    this.xqList = $g.gId('xqmusic-list'); // 列表按钮
    this.xqSongBox = $g.dom('.xqmusic-menu-ls'); // 歌曲盒子
    this.xqLyricBox = $g.dom('.xqmusic-lyric-ls'); // 歌词盒子
    this.xqAudio = $g.gId('xqmusic-audio'); // 播放器
    this.xqTop = $g.dom('.xqmusic-top'); // 播放器
}

// 初始化事件
XqMusic.prototype.initEvents = function () {  
    // 歌词界面切换
    this.xqWord.addEventListener('click', () => {
        this.lyricPageToggle();
    }, false);
    this.xqList.addEventListener('click', () => {
        this.songPageToggle();
    }, false);
    this.xqMuted.addEventListener('click', () => {
        this.showMuted();
    }, false);
    this.xqVolumn.addEventListener('click', () => {
        this.showVolumn();
    }, false);
    // 播放暂停
    this.xqPlay.addEventListener('click', () => {
        this.playSong();
    }, false);
    this.xqPause.addEventListener('click', () => {
        this.playSong();
    }, false);
    this.xqAudio.addEventListener('timeupdate', () => {
        this.getTime();
    }, false);
    // 切换歌曲
    this.xqPrev.addEventListener('click', () => {
        this.togglePrevSong();
    }, false);
    this.xqNext.addEventListener('click', () => {
        this.toggleNextSong();
    }, false);
}

// 拖拽
XqMusic.prototype.boxDrag = function () {  
    new $g.Drag($g.dom(`${this.options.el} .xqmusic`));
}

// 显示歌曲列表
XqMusic.prototype.showList = function () {
    let songStr = '';
    for (const item of this.songList) {
        songStr += `<li data-id="${item.id}">
            <span class="overflow">${item.name}</span>
            <button data-id="${item.id}" class="song-play">
                <i data-id="${item.id}" class="fa fa-play"></i>
            </button>
        </li>`;
    }
    this.xqSongBox.innerHTML = songStr;
    this.showCurrentHigh();
}

// 显示正在播放
XqMusic.prototype.showCurrentHigh = function () {  
    let playList = document.querySelectorAll('.xqmusic-menu-ls li');
    for (const item of playList) {
        item.className = '';
        item.querySelector('i').className = 'fa fa-play';
        let id = item.getAttribute('data-id');
        if (id == this.songList[this.currentIndex].id) {
            item.className = 'active';
            item.querySelector('i').className = this.playStatus ? 'fa fa-pause' : 'fa fa-play';
        }
        item.querySelector('button').addEventListener('click', (e) => {
            this.toggleListSong(e);
        }, false);
    }
}

// 显示歌曲默认
XqMusic.prototype.showDefault = function() {  
    let item = this.songList[this.currentIndex];
    this.xqCoverImg.style.backgroundImage = `url(${item.pic})`;
    this.xqAudio.src = item.url;
    this.xqSongTitle.innerText = `${item.author} - ${item.name}`;
    if (item.lyric_url) {
        this.getLyric(item.lyric_url);
    } else {
        this.xqLyricBox.innerHTML = '<li>暂无歌词</li>';
        localStorage.setItem('lyrcis', JSON.stringify({}));
    }
    this.showCurrentHigh();
}

// 获取歌词
XqMusic.prototype.getLyric = async function  (url) {  
    let data = await axios.get(url);
    let lrcs = this.parseLyric(data.data);
    localStorage.setItem('lyrcis', JSON.stringify(lrcs));
    this.showLyric(lrcs);
}

// 解析歌词
XqMusic.prototype.parseLyric = function (data) {
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
XqMusic.prototype.showLyric = function  (lrc) {
    let lrcStr = '';
    for (const item of lrc.ms) {
        lrcStr += `<li>${item.c}</li>`;
    }
    this.xqLyricBox.innerHTML = lrcStr;
}

XqMusic.prototype.lyricPageToggle = function () {
    this.lyricShow = !this.lyricShow;
    this.songShow = false;
    this.xqLyricBox.style.display = this.lyricShow ? 'block' : 'none';
    this.xqSongBox.style.display = 'none';
    this.xqTop.className = this.lyricShow ? 'xqmusic-top' : 'xqmusic-top active';
}

// 歌曲界面切换
XqMusic.prototype.songPageToggle = function () {
    this.songShow = !this.songShow;
    this.lyricShow = false;
    this.xqSongBox.style.display = this.songShow ? 'block' : 'none';
    this.xqLyricBox.style.display = 'none';
    this.xqTop.className = this.songShow ? 'xqmusic-top' : 'xqmusic-top active';
}

// 静音和声音

XqMusic.prototype.showMuted = function() {  
    this.xqMuted.className = '';
    this.xqVolumn.className = 'active';
    this.xqAudio.muted = false;
}

XqMusic.prototype.showVolumn = function () {  
    this.xqMuted.className = 'active';
    this.xqVolumn.className = '';
    this.xqAudio.muted = true;
}

// 播放歌曲
XqMusic.prototype.playSong = function  () {
    if (!this.playStatus) {
        this.xqAudio.play();
        this.xqPlay.classList.remove('active');
        this.xqPause.classList.add('active');
        this.xqCoverImg.classList.add('active');
        this.getTime();
    } else {
        this.xqAudio.pause();
        this.xqPlay.classList.add('active');
        this.xqPause.classList.remove('active');
        this.xqCoverImg.classList.remove('active');
    }
    this.playStatus = !this.playStatus;
    this.showCurrentHigh();
}

// 获取时间
XqMusic.prototype.getTime = function  (e) {
    if (!this.playStatus) return;  
    let currentTime = this.xqAudio.currentTime || e.timeStamp / 1000;
    this.xqCurrentTime.innerText = this.calcTimeStr(currentTime).m;
    let precent = (currentTime / this.xqAudio.duration) * 100;
    this.xqProgressBar.style.width = precent+'%';
    this.xqTotal.innerText = this.xqAudio.duration ? this.calcTimeStr(this.xqAudio.duration).m : '00:00';
    if (this.songList[this.currentIndex].lyric_url) {
        this.showLyricPos(currentTime);
    }
}

// 计算时间字符串
XqMusic.prototype.calcTimeStr = function (second) {
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

// 歌词高亮
XqMusic.prototype.showLyricPos = function  (time) {
    let lyrcis = localStorage.getItem('lyrcis'),
    lrcItem = document.querySelectorAll('.xqmusic-lyric-ls li');
    lyrcis = JSON.parse(lyrcis).ms;
    if (lyrcis && lyrcis.length === 0) return;
    let index = 0;
    for (let i = 0; i < lyrcis.length; i++) {
        let item = lyrcis[i];
        let diff = time - item.t;
        if (diff >= 0 && diff < 1) {
            index = i;
            for (const item of lrcItem) {
                item.className = '';
            }
            lrcItem[i].className = 'active';
            let lyrTop = lrcItem[i].offsetTop;
            let midTop = this.xqLyricBox.offsetHeight / 2;
            let allowLineNum = midTop / 36;
            let diffTop = lyrTop - midTop;
            if (i >= allowLineNum && diffTop > 0) {
                this.xqLyricBox.scrollTop = diffTop;
            } else {
                this.xqLyricBox.scrollTop = 0;
            }
        }
    }
}

XqMusic.prototype.togglePrevSong = function  () {  
    if (this.currentIndex === 0) {
        this.currentIndex = this.songList.length;
    }
    this.currentIndex--;
    this.toggleMusic(this.currentIndex);
}

XqMusic.prototype.toggleNextSong = function  () {  
    if (this.currentIndex >= 0 && this.currentIndex <= this.songList.length) {
        this.currentIndex++;
    }
    if (this.currentIndex == this.songList.length) {
        this.currentIndex = 0;
    }
    this.toggleMusic();
}

XqMusic.prototype.toggleListSong = function  (e) {
    let id = e.target.dataset.id;
    let index = this.songList.findIndex(s => id == s.id);
    this.currentIndex = index;
    this.toggleMusic();
}

XqMusic.prototype.toggleMusic = function () {
    this.showDefault();
    this.showCurrentHigh();
    this.xqCoverImg.className = '';
    this.xqTotal.innerText = '00:00';
    this.xqLyricBox.scrollTop = 0;
    this.xqAudio.pause();
    this.xqPlay.classList.add('active');
    this.xqPause.classList.remove('active');
    this.xqCoverImg.classList.remove('active');
    this.playStatus = false;
}
