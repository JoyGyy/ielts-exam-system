'use strict';

var manifest = Object.create(null);
var scriptStatus = Object.create(null);
var groupStatus = Object.create(null);
var dependencies = Object.create(null);

function registerDefaultManifest() {
    manifest['exam-data'] = [
        'assets/scripts/complete-exam-data.js',
        'assets/scripts/listening-exam-data.js'
    ];

    manifest['state-core'] = [
        'js/shared/examIndex.js',
        'js/core/practiceCore.js',
        'js/core/resourceCore.js',
        'js/app/state-service.js',
        'js/services/libraryManager.js'
    ];

    manifest['practice-suite'] = [
        // 练习记录功能与存储相关，需按用户行为加载
        'js/app/spellingErrorCollector.js',
        'js/utils/markdownExporter.js',
        'js/components/practiceRecordModal.js',
        'js/components/practiceHistoryEnhancer.js',
        'js/core/scoreStorage.js',
        'js/utils/answerSanitizer.js',
        'js/core/practiceRecorder.js'
    ];

    manifest['browse-runtime'] = [
        // 浏览和主逻辑（main.js 保持组内最后加载）
        'js/views/legacyViewBundle.js',
        'js/app/examActions.js',
        // 单篇练习通信与会话能力属于 browse/practice 主流程
        'js/app/readingLaunchMixin.js',
        'js/app/listeningLaunchMixin.js',
        'js/app/examSession/urlBuilder.js',
        'js/app/examSession/windowManager.js',
        'js/app/examSession/dataInjector.js',
        'js/app/examSession/sessionTracker.js',
        'js/app/examSessionMixin.js',
        'js/app/browseController.js',
        'js/presentation/message-center.js',
        'js/components/PDFHandler.js',
        'js/components/SystemDiagnostics.js',
        'js/components/PerformanceOptimizer.js',
        'js/components/BrowseStateManager.js',
        'js/utils/dataConsistencyManager.js',
        'js/utils/answerMatchCore.js',
        'js/utils/answerComparisonUtils.js',
        'js/utils/BrowsePreferencesUtils.js',
        'js/utils/performance.js',
        'js/utils/typeChecker.js',
        'js/utils/codeStandards.js',
        // main.js 子模块（按依赖顺序加载）
        'js/main/viewHelpers.js',
        'js/main/globalShims.js',
        'js/main/practiceView.js',
        'js/main/examListManager.js',
        'js/main.js'
    ];

    manifest['more-tools'] = [
        'js/presentation/moreView.js'
    ];

    dependencies['state-core'] = [];
    dependencies['exam-data'] = [];
    dependencies['practice-suite'] = ['state-core'];
    dependencies['browse-runtime'] = ['state-core'];
    dependencies['more-tools'] = ['state-core'];
}

function normalizeScriptUrl(url) {
    if (!url) {
        return '';
    }
    try {
        return new URL(url, document.baseURI).href;
    } catch (_) {
        return String(url);
    }
}

function findExistingScriptTag(url) {
    if (typeof document === 'undefined') {
        return null;
    }
    var target = normalizeScriptUrl(url);
    if (!target) {
        return null;
    }
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i += 1) {
        var node = scripts[i];
        var srcAttr = node.getAttribute('src');
        if (!srcAttr) {
            continue;
        }
        if (normalizeScriptUrl(srcAttr) === target || normalizeScriptUrl(node.src) === target) {
            return node;
        }
    }
    return null;
}

function loadScript(url) {
    if (!url) {
        return Promise.resolve();
    }
    if (scriptStatus[url] === 'loaded') {
        return Promise.resolve();
    }
    if (scriptStatus[url] && scriptStatus[url].then) {
        return scriptStatus[url];
    }

    var existing = findExistingScriptTag(url);
    if (existing) {
        scriptStatus[url] = 'loaded';
        return Promise.resolve();
    }

    // 含有 ES 模块语法的文件列表（export/import 语句）
    var ES_MODULE_FILES = [
        'js/runtime/lazyLoader.js',
        'js/utils/environmentDetector.js',
        'js/utils/logger.js',
        'js/core/practiceCore.js',
        'js/utils/dom.js',
        'js/app/main-entry.js',
        'js/core/practiceRecorder.js',
        'js/core/scoreStorage.js',
        'js/services/libraryManager.js',
        'js/services/overviewStats.js',
        'js/app/mixins/stateMixin.js',
        'js/app/mixins/bootstrapMixin.js',
        'js/app/mixins/lifecycleMixin.js',
        'js/app/mixins/navigationMixin.js',
        'js/app/mixins/fallbackMixin.js',
        'js/app/app.js',
        'js/shared/normalizePracticeType.js',
        'js/shared/constants.js',
        'js/shared/examIndex.js',
        'js/app/examSessionMixin.js',
        'js/app/examSession/windowManager.js',
        'js/app/examSession/dataInjector.js',
        'js/app/examSession/sessionTracker.js',
        'js/app/examSession/urlBuilder.js',
        'js/app/examActions.js',
        'js/app/browseController.js',
        'js/app/state-service.js',
    ];

    scriptStatus[url] = new Promise(function inject(resolve, reject) {
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        // ES 模块文件需要 type="module"
        if (ES_MODULE_FILES.indexOf(url) !== -1) {
            script.type = 'module';
        }
        script.onload = function handleLoad() {
            scriptStatus[url] = 'loaded';
            resolve();
        };
        script.onerror = function handleError(error) {
            scriptStatus[url] = null;
            reject(new Error('加载脚本失败: ' + url + ' => ' + (error?.message || error)));
        };
        document.head.appendChild(script);
    });

    return scriptStatus[url];
}

function loadBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) {
        return Promise.resolve();
    }
    if (batch.length === 1) {
        return loadScript(batch[0]);
    }
    return Promise.all(batch.map(loadScript)).then(function () {
        return undefined;
    });
}

function loadByBatches(batches) {
    return batches.reduce(function chain(promise, batch) {
        return promise.then(function next() {
            return loadBatch(batch);
        });
    }, Promise.resolve());
}

function sequentialLoad(files) {
    return files.reduce(function chain(promise, file) {
        return promise.then(function next() {
            return loadScript(file);
        });
    }, Promise.resolve());
}

function loadGroup(groupName, files) {
    var list = Array.isArray(files) ? files.slice() : [];
    if (!list.length) {
        return Promise.resolve();
    }

    // 尝试加载 bundle（单个请求替代多个文件）
    var bundleUrl = 'assets/bundles/' + groupName + '.bundle.js';
    var bundleKey = 'bundle:' + groupName;
    if (scriptStatus[bundleKey] === 'loaded') {
        return Promise.resolve();
    }
    if (scriptStatus[bundleKey] && scriptStatus[bundleKey].then) {
        return scriptStatus[bundleKey];
    }

    scriptStatus[bundleKey] = new Promise(function tryBundle(resolve) {
        var script = document.createElement('script');
        script.src = bundleUrl;
        script.async = true;
        script.onload = function () {
            scriptStatus[bundleKey] = 'loaded';
            resolve(true);
        };
        script.onerror = function () {
            // bundle 不存在，回退到逐文件加载
            scriptStatus[bundleKey] = null;
            resolve(false);
        };
        document.head.appendChild(script);
    }).then(function (bundleLoaded) {
        if (bundleLoaded) {
            return;
        }
        // 回退：逐文件加载
        if (groupName === 'browse-runtime') {
            var mainIndex = list.indexOf('js/main.js');
            var mainSubModules = [
                'js/main/viewHelpers.js',
                'js/main/globalShims.js',
                'js/main/practiceView.js',
                'js/main/examListManager.js'
            ];
            var withoutMain = mainIndex >= 0
                ? list.filter(function (file) {
                    return file !== 'js/main.js' && mainSubModules.indexOf(file) === -1;
                })
                : list.slice();

            var batches = [
                ['js/views/legacyViewBundle.js'],
                ['js/app/examActions.js'],
                ['js/app/browseController.js'],
                ['js/presentation/message-center.js'],
                withoutMain.filter(function (file) {
                    return [
                        'js/views/legacyViewBundle.js',
                        'js/app/examActions.js',
                        'js/app/browseController.js',
                        'js/presentation/message-center.js',
                        'js/main.js'
                    ].indexOf(file) === -1;
                })
            ];
            // main.js 子模块（在 main.js 之前加载）
            batches.push(mainSubModules.filter(function (file) {
                return list.indexOf(file) !== -1;
            }));
            if (mainIndex >= 0) {
                batches.push(['js/main.js']);
            }
            return loadByBatches(batches);
        }

        return sequentialLoad(list);
    });

    return scriptStatus[bundleKey];
}

function mirrorAliasStatus() {
    // No-op: browse-view alias has been removed
}

function refreshAppPrototypeIfNeeded(groupName) {
    var files = manifest[groupName] || [];
    var containsMixin = files.some(function (file) {
        return typeof file === 'string' && /Mixin\.js$/.test(file);
    });
    if (!containsMixin) {
        return;
    }
    try {
        if (window.ExamSystemAppMixins && typeof window.ExamSystemAppMixins.__applyToApp === 'function') {
            window.ExamSystemAppMixins.__applyToApp();
        }
    } catch (error) {
        console.warn('[LazyLoader] 重新挂载 mixins 失败:', groupName, error);
    }
}

function ensureGroup(groupName) {
    if (!groupName || !manifest[groupName]) {
        return Promise.resolve();
    }

    if (groupStatus[groupName] === 'loaded') {
        return Promise.resolve();
    }
    if (groupStatus[groupName] && groupStatus[groupName].then) {
        return groupStatus[groupName];
    }

    var required = dependencies[groupName] || [];
    groupStatus[groupName] = Promise.all(required.map(ensureGroup))
        .then(function () {
            return loadGroup(groupName, manifest[groupName]);
        })
        .then(function onGroupLoaded() {
            refreshAppPrototypeIfNeeded(groupName);
            groupStatus[groupName] = 'loaded';
            mirrorAliasStatus(groupName, 'loaded');
        }).catch(function onGroupFailed(error) {
            console.error('[LazyLoader] 组加载失败:', groupName, error);
            groupStatus[groupName] = null;
            mirrorAliasStatus(groupName, null);
            throw error;
        });
    mirrorAliasStatus(groupName, groupStatus[groupName]);

    return groupStatus[groupName];
}

function registerGroup(name, files) {
    if (!name || !Array.isArray(files)) {
        return;
    }
    manifest[name] = files.slice();
}

function getStatus(name) {
    if (!name) {
        return { manifest: Object.keys(manifest) };
    }
    return {
        loaded: groupStatus[name] === 'loaded',
        files: manifest[name] ? manifest[name].slice() : []
    };
}

registerDefaultManifest();

// Backward compatibility: expose on window
window.AppLazyLoader = window.AppLazyLoader || {};
window.AppLazyLoader.ensureGroup = ensureGroup;
window.AppLazyLoader.registerGroup = registerGroup;
window.AppLazyLoader.getStatus = getStatus;

export const AppLazyLoader = window.AppLazyLoader;
