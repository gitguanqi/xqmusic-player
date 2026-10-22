/**
 * Vue 插件入口。
 *
 * 同时导出组件本身与 install 对象：
 * - Vue 3: app.use(xqMusic)  /  app.component('xqMusic', XqMusic)
 * - Vue 2 的 Vue.use() 也能调用 install（Vue2 无法编译 <script setup>，见 README 的兼容性说明）
 */
import xqMusicPlayer from './xqmusic.vue';

// script setup 不会生成 name 选项，这里补上，便于 devtools 与递归组件定位
xqMusicPlayer.name = 'XqMusic';

const xqMusic = {
    version: '1.3.0',
    component: xqMusicPlayer,
    install: function (app) {
        // 两个名字都注册：模板里写 <xq-music> 还是 <XqMusic> 都能命中
        app.component('xq-music', xqMusicPlayer);
        app.component('xqMusic', xqMusicPlayer);
        return app;
    }
};

export { xqMusicPlayer as XqMusic };
export default xqMusic;
