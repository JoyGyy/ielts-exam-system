// globalShims.js - 全局变量声明和兼容层 (Shim)
// 从 main.js 提取：变量声明、window.* 赋值、ensure 函数 shim、基础工具函数

// ============================================================================
// 全局变量声明
// ============================================================================

let practiceListScroller = null;
let app = null;
let pdfHandler = null;
let browseStateManager = null;

function normalizeRecordId(id) {
    if (id == null) {
        return '';
    }
    return String(id);
}

if (typeof window !== 'undefined') {
    window.normalizeRecordId = normalizeRecordId;
}

// examListViewInstance - 迁移到 browseController
Object.defineProperty(window, 'examListViewInstance', {
    get: function () {
        if (window.browseController && typeof window.browseController.getExamListView === 'function') {
            return window.browseController.getExamListView();
        }
        return null;
    },
    set: function (value) {
        if (window.browseController && typeof window.browseController.setExamListView === 'function') {
            window.browseController.setExamListView(value);
        }
    },
    configurable: true
});

let practiceDashboardViewInstance = null;
let legacyNavigationController = null;

// ============================================================================
// Phase 1: Boot/Ensure 函数 Shim 层（实际实现在 main-entry.js）
// ============================================================================

// ensureExamDataScripts - 已在 main-entry.js 实现
if (typeof window.ensureExamDataScripts !== 'function') {
    window.ensureExamDataScripts = function ensureExamDataScripts() {
        console.warn('[main.js shim] ensureExamDataScripts 应由 main-entry.js 提供');
        return Promise.resolve();
    };
}

// ensureBrowseGroup - 已在 main-entry.js 实现
if (typeof window.ensureBrowseGroup !== 'function') {
    window.ensureBrowseGroup = function ensureBrowseGroup() {
        console.warn('[main.js shim] ensureBrowseGroup 应由 main-entry.js 提供');
        return Promise.resolve();
    };
}

// getLibraryManager - 保留在 main.js（依赖 browse-runtime 组加载后的全局对象）
function getLibraryManager() {
    if (window.LibraryManager && typeof window.LibraryManager.getInstance === 'function') {
        return window.LibraryManager.getInstance();
    }
    return null;
}

// ensureLibraryManagerReady - 转发到 getLibraryManager + ensureBrowseGroup
async function ensureLibraryManagerReady() {
    let manager = getLibraryManager();
    if (manager) {
        return manager;
    }
    // 确保 browse-runtime 组加载（LibraryManager 在该组中）
    if (typeof window.ensureBrowseGroup === 'function') {
        await window.ensureBrowseGroup();
    }
    manager = getLibraryManager();
    return manager;
}

// ============================================================================
// Phase 2: 浏览/筛选函数 Shim 层（实际实现在 browseController.js）
// ============================================================================

// setBrowseFilterState
if (typeof window.setBrowseFilterState !== 'function') {
    window.setBrowseFilterState = function (category, type) {
        if (window.browseController && typeof window.browseController.setBrowseFilterState === 'function') {
            window.browseController.setBrowseFilterState(category, type);
        }
    };
}

// getCurrentCategory
if (typeof window.getCurrentCategory !== 'function') {
    window.getCurrentCategory = function () {
        if (window.browseController && typeof window.browseController.getCurrentCategory === 'function') {
            return window.browseController.getCurrentCategory();
        }
        return 'all';
    };
}

// getCurrentExamType
if (typeof window.getCurrentExamType !== 'function') {
    window.getCurrentExamType = function () {
        if (window.browseController && typeof window.browseController.getCurrentExamType === 'function') {
            return window.browseController.getCurrentExamType();
        }
        return 'all';
    };
}

// updateBrowseTitle
if (typeof window.updateBrowseTitle !== 'function') {
    window.updateBrowseTitle = function () {
        if (window.browseController && typeof window.browseController.updateBrowseTitle === 'function') {
            window.browseController.updateBrowseTitle();
        }
    };
}

// clearPendingBrowseAutoScroll
if (typeof window.clearPendingBrowseAutoScroll !== 'function') {
    window.clearPendingBrowseAutoScroll = function () {
        if (window.browseController && typeof window.browseController.clearPendingBrowseAutoScroll === 'function') {
            window.browseController.clearPendingBrowseAutoScroll();
        }
    };
}

