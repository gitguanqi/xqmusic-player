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
    // 获取歌曲列表
    getMusicList();
})

// 获取歌曲列表
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
