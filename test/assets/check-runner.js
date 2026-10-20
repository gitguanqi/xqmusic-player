/**
 * 测试页共用的自检运行器。
 *
 * 页面上的每一项检查都必须以可见的 PENDING / PASS / FAIL 呈现，
 * 失败不能只出现在 console 里（人工在浏览器里打开也要能看出结果）。
 *
 * 每个页面最后调用 XqDemo.report({ remount, liveCount })：
 * - remount 负责在生命周期断言之后重新挂一个可交互的 demo，
 *   保证页面最终态不是空白面板；
 * - liveCount 返回当前可见实例数，必须 > 0 才算 PASS。
 *
 * 检查是串行执行的：绝大多数断言操作的是同一个实例的同一份 DOM，
 * 并行跑会互相踩（上一条刚切到第三首，下一条已经在断言第一首的歌词）。
 */
(function () {
    /** @type {Promise<void>} 串行执行队列，保证断言之间不会互相干扰 */
    var queue = Promise.resolve();
    var results = [];
    var statusEl = document.getElementById('status');
    var listEl = document.getElementById('checks');

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function row(result) {
        var li = el('li', 'check ' + (result.ok ? 'is-pass' : 'is-fail'));
        li.appendChild(el('span', 'badge', result.ok ? 'PASS' : 'FAIL'));
        li.appendChild(el('span', 'name', result.name));
        if (result.detail) li.appendChild(el('span', 'detail', result.detail));
        return li;
    }

    function render() {
        listEl.textContent = '';
        results.forEach(function (r) {
            listEl.appendChild(row(r));
        });
    }

    /** 串行跑一项检查并落地结果 */
    function settle(name, fn) {
        return Promise.resolve()
            .then(fn)
            .then(function (out) {
                var ok = out === true || (out && out.ok);
                results.push({ name: name, ok: !!ok, detail: (out && out.detail) || '' });
            }, function (err) {
                results.push({ name: name, ok: false, detail: '抛错: ' + (err && err.message) });
            });
    }

    window.XqDemo = {
        /**
         * 登记一项检查。fn 返回 true / { ok, detail }，抛异常即判失败。
         *
         * 注意是排队的：check() 返回的 promise 在所有前序检查跑完之后才落地，
         * 页面可以放心在多条断言之间共享同一个实例。
         *
         * @param {string} name
         * @param {Function} fn
         * @returns {Promise<void>}
         */
        check: function (name, fn) {
            queue = queue.then(function () {
                return settle(name, fn);
            });
            return queue;
        },

        /**
         * 汇总结论。必须在页面脚本末尾调用。
         * @param {{remount?: Function, liveCount?: Function}} [options]
         * @returns {Promise<Object>}
         */
        report: function (options) {
            var opts = options || {};
            return queue.then(function () {
                // 生命周期断言可能销毁了唯一的实例，这里必须把可见 demo 重新挂回来
                if (typeof opts.remount === 'function') {
                    try {
                        opts.remount();
                    } catch (err) {
                        results.push({ name: '重新挂载 demo', ok: false, detail: err.message });
                    }
                }
                render();

                var failed = results.filter(function (r) { return !r.ok; }).length;
                var live = typeof opts.liveCount === 'function' ? opts.liveCount() : 1;
                var passed = failed === 0 && live > 0;

                statusEl.className = 'status ' + (passed ? 'is-pass' : 'is-fail');
                statusEl.textContent = passed
                    ? 'PASS  ' + results.length + '/' + results.length + ' 项检查通过 —— 下方是可直接交互的 demo'
                    : 'FAIL  ' + (results.length - failed) + '/' + results.length + ' 项通过';

                window.__TEST_RESULTS__ = {
                    status: passed ? 'passed' : 'failed',
                    liveInstances: live,
                    checks: results,
                };
                return window.__TEST_RESULTS__;
            });
        },

        /** 预置状态文案，页面加载时先显示「检查中」 */
        setStatus: function (state, text) {
            statusEl.className = 'status is-' + state;
            statusEl.textContent = text;
        },
    };
})();