// switchLibraryConfig
if (typeof window.switchLibraryConfig !== 'function') {
    window.switchLibraryConfig = function (key) {
        if (window.LibraryManager && typeof window.LibraryManager.switchLibraryConfig === 'function') {
            return window.LibraryManager.switchLibraryConfig(key);
        }
    };
}

// loadLibrary - 始终转发到 LibraryManager 实现，支持字符串 key
window.loadLibrary = function (keyOrForceReload) {
    return loadLibraryInternal(keyOrForceReload);
};


function ensureExamListView() {
    // 通过 browseController getter 访问，避免直接引用已移除的变量
    let instance = null;
    if (window.browseController && typeof window.browseController.getExamListView === 'function') {
        instance = window.browseController.getExamListView();
    }

    if (!instance && window.LegacyExamListView) {
        instance = new window.LegacyExamListView({
            domAdapter: window.DOMAdapter,
            containerId: 'exam-list-container'
        });
        // 保存到 browseController
        if (window.browseController && typeof window.browseController.setExamListView === 'function') {
            window.browseController.setExamListView(instance);
        }
    }
    return instance;
}

function ensurePracticeDashboardView() {
    if (!practiceDashboardViewInstance && window.PracticeDashboardView) {
        practiceDashboardViewInstance = new window.PracticeDashboardView({
            domAdapter: window.DOMAdapter
        });
    }
    return practiceDashboardViewInstance;
}

function ensureLegacyNavigation(options) {
    var mergedOptions = Object.assign({
        containerSelector: '.main-nav',
        activeClass: 'active',
        syncOnNavigate: true,
        onRepeatNavigate: function onRepeatNavigate(viewName) {
            if (viewName === 'browse') {
                resetBrowseViewToAll();
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
    }, options || {});

    if (window.NavigationController && typeof window.NavigationController.ensure === 'function') {
        legacyNavigationController = window.NavigationController.ensure(mergedOptions);
        return legacyNavigationController;
    }

    if (typeof window.ensureLegacyNavigationController === 'function') {
        legacyNavigationController = window.ensureLegacyNavigationController(mergedOptions);
        return legacyNavigationController;
    }

    return null;
}

// --- Library Loader Modal and Index Management ---

async function getActiveLibraryConfigurationKey() {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.getActiveLibraryConfigurationKey === 'function') {
        return await manager.getActiveLibraryConfigurationKey();
    }
    return await storage.get('active_exam_index_key', 'exam_index');
}
async function getLibraryConfigurations() {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.getLibraryConfigurations === 'function') {
        return await manager.getLibraryConfigurations();
    }
    return await storage.get('exam_index_configurations', []);
}
async function saveLibraryConfiguration(name, key, examCount) {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.saveLibraryConfiguration === 'function') {
        return await manager.saveLibraryConfiguration(name, key, examCount);
    }
}
async function setActiveLibraryConfiguration(key) {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.setActiveLibraryConfiguration === 'function') {
        return await manager.setActiveLibraryConfiguration(key);
    }
}
function triggerFolderPicker() { document.getElementById('folder-picker').click(); }
function handleFolderSelection(event) { /* legacy stub - replaced by modal-specific inputs */ }

// --- Helper Functions ---
function getViewName(viewName) {
    switch (viewName) {
        case 'overview': return '总览';
        case 'browse': return '题库浏览';
        case 'practice': return '练习记录';
        case 'settings': return '设置';
        default: return '';
    }
}

function updateSystemInfo() {
    const examIndexSnapshot = getExamIndexState();
    if (!examIndexSnapshot || examIndexSnapshot.length === 0) return;
    const readingExams = examIndexSnapshot.filter(e => e.type === 'reading');
    const listeningExams = examIndexSnapshot.filter(e => e.type === 'listening');

    const totalEl = document.getElementById('total-exams');
    if (totalEl) totalEl.textContent = examIndexSnapshot.length;
    // These IDs might not exist anymore, but we'll add them for robustness
    const htmlExamsEl = document.getElementById('html-exams');
    const pdfExamsEl = document.getElementById('pdf-exams');
    const lastUpdateEl = document.getElementById('last-update');

    if (htmlExamsEl) htmlExamsEl.textContent = readingExams.length + listeningExams.length; // Simplified
    if (pdfExamsEl) pdfExamsEl.textContent = examIndexSnapshot.filter(e => e.pdfFilename).length;
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString();
}

