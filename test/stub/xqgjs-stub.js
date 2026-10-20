/**
 * xqgjs 的本地替身，只实现本包用到的三个接口：dom / gId / Drag。
 *
 * 存在的意义：仓库里的测试页原来从第三方 CDN 拉 $g，离线或 CDN 抖动时整页失败。
 * 这个替身让 test/*.html 完全自足，同时不参与发布（npm files 只包含 lib 与文档）。
 */
(function (global) {
    'use strict';

    global.$g = {
        /**
         * @param {string|Element} selector
         * @returns {Element|null}
         */
        dom: function (selector) {
            if (typeof selector === 'string') {
                return global.document.querySelector(selector);
            }
            return selector || null;
        },

        /**
         * @param {string} id
         * @returns {Element|null}
         */
        gId: function (id) {
            return global.document.getElementById(id);
        },

        /**
         * 极简拖拽：只保证构造不报错，并支持 destroy()，够测试页用。
         * @constructor
         * @param {Element} element
         */
        Drag: function Drag(element) {
            this.element = element;
            this.destroy = function () {
                this.element = null;
            };
        },
    };
})(window);
