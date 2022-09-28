# xqmusic-player

This is a simplify music player.

## use

### import cdn

```html
<!-- cdn -->
<link rel="stylesheet" href="https://xqgj.cc/xqcdn/libs/font-awesome/5.15.3/css/all.min.css">
<link rel="stylesheet" href="https://xqgj.cc/xqcdn/libs/xqmusic/0.0.1/css/xqmusic.min.css">
<script src="https://xqgj.cc/xqcdn/libs/gjs/1.0.3/js/gjs.min.js"></script>
<script src="https://xqgj.cc/xqcdn/libs/axios/0.19.2/axios.min.js"></script>
<script src="https://xqgj.cc/xqcdn/libs/xqmusic/0.0.1/js/xqmusic.min.js"></script>
```

### use npm

```sh
npm i xqmusic-player
```

### vue3

```js
import xqMusic from 'xqmusic-player/libs/vue/xqmusic';
const app = createApp(App);
app.use(xqMusic);
```

### detail

```html
<div id="music"></div>
```

```js
let songs = [
    {
        id: 1,
        name: '麻雀',
        author: '李荣浩',
        pic: './data/lrh-mq.jpg',
        lyric_url: './data/lrh-mq.lrc',
        url: './data/lrh-mq.mp3',
    },
    {
        id: 2,
        name: '年少有为',
        author: '李荣浩',
        pic: './data/lrh-nsyw.jpg',
        lyric_url: './data/lrh-nsyw.lrc',
        url: './data/lrh-nsyw.mp3',
    },
    {
        id: 3,
        name: '爸爸妈妈',
        author: '李荣浩',
        pic: './data/lrh-bbmm.jpg',
        lyric_url: './data/lrh-bbmm.lrc',
        url: './data/lrh-bbmm.mp3',
    }
]

let options = {
    el: '#music',
    list: songs,
    mode: 'slide', // move/slide
}

new XqMusic(options);
```

### preview

![xqlight](https://xqgj.cc/xqmusic-player/img/preview.jpg)

## issue

[submit your question](https://github.com/gitguanqi/xqmusic-player/issues/new)

## author

[@gitguanqi](https://github.com/gitguanqi)