function showMessage(message, type = 'info', duration = 4000) {
    if (typeof window !== 'undefined' && window.getMessageCenter) {
        return window.getMessageCenter().show(message, type, duration);
    }
    if (typeof window !== 'undefined' && window.MessageCenter && typeof window.MessageCenter.getInstance === 'function') {
        return window.MessageCenter.getInstance().show(message, type, duration);
    }
    if (typeof console !== 'undefined') {
        const logMethod = type === 'error' ? 'error' : 'log';
        console[logMethod](`[Message:${type}]`, message);
    }
    return null;
}

if (typeof window !== 'undefined') {
    window.showMessage = showMessage;
}

// Other functions from the original file (simplified or kept as is)

// --- Library Loader Modal and Index Management ---
// ... other utility and management functions can be moved here ...
// --- Functions Restored from Backup ---

// Provide a local implementation to avoid dependency on legacy js/script.js
function openPDFSafely(pdfPath, examTitle = 'PDF') {
    try {
        if (pdfHandler && typeof pdfHandler.openPDF === 'function') {
            return pdfHandler.openPDF(pdfPath, examTitle, { width: 1000, height: 800 });
        }
        let pdfWindow = null;
        try {
            pdfWindow = window.open(pdfPath, `pdf_${Date.now()}`, 'width=1000,height=800,scrollbars=yes,resizable=yes,status=yes,toolbar=yes');
        } catch (_) { }
        if (!pdfWindow) {
            try {
                // 降级：当前窗口打开
                window.location.href = pdfPath;
                return window;
            } catch (e) {
                showMessage('无法打开PDF窗口，请检查弹窗设置', 'error');
                return null;
            }
        }
        showMessage('正在打开PDF...', 'info');
        return pdfWindow;
    } catch (error) {
        console.error('[PDF] 打开失败:', error);
        showMessage('打开PDF失败', 'error');
        return null;
    }
}

function showDeveloperTeam() {
    const modal = document.getElementById('developer-modal');
    if (modal) modal.classList.add('show');
}

function hideDeveloperTeam() {
    const modal = document.getElementById('developer-modal');
    if (modal) modal.classList.remove('show');
}

let libraryConfigViewInstance = null;

function ensureLibraryConfigView() {
    if (libraryConfigViewInstance || typeof window === 'undefined') {
        return libraryConfigViewInstance;
    }
    if (typeof window.LibraryConfigView === 'function') {
        libraryConfigViewInstance = new window.LibraryConfigView();
    }
    return libraryConfigViewInstance;
}

