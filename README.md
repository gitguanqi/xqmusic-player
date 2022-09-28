# xqmusic-player

This is a simplify music player.

## use

### import cdn

```html
<!-- cdn css -->
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.2.0/css/all.min.css">
<link rel="stylesheet" href="https://unpkg.com/xqmusic-player/libs/css/xqmusic.min.css">
<!-- cdn js -->
<script src="https://cdn.bootcdn.net/ajax/libs/axios/0.27.2/axios.min.js"></script>
<script src="https://unpkg.com/xqgjs/libs/gjs.min.js"></script>
<script src="https://unpkg.com/xqmusic-player@1.0.1/libs/js/xqmusic.min.js"></script>
```

### use npm

```sh
npm i xqmusic-player
```

### mock

`/mock/music.json`:

```json
[
    {
        "id": 1,
        "name": "麻雀",
        "author": "李荣浩",
        "pic": "./lrh-mq.jpg",
        "lyric_url": "./lrh-mq.lrc",
        "url": "./lrh-mq.mp3"
    },
    {
        "id": 2,
        "name": "年少有为",
        "author": "李荣浩",
        "pic": "./lrh-nsyw.jpg",
        "lyric_url": "./lrh-nsyw.lrc",
        "url": "./lrh-nsyw.mp3"
    },
    {
        "id": 3,
        "name": "爸爸妈妈",
        "author": "李荣浩",
        "pic": "./lrh-bbmm.jpg",
        "lyric_url": "./lrh-bbmm.lrc",
        "url": "./lrh-bbmm.mp3"
    }
]
```

### browser

```html
<div id="music"></div>
```

```js
// 插件参数
let options = {
    el: '#music',
    list: [],
    mode: 'slide', // move/slide
},
dataUrl = '/mock/music.json';

window.onload = function () {  
    getList();
}


// 获取歌曲列表
async function getList () {  
    let data = await axios.get(dataUrl);
    if (data.status === 200) {
        options.list = [...data.data];
        init(options);
    }
}

// 初始化参数
function init (options) {  
    new XqMusic(options);
}
```

### vue3

```js
import xqMusic from 'xqmusic-player/libs/vue/xqmusic';
const app = createApp(App);
app.use(xqMusic);
```

```vue
<template>
    <div>
        <xq-music :list="post.list"></xq-music>
    </div>
</template>

<script setup>

import { reactive, getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance();

const demo = reactive({
    list: [],
});

onMounted(() => {
    getMusicList();
})

async function getMusicList () {  
    let url = '/mock/music.json';
    let data = await proxy.$http.get(url);
    if (data.status === 200) {
        let list = data.data;
        if (list && list.length) {
            demo.list = list;
        }
    }
}
</script>
```

### preview

![xqlight](./docs/img/preview.jpg)

## issue

[submit your question](https://github.com/gitguanqi/xqmusic-player/issues/new)

## author

[@gitguanqi](https://github.com/gitguanqi)
