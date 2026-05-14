/**
 * examSessionMixin.js - 入口文件
 * 管理练习会话生命周期：打开练习窗口、注入数据、跟踪会话、构建URL
 *
 * 子模块：
 *   js/app/examSession/windowManager.js   - 练习窗口管理
 *   js/app/examSession/dataInjector.js    - 数据注入
 *   js/app/examSession/sessionTracker.js  - 练习会话跟踪
 *   js/app/examSession/urlBuilder.js      - 练习 URL 构建
 */
(function (global) {

    // ===== 共享函数：题目索引查找 =====

    async function getActiveExamIndexSnapshot() {
        const stateGetters = [
            () => (typeof global.getExamIndexState === 'function') ? global.getExamIndexState() : null,
            () => (typeof getExamIndexState === 'function') ? getExamIndexState : null
        ];

        for (const getterFactory of stateGetters) {
            try {
                const getter = getterFactory();
                if (typeof getter === 'function') {
                    const state = getter();
                    if (Array.isArray(state) && state.length) {
                        return state.slice();
                    }
                }
            } catch (_) { }
        }

        let activeKey = 'exam_index';
        try {
            if (typeof global.getActiveLibraryConfigurationKey === 'function') {
                const resolved = await global.getActiveLibraryConfigurationKey();
                if (resolved && typeof resolved === 'string' && resolved.trim()) {
                    activeKey = resolved.trim();
                }
            } else {
                const storedKey = await storage.get('active_exam_index_key', 'exam_index');
                if (storedKey && typeof storedKey === 'string' && storedKey.trim()) {
                    activeKey = storedKey.trim();
                }
            }
        } catch (_) {
            try {
                const storedKey = await storage.get('active_exam_index_key', 'exam_index');
                if (storedKey && typeof storedKey === 'string' && storedKey.trim()) {
                    activeKey = storedKey.trim();
                }
            } catch (_) { }
        }

        let dataset = await storage.get(activeKey, []) || [];
        if ((!Array.isArray(dataset) || dataset.length === 0) && activeKey !== 'exam_index') {
            dataset = await storage.get('exam_index', []) || [];
        }
        if (!Array.isArray(dataset) || dataset.length === 0) {
            if (Array.isArray(global.examIndex) && global.examIndex.length) {
                dataset = global.examIndex.slice();
            } else if (Array.isArray(global.completeExamIndex) && global.completeExamIndex.length) {
                dataset = global.completeExamIndex.slice();
            }
        }
        return Array.isArray(dataset) ? dataset : [];
    }

    async function findExamDefinition(examId) {
        if (!examId) {
            return null;
        }
        if (typeof global.getExamById === 'function') {
            return global.getExamById(examId);
        }
        const list = await getActiveExamIndexSnapshot();
        const match = list.find(entry => entry && entry.id === examId);
        if (match) {
            return match;
        }

        const fallbacks = [
            Array.isArray(global.examIndex) ? global.examIndex : null,
            Array.isArray(global.completeExamIndex) ? global.completeExamIndex : null,
            Array.isArray(global.listeningExamIndex) ? global.listeningExamIndex : null
        ];
        for (const fallback of fallbacks) {
            if (!Array.isArray(fallback)) continue;
            const found = fallback.find(entry => entry && entry.id === examId);
            if (found) {
                return found;
            }
        }

        return null;
    }

    // ===== 合并子模块 =====

    const modules = global.__examSessionModules || {};

    const mixin = {
        // 内部函数包装为 mixin 方法
        _getActiveExamIndexSnapshot: getActiveExamIndexSnapshot,
        _findExamDefinition: findExamDefinition,

        // ExamBrowser组件已移除，使用内置的题目列表功能
    };

    // 合并各子模块方法
    const moduleNames = ['urlBuilder', 'windowManager', 'dataInjector', 'sessionTracker'];
    for (let i = 0; i < moduleNames.length; i++) {
        const mod = modules[moduleNames[i]];
        if (mod && typeof mod === 'object') {
            Object.assign(mixin, mod);
        }
    }

    global.ExamSystemAppMixins = global.ExamSystemAppMixins || {};
    global.ExamSystemAppMixins.examSession = mixin;

    // 清理临时模块引用
    delete global.__examSessionModules;
})(typeof window !== "undefined" ? window : globalThis);