function normalizeLibraryConfigurationRecords(rawConfigs) {
    const configs = Array.isArray(rawConfigs) ? rawConfigs : [];
    const normalized = [];
    const seenKeys = new Set();
    let mutated = false;
    const now = Date.now();

    const normalizeKey = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim();
    };

    for (const config of configs) {
        if (!config) {
            mutated = true;
            continue;
        }

        if (typeof config === 'string') {
            const key = normalizeKey(config);
            if (!key) {
                mutated = true;
                continue;
            }
            if (seenKeys.has(key)) {
                mutated = true;
                continue;
            }
            seenKeys.add(key);
            normalized.push({
                name: key === 'exam_index' ? '默认题库' : key,
                key,
                examCount: 0,
                timestamp: now
            });
            mutated = true;
            continue;
        }

        if (typeof config !== 'object') {
            mutated = true;
            continue;
        }

        const record = Object.assign({}, config);

        let key = normalizeKey(record.key);
        if (!key) {
            const fallbackFields = ['storageKey', 'storage_key', 'id'];
            for (const field of fallbackFields) {
                key = normalizeKey(record[field]);
                if (key) {
                    record.key = key;
                    mutated = true;
                    break;
                }
            }
        }

        if (!key && typeof record.name === 'string') {
            const nameKey = normalizeKey(record.name);
            if (/^exam_index(_\d+)?$/.test(nameKey)) {
                key = nameKey;
                record.key = key;
                mutated = true;
            }
        }

        if (!key) {
            mutated = true;
            continue;
        }

        if (seenKeys.has(key)) {
            const existingIndex = normalized.findIndex(item => item.key === key);
            if (existingIndex !== -1) {
                const existing = normalized[existingIndex];
                const merged = Object.assign({}, existing);
                if ((!existing.name || existing.name === existing.key) && typeof record.name === 'string' && record.name.trim()) {
                    merged.name = record.name.trim();
                }
                if (!Number.isFinite(existing.examCount) || existing.examCount === 0) {
                    const fallbackCount = Number(record.examCount);
                    if (Number.isFinite(fallbackCount) && fallbackCount >= 0) {
                        merged.examCount = fallbackCount;
                    } else if (Array.isArray(record.exams)) {
                        merged.examCount = record.exams.length;
                    }
                }
                const mergedTimestamp = Number(record.timestamp || record.updatedAt || record.createdAt);
                if (Number.isFinite(mergedTimestamp) && mergedTimestamp > 0 && (!Number.isFinite(existing.timestamp) || mergedTimestamp > existing.timestamp)) {
                    merged.timestamp = mergedTimestamp;
                }
                normalized[existingIndex] = merged;
            }
            mutated = true;
            continue;
        }

        seenKeys.add(key);

        if (typeof record.name !== 'string' || !record.name.trim()) {
            record.name = key === 'exam_index' ? '默认题库' : key;
            mutated = true;
        } else {
            record.name = record.name.trim();
        }

        const count = Number(record.examCount);
        if (!Number.isFinite(count) || count < 0) {
            if (Array.isArray(record.exams)) {
                record.examCount = record.exams.length;
            } else if (Number.isFinite(Number(record.count)) && Number(record.count) >= 0) {
                record.examCount = Number(record.count);
            } else {
                record.examCount = 0;
            }
            mutated = true;
        } else {
            record.examCount = count;
        }

        const ts = Number(record.timestamp || record.updatedAt || record.createdAt);
        if (!Number.isFinite(ts) || ts <= 0) {
            record.timestamp = now;
            mutated = true;
        } else {
            record.timestamp = ts;
        }

        normalized.push(record);
    }

    return { normalized, mutated };
}

async function resolveLibraryConfigurations() {
    const rawConfigs = await getLibraryConfigurations();
    let configs = Array.isArray(rawConfigs) ? rawConfigs : [];
    let mutated = false;

    const normalizedResult = normalizeLibraryConfigurationRecords(configs);
    configs = normalizedResult.normalized;
    mutated = normalizedResult.mutated;

    if (configs.length === 0) {
        try {
            const count = getExamIndexState().length;
            configs = [{
                name: '默认题库',
                key: 'exam_index',
                examCount: count,
                timestamp: Date.now()
            }];
            mutated = true;
            const activeKey = await storage.get('active_exam_index_key');
            if (!activeKey) {
                await storage.set('active_exam_index_key', 'exam_index');
            }
        } catch (error) {
            console.warn('[LibraryConfig] 无法初始化默认题库配置', error);
        }
    }

    if (mutated) {
        try {
            await storage.set('exam_index_configurations', configs);
        } catch (error) {
            console.warn('[LibraryConfig] 无法同步题库配置记录', error);
        }
    }

    return configs;
}

async function fetchLibraryDataset(key) {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.fetchLibraryDataset === 'function') {
        return await manager.fetchLibraryDataset(key);
    }
    return [];
}

async function updateLibraryConfigurationMetadata(key, examCount) {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.updateLibraryConfigurationMetadata === 'function') {
        return await manager.updateLibraryConfigurationMetadata(key, examCount);
    }
}

function resetBrowseStateAfterLibrarySwitch() {
    try {
        if (window.browseStateManager && typeof window.browseStateManager.resetToAllExams === 'function') {
            window.browseStateManager.resetToAllExams();
            return;
        }
    } catch (error) {
        console.warn('[LibraryConfig] 重置 BrowseStateManager 失败:', error);
    }
    setBrowseFilterState('all', 'all');
    setFilteredExamsState([]);
}

async function applyLibraryConfiguration(key, dataset, options = {}) {
    const manager = await ensureLibraryManagerReady();
    if (manager && typeof manager.applyLibraryConfiguration === 'function') {
        return await manager.applyLibraryConfiguration(key, dataset, options);
    }
    return false;
}

