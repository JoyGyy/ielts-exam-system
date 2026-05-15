// examListManager.js - 题库列表管理
// 从 main.js 提取 loadExamList, renderExamList, searchExamList, displayExams 等

function loadExamList() {
    if (window.ExamActions && typeof window.ExamActions.loadExamList === 'function') {
        return window.ExamActions.loadExamList();
    }
    console.warn('[main.js] ExamActions.loadExamList 未就绪，尝试加载 browse-runtime 组');
    if (window.AppLazyLoader && typeof window.AppLazyLoader.ensureGroup === 'function') {
        window.AppLazyLoader.ensureGroup('browse-runtime').then(function () {
            if (window.ExamActions && typeof window.ExamActions.loadExamList === 'function') {
                window.ExamActions.loadExamList();
            } else {
                // 最终降级：直接 DOM 渲染
                loadExamListFallback();
            }
        }).catch(function (err) {
            console.error('[main.js] browse-runtime 组加载失败:', err);
            loadExamListFallback();
        });
    } else {
        // 无懒加载器，直接降级
        loadExamListFallback();
    }
}

function loadExamListFallback() {
    console.warn('[main.js] 使用降级渲染逻辑');
    try {
        let examIndex = typeof getExamIndexState === 'function' ? getExamIndexState() : (Array.isArray(window.examIndex) ? window.examIndex : []);
        const container = document.getElementById('exam-list-container');
        if (!container) return;

        // 清除 loading 指示器
        const loadingEl = document.querySelector('#browse-view .loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

        container.innerHTML = '<div class="exam-list-empty"><p>题库加载中...</p></div>';

        if (examIndex.length === 0) {
            container.innerHTML = '<div class="exam-list-empty"><p>暂无题目</p></div>';
            return;
        }

        // 应用当前筛选状态（修复 P2 bug）
        const currentCategory = typeof getCurrentCategory === 'function' ? getCurrentCategory() : 'all';
        const currentType = typeof getCurrentExamType === 'function' ? getCurrentExamType() : 'all';
        const isFrequencyMode = window.__browseFilterMode && window.__browseFilterMode !== 'default';
        const basePathFilter = isFrequencyMode && typeof window.__browsePath === 'string' && window.__browsePath.trim()
            ? window.__browsePath.trim()
            : null;

        let filtered = Array.from(examIndex);
        if (currentType !== 'all') {
            filtered = filtered.filter(function (exam) { return exam.type === currentType; });
        }
        if (currentCategory !== 'all') {
            filtered = filtered.filter(function (exam) { return exam.category === currentCategory; });
        }
        if (basePathFilter) {
            filtered = filtered.filter(function (exam) {
                return typeof exam?.path === 'string' && exam.path.includes(basePathFilter);
            });
        }

        if (window.ExamActions && typeof window.ExamActions.applyBrowsePostFilters === 'function') {
            filtered = window.ExamActions.applyBrowsePostFilters(filtered);
        } else {
            if (window.ExamActions && typeof window.ExamActions.deduplicateExams === 'function') {
                filtered = window.ExamActions.deduplicateExams(filtered);
            }
            if (window.ExamActions && typeof window.ExamActions.applyExamSort === 'function') {
                filtered = window.ExamActions.applyExamSort(filtered);
            }
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="exam-list-empty"><p>未找到匹配的题目</p></div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'exam-list';
        filtered.forEach(function (exam) {
            if (!exam) return;
            const item = document.createElement('div');
            item.className = 'exam-item';
            item.innerHTML = '<div class="exam-info"><h4>' + (exam.title || '') + '</h4></div>' +
                '<div class="exam-actions">' +
                '<button class="btn" onclick="window.openExam(\'' + (exam.id || '') + '\')">开始练习</button>' +
                '<button class="btn btn-outline" onclick="window.startMockExam(\'' + (exam.id || '') + '\')">模考</button>' +
                '<button class="btn btn-outline" onclick="window.viewPDF(\'' + (exam.id || '') + '\')">PDF</button>' +
                '</div>';
            list.appendChild(item);
        });
        container.innerHTML = '';
        container.appendChild(list);
    } catch (err) {
        console.error('[main.js] 降级渲染失败:', err);
    }
}

function resetBrowseViewToAll() {
    if (window.ExamActions && typeof window.ExamActions.resetBrowseViewToAll === 'function') {
        return window.ExamActions.resetBrowseViewToAll();
    }
    console.warn('[main.js] ExamActions.resetBrowseViewToAll 未就绪');

    // 清除频率模式状态，确保回到默认列表
    window.__browseFilterMode = 'default';
    window.__browsePath = null;

    if (window.AppLazyLoader && typeof window.AppLazyLoader.ensureGroup === 'function') {
        window.AppLazyLoader.ensureGroup('browse-runtime').then(function () {
            if (window.ExamActions && typeof window.ExamActions.resetBrowseViewToAll === 'function') {
                window.ExamActions.resetBrowseViewToAll();
            } else {
                // 降级：重置状态并重新加载
                if (typeof setBrowseFilterState === 'function') setBrowseFilterState('all', 'all');
                loadExamList();
            }
        }).catch(function () {
            if (typeof setBrowseFilterState === 'function') setBrowseFilterState('all', 'all');
            loadExamList();
        });
    } else {
        if (typeof setBrowseFilterState === 'function') setBrowseFilterState('all', 'all');
        loadExamList();
    }
}

function displayExams(exams) {
    if (window.ExamActions && typeof window.ExamActions.displayExams === 'function') {
        return window.ExamActions.displayExams(exams);
    }
    console.warn('[main.js] ExamActions.displayExams 未就绪，使用降级渲染');

    // 立即降级渲染（displayExams 需要同步执行）
    try {
        const container = document.getElementById('exam-list-container');
        if (!container) return;

        // 清除 loading 指示器（修复 P2 bug）
        const loadingEl = document.querySelector('#browse-view .loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

        const normalizedExams = Array.isArray(exams) ? exams : [];
        if (normalizedExams.length === 0) {
            container.innerHTML = '<div class="exam-list-empty"><p>未找到匹配的题目</p></div>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'exam-list';
        normalizedExams.forEach(function (exam) {
            if (!exam) return;
            const item = document.createElement('div');
            item.className = 'exam-item';
            const metaText = typeof window.formatExamMetaText === 'function'
                ? window.formatExamMetaText(exam)
                : [exam.category || '', exam.type || '', Number.isFinite(Number(exam.difficultyScore)) ? '难度 ' + Number(exam.difficultyScore) : '']
                    .filter(Boolean)
                    .join(' | ');
            item.innerHTML = '<div class="exam-info"><h4>' + (exam.title || '') + '</h4>' +
                '<div class="exam-meta">' + metaText + '</div></div>' +
                '<div class="exam-actions">' +
                '<button class="btn" onclick="window.openExam(\'' + (exam.id || '') + '\')">开始练习</button>' +
                '<button class="btn btn-outline" onclick="window.startMockExam(\'' + (exam.id || '') + '\')">模考</button>' +
                '<button class="btn btn-outline" onclick="window.viewPDF(\'' + (exam.id || '') + '\')">PDF</button>' +
                '</div>';
            list.appendChild(item);
        });
        container.innerHTML = '';
        container.appendChild(list);
    } catch (err) {
        console.error('[main.js] displayExams 降级渲染失败:', err);
    }
}

function getResourceCore() {
    return window.ResourceCore || null;
}

window.resolveExamBasePath = function (exam) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.resolveExamBasePath === 'function') {
        return resourceCore.resolveExamBasePath(exam);
    }
    return '';
};

window.buildResourcePath = function (exam, kind) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.buildResourcePath === 'function') {
        return resourceCore.buildResourcePath(exam, kind);
    }
    return '';
};

