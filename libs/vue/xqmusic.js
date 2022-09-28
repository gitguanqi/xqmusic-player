import xqMusicPlayer from './xqmusic.vue'

const xqMusic = {
    install: function (Vue) {  
        Vue.component('xqMusic', xqMusicPlayer)
    }
}

export default xqMusic;