async function debugCompareActiveIndexWithDefault() {
    try {
        const activeKey = await getActiveLibraryConfigurationKey();
        const activeIndex = Array.isArray(getExamIndexState()) ? getExamIndexState() : [];
        const defaultIndex = Array.isArray(window.completeExamIndex)
            ? window.completeExamIndex.map((exam) => Object.assign({}, exam, { type: 'reading' }))
            : [];
        const defaultListening = Array.isArray(window.listeningExamIndex) ? window.listeningExamIndex : [];
        const storedDefault = await storage.get('exam_index', []);
        const combinedDefault = storedDefault.length ? storedDefault : [...defaultIndex, ...defaultListening];

        const normalizeTail = (path) => {
            const p = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
            if (p.length === 0) return '';
            if (p.length === 1) return p[0].toLowerCase();
            return (p[p.length - 2] + '/' + p[p.length - 1]).toLowerCase();
        };
        const makeKey = (exam) => {
            const title = (exam.title || '').toLowerCase();
            const tail = normalizeTail(exam.path || exam.resourcePath || exam.basePath);
            const file = (exam.filename || exam.pdfFilename || '').toLowerCase();
            return [title, tail, file].join('|');
        };

        const defaultMap = new Map();
        combinedDefault.forEach((exam) => {
            defaultMap.set(makeKey(exam), exam);
        });

        let hit = 0;
        let miss = 0;
        const misses = [];
        activeIndex.forEach((exam) => {
            const key = makeKey(exam);
            if (defaultMap.has(key)) {
                hit += 1;
            } else {
                miss += 1;
                misses.push({ title: exam.title, path: exam.path, file: exam.filename || exam.pdfFilename });
            }
        });

        console.log('[LibraryDebug] Active key:', activeKey, '命中/总', hit, '/', activeIndex.length, '未命中示例前5:', misses.slice(0, 5));
        return { activeKey, hit, miss, sampleMisses: misses.slice(0, 10) };
    } catch (error) {
        console.warn('[LibraryDebug] 比对索引失败:', error);
        return null;
    }
}

function renderLibraryConfigFallback(container, configs, options) {
    const hostClass = 'library-config-list';
    let host = container.querySelector('.' + hostClass);
    if (!host) {
        host = document.createElement('div');
        host.className = hostClass;
        container.appendChild(host);
    }

    while (host.firstChild) {
        host.removeChild(host.firstChild);
    }

    const panel = document.createElement('div');
    panel.className = 'library-config-panel';

    const header = document.createElement('div');
    header.className = 'library-config-panel__header';
    const title = document.createElement('h3');
    title.className = 'library-config-panel__title';
    title.textContent = '📚 题库配置列表';
    header.appendChild(title);
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'library-config-panel__list';
    const activeKey = options && options.activeKey;

    configs.forEach((config) => {
        if (!config) {
            return;
        }
        const isActive = activeKey === config.key;
        const isDefault = config.key === 'exam_index';

        const item = document.createElement('div');
        item.className = 'library-config-panel__item' + (activeKey === config.key ? ' library-config-panel__item--active' : '');

        const info = document.createElement('div');
        info.className = 'library-config-panel__info';

        const titleLine = document.createElement('div');
        titleLine.textContent = config.name || config.key || '未命名题库';
        info.appendChild(titleLine);

        const meta = document.createElement('div');
        meta.className = 'library-config-panel__meta';
        try {
            meta.textContent = new Date(config.timestamp).toLocaleString() + ' · ' + (config.examCount || 0) + ' 个题目';
        } catch (_) {
            meta.textContent = (config.examCount || 0) + ' 个题目';
        }
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'library-config-panel__actions';

        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'btn btn-secondary';
        switchBtn.dataset.configAction = 'switch';
        switchBtn.dataset.configKey = config.key;
        if (isActive) {
            switchBtn.dataset.configActive = '1';
        }
        switchBtn.textContent = '切换';
        actions.appendChild(switchBtn);

        if (!isDefault) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-warning';
            deleteBtn.dataset.configAction = 'delete';
            deleteBtn.dataset.configKey = config.key;
            if (isActive) {
                deleteBtn.dataset.configActive = '1';
            }
            deleteBtn.textContent = '删除';
            actions.appendChild(deleteBtn);

            if (typeof deleteBtn.addEventListener === 'function') {
                deleteBtn.addEventListener('click', (event) => {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }
                    if (event && typeof event.stopPropagation === 'function') {
                        event.stopPropagation();
                    }
                    if (typeof deleteLibraryConfig === 'function') {
                        deleteLibraryConfig(config.key);
                    }
                });
            }
        }

        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);

        if (typeof switchBtn.addEventListener === 'function') {
            switchBtn.addEventListener('click', (event) => {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }
                if (event && typeof event.stopPropagation === 'function') {
                    event.stopPropagation();
                }
                if (typeof switchLibraryConfig === 'function') {
                    switchLibraryConfig(config.key);
                }
            });
        }
    });

    if (!list.childElementCount) {
        const empty = document.createElement('div');
        empty.className = 'library-config-panel__empty';
        empty.textContent = options && options.emptyMessage ? options.emptyMessage : '暂无题库配置记录';
        panel.appendChild(empty);
    } else {
        panel.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'library-config-panel__footer';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-secondary library-config-panel__close';
    close.dataset.configAction = 'close';
    close.textContent = '关闭';
    footer.appendChild(close);
    panel.appendChild(footer);

    host.appendChild(panel);

    const findActionTarget = (node) => {
        let current = node;
        while (current && current !== host) {
            if (current.dataset && current.dataset.configAction) {
                return current;
            }
            current = current.parentNode || (current.host && current.host instanceof Node ? current.host : null);
        }
        return null;
    };

    const handler = (event) => {
        const target = findActionTarget(event.target);
        if (!target) {
            return;
        }
        const action = target.dataset.configAction;
        if (action === 'close') {
            host.remove();
            return;
        }
        if (action === 'switch' && typeof switchLibraryConfig === 'function') {
            switchLibraryConfig(target.dataset.configKey);
        }
        if (action === 'delete' && typeof deleteLibraryConfig === 'function') {
            deleteLibraryConfig(target.dataset.configKey);
        }
    };

    host.onclick = handler;
    return host;
}