window.derivePathMapFromIndex = function (exams, fallbackMap) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.derivePathMapFromIndex === 'function') {
        return resourceCore.derivePathMapFromIndex(exams, fallbackMap);
    }
    return fallbackMap || null;
};

window.loadPathMapForConfiguration = async function (key) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.loadPathMapForConfiguration === 'function') {
        return resourceCore.loadPathMapForConfiguration(key);
    }
    return null;
};

window.savePathMapForConfiguration = async function (key, examIndex, options) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.savePathMapForConfiguration === 'function') {
        return resourceCore.savePathMapForConfiguration(key, examIndex, options || {});
    }
    return null;
};

window.getPathMap = function () {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.getPathMap === 'function') {
        return resourceCore.getPathMap();
    }
    return null;
};

window.setActivePathMap = function (map) {
    const resourceCore = getResourceCore();
    if (resourceCore && typeof resourceCore.setActivePathMap === 'function') {
        return resourceCore.setActivePathMap(map);
    }
    return map || null;
};

function openExam(examId, options = {}) {
    // 优先使用App流程（带会话与通信）
    if (window.app && typeof window.app.openExam === 'function') {
        try {
            window.app.openExam(examId, options || {});
            return;
        } catch (e) {
            console.warn('[Main] app.openExam 调用失败，启用降级握手路径:', e);
        }
    }

    // 降级：本地完成打开 + 握手重试，确保 sessionId 下发
    const exam = window.getExamById ? window.getExamById(examId) : getExamIndexState().find(e => e.id === examId);
    if (!exam) return showMessage('未找到题目', 'error');
    if (!exam.hasHtml) return viewPDF(examId);

    // 听力题使用统一页面
    if (exam.type === 'listening' || examId.startsWith('listening-')) {
        const manifest = window.__LISTENING_EXAM_MANIFEST__;
        const entry = manifest && manifest[examId];
        if (entry) {
            const url = `assets/generated/listening-exams/unifiedListeningPage.html?examId=${encodeURIComponent(examId)}&dataKey=${encodeURIComponent(entry.dataKey || examId)}`;
            const w = window.open(url, `exam_${examId}`, 'width=1200,height=800,scrollbars=yes,resizable=yes');
            if (!w) return showMessage('无法打开窗口，请检查弹窗设置', 'error');
            showMessage('正在打开: ' + exam.title, 'success');
            return;
        }
    }

    const fullPath = window.buildResourcePath(exam, 'html');
    const examWindow = window.open(fullPath, `exam_${exam.id}`, 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (!examWindow) {
        return showMessage('无法打开窗口，请检查弹窗设置', 'error');
    }
    showMessage('正在打开: ' + exam.title, 'success');

    startHandshakeFallback(examWindow, examId);
}

// 降级握手：循环发送 INIT_SESSION，直至收到 SESSION_READY
function startHandshakeFallback(examWindow, examId) {
    try {
        const sessionId = `${examId}_${Date.now()}`;
        const initPayload = { examId, parentOrigin: window.location.origin, sessionId };
        fallbackExamSessions.set(sessionId, { examId, timer: null, win: examWindow });

        let attempts = 0;
        const maxAttempts = 30; // ~9s
        const tick = () => {
            if (examWindow && !examWindow.closed) {
                try {
                    if (attempts === 0) {
                        console.log('[Fallback] 发送初始化消息到练习页面:', { type: 'INIT_SESSION', data: initPayload });
                    }
                    examWindow.postMessage({ type: 'INIT_SESSION', data: initPayload }, '*');
                    examWindow.postMessage({ type: 'init_exam_session', data: initPayload }, '*');
                } catch (_) { }
            }
            attempts++;
            if (attempts >= maxAttempts) {
                const rec = fallbackExamSessions.get(sessionId);
                if (rec && rec.timer) clearInterval(rec.timer);
                fallbackExamSessions.delete(sessionId);
                console.warn('[Fallback] 握手超时，练习页可能未加载增强器');
            }
        };
        const timer = setInterval(tick, 300);
        const rec = fallbackExamSessions.get(sessionId);
        if (rec) rec.timer = timer;
        tick();
    } catch (e) {
        console.warn('[Fallback] 启动握手失败:', e);
    }
}

function viewPDF(examId) {
    // 增加数组化防御
    const exam = window.getExamById ? window.getExamById(examId) : getExamIndexState().find(e => e.id === examId);
    if (!exam || !exam.pdfFilename) return showMessage('未找到PDF文件', 'error');

    const fullPath = window.buildResourcePath(exam, 'pdf');
    openPDFSafely(fullPath, exam.title);
}

// Bridge for record details to existing enhancer/modal if present
function showRecordDetails(recordId) {
    if (window.practiceHistoryEnhancer && typeof window.practiceHistoryEnhancer.showRecordDetails === 'function') {
        window.practiceHistoryEnhancer.showRecordDetails(recordId);
        return;
    }
    if (window.practiceRecordModal && typeof window.practiceRecordModal.showById === 'function') {
        window.practiceRecordModal.showById(recordId);
        return;
    }
    alert('无法显示记录详情：组件未加载');
}

// 全局桥接：HTML 按钮 onclick="browseCategory('P1','reading')"
if (typeof window.browseCategory !== 'function') {
    window.browseCategory = function (category, type, filterMode, path) {
        try {
            if (window.app && typeof window.app.browseCategory === 'function') {
                window.app.browseCategory(category, type, filterMode, path);
                return;
            }
        } catch (_) { }
        // 回退：直接应用筛选（保持 filterMode/path 兼容）
        try {
            applyBrowseFilter(category, type, filterMode, path);
        } catch (_) { }
    };
}

function filterRecordsByType(type) {
    setBrowseFilterState(getCurrentCategory(), type);

    // 更新练习历史筛选按钮的 active 状态
    var container = document.getElementById('record-type-filter-buttons');
    if (container) {
        var buttons = container.querySelectorAll('.shui-segmented-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.dataset.filterType === type) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        }
    }

    // 触发滑块指示器同步
    if (typeof window.updateSegmentedIndicators === 'function') {
        setTimeout(window.updateSegmentedIndicators, 10);
    }

    updatePracticeView();
}


// --- Event Handlers & Navigation ---


function browseCategory(category, type = 'reading', filterMode = null, path = null) {

    requestBrowseAutoScroll(category, type);
    // 先设置筛选器，确保 App 路径也能获取到筛选参数
    try {
        setBrowseFilterState(category, type);

        // 设置待处理筛选器，确保组件未初始化时筛选不会丢失
        // 新增：包含 filterMode 和 path 参数
        try {
            window.__pendingBrowseFilter = { category, type, filterMode, path };
        } catch (_) {
            // 如果全局变量设置失败，继续执行
        }
    } catch (error) {
        console.warn('[browseCategory] 设置筛选器失败:', error);
    }

    // 优先调用 window.app.browseCategory(category, type, filterMode, path)
    if (window.app && typeof window.app.browseCategory === 'function') {
        try {
            window.app.browseCategory(category, type, filterMode, path);
            console.log('[browseCategory] Called app.browseCategory with filterMode:', filterMode);
            // 常规模式仍需刷新题库；频率模式由 browseController 接管
            if (!filterMode) {
                setTimeout(() => loadExamList(), 100);
            }
            return;
        } catch (error) {
            console.warn('[browseCategory] window.app.browseCategory 调用失败，使用降级路径:', error);
        }
    }

    // 降级路径：手动处理浏览筛选
    try {
        // 正确更新标题使用中文字符串
        setBrowseTitle(formatBrowseTitle(category, type));

        // 导航到浏览视图
        if (window.app && typeof window.app.navigateToView === 'function') {
            window.app.navigateToView('browse');
        } else if (typeof window.showView === 'function') {
            showView('browse', false);
        } else {
            try {
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                const target = document.getElementById('browse-view');
                if (target) target.classList.add('active');
            } catch (_) { }
        }

        // 尽量沿用统一筛选逻辑
        if (typeof applyBrowseFilter === 'function') {
            applyBrowseFilter(category, type, filterMode, path);
        } else {
            loadExamList();
        }

    } catch (error) {
        console.error('[browseCategory] 处理浏览类别时出错:', error);
        showMessage('浏览类别时出现错误', 'error');
    }
}

function filterByType(type) {
    // 重置筛选器状态
    setBrowseFilterState('all', type);
    setBrowseTitle(formatBrowseTitle('all', type));

    // 重置浏览模式和路径（清除频率模式残留）
    window.__browseFilterMode = 'default';
    window.__browsePath = null;

    // 重置 browseController 到默认模式
    // 关键修复：仅在当前不是默认模式时才调用 resetToDefault，防止死循环
    // (resetToDefault -> setMode -> applyFilter -> filterByType -> global.filterByType)
    if (window.browseController &&
        window.browseController.currentMode !== 'default' &&
        typeof window.browseController.resetToDefault === 'function') {
        window.browseController.resetToDefault();
    }

    // 更新题库浏览筛选按钮的 active 状态
    var container = document.getElementById('type-filter-buttons');
    if (container) {
        var buttons = container.querySelectorAll('.shui-segmented-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.dataset.filterType === type || btn.dataset.filterId === type) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        }
    }

    // 触发滑块指示器同步
    if (typeof window.updateSegmentedIndicators === 'function') {
        setTimeout(window.updateSegmentedIndicators, 10);
    }

    // 刷新题库列表
    loadExamList();
}

// 应用分类筛选（供 App/总览调用）
function applyBrowseFilter(category = 'all', type = null, filterMode = null, path = null) {
    try {
        // 归一化输入：兼容 "P1 阅读"/"P2 听力" 这类文案
        const raw = String(category || 'all');
        let normalizedCategory = 'all';
        const m = raw.match(/\bP[1-4]\b/i);
        if (m) normalizedCategory = m[0].toUpperCase();

        // 若未显式给出类型，从文案或题库推断
        if (!type || type === 'all') {
            if (/阅读/.test(raw)) type = 'reading';
            else if (/听力/.test(raw)) type = 'listening';
        }
        // 若未显式给出类型，则根据当前题库推断（同时存在时不限定类型）
        if (!type || type === 'all') {
            try {
                const indexSnapshot = getExamIndexState();
                const hasReading = indexSnapshot.some(e => e.category === normalizedCategory && e.type === 'reading');
                const hasListening = indexSnapshot.some(e => e.category === normalizedCategory && e.type === 'listening');
                if (hasReading && !hasListening) type = 'reading';
                else if (!hasReading && hasListening) type = 'listening';
                else type = 'all';
            } catch (_) { type = 'all'; }
        }

        const normalizedType = normalizeExamType(type);
        const normalizedPath = (typeof path === 'string' && path.trim()) ? path.trim() : null;

        // 1. 先处理模式切换/重置
        if (filterMode) {
            const modeConfig = window.BROWSE_MODES && window.BROWSE_MODES[filterMode];
            const basePath = normalizedPath || (modeConfig && modeConfig.basePath) || null;
            window.__browsePath = basePath;
            window.__browseFilterMode = filterMode;
            if (window.browseController) {
                try {
                    if (!window.browseController.buttonContainer) {
                        window.browseController.initialize('type-filter-buttons');
                    }
                    window.browseController.setMode(filterMode);
                } catch (error) {
                    console.warn('[Browse] 切换浏览模式失败:', error);
                }
            }
        } else {
            // 默认模式：清除频率模式状态
            window.__browseFilterMode = 'default';
            window.__browsePath = normalizedPath;
            if (window.browseController &&
                window.browseController.currentMode !== 'default' &&
                typeof window.browseController.resetToDefault === 'function') {
                window.browseController.resetToDefault();
            }
        }

        // 2. 再应用具体的分类和类型筛选（确保不被重置覆盖）
        setBrowseFilterState(normalizedCategory, normalizedType);


        setBrowseTitle(formatBrowseTitle(normalizedCategory, normalizedType));

        // 3. 刷新题库列表
        // 如果是频率模式，setMode 已经处理了刷新，不需要再次调用 loadExamList
        // 只有在默认模式下才显式调用
        if (!filterMode) {
            loadExamList();
        }

        // 若未在浏览视图，则尽力切换
        if (typeof window.showView === 'function' && !document.getElementById('browse-view')?.classList.contains('active')) {
            window.showView('browse', false);
        }
    } catch (e) {
        console.warn('[Browse] 应用筛选失败，回退到默认列表:', e);
        setBrowseFilterState('all', 'all');
        if (window.browseController && typeof window.browseController.resetToDefault === 'function') {
            window.browseController.resetToDefault();
        }
        // 避免在错误处理中再次同步调用可能导致错误的 loadExamList，使用 setTimeout 打断调用栈
        setTimeout(() => {
            try { loadExamList(); } catch (_) { }
        }, 0);
    }
}

// Initialize browse view when it's activated
function initializeBrowseView() {
    console.log('[System] Initializing browse view...');
    startPracticeRecordsSyncInBackground('browse-view');

    // 初始化 browseController
    if (window.browseController && !window.browseController.buttonContainer) {
        window.browseController.initialize('type-filter-buttons');
    }

    const persisted = getPersistedBrowseFilter();
    if (persisted) {
        setBrowseFilterState(persisted.category, persisted.type);
        setBrowseTitle(formatBrowseTitle(persisted.category, persisted.type));
    } else {
        setBrowseFilterState('all', 'all');
        setBrowseTitle(formatBrowseTitle('all', 'all'));
    }

    ensurePracticeRecordsSync('browse-view').then(() => {
        refreshBrowseProgressFromRecords();
    });
    setupBrowseSortControl();
    loadExamList();
}

function setupBrowseSortControl() {
    const sortSelect = document.getElementById('browse-sort-select');
    if (!sortSelect || sortSelect.dataset.bound === 'true') {
        return;
    }
    let savedMode = String(window.__browseSortMode || '').trim().toLowerCase();
    if (!savedMode) {
        try {
            savedMode = String(window.localStorage.getItem('browse_sort_mode') || 'default').trim().toLowerCase();
        } catch (_) {
            savedMode = 'default';
        }
    }
    sortSelect.value = savedMode === 'frequency-desc' ? 'frequency-desc' : 'default';
    window.__browseSortMode = sortSelect.value;
    sortSelect.addEventListener('change', () => {
        const mode = String(sortSelect.value || 'default').trim().toLowerCase();
        window.__browseSortMode = mode === 'frequency-desc' ? 'frequency-desc' : 'default';
        try {
            window.localStorage.setItem('browse_sort_mode', window.__browseSortMode);
        } catch (_) {
            // ignore storage failures
        }
        loadExamList();
    });
    sortSelect.dataset.bound = 'true';
}

// --- Overview View ---

let overviewViewInstance = null;

function getOverviewView() {
    if (!overviewViewInstance) {
        const OverviewView = window.AppViews && window.AppViews.OverviewView;
        if (typeof OverviewView !== 'function') {
            console.warn('[Overview] 未加载 OverviewView 模块，使用回退渲染逻辑');
            return null;
        }
        overviewViewInstance = new OverviewView({});
    }
    return overviewViewInstance;
}

function updateOverview() {
    const categoryContainer = document.getElementById('category-overview');
    if (!categoryContainer) {
        console.warn('[Overview] 找不到 category-overview 容器');
        return;
    }

    const currentExamIndex = getExamIndexState();
    const statsService = window.AppServices && window.AppServices.overviewStats;
    const stats = statsService ?
        statsService.calculate(currentExamIndex) :
        {
            reading: [],
            listening: [],
            meta: {
                readingUnknown: 0,
                listeningUnknown: 0,
                total: currentExamIndex.length,
                readingUnknownEntries: [],
                listeningUnknownEntries: []
            }
        };

    const view = getOverviewView();
    if (view && window.DOM && window.DOM.builder) {
        view.render(stats, {
            container: categoryContainer,
            actions: {
                onBrowseCategory: (category, type, filterMode, path) => {
                    if (typeof browseCategory === 'function') {
                        browseCategory(category, type, filterMode, path);
                    }
                },
                onRandomPractice: (category, type, filterMode, path) => {
                    if (typeof startRandomPractice === 'function') {
                        startRandomPractice(category, type, filterMode, path);
                    }
                }
            }
        });

        if (stats.meta?.readingUnknownEntries?.length) {
            console.warn('[Overview] 未知阅读类别:', stats.meta.readingUnknownEntries);
        }
        if (stats.meta?.listeningUnknownEntries?.length) {
            console.warn('[Overview] 未知听力类别:', stats.meta.listeningUnknownEntries);
        }
        return;
    }

    renderOverviewLegacy(categoryContainer, stats);
    setupOverviewInteractions();
}

function renderOverviewLegacy(container, stats) {
    if (!container) return;

    const adapter = window.DOMAdapter;
    if (!adapter) {
        console.warn('[Overview] DOMAdapter 未加载，跳过渲染');
        return;
    }

    const sections = [];

    const appendSection = (title, entries, icon) => {
        if (!entries || entries.length === 0) {
            return;
        }

        sections.push(adapter.create('h3', {
            className: 'overview-section-title',
            dataset: { overviewSection: title }
        }, [
            adapter.create('span', { className: 'overview-section-icon', ariaHidden: 'true' }, icon),
            adapter.create('span', { className: 'overview-section-label' }, title)
        ]));

        entries.forEach((entry) => {
            sections.push(adapter.create('div', {
                className: 'category-card',
                dataset: {
                    category: entry.category,
                    examType: entry.type
                }
            }, [
                adapter.create('div', { className: 'category-header' }, [
                    adapter.create('div', {
                        className: 'category-icon',
                        ariaHidden: 'true'
                    }, entry.type === 'reading' ? '📖' : '🎧'),
                    adapter.create('div', { className: 'category-details' }, [
                        adapter.create('div', { className: 'category-title' }, [
                            entry.category,
                            ' ',
                            entry.type === 'reading' ? '阅读' : '听力'
                        ]),
                        adapter.create('div', { className: 'category-meta' }, `${entry.total} 篇`)
                    ])
                ]),
                adapter.create('div', { className: 'category-card-actions' }, [
                    adapter.create('button', {
                        type: 'button',
                        className: 'btn category-action-button',
                        dataset: {
                            overviewAction: 'browse',
                            category: entry.category,
                            examType: entry.type
                        }
                    }, [
                        adapter.create('span', { className: 'category-action-icon', ariaHidden: 'true' }, '📚'),
                        adapter.create('span', { className: 'category-action-label' }, '浏览题库')
                    ]),
                    adapter.create('button', {
                        type: 'button',
                        className: 'btn btn-secondary category-action-button',
                        dataset: {
                            overviewAction: 'random',
                            category: entry.category,
                            examType: entry.type
                        }
                    }, [
                        adapter.create('span', { className: 'category-action-icon', ariaHidden: 'true' }, '🎲'),
                        adapter.create('span', { className: 'category-action-label' }, '随机练习')
                    ])
                ])
            ]));
        });
    };

    const readingEntries = (stats && stats.reading) || [];
    const listeningEntries = (stats && stats.listening ? stats.listening.filter((entry) => entry.total > 0) : []);

    appendSection('阅读', readingEntries, '📖');
    appendSection('听力', listeningEntries, '🎧');

    if (sections.length === 0) {
        sections.push(adapter.create('p', { className: 'overview-empty' }, '暂无题库数据'));
    }

    adapter.replaceContent(container, sections);
}

let overviewDelegatesConfigured = false;

function setupOverviewInteractions() {
    if (overviewDelegatesConfigured) {
        return;
    }

    const container = document.getElementById('category-overview');
    if (!container) {
        return;
    }

    const invokeAction = (target, event) => {
        const action = target.dataset.overviewAction;
        if (!action) {
            return;
        }

        event.preventDefault();

        const category = target.dataset.category;
        const type = target.dataset.examType || 'reading';
        const filterMode = target.dataset.filterMode || null;
        const path = target.dataset.path || null;

        if (!category) {
            return;
        }

        if (action === 'browse') {
            if (typeof browseCategory === 'function') {
                browseCategory(category, type, filterMode, path);
            } else {
                try { applyBrowseFilter(category, type, filterMode, path); } catch (_) { }
            }
            return;
        }

        if (action === 'random' && typeof startRandomPractice === 'function') {
            startRandomPractice(category, type, filterMode, path);
        }
    };

    const hasDomDelegate = typeof window !== 'undefined'
        && window.DOM
        && typeof window.DOM.delegate === 'function';

    if (hasDomDelegate) {
        window.DOM.delegate('click', '#category-overview [data-overview-action]', function (event) {
            invokeAction(this, event);
        });
    } else {
        container.addEventListener('click', (event) => {
            const target = event.target.closest('[data-overview-action]');
            if (!target || !container.contains(target)) {
                return;
            }
            invokeAction(target, event);
        });
    }

    overviewDelegatesConfigured = true;
}

// --- Library Configuration UI ---

function showView(viewName, animate) {
    // placeholder - 实际实现在 app.js 中
    if (typeof window.app !== 'undefined' && typeof window.app.navigateToView === 'function') {
        window.app.navigateToView(viewName);
    }
}

async function loadLibraryInternal(keyOrForceReload = false) {
    const manager = await ensureLibraryManagerReady();
    if (!manager) {
        console.warn('[Library] LibraryManager 未就绪，跳过加载');
        return;
    }

    const supportsManagerLoad = typeof manager.loadLibrary === 'function';
    const supportsApplyConfig = typeof manager.applyLibraryConfiguration === 'function';
    const supportsLoadActive = typeof manager.loadActiveLibrary === 'function';

    if (typeof keyOrForceReload === 'string') {
        if (supportsManagerLoad) {
            return manager.loadLibrary(keyOrForceReload);
        }
        if (supportsApplyConfig) {
            return manager.applyLibraryConfiguration(keyOrForceReload);
        }
    }

    const forceReload = !!keyOrForceReload;
    if (supportsLoadActive) {
        return manager.loadActiveLibrary(forceReload);
    }
    if (supportsManagerLoad) {
        return manager.loadLibrary(forceReload ? 'default' : undefined);
    }
}

function resolveScriptPathRoot(type) {
    const manager = getLibraryManager();
    if (manager && typeof manager.resolveScriptPathRoot === 'function') {
        return manager.resolveScriptPathRoot(type);
    }
    return type === 'reading'
        ? '睡着过项目组/2. 所有文章(11.20)[192篇]/'
        : 'assets/listening/';
}

function finishLibraryLoading(startTime) {
    const manager = getLibraryManager();
    if (manager && typeof manager.finishLibraryLoading === 'function') {
        return manager.finishLibraryLoading(startTime);
    }
}

function searchExams(query) {
    toggleSearchClearButton(query);
    if (window.performanceOptimizer && typeof window.performanceOptimizer.debounce === 'function') {
        const debouncedSearch = window.performanceOptimizer.debounce(performSearch, 300, 'exam_search');
        debouncedSearch(query);
    } else {
        // Fallback: direct call if optimizer not available
        performSearch(query);
    }
}

function toggleSearchClearButton(query) {
    const clearButton = document.getElementById('search-clear-btn');
    if (!clearButton) {
        return;
    }
    const normalizedQuery = typeof query === 'string' ? query.trim() : '';
    clearButton.hidden = normalizedQuery.length === 0;
}

function clearSearch() {
    const searchInput = document.getElementById('exam-search-input') || document.querySelector('.search-input');
    if (searchInput) {
        searchInput.value = '';
        try {
            searchInput.focus();
        } catch (_) { }
    }
    if (window.browseStateManager && typeof window.browseStateManager.clearSearchState === 'function') {
        try { window.browseStateManager.clearSearchState(); } catch (_) { }
    }
    toggleSearchClearButton('');
    searchExams('');
}

function performSearch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
        const currentFiltered = getFilteredExamsState();
        const baseList = currentFiltered.length ? currentFiltered : getExamIndexState();
        displayExams(baseList);
        return;
    }

    // 调试日志
    console.log('[Search] 执行搜索，查询词:', normalizedQuery);
    const searchBase = getExamIndexState();
    console.log('[Search] 全量索引数量:', searchBase.length);
    const searchResults = searchBase.filter(exam => {
        if (exam.searchText) {
            return exam.searchText.includes(normalizedQuery);
        }
        // Fallback 匹配
        return (exam.title && exam.title.toLowerCase().includes(normalizedQuery)) ||
            (exam.category && exam.category.toLowerCase().includes(normalizedQuery));
    });

    console.log('[Search] 搜索结果数量:', searchResults.length);
    displayExams(searchResults);
}

// Phase 3: 打开题目 - 已迁移到 app-actions.js
function openExamWithFallback(exam, delay = 600) {
    if (window.AppActions && typeof window.AppActions.openExamWithFallback === 'function') {
        return window.AppActions.openExamWithFallback(exam, delay);
    }
    // 降级：直接执行
    if (!exam) {
        if (typeof showMessage === 'function') {
            showMessage('未找到可用题目', 'error');
        }
        return;
    }
    const launch = () => {
        try {
            if (exam.hasHtml) {
                openExam(exam.id);
            } else {
                viewPDF(exam.id);
            }
        } catch (error) {
            console.error('[main.js] 启动题目失败:', error);
            if (typeof showMessage === 'function') {
                showMessage('无法打开题目，请检查题库路径', 'error');
            }
        }
    };
    if (delay > 0) {
        setTimeout(launch, delay);
    } else {
        launch();
    }
}

// Phase 3: 随机练习 - 已迁移到 app-actions.js
function startRandomPractice(category, type = 'reading', filterMode = null, path = null) {
    if (window.AppActions && typeof window.AppActions.startRandomPractice === 'function') {
        return window.AppActions.startRandomPractice(category, type, filterMode, path);
    }
    // 降级：直接执行
    const list = getExamIndexState();
    const normalizedType = (!type || type === 'all') ? null : type;
    const normalizedPath = (typeof path === 'string' && path.trim()) ? path.trim() : null;

    let pool = Array.from(list);
    if (normalizedType) {
        pool = pool.filter((exam) => exam.type === normalizedType);
    }
    if (category && category !== 'all') {
        const filteredByCategory = pool.filter((exam) => exam.category === category);
        if (filteredByCategory.length > 0 || !normalizedPath) {
            pool = filteredByCategory;
        }
    }
    if (normalizedPath) {
        pool = pool.filter((exam) => typeof exam?.path === 'string' && exam.path.includes(normalizedPath));
    } else if (filterMode && window.BROWSE_MODES && window.BROWSE_MODES[filterMode]) {
        const modeConfig = window.BROWSE_MODES[filterMode];
        if (modeConfig?.basePath) {
            pool = pool.filter((exam) => typeof exam?.path === 'string' && exam.path.includes(modeConfig.basePath));
        }
    }
    if (pool.length === 0) {
        if (typeof showMessage === 'function') {
            const typeLabel = normalizedType === 'listening' ? '听力' : (normalizedType === 'reading' ? '阅读' : '题库');
            showMessage(`${category} ${typeLabel} 分类暂无可用题目`, 'error');
        }
        return;
    }
    const randomExam = pool[Math.floor(Math.random() * pool.length)];
    if (typeof showMessage === 'function') {
        showMessage(`随机选择: ${randomExam.title}`, 'info');
    }
    openExamWithFallback(randomExam);
}

// --- Mock Exam (模考) ---

window.startMockExam = function (examId) {
    var exam = window.getExamById ? window.getExamById(examId) : getExamIndexState().find(function (e) { return e.id === examId; });
    if (!exam) {
        if (typeof showMessage === 'function') {
            showMessage('未找到题目', 'error');
        }
        return;
    }

    var duration = exam.type === 'listening' ? 1800 : 3600; // listening 30min, reading 60min
    var typeLabel = exam.type === 'listening' ? '听力' : '阅读';

    if (!confirm('开始' + typeLabel + '模考\n时间限制：' + (duration / 60) + '分钟\n确定开始吗？')) {
        return;
    }

    // Create timer
    var timer = new window.CountdownTimer({
        duration: duration,
        onComplete: function () {
            // Remove timer UI
            var ui = document.querySelector('.countdown-timer');
            if (ui && ui.parentNode) {
                ui.parentNode.removeChild(ui);
            }
            if (typeof showMessage === 'function') {
                showMessage('时间到！模考结束', 'info');
            }
        }
    });

    var ui = window.createCountdownUI(timer);
    document.body.prepend(ui);
    timer.start();

    // Open the exam using existing logic
    openExamWithFallback(exam);
};
