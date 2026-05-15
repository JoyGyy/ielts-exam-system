'use strict';

var STRICT_ON_DEMAND = true;
var BROWSE_GROUP = 'browse-runtime';
var STATE_CORE_GROUP = 'state-core';

function ensureLazyGroup(name) {
    if (!name || !window.AppLazyLoader || typeof window.AppLazyLoader.ensureGroup !== 'function') {
        return Promise.resolve();
    }
    return window.AppLazyLoader.ensureGroup(name);
}

var browseGroupPromise = null;
var stateCorePromise = null;
var coreBootstrapStarted = false;

function reapplyAppMixins() {
    if (window.ExamSystemAppMixins && typeof window.ExamSystemAppMixins.__applyToApp === 'function') {
        try {
            window.ExamSystemAppMixins.__applyToApp();
        } catch (error) {
            console.warn('[MainEntry] 重新应用 mixins 失败:', error);
        }
    }
}

function ensureBrowseGroup() {
    if (!browseGroupPromise) {
        browseGroupPromise = ensureLazyGroup(BROWSE_GROUP).then(function onBrowseLoaded() {
            reapplyAppMixins();
            if (typeof window.setupBrowsePreferenceUI === 'function') {
                try {
                    window.setupBrowsePreferenceUI();
                } catch (error) {
                    console.warn('[MainEntry] 初始化题库偏好 UI 失败:', error);
                }
            }
            return true;
        }).catch(function onBrowseLoadError(error) {
            browseGroupPromise = null;
            throw error;
        });
    }
    return browseGroupPromise;
}

function ensureStateCoreGroup() {
    if (!stateCorePromise) {
        stateCorePromise = ensureLazyGroup(STATE_CORE_GROUP);
    }
    return stateCorePromise;
}

// 向后兼容：提供 window.ensureBrowseGroup，避免 main.js 注入垃圾 shim 警告
if (typeof window.ensureBrowseGroup !== 'function') {
    window.ensureBrowseGroup = ensureBrowseGroup;
}

function ensureExamData() {
    if (typeof window.ensureExamDataScripts === 'function') {
        return window.ensureExamDataScripts();
    }
    return ensureLazyGroup('exam-data');
}

function setStorageNamespace() {
    if (!window.storage || !window.storage.ready || typeof window.storage.setNamespace !== 'function') {
        return;
    }
    window.storage.ready.then(function applyNamespace() {
        window.storage.setNamespace('exam_system');
        try {
            console.log('[MainEntry] 已设置存储命名空间: exam_system');
        } catch (_) { }
    }).catch(function handleNamespaceError(error) {
        console.error('[MainEntry] 设置命名空间失败', error);
    });
}

function initializeNavigationShell() {
    try {
        if (window.NavigationController && typeof window.NavigationController.ensure === 'function') {
            window.NavigationController.ensure({
                containerSelector: '.main-nav',
                activeClass: 'active',
                initialView: 'overview',
                syncOnNavigate: true,
                onRepeatNavigate: function onRepeatNavigate(viewName) {
                    if (viewName === 'browse' && typeof window.resetBrowseViewToAll === 'function') {
                        window.resetBrowseViewToAll();
                    }
                },
                onNavigate: function onNavigate(viewName) {
                    if (typeof window.showView === 'function') {
                        window.showView(viewName);
                        return;
                    }
                    if (window.app && typeof window.app.navigateToView === 'function') {
                        window.app.navigateToView(viewName);
                    }
                }
            });
        }
    } catch (error) {
        console.warn('[MainEntry] 初始化导航失败:', error);
    }
}

function proxyAfterGroup(groupName, getter, fallback) {
    return function proxiedCall() {
        var args = Array.prototype.slice.call(arguments);
        return ensureLazyGroup(groupName).then(function invoke() {
            var fn = getter();
            if (typeof fn === 'function') {
                return fn.apply(window, args);
            }
            if (typeof fallback === 'function') {
                return fallback.apply(window, args);
            }
            return undefined;
        });
    };
}