async function renderLibraryConfigList(options = {}) {
    const containerId = options.containerId || 'settings-view';
    const container = document.getElementById(containerId);
    if (!container) {
        return null;
    }

    let configs = Array.isArray(options.configs) ? options.configs : await resolveLibraryConfigurations();
    if (!configs.length) {
        if (options.silentEmpty) {
            const existingHost = container.querySelector('.library-config-list');
            if (existingHost) {
                existingHost.remove();
            }
        } else if (typeof showMessage === 'function') {
            showMessage('暂无题库配置记录', 'info');
        }
        return null;
    }

    const activeKey = options.activeKey || await getActiveLibraryConfigurationKey();
    const view = ensureLibraryConfigView();
    if (view) {
        return view.mount(container, configs, {
            activeKey,
            allowDelete: options.allowDelete !== false,
            emptyMessage: options.emptyMessage,
            handlers: Object.assign({
                switch: (configKey) => switchLibraryConfig(configKey),
                delete: (configKey) => deleteLibraryConfig(configKey)
            }, options.handlers || {})
        });
    }

    return renderLibraryConfigFallback(container, configs, { activeKey, emptyMessage: options.emptyMessage });
}

async function showLibraryConfigList(options) {
    return renderLibraryConfigList(Object.assign({ allowDelete: true }, options || {}));
}

async function showLibraryConfigListV2(options) {
    return renderLibraryConfigList(Object.assign({ allowDelete: true }, options || {}));
}

// 切换题库配置
async function switchLibraryConfigImpl(configKey) {
    const key = typeof configKey === 'string' ? configKey.trim() : '';
    if (!key) {
        return;
    }
    try {
        const activeKey = await getActiveLibraryConfigurationKey();
        if (activeKey === key) {
            showMessage('当前题库已激活', 'info');
            return;
        }
    } catch (error) {
        console.warn('[LibraryConfig] 无法读取当前题库配置', error);
    }
    const dataset = await fetchLibraryDataset(key);
    if (!Array.isArray(dataset) || dataset.length === 0) {
        showMessage('目标题库没有题目，请先加载该题库数据', 'warning');
        return;
    }
    showMessage('正在切换题库配置...', 'info');
    const applied = await applyLibraryConfiguration(key, dataset, { skipConfigRefresh: false });
    if (applied) {
        showMessage('题库配置已切换', 'success');
    }
}

