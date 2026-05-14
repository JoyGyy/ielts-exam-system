// viewHelpers.js - 视图辅助函数和通用工具
// 从 main.js 提取 formatBrowseTitle, normalizeExamType, getPersistedBrowseFilter,
// enrichPracticeRecordForUI, updateBrowseAnchorsFromRecords, setupBrowsePreferenceUI
// 以及其他跨模块共享的辅助函数

// ============================================================================
// Browse Helper Functions
// ============================================================================

function formatBrowseTitle(category, type) {
    const categoryLabels = {
        'all': '全部',
        'P1': 'P1',
        'P2': 'P2',
        'P3': 'P3',
        'P4': 'P4'
    };
    const typeLabels = {
        'all': '',
        'reading': '阅读',
        'listening': '听力'
    };

    const catLabel = categoryLabels[category] || category || '全部';
    const typeLabel = typeLabels[type] || '';

    if (category === 'all' && !typeLabel) {
        return '题库列表';
    }
    if (category === 'all' && typeLabel) {
        return typeLabel + '题库';
    }
    if (typeLabel) {
        return catLabel + ' ' + typeLabel;
    }
    return catLabel + ' 题库';
}

function normalizeExamType(type) {
    if (!type || type === 'all') {
        return 'all';
    }
    const normalized = String(type).toLowerCase();
    if (normalized.includes('read') || normalized.includes('阅读')) {
        return 'reading';
    }
    if (normalized.includes('listen') || normalized.includes('听力')) {
        return 'listening';
    }
    return normalized;
}

function getPersistedBrowseFilter() {
    try {
        const raw = window.localStorage.getItem('browse_filter');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return { category: parsed.category || 'all', type: parsed.type || 'all' };
        }
    } catch (_) { }
    return null;
}

function persistBrowseFilter(category, type) {
    try {
        window.localStorage.setItem('browse_filter', JSON.stringify({ category, type }));
    } catch (_) { }
}

function requestBrowseAutoScroll(category, type) {
    try {
        window.__pendingBrowseAutoScroll = { category, type, timestamp: Date.now() };
    } catch (_) { }
}

// ============================================================================
// Practice Record Enrichment
// ============================================================================

function enrichPracticeRecordForUI(record) {
    if (!record || typeof record !== 'object') {
        return record;
    }

    // 确保关键字段存在
    const enriched = Object.assign({}, record);

    // 从 realData 中提取并规范化字段
    const rd = enriched.realData || {};
    const sInfo = enriched.scoreInfo || rd.scoreInfo || {};

    if (typeof enriched.correctAnswers !== 'number') {
        enriched.correctAnswers = typeof sInfo.correct === 'number' ? sInfo.correct : 0;
    }
    if (typeof enriched.totalQuestions !== 'number') {
        enriched.totalQuestions = typeof sInfo.total === 'number' ? sInfo.total : 0;
    }
    if (typeof enriched.accuracy !== 'number') {
        const correct = enriched.correctAnswers;
        const total = enriched.totalQuestions;
        enriched.accuracy = total > 0 ? correct / total : 0;
    }
    if (typeof enriched.percentage !== 'number') {
        enriched.percentage = Math.round(enriched.accuracy * 100);
    }
    if (typeof enriched.duration !== 'number' || enriched.duration <= 0) {
        enriched.duration = 0;
    }

    // 确保 date 字段存在
    if (!enriched.date) {
        enriched.date = enriched.endTime || enriched.timestamp
            ? new Date(enriched.endTime || enriched.timestamp).toISOString()
            : new Date().toISOString();
    }

    return enriched;
}

// ============================================================================
// Browse Anchors
// ============================================================================

function updateBrowseAnchorsFromRecords(records) {
    try {
        const normalizedRecords = Array.isArray(records) ? records : [];
        const anchorMap = {};

        normalizedRecords.forEach((record) => {
            if (!record || !record.examId) return;
            const examId = String(record.examId);
            if (!anchorMap[examId]) {
                anchorMap[examId] = {
                    lastPracticed: record.date || record.endTime || '',
                    practiceCount: 0,
                    bestPercentage: 0
                };
            }
            const anchor = anchorMap[examId];
            anchor.practiceCount++;
            const pct = typeof record.percentage === 'number' ? record.percentage : 0;
            if (pct > anchor.bestPercentage) {
                anchor.bestPercentage = pct;
            }
        });

        window.__browseAnchors = anchorMap;
    } catch (error) {
        console.warn('[Browse] 更新浏览锚点失败:', error);
    }
}

// ============================================================================
// Browse Preference UI
// ============================================================================

function setupBrowsePreferenceUI() {
    // 初始化浏览偏好 UI（如果有相关组件）
    try {
        const sortSelect = document.getElementById('browse-sort-select');
        if (sortSelect && !sortSelect.dataset.bound) {
            let savedMode = 'default';
            try {
                savedMode = String(window.localStorage.getItem('browse_sort_mode') || 'default').trim().toLowerCase();
            } catch (_) { }
            sortSelect.value = savedMode === 'frequency-desc' ? 'frequency-desc' : 'default';
        }
    } catch (_) { }
}