// 保持对外接口
if (typeof window.normalizeRecordId !== 'function') {
    window.normalizeRecordId = function normalizeRecordId(id) {
        return id == null ? '' : String(id);
    };
}

if (typeof window.ensureExamDataScripts !== 'function') {
    window.ensureExamDataScripts = function ensureExamDataScripts() {
        return ensureLazyGroup('exam-data');
    };
}

function ensureGlobalFunctionAfterGroup(name, group, fallback) {
    if (typeof window[name] === 'function') {
        return;
    }
    var proxy = function lazyProxy() {
        var args = Array.prototype.slice.call(arguments);
        return ensureLazyGroup(group).then(function () {
            var fn = window[name];
            if (typeof fn === 'function' && fn !== proxy) {
                return fn.apply(window, args);
            }
            if (typeof fallback === 'function') {
                return fallback.apply(window, args);
            }
            return undefined;
        });
    };
    window[name] = proxy;
}

// 懒加载代理（browse 组）
if (typeof window.loadExamList !== 'function') {
    window.loadExamList = proxyAfterGroup(BROWSE_GROUP, function () {
        return window.__legacyLoadExamList || window.loadExamList;
    });
}

if (typeof window.resetBrowseViewToAll !== 'function') {
    window.resetBrowseViewToAll = proxyAfterGroup(BROWSE_GROUP, function () {
        return window.__legacyResetBrowseViewToAll || window.resetBrowseViewToAll;
    });
}

ensureGlobalFunctionAfterGroup('showLibraryLoaderModal', BROWSE_GROUP, function () {
    if (typeof window.showMessage === 'function') {
        window.showMessage('题库管理模块未就绪', 'warning');
    }
});

ensureGlobalFunctionAfterGroup('filterByType', BROWSE_GROUP, function () {
    if (typeof window.showMessage === 'function') {
        window.showMessage('题库筛选模块未就绪', 'warning');
    }
});

ensureGlobalFunctionAfterGroup('filterRecordsByType', BROWSE_GROUP, function () {
    if (typeof window.showMessage === 'function') {
        window.showMessage('练习筛选模块未就绪', 'warning');
    }
});

ensureGlobalFunctionAfterGroup('openExam', BROWSE_GROUP, function (examId, options) {
    if (window.app && typeof window.app.openExam === 'function') {
        return window.app.openExam(examId, options);
    }
    if (typeof window.showMessage === 'function') {
        window.showMessage('题目模块未就绪', 'warning');
    }
    return undefined;
});

ensureGlobalFunctionAfterGroup('viewPDF', BROWSE_GROUP, function (examId) {
    if (typeof window.showMessage === 'function') {
        window.showMessage('PDF 模块未就绪', 'warning');
    }
    return examId;
});

ensureGlobalFunctionAfterGroup('searchExams', BROWSE_GROUP, function (query) {
    var input = document.getElementById('exam-search-input') || document.querySelector('.search-input');
    if (input && typeof query === 'string') {
        input.value = query;
    }
    return query;
});

ensureGlobalFunctionAfterGroup('clearSearch', BROWSE_GROUP, function () {
    var input = document.getElementById('exam-search-input') || document.querySelector('.search-input');
    var clearButton = document.getElementById('search-clear-btn');
    if (input) {
        input.value = '';
    }
    if (clearButton) {
        clearButton.hidden = true;
    }
    if (typeof window.searchExams === 'function') {
        return window.searchExams('');
    }
    return undefined;
});

ensureGlobalFunctionAfterGroup('toggleBulkDelete', BROWSE_GROUP, function () {
    if (typeof window.showMessage === 'function') {
        window.showMessage('批量删除模块未就绪', 'warning');
    }
});

ensureGlobalFunctionAfterGroup('clearPracticeData', BROWSE_GROUP, function () {
    if (typeof window.showMessage === 'function') {
        window.showMessage('练习数据模块未就绪', 'warning');
    }
});