// 删除题库配置
async function deleteLibraryConfigImpl(configKey) {
    const key = typeof configKey === 'string' ? configKey.trim() : '';
    if (!key) {
        return;
    }
    if (key === 'exam_index') {
        showMessage('默认题库不可删除', 'warning');
        return;
    }
    try {
        const activeKey = await getActiveLibraryConfigurationKey();
        if (activeKey === key) {
            showMessage('当前正在使用此题库，请先切换到其他配置', 'warning');
            return;
        }
    } catch (error) {
        console.warn('[LibraryConfig] 无法读取当前题库配置', error);
    }
    if (confirm('确定要删除这个题库配置吗？此操作不可恢复。')) {
        let configs = await getLibraryConfigurations();
        configs = Array.isArray(configs)
            ? configs.filter((config) => {
                if (!config) {
                    return false;
                }
                if (typeof config === 'string') {
                    return config.trim() !== key;
                }
                const cfgKey = typeof config.key === 'string' ? config.key.trim() : '';
                return cfgKey && cfgKey !== key;
            })
            : [];
        await storage.set('exam_index_configurations', configs);
        try {
            await storage.remove(key);
        } catch (error) {
            console.warn('[LibraryConfig] 删除题库数据失败', error);
        }

        showMessage('题库配置已删除', 'success');
        await renderLibraryConfigList({ silentEmpty: true });
    }
}

if (typeof window !== 'undefined') {
    window.switchLibraryConfig = switchLibraryConfigImpl;
    window.deleteLibraryConfig = deleteLibraryConfigImpl;
}

// --- Initialization ---
async function initializeLegacyComponents() {
    try { showMessage('系统准备就绪', 'success'); } catch (_) { }

    try {
        ensureLegacyNavigation({ initialView: 'overview' });
    } catch (error) {
        console.warn('[Navigation] 初始化导航控制器失败:', error);
    }

    setupBrowsePreferenceUI();

    // Setup UI Listeners
    const folderPicker = document.getElementById('folder-picker');
    if (folderPicker) {
        folderPicker.addEventListener('change', handleFolderSelection);
    }

    // Initialize components
    if (window.PDFHandler) {
        pdfHandler = new PDFHandler();
        console.log('[System] PDF处理器已初始化');
    }
    if (window.BrowseStateManager) {
        browseStateManager = new BrowseStateManager();
        console.log('[System] 浏览状态管理器已初始化');
    }
    // 初始化性能优化器 - 关键性能修复
    if (window.PerformanceOptimizer) {
        window.performanceOptimizer = new PerformanceOptimizer();
        console.log('[System] 性能优化器已初始化');
    } else {
        console.warn('[System] PerformanceOptimizer类未加载');
    }

    // Clean up old cache and configurations for v1.1.0 upgrade (one-time only)
    let needsCleanup = false;
    try {
        needsCleanup = !localStorage.getItem('upgrade_v1_1_0_cleanup_done');
    } catch (error) {
        console.warn('[System] 检查升级标记失败，将继续执行清理流程', error);
        needsCleanup = true;
    }

    if (needsCleanup) {
        console.log('[System] 首次运行，执行升级清理...');
        try {
            await cleanupOldCache();
        } finally {
            try { localStorage.setItem('upgrade_v1_1_0_cleanup_done', '1'); } catch (_) { }
        }
    } else {
        console.log('[System] 升级清理已完成，跳过重复清理');
    }

    // Load data and setup listeners
    await loadLibraryInternal();
    startPracticeRecordsSyncInBackground('boot'); // 后台静默加载练习记录，避免阻塞首页
    setupMessageListener(); // Listen for updates from child windows
    setupStorageSyncListener(); // Listen for storage changes from other tabs
}

// Clean up old cache and configurations
async function cleanupOldCache() {
    try {
        console.log('[System] 正在清理旧缓存与配置...');
        await storage.remove('exam_index');
        await storage.remove('active_exam_index_key');
        await storage.set('exam_index_configurations', []);
        console.log('[System] 旧缓存清理完成');
    } catch (error) {
        console.warn('[System] 清理旧缓存时出错:', error);
    }
}

// --- Data Loading and Management ---

// Phase 3: 练习记录同步 - 保留在 main.js（核心数据流，暂不迁移）