ensureGlobalFunctionAfterGroup('browseCategory', BROWSE_GROUP, function (category, type, filterMode, path) {
    if (window.app && typeof window.app.browseCategory === 'function') {
        return window.app.browseCategory(category, type, filterMode, path);
    }
    if (typeof window.showView === 'function') {
        window.showView('browse', false);
    }
    return undefined;
});

function getActiveViewName() {
    var active = document.querySelector('.view.active');
    if (!active || !active.id) {
        return '';
    }
    return active.id.replace(/-view$/, '');
}

function syncOverviewAfterIndexLoad() {
    if (!window.app || typeof window.app.setState !== 'function') {
        return;
    }
    if (typeof window.getExamIndexState !== 'function') {
        return;
    }
    var list = window.getExamIndexState();
    if (!Array.isArray(list)) {
        return;
    }
    try {
        window.app.setState('exam.index', list.slice());
        if (typeof window.app.refreshOverviewData === 'function') {
            window.app.refreshOverviewData();
        }
    } catch (error) {
        console.warn('[MainEntry] 同步总览数据失败:', error);
    }
}

function handleExamIndexLoaded() {
    syncOverviewAfterIndexLoad();
    var activeView = getActiveViewName();

    if (activeView === 'browse') {
        ensureBrowseGroup().then(function afterBrowseReady() {
            if (typeof window.loadExamList === 'function') {
                try { window.loadExamList(); } catch (_) { }
            }
            var loading = document.querySelector('#browse-view .loading');
            if (loading) {
                loading.style.display = 'none';
            }
        }).catch(function handleBrowseLoadError(error) {
            console.error('[MainEntry] browse-runtime 组加载失败:', error);
        });
        return;
    }

    if (activeView === 'practice') {
        ensureBrowseGroup().then(function onPracticeReady() {
            if (typeof window.updatePracticeView === 'function') {
                try { window.updatePracticeView(); } catch (_) { }
            }
        }).catch(function handlePracticeLoadError(error) {
            console.error('[MainEntry] practice 视图模块加载失败:', error);
        });
    }
}

window.addEventListener('examIndexLoaded', function onExamIndexLoaded() {
    handleExamIndexLoaded();
});

function bootstrapCoreDataInBackground() {
    if (coreBootstrapStarted) {
        return;
    }
    coreBootstrapStarted = true;

    Promise.resolve()
        .then(function () {
            return ensureStateCoreGroup();
        })
        .then(function () {
            if (window.LibraryManager && typeof window.LibraryManager.getInstance === 'function') {
                return window.LibraryManager.getInstance().loadActiveLibrary(false);
            }
            return ensureExamData();
        })
        .then(function (result) {
            syncOverviewAfterIndexLoad();
            return ensureLazyGroup('practice-suite').catch(function (err) {
                console.warn('[MainEntry] practice-suite 加载失败:', err);
            });
        })
        .catch(function onBackgroundBootstrapError(error) {
            console.error('[MainEntry] 后台题库引导失败:', error);
        });
}

function init() {
    setStorageNamespace();
    initializeNavigationShell();

    if (STRICT_ON_DEMAND) {
        setTimeout(function () {
            bootstrapCoreDataInBackground();
        }, 0);
        return;
    }

    bootstrapCoreDataInBackground();
    ensureBrowseGroup().catch(function preloadError(error) {
        console.warn('[MainEntry] 预加载 browse-runtime 失败:', error);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Backward compatibility: expose on window
window.AppEntry = Object.assign({}, window.AppEntry || {}, {
    STRICT_ON_DEMAND: STRICT_ON_DEMAND,
    ensureBrowseGroup: ensureBrowseGroup,
    ensureBrowseRuntime: ensureBrowseGroup,
    ensureStateCoreGroup: ensureStateCoreGroup,
    browseReady: function () { return browseGroupPromise || ensureBrowseGroup(); },
    examDataReady: ensureExamData
});

export { ensureBrowseGroup, ensureStateCoreGroup, ensureExamData };
