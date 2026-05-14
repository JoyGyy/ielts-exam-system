// practiceView.js - 练习视图
// 从 main.js 提取 updatePracticeView, renderPracticeRecords, displayScores,
// 练习记录同步、完成回调、消息监听、批量操作等

// ============================================================================
// Practice Records Sync
// ============================================================================

// Phase 3: 练习记录同步 - 保留在 main.js（核心数据流，暂不迁移）
async function syncPracticeRecords(options = {}) {
    const { forceRender = false } = options || {};
    console.log('[System] 正在从存储中同步练习记录...');
    let records = [];
    try {
        const practiceCoreStore = window.PracticeCore && window.PracticeCore.store;
        if (practiceCoreStore && typeof practiceCoreStore.listPracticeRecords === 'function') {
            records = await practiceCoreStore.listPracticeRecords();
        } else {
        // Prefer normalized records from ScoreStorage via PracticeRecorder
            const pr = window.app && window.app.components && window.app.components.practiceRecorder;
            if (pr && typeof pr.getPracticeRecords === 'function') {
                const maybePromise = pr.getPracticeRecords();
                const res = (typeof maybePromise?.then === 'function') ? await maybePromise : maybePromise;
                records = Array.isArray(res) ? res : [];
            } else {
                // Fallback: read raw storage and defensively normalize minimal fields
                const raw = await storage.get('practice_records', []) || [];
                const base = Array.isArray(raw) ? raw : [];
                records = base.map(r => {
                    const rd = (r && r.realData) || {};
                    const sInfo = r && (r.scoreInfo || rd.scoreInfo) || {};
                    const correct = (typeof r.correctAnswers === 'number') ? r.correctAnswers : (typeof sInfo.correct === 'number' ? sInfo.correct : (typeof r.score === 'number' ? r.score : 0));
                    const total = (typeof r.totalQuestions === 'number') ? r.totalQuestions : (typeof sInfo.total === 'number' ? sInfo.total : (rd.answers ? Object.keys(rd.answers).length : 0));
                    let acc = (typeof r.accuracy === 'number') ? r.accuracy : (total > 0 ? (correct / total) : 0);
                    if (acc > 1 && acc <= 100) { acc = acc / 100; }
                    const pct = (typeof r.percentage === 'number' && r.percentage >= 0 && r.percentage <= 100) ? r.percentage : Math.round(acc * 100);
                    let dur = (typeof r.duration === 'number') ? r.duration : undefined;
                    if (!(Number.isFinite(dur) && dur > 0)) {
                        if (typeof rd.duration === 'number' && rd.duration > 0) {
                            dur = rd.duration;
                        } else {
                            // try compute from timestamps if available
                            const s = r.startTime ? new Date(r.startTime).getTime() : NaN;
                            const e = r.endTime ? new Date(r.endTime).getTime() : NaN;
                            if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
                                dur = Math.round((e - s) / 1000);
                            } else {
                                dur = 0;
                            }
                        }
                    }
                    return { ...r, accuracy: acc, percentage: pct, duration: dur, correctAnswers: (r.correctAnswers ?? correct), totalQuestions: (r.totalQuestions ?? total) };
                });
            }
        }
    } catch (e) {
        console.warn('[System] 同步记录时发生错误，使用存储原始数据:', e);
        const raw = await storage.get('practice_records', []);
        records = Array.isArray(raw) ? raw : [];
    }

    // Normalize duration and percentages to avoid 0-second artifacts
    try {
        records = (records || []).map(r => {
            const rd = (r && r.realData) || {};
            let duration = (typeof r.duration === 'number') ? r.duration : undefined;
            if (!(Number.isFinite(duration) && duration > 0)) {
                const sInfo = r && (r.scoreInfo || rd.scoreInfo) || {};
                const candidates = [
                    r.duration, rd.duration, r.durationSeconds, r.duration_seconds,
                    r.elapsedSeconds, r.elapsed_seconds, r.timeSpent, r.time_spent,
                    rd.durationSeconds, rd.elapsedSeconds, rd.timeSpent,
                    sInfo.duration, sInfo.timeSpent
                ];
                for (const v of candidates) {
                    const n = Number(v);
                    if (Number.isFinite(n) && n > 0) { duration = Math.floor(n); break; }
                }
                if (!(Number.isFinite(duration) && duration > 0) && r && r.startTime && r.endTime) {
                    const s = new Date(r.startTime).getTime();
                    const e = new Date(r.endTime).getTime();
                    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
                        duration = Math.round((e - s) / 1000);
                    }
                }
                if (!(Number.isFinite(duration) && duration > 0) && rd && Array.isArray(rd.interactions) && rd.interactions.length) {
                    try {
                        const ts = rd.interactions.map(x => x && Number(x.timestamp)).filter(n => Number.isFinite(n));
                        if (ts.length) {
                            const span = Math.max(...ts) - Math.min(...ts);
                            if (Number.isFinite(span) && span > 0) duration = Math.floor(span / 1000);
                        }
                    } catch (_) { }
                }
            }
            if (!Number.isFinite(duration)) duration = 0;

            // Coerce percentage/accuracy if only scoreInfo exists
            const sInfo = r && (r.scoreInfo || rd.scoreInfo) || {};
            const correct = (typeof r.correctAnswers === 'number') ? r.correctAnswers : (typeof sInfo.correct === 'number' ? sInfo.correct : (typeof r.score === 'number' ? r.score : undefined));
            const total = (typeof r.totalQuestions === 'number') ? r.totalQuestions : (typeof sInfo.total === 'number' ? sInfo.total : (rd.answers ? Object.keys(rd.answers).length : undefined));
            let accuracy = (typeof r.accuracy === 'number') ? r.accuracy : undefined;
            let percentage = (typeof r.percentage === 'number') ? r.percentage : undefined;
            if ((accuracy === undefined || percentage === undefined) && Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
                const acc = correct / total;
                if (accuracy === undefined) accuracy = acc;
                if (percentage === undefined) percentage = Math.round(acc * 100);
            }

            return { ...r, duration, accuracy: (accuracy ?? r.accuracy), percentage: (percentage ?? r.percentage) };
        });
    } catch (e) { console.warn('[System] normalize durations failed:', e); }

    // 若数据未变则跳过 UI 刷新，避免无意义的列表重置
    try {
        const prev = typeof getPracticeRecordsState === 'function'
            ? getPracticeRecordsState()
            : (Array.isArray(window.practiceRecords) ? window.practiceRecords : []);
        const renderer = window.PracticeHistoryRenderer;
        if (renderer && renderer.helpers && typeof renderer.helpers.computeRecordsSignature === 'function') {
            const prevSig = renderer.helpers.computeRecordsSignature(prev);
            const nextSig = renderer.helpers.computeRecordsSignature(records);
            if (!forceRender && prevSig === nextSig) {
                console.log('[System] 练习记录未变化，跳过UI刷新');
                return;
            }
        }
    } catch (_) { /* 保底不中断同步流程 */ }

    // 新增修复3D：确保全局变量和 app.state 都跟 canonical records 保持一致
    setPracticeRecordsState(records);
    try {
        if (window.app && window.app.state && window.app.state.practice) {
            const nextRecords = typeof getPracticeRecordsState === 'function'
                ? getPracticeRecordsState()
                : (Array.isArray(records) ? records : []);
            window.app.state.practice.records = Array.isArray(nextRecords) ? nextRecords.slice() : [];
        }
    } catch (error) {
        console.warn('[System] 同步练习记录到 App state 失败:', error);
    }
    refreshBrowseProgressFromRecords(records);

    console.log(`[System] ${records.length} 条练习记录已加载到内存。`);
    updatePracticeView();
}

let practiceRecordsLoadPromise = null;
function ensurePracticeRecordsSync(trigger = 'default') {
    if (practiceRecordsLoadPromise) {
        return practiceRecordsLoadPromise;
    }
    const loadTask = (async () => {
        await syncPracticeRecords();
        return true;
    })().catch((error) => {
        console.warn(`[System] 练习记录同步失败(${trigger}):`, error);
        return false;
    });
    practiceRecordsLoadPromise = loadTask.finally(() => {
        practiceRecordsLoadPromise = null;
    });
    return practiceRecordsLoadPromise;
}

function startPracticeRecordsSyncInBackground(trigger = 'default') {
    try {
        ensurePracticeRecordsSync(trigger);
    } catch (error) {
        console.warn(`[System] 后台同步练习记录失败(${trigger}):`, error);
    }
}

async function listCanonicalPracticeRecords() {
    const practiceKey = ['practice', 'records'].join('_');
    const practiceCoreStore = window.PracticeCore && window.PracticeCore.store;
    if (practiceCoreStore && typeof practiceCoreStore.listPracticeRecords === 'function') {
        return await practiceCoreStore.listPracticeRecords();
    }

    if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.getPracticeRecords === 'function') {
        const records = await window.simpleStorageWrapper.getPracticeRecords();
        return Array.isArray(records) ? records : [];
    }

    if (window.storage && typeof window.storage.get === 'function') {
        const records = await window.storage.get(practiceKey, []);
        return Array.isArray(records) ? records : [];
    }

    return [];
}

async function replaceCanonicalPracticeRecords(records) {
    const finalRecords = Array.isArray(records) ? records : [];
    const practiceKey = ['practice', 'records'].join('_');
    const practiceCoreStore = window.PracticeCore && window.PracticeCore.store;

    if (practiceCoreStore && typeof practiceCoreStore.replacePracticeRecords === 'function') {
        await practiceCoreStore.replacePracticeRecords(finalRecords);
        return true;
    }

    if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.savePracticeRecords === 'function') {
        await window.simpleStorageWrapper.savePracticeRecords(finalRecords);
        return true;
    }

    if (window.storage && typeof window.storage.writePersistentValue === 'function') {
        await window.storage.writePersistentValue(practiceKey, finalRecords);
        return true;
    }

    if (window.storage && typeof window.storage.set === 'function') {
        await window.storage.set(practiceKey, finalRecords);
        return true;
    }

    throw new Error('练习记录存储未就绪');
}

function syncLegacyPracticeRecordArtifacts(records) {
    const finalRecords = Array.isArray(records) ? records : [];
    const legacyRawKeys = ['practice_records', 'old_prefix_practice_records'];
    const shadowKey = window.storage && typeof window.storage.getKey === 'function'
        ? window.storage.getKey('practice_records')
        : null;

    try {
        if (finalRecords.length === 0) {
            legacyRawKeys.forEach((key) => {
                try { localStorage.removeItem(key); } catch (_) { }
                try { sessionStorage.removeItem(key); } catch (_) { }
            });
        } else {
            const serialized = JSON.stringify(finalRecords);
            try { localStorage.setItem('practice_records', serialized); } catch (_) { }
            try { sessionStorage.removeItem('practice_records'); } catch (_) { }
            try { localStorage.removeItem('old_prefix_practice_records'); } catch (_) { }
            try { sessionStorage.removeItem('old_prefix_practice_records'); } catch (_) { }
        }
    } catch (error) {
        console.warn('[System] 同步 legacy 练习记录影子键失败:', error);
    }

    if (shadowKey && window.storage && window.storage.mode === 'indexeddb') {
        try { localStorage.removeItem(shadowKey); } catch (_) { }
        try { sessionStorage.removeItem(shadowKey); } catch (_) { }
    }
}

async function persistPracticeRecordsAndRefresh(records, trigger = 'manual-update') {
    const finalRecords = Array.isArray(records) ? records : [];
    await replaceCanonicalPracticeRecords(finalRecords);
    syncLegacyPracticeRecordArtifacts(finalRecords);
    await syncPracticeRecords({ forceRender: true });
    return getPracticeRecordsState();
}

// ============================================================================
// Completion Helpers
// ============================================================================

const completionNoticeState = {
    lastSessionId: null,
    lastShownAt: 0
};

function extractCompletionPayload(envelope) {
    if (!envelope || typeof envelope !== 'object') {
        return null;
    }
    const candidates = [envelope.data, envelope.payload, envelope.results, envelope.detail, envelope];
    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (candidate && typeof candidate === 'object') {
            if (
                candidate.scoreInfo ||
                typeof candidate.correctAnswers !== 'undefined' ||
                typeof candidate.totalQuestions !== 'undefined' ||
                (candidate.answers && typeof candidate.answers === 'object')
            ) {
                return candidate;
            }
        }
    }
    return null;
}

function extractCompletionSessionId(envelope) {
    if (!envelope || typeof envelope !== 'object') {
        return null;
    }
    if (typeof envelope.sessionId === 'string' && envelope.sessionId.trim()) {
        return envelope.sessionId.trim();
    }
    const payload = extractCompletionPayload(envelope);
    if (payload && typeof payload.sessionId === 'string' && payload.sessionId.trim()) {
        return payload.sessionId.trim();
    }
    return null;
}

function shouldAnnounceCompletion(sessionId) {
    const now = Date.now();
    if (sessionId && completionNoticeState.lastSessionId === sessionId) {
        return false;
    }
    if (!sessionId && (now - completionNoticeState.lastShownAt) < 1500) {
        return false;
    }
    completionNoticeState.lastSessionId = sessionId || null;
    completionNoticeState.lastShownAt = now;
    return true;
}

function pickNumericValue(values) {
    for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        if (value === undefined || value === null) {
            continue;
        }
        const num = Number(value);
        if (Number.isFinite(num)) {
            return num;
        }
    }
    return null;
}

function extractCompletionStats(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const scoreInfo = payload.scoreInfo || (payload.realData && payload.realData.scoreInfo) || {};
    const correct = pickNumericValue([
        scoreInfo.correct,
        payload.correctAnswers,
        payload.score,
        payload.realData && payload.realData.correctAnswers
    ]);
    const total = pickNumericValue([
        scoreInfo.total,
        payload.totalQuestions,
        payload.questionCount,
        payload.realData && payload.realData.totalQuestions,
        payload.answerComparison && typeof payload.answerComparison === 'object'
            ? Object.keys(payload.answerComparison).length
            : null,
        payload.answers && typeof payload.answers === 'object'
            ? Object.keys(payload.answers).length
            : null
    ]);
    let percentage = pickNumericValue([
        scoreInfo.percentage,
        payload.percentage,
        typeof scoreInfo.accuracy === 'number' ? scoreInfo.accuracy * 100 : null,
        typeof payload.accuracy === 'number' ? payload.accuracy * 100 : null
    ]);
    if (!Number.isFinite(percentage) && Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
        percentage = (correct / total) * 100;
    }

    const hasScore = Number.isFinite(correct) && Number.isFinite(total) && total > 0;
    const hasPercentage = Number.isFinite(percentage);
    if (!hasPercentage && !hasScore) {
        return null;
    }

    return {
        percentage: hasPercentage ? percentage : null,
        correct: hasScore ? correct : null,
        total: hasScore ? total : null
    };
}

function formatPercentageDisplay(value) {
    if (!Number.isFinite(value)) {
        return null;
    }
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function showCompletionSummary(envelope) {
    const payload = extractCompletionPayload(envelope);
    const stats = extractCompletionStats(payload);
    if (!stats) {
        return;
    }
    const parts = [];
    const pctText = formatPercentageDisplay(stats.percentage);
    if (pctText) {
        parts.push(`本次正确率 ${pctText}`);
    }
    if (Number.isFinite(stats.correct) && Number.isFinite(stats.total)) {
        parts.push(`得分 ${stats.correct}/${stats.total}`);
    }
    if (parts.length === 0) {
        return;
    }
    showMessage(`📊 ${parts.join('，')}`, 'info');
}

// ============================================================================
// Message & Storage Listeners
// ============================================================================

function setupMessageListener() {
    window.addEventListener('message', (event) => {
        // 更兼容的安全检查：允许同源或file协议下的子窗口
        try {
            if (event.origin && event.origin !== 'null' && event.origin !== window.location.origin) {
                return;
            }
        } catch (_) { }

        const data = event.data || {};
        const type = data.type;
        if (type === 'SESSION_READY') {
            // 子页未携带 sessionId，这里基于 event.source 匹配对应会话并停止握手重试
            try {
                for (const [sid, rec] of fallbackExamSessions.entries()) {
                    if (rec && rec.win === event.source) {
                        if (rec.timer) clearInterval(rec.timer);
                        console.log('[Fallback] 会话就绪(匹配到窗口):', sid);
                        break;
                    }
                }
            } catch (_) { }
        } else if (type === 'PRACTICE_COMPLETE' || type === 'practice_completed') {
            const payload = extractCompletionPayload(data) || {};
            const sessionId = extractCompletionSessionId(data);
            const rec = sessionId ? fallbackExamSessions.get(sessionId) : null;
            const shouldNotify = shouldAnnounceCompletion(sessionId);
            if (rec) {
                console.log('[Fallback] 收到练习完成（降级路径），保存真实数据');
                savePracticeRecordFallback(rec.examId, payload).finally(() => {
                    try { if (rec && rec.timer) clearInterval(rec.timer); } catch (_) { }
                    try { fallbackExamSessions.delete(sessionId); } catch (_) { }
                    if (shouldNotify) {
                        showMessage('练习已完成，正在更新记录...', 'success');
                        showCompletionSummary(payload);
                    }
                    setTimeout(syncPracticeRecords, 300);
                });
            } else {
                console.log('[System] 收到练习完成消息，正在同步记录...');
                if (shouldNotify) {
                    showMessage('练习已完成，正在更新记录...', 'success');
                    showCompletionSummary(payload);
                }
                setTimeout(syncPracticeRecords, 300);
            }
        }
    });
}

function setupStorageSyncListener() {
    window.addEventListener('storage-sync', (event) => {
        console.log('[System] 收到存储同步事件，正在更新练习记录...', event.detail);
        //可以选择性地只更新受影响的key，但为了简单起见，我们直接同步所有记录
        // if (event.detail && event.detail.key === 'practice_records') {
        syncPracticeRecords();
        // }
    });
}

// ============================================================================
// Fallback Answer Normalization
// ============================================================================

function normalizeFallbackAnswerValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => normalizeFallbackAnswerValue(item))
            .filter(Boolean)
            .join(', ');
    }
    if (typeof value === 'object') {
        const preferKeys = ['value', 'label', 'text', 'answer', 'content'];
        for (const key of preferKeys) {
            if (typeof value[key] === 'string' && value[key].trim()) {
                return value[key].trim();
            }
        }
        if (typeof value.innerText === 'string' && value.innerText.trim()) {
            return value.innerText.trim();
        }
        if (typeof value.textContent === 'string' && value.textContent.trim()) {
            return value.textContent.trim();
        }
        try {
            const json = JSON.stringify(value);
            if (json && json !== '{}' && json !== '[]') {
                return json;
            }
        } catch (_) { }
        return String(value);
    }
    return String(value).trim();
}

function normalizeFallbackAnswerMap(rawAnswers) {
    const map = {};
    if (!rawAnswers) {
        return map;
    }
    if (Array.isArray(rawAnswers)) {
        rawAnswers.forEach((entry, index) => {
            if (!entry) return;
            const key = entry.questionId || `q${index + 1}`;
            map[key] = normalizeFallbackAnswerValue(entry.answer ?? entry.userAnswer ?? entry.value ?? entry);
        });
        return map;
    }
    Object.entries(rawAnswers).forEach(([rawKey, rawValue]) => {
        if (!rawKey) return;
        const key = rawKey.startsWith('q') ? rawKey : `q${rawKey}`;
        map[key] = normalizeFallbackAnswerValue(
            rawValue && typeof rawValue === 'object' && 'answer' in rawValue
                ? rawValue.answer
                : rawValue
        );
    });
    return map;
}

function buildFallbackAnswerDetails(answerMap = {}, correctMap = {}) {
    const details = {};
    const keys = new Set([
        ...Object.keys(answerMap || {}),
        ...Object.keys(correctMap || {})
    ]);
    keys.forEach((key) => {
        const userAnswer = normalizeFallbackAnswerValue(answerMap[key]);
        const correctAnswer = normalizeFallbackAnswerValue(correctMap[key]);
        let isCorrect = null;
        if (correctAnswer) {
            isCorrect = userAnswer && userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        }
        details[key] = {
            userAnswer: userAnswer || '-',
            correctAnswer: correctAnswer || '-',
            isCorrect
        };
    });
    return details;
}

function normalizeFallbackAnswerComparison(existingComparison, answerMap, correctMap) {
    const normalized = {};
    const source = existingComparison && typeof existingComparison === 'object' ? existingComparison : {};
    Object.entries(source).forEach(([questionId, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        normalized[questionId] = {
            questionId,
            userAnswer: normalizeFallbackAnswerValue(entry.userAnswer ?? entry.user ?? entry.answer),
            correctAnswer: normalizeFallbackAnswerValue(entry.correctAnswer ?? entry.correct),
            isCorrect: typeof entry.isCorrect === 'boolean' ? entry.isCorrect : null
        };
    });

    const mergedKeys = new Set([
        ...Object.keys(answerMap || {}),
        ...Object.keys(correctMap || {})
    ]);
    mergedKeys.forEach((key) => {
        if (normalized[key]) return;
        const userAnswer = normalizeFallbackAnswerValue(answerMap[key]);
        const correctAnswer = normalizeFallbackAnswerValue(correctMap[key]);
        let isCorrect = null;
        if (correctAnswer) {
            isCorrect = userAnswer && userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        }
        normalized[key] = {
            questionId: key,
            userAnswer: userAnswer || '',
            correctAnswer: correctAnswer || '',
            isCorrect
        };
    });

    return normalized;
}

// 降级保存：将 PRACTICE_COMPLETE 的真实数据写入 practice_records（与旧视图字段兼容）
async function savePracticeRecordFallback(examId, realData) {
    try {
        const list = getExamIndexState();
        let exam = list.find(e => e.id === examId) || {};

        // 如果通过 examId 找不到，尝试通过 URL 或标题匹配
        if (!exam.id && realData) {
            // 尝试通过 URL 匹配
            if (realData.url) {
                const urlPath = realData.url.toLowerCase();
                const urlMatch = list.find(e => {
                    if (!e.path) return false;
                    const itemPath = e.path.toLowerCase();
                    const urlParts = urlPath.split('/').filter(Boolean);
                    const pathParts = itemPath.split('/').filter(Boolean);

                    // 检查最后几个路径段是否匹配
                    for (let i = 0; i < Math.min(urlParts.length, pathParts.length); i++) {
                        if (urlParts[urlParts.length - 1 - i] === pathParts[pathParts.length - 1 - i]) {
                            return true;
                        }
                    }
                    return false;
                });
                if (urlMatch) {
                    exam = urlMatch;
                    console.log('[Fallback] 通过 URL 匹配到题目:', exam.id, exam.title);
                }
            }

            // 尝试通过标题匹配
            if (!exam.id && realData.title) {
                const normalizeTitle = (str) => {
                    if (!str) return '';
                    return String(str).trim().toLowerCase()
                        .replace(/^\[.*?\]\s*/, '')  // 移除标签前缀
                        .replace(/[^\w\s]/g, '')
                        .replace(/\s+/g, ' ');
                };
                const targetTitle = normalizeTitle(realData.title);
                const titleMatch = list.find(e => {
                    if (!e.title) return false;
                    const itemTitle = normalizeTitle(e.title);
                    return itemTitle === targetTitle ||
                        (targetTitle.length > 5 && itemTitle.includes(targetTitle)) ||
                        (itemTitle.length > 5 && targetTitle.includes(itemTitle));
                });
                if (titleMatch) {
                    exam = titleMatch;
                    console.log('[Fallback] 通过标题匹配到题目:', exam.id, exam.title);
                }
            }
        }

        const sInfo = realData && realData.scoreInfo ? realData.scoreInfo : {};
        const correct = typeof sInfo.correct === 'number' ? sInfo.correct : 0;
        const normalizedAnswers = normalizeFallbackAnswerMap(realData.answers);
        const normalizedCorrectMap = normalizeFallbackAnswerMap(realData.correctAnswers);
        const total = typeof sInfo.total === 'number' ? sInfo.total : Object.keys(normalizedCorrectMap).length || Object.keys(normalizedAnswers).length;
        let acc = typeof sInfo.accuracy === 'number' ? sInfo.accuracy : (total > 0 ? correct / total : 0);
        if (acc > 1 && acc <= 100) { acc = acc / 100; }
        const pct = typeof sInfo.percentage === 'number' && sInfo.percentage >= 0 && sInfo.percentage <= 100 ? sInfo.percentage : Math.round(acc * 100);

        const answerDetails = buildFallbackAnswerDetails(normalizedAnswers, normalizedCorrectMap);
        const answerComparison = normalizeFallbackAnswerComparison(realData.answerComparison, normalizedAnswers, normalizedCorrectMap);
        const scoreInfo = {
            correct,
            total,
            accuracy: acc,
            percentage: pct,
            details: answerDetails,
            source: sInfo.source || realData.source || 'fallback'
        };

        // 从多个来源提取 category
        let category = exam.category;
        if (!category && realData.pageType) {
            category = realData.pageType;  // 如 "P4"
        }
        if (!category && realData.url) {
            const match = realData.url.match(/\b(P[1-4])\b/i);
            if (match) category = match[1].toUpperCase();
        }
        if (!category && realData.title) {
            const match = realData.title.match(/\b(P[1-4])\b/i);
            if (match) category = match[1].toUpperCase();
        }
        if (!category) {
            category = 'Unknown';
        }

        const practiceCore = window.PracticeCore;
        if (practiceCore && practiceCore.ingestor && practiceCore.store) {
            const canonicalRecord = practiceCore.ingestor.fromCompletion(realData, {
                examId,
                examEntry: exam,
                metadata: {
                    examId,
                    examTitle: exam.title || realData.title || '',
                    category,
                    frequency: exam.frequency || realData.frequency || 'unknown',
                    type: exam.type || realData.type || null
                }
            }, exam, {
                currentVersion: (window.scoreStorage && window.scoreStorage.currentVersion) || '1.0.0'
            });

            if (!canonicalRecord) {
                return null;
            }

            await practiceCore.store.savePracticeRecord(canonicalRecord, {
                currentVersion: canonicalRecord.version || ((window.scoreStorage && window.scoreStorage.currentVersion) || '1.0.0'),
                maxRecords: (window.scoreStorage && window.scoreStorage.maxRecords) || 1000
            });
            console.log('[Fallback] 真实数据已通过 PracticeCore 保存');
            return canonicalRecord;
        }

        const record = {
            id: Date.now(),
            examId: examId,
            title: exam.title || realData.title || '',
            category: category,
            frequency: exam.frequency || 'unknown',
            realData: {
                score: correct,
                totalQuestions: total,
                accuracy: acc,
                percentage: pct,
                duration: realData.duration,
                answers: normalizedAnswers,
                correctAnswers: normalizedCorrectMap,
                interactions: realData.interactions || [],
                answerComparison,
                scoreInfo,
                isRealData: true,
                source: sInfo.source || 'fallback'
            },
            dataSource: 'real',
            date: new Date().toISOString(),
            sessionId: realData.sessionId,
            timestamp: Date.now(),
            // 兼容旧视图字段
            score: correct,
            correctAnswers: correct,
            totalQuestions: total,
            accuracy: acc,
            percentage: pct,
            answers: normalizedAnswers,
            answerDetails,
            correctAnswerMap: normalizedCorrectMap,
            answerComparison,
            scoreInfo,
            startTime: new Date((realData.startTime ?? (Date.now() - (realData.duration || 0) * 1000))).toISOString(),
            endTime: new Date((realData.endTime ?? Date.now())).toISOString()
        };

        if (window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.savePracticeRecord === 'function') {
            await window.PracticeCore.store.savePracticeRecord(record);
        } else if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.addPracticeRecord === 'function') {
            await window.simpleStorageWrapper.addPracticeRecord(record);
        } else {
            const records = await storage.get('practice_records', []);
            const arr = Array.isArray(records) ? records : [];
            arr.push(record);
            const practiceKey = ['practice', 'records'].join('_');
            await storage.set(practiceKey, arr);
        }
        console.log('[Fallback] 真实数据已保存到 practice_records');
    } catch (e) {
        console.error('[Fallback] 保存练习记录失败:', e);
    }
}

// ============================================================================
// Practice View
// ============================================================================

function refreshBulkDeleteButton() {
    const btn = document.getElementById('bulk-delete-btn');
    if (!btn) {
        return;
    }

    const mode = getBulkDeleteModeState();
    const selected = getSelectedRecordsState();
    const count = selected.size;

    if (mode) {
        btn.classList.remove('btn-info');
        btn.classList.add('btn-success');
        btn.textContent = count > 0 ? `✓ 完成选择 (${count})` : '✓ 完成选择';
    } else {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-info');
        btn.textContent = count > 0 ? `📝 批量删除 (${count})` : '📝 批量删除';
    }
}

function ensureBulkDeleteMode(options = {}) {
    const { silent = false } = options || {};
    if (getBulkDeleteModeState()) {
        return false;
    }

    setBulkDeleteModeState(true);
    if (!silent && typeof showMessage === 'function') {
        showMessage('批量管理模式已开启，点击记录进行选择', 'info');
    }
    refreshBulkDeleteButton();
    return true;
}

// Phase 3: 练习历史交互设置 - 保留在 main.js（依赖 DOM 事件委托，暂不迁移）
let practiceHistoryDelegatesConfigured = false;

function setupPracticeHistoryInteractions() {
    if (practiceHistoryDelegatesConfigured) {
        return;
    }

    const container = document.getElementById('practice-history-list') || document.getElementById('history-list');
    if (!container) {
        return;
    }

    const handleDetails = (recordId, event) => {
        if (!recordId) return;
        if (event) event.preventDefault();
        if (typeof showRecordDetails === 'function') {
            showRecordDetails(recordId);
        }
    };

    const handleDelete = (recordId, event) => {
        if (!recordId) return;
        if (event) event.preventDefault();
        if (typeof deleteRecord === 'function') {
            deleteRecord(recordId);
        }
    };

    const handleSelection = (recordId, event) => {
        if (!getBulkDeleteModeState() || !recordId) return;
        if (event) event.preventDefault();
        toggleRecordSelection(recordId);
    };

    const handleCheckbox = (recordId, event) => {
        if (!recordId) {
            return;
        }
        ensureBulkDeleteMode({ silent: true });
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        toggleRecordSelection(recordId);
    };

    const hasDomDelegate = typeof window !== 'undefined' && window.DOM && typeof window.DOM.delegate === 'function';

    if (hasDomDelegate) {
        window.DOM.delegate('click', '.practice-history-list [data-record-action="details"], #history-list [data-record-action="details"]', function (event) {
            handleDetails(this.dataset.recordId, event);
        });

        window.DOM.delegate('click', '.practice-history-list [data-record-action="delete"], #history-list [data-record-action="delete"]', function (event) {
            handleDelete(this.dataset.recordId, event);
        });

        window.DOM.delegate('click', '.practice-history-list .history-item, #history-list .history-item', function (event) {
            const actionTarget = event.target.closest('[data-record-action]');
            if (actionTarget) return;
            if (event.target && event.target.matches('input[data-record-id]')) {
                return;
            }
            handleSelection(this.dataset.recordId, event);
        });

        window.DOM.delegate('change', '.practice-history-list input[data-record-id], #history-list input[data-record-id]', function (event) {
            handleCheckbox(this.dataset.recordId, event);
        });
    } else {
        container.addEventListener('click', (event) => {
            const detailsTarget = event.target.closest('[data-record-action="details"]');
            if (detailsTarget && container.contains(detailsTarget)) {
                handleDetails(detailsTarget.dataset.recordId, event);
                return;
            }

            const deleteTarget = event.target.closest('[data-record-action="delete"]');
            if (deleteTarget && container.contains(deleteTarget)) {
                handleDelete(deleteTarget.dataset.recordId, event);
                return;
            }

            const item = event.target.closest('.history-item');
            if (item && container.contains(item)) {
                const actionTarget = event.target.closest('[data-record-action]');
                if (actionTarget || (event.target && event.target.matches('input[data-record-id]'))) {
                    return;
                }
                handleSelection(item.dataset.recordId, event);
            }
        });

        container.addEventListener('change', (event) => {
            const checkbox = event.target.closest('input[data-record-id]');
            if (!checkbox || !container.contains(checkbox)) {
                return;
            }
            handleCheckbox(checkbox.dataset.recordId, event);
        });
    }

    practiceHistoryDelegatesConfigured = true;
}

function normalizeRecordType(value) {
    if (!value) {
        return '';
    }
    const normalized = String(value).toLowerCase();
    if (normalized.includes('read') || normalized.includes('阅读')) {
        return 'reading';
    }
    if (normalized.includes('listen') || normalized.includes('听力')) {
        return 'listening';
    }
    return normalized;
}

function recordMatchesExamType(record, targetType, examIndex) {
    const normalizedTarget = normalizeRecordType(targetType);
    if (!normalizedTarget || normalizedTarget === 'all') {
        return true;
    }
    if (!record) {
        return false;
    }

    const recordType = normalizeRecordType(
        record.type ||
        record.examType ||
        record.metadata?.type ||
        record.realData?.type
    );
    if (recordType) {
        return recordType === normalizedTarget;
    }

    const list = Array.isArray(examIndex) ? examIndex : [];
    const exam = list.find((e) => e && (e.id === record.examId || e.title === record.title));
    const examType = normalizeRecordType(exam && exam.type);
    if (examType) {
        return examType === normalizedTarget;
    }

    // 保底保留，避免题库切换导致无法映射类型时练习记录消失
    return true;
}

// Phase 3: 练习记录视图更新 - 保留在 main.js（依赖多个组件，暂不迁移）
function updatePracticeView() {
    const rawRecords = getPracticeRecordsState();
    const records = rawRecords.filter((record) => record && (record.dataSource === 'real' || record.dataSource === undefined));

    const stats = window.PracticeStats;
    const summary = stats && typeof stats.calculateSummary === 'function'
        ? stats.calculateSummary(records)
        : computePracticeSummaryFallback(records);

    const dashboard = ensurePracticeDashboardView();
    if (dashboard) {
        dashboard.updateSummary(summary);
    } else {
        applyPracticeSummaryFallback(summary);
    }

    // --- 3. Filter and Render History List ---
    const historyContainer = document.getElementById('practice-history-list') || document.getElementById('history-list');
    if (!historyContainer) {
        return;
    }

    setupPracticeHistoryInteractions();

    let recordsToShow = stats && typeof stats.sortByDateDesc === 'function'
        ? stats.sortByDateDesc(records)
        : records.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    const examType = getCurrentExamType();
    if (examType !== 'all') {
        if (stats && typeof stats.filterByExamType === 'function') {
            recordsToShow = stats.filterByExamType(recordsToShow, getExamIndexState(), examType);
        } else {
            const examIndexSnapshot = getExamIndexState();
            recordsToShow = recordsToShow.filter((record) => recordMatchesExamType(record, examType, examIndexSnapshot));
        }
    }

    const historyQuery = String(window.__practiceHistoryQuery || '').trim().toLowerCase();
    if (historyQuery) {
        recordsToShow = recordsToShow.filter((record) => {
            if (!record) {
                return false;
            }
            const fields = [
                record.title,
                record.examId,
                record.category,
                record.frequency,
                record.metadata && record.metadata.examTitle,
                record.metadata && record.metadata.category,
                record.date
            ];
            return fields.some((field) => String(field || '').toLowerCase().includes(historyQuery));
        });
    }

    // --- 4. Render history list ---
    const renderer = window.PracticeHistoryRenderer;
    if (!renderer) {
        console.warn('[PracticeHistory] Renderer 未加载，跳过渲染');
        return;
    }

    const renderResult = typeof renderer.renderView === 'function'
        ? renderer.renderView({
            container: historyContainer,
            records: recordsToShow,
            bulkDeleteMode: getBulkDeleteModeState(),
            selectedRecords: getSelectedRecordsState(),
            scrollerOptions: { itemHeight: 100, containerHeight: 650 },
            scroller: practiceListScroller
        })
        : null;
    if (renderResult && renderResult.scroller !== undefined) {
        practiceListScroller = renderResult.scroller;
    }
    refreshBulkDeleteButton();
}

function searchPracticeHistory(query) {
    window.__practiceHistoryQuery = String(query || '').trim();
    const clearButton = document.getElementById('history-search-clear-btn');
    if (clearButton) {
        clearButton.hidden = window.__practiceHistoryQuery.length === 0;
    }
    updatePracticeView();
}

function clearPracticeHistorySearch() {
    const input = document.getElementById('history-search-input');
    if (input) {
        input.value = '';
        try {
            input.focus();
        } catch (_) { }
    }
    searchPracticeHistory('');
}

function refreshBrowseProgressFromRecords(recordsOverride = null) {
    try {
        const records = Array.isArray(recordsOverride)
            ? recordsOverride
            : (typeof getPracticeRecordsState === 'function'
                ? getPracticeRecordsState()
                : (Array.isArray(window.practiceRecords) ? window.practiceRecords : []));
        if (typeof updateBrowseAnchorsFromRecords === 'function') {
            updateBrowseAnchorsFromRecords(records);
        }
        const browseView = document.getElementById('browse-view');
        const isBrowseActive = browseView && browseView.classList.contains('active');
        if (isBrowseActive && typeof loadExamList === 'function') {
            loadExamList();
        }
    } catch (error) {
        console.warn('[Browse] 刷新浏览进度失败:', error);
    }
}

let practiceSessionEventBound = false;
function ensurePracticeSessionSyncListener() {
    if (practiceSessionEventBound) {
        return;
    }
    practiceSessionEventBound = true;
    document.addEventListener('practiceSessionCompleted', (event) => {
        try {
            const detail = event && event.detail ? event.detail : {};
            let record = detail.practiceRecord;
            if (record && typeof record === 'object') {
                record = enrichPracticeRecordForUI(record);
                const current = getPracticeRecordsState();
                const filtered = Array.isArray(current)
                    ? current.filter((item) => item && item.id !== record.id)
                    : [];
                setPracticeRecordsState([record, ...filtered]);
                updatePracticeView();
                refreshBrowseProgressFromRecords([record, ...filtered]);
            }
        } catch (syncError) {
            console.warn('[PracticeView] practiceSessionCompleted 事件处理失败:', syncError);
        } finally {
            // 仍然执行一次全面同步，确保 ScoreStorage/StorageRepo 状态一致
            setTimeout(() => {
                try { syncPracticeRecords(); } catch (_) { }
            }, 200);
        }
    });
}

// Phase 3: 练习统计计算 - 保留在 main.js（数据处理逻辑，暂不迁移）
function computePracticeSummaryFallback(records) {
    const normalized = Array.isArray(records) ? records : [];
    const totalPracticed = normalized.length;
    let totalScore = 0;
    let totalDuration = 0;
    const dateStrings = [];

    normalized.forEach((record) => {
        if (!record) {
            return;
        }
        const percentage = typeof record.percentage === 'number' ? record.percentage : (typeof record.accuracy === 'number' ? Math.round(record.accuracy * 100) : 0);
        const duration = typeof record.duration === 'number' ? record.duration : 0;
        totalScore += percentage;
        totalDuration += duration;

        if (record.date) {
            const time = new Date(record.date);
            if (!Number.isNaN(time.getTime())) {
                dateStrings.push(time.toDateString());
            }
        }
    });

    const uniqueDates = Array.from(new Set(dateStrings)).sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    if (uniqueDates.length > 0) {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const firstDate = new Date(uniqueDates[0]);
        if (firstDate.toDateString() === today.toDateString() || firstDate.toDateString() === yesterday.toDateString()) {
            streak = 1;
            for (let i = 0; i < uniqueDates.length - 1; i += 1) {
                const currentDay = new Date(uniqueDates[i]);
                const nextDay = new Date(uniqueDates[i + 1]);
                const diffTime = currentDay - nextDay;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    streak += 1;
                } else {
                    break;
                }
            }
        }
    }

    return {
        totalPracticed,
        averageScore: totalPracticed > 0 ? totalScore / totalPracticed : 0,
        totalStudyMinutes: totalDuration / 60,
        streak
    };
}

// Phase 3: 应用练习统计 - 保留在 main.js（DOM 操作，暂不迁移）
function applyPracticeSummaryFallback(summary) {
    if (!summary || typeof document === 'undefined') {
        return;
    }

    const totalEl = document.getElementById('total-practiced');
    if (totalEl) {
        totalEl.textContent = typeof summary.totalPracticed === 'number' ? summary.totalPracticed : 0;
    }

    const avgEl = document.getElementById('avg-score');
    if (avgEl) {
        const avg = typeof summary.averageScore === 'number' ? summary.averageScore : 0;
        avgEl.textContent = `${avg.toFixed(1)}%`;
    }

    const timeEl = document.getElementById('study-time');
    if (timeEl) {
        const minutes = typeof summary.totalStudyMinutes === 'number' ? summary.totalStudyMinutes : 0;
        timeEl.textContent = Math.round(minutes).toString();
    }

    const streakEl = document.getElementById('streak-days');
    if (streakEl) {
        streakEl.textContent = typeof summary.streak === 'number' ? summary.streak : 0;
    }
}

// ============================================================================
// Bulk Operations
// ============================================================================

async function toggleBulkDelete() {
    const nextMode = !getBulkDeleteModeState();
    setBulkDeleteModeState(nextMode);
    if (nextMode) {
        clearSelectedRecordsState();
        refreshBulkDeleteButton();
        if (typeof showMessage === 'function') {
            showMessage('批量管理模式已开启，点击记录进行选择', 'info');
        }
        updatePracticeView();
        return;
    }

    refreshBulkDeleteButton();
    const selected = getSelectedRecordsState();
    if (selected.size > 0) {
        const confirmMessage = `确定要删除选中的 ${selected.size} 条记录吗？此操作不可恢复。`;
        if (confirm(confirmMessage)) {
            try {
                await bulkDeleteRecords(selected);
            } catch (error) {
                console.error('[System] 批量删除失败:', error);
                showMessage('批量删除失败：' + (error && error.message ? error.message : '未知错误'), 'error');
            }
        }
    }

    clearSelectedRecordsState();
    refreshBulkDeleteButton();
    updatePracticeView();
}

async function bulkDeleteRecords(selectedSnapshot = getSelectedRecordsState()) {
    const normalizedIds = Array.from(selectedSnapshot, (id) => normalizeRecordId(id)).filter(Boolean);
    if (normalizedIds.length === 0) {
        showMessage('请选择要删除的记录', 'warning');
        return;
    }

    const records = await listCanonicalPracticeRecords();
    const baseList = Array.isArray(records) ? records : [];
    const recordsToKeep = baseList.filter(record => !normalizedIds.includes(normalizeRecordId(record && record.id)));

    const deletedCount = baseList.length - recordsToKeep.length;
    if (deletedCount === 0) {
        showMessage('未找到可删除的记录', 'warning');
        return;
    }

    await persistPracticeRecordsAndRefresh(recordsToKeep, 'bulk-delete');

    showMessage(`已删除 ${deletedCount} 条记录`, 'success');
    console.log(`[System] 批量删除了 ${deletedCount} 条练习记录`);
}

function toggleRecordSelection(recordId) {
    if (!getBulkDeleteModeState()) return;

    const normalizedId = normalizeRecordId(recordId);
    if (!normalizedId) {
        return;
    }

    const selected = getSelectedRecordsState();
    if (selected.has(normalizedId)) {
        removeSelectedRecordState(normalizedId);
    } else {
        addSelectedRecordState(normalizedId);
    }
    updatePracticeView(); // Re-render to show selection state
}


async function deleteRecord(recordId) {
    if (!recordId) {
        showMessage('记录ID无效', 'error');
        return;
    }

    const records = await listCanonicalPracticeRecords();
    const recordIndex = records.findIndex(record => String(record.id) === String(recordId));

    if (recordIndex === -1) {
        showMessage('未找到记录', 'error');
        return;
    }

    const record = records[recordIndex];
    const confirmMessage = `确定要删除这条练习记录吗？\n\n题目: ${record.title}\n时间: ${new Date(record.date).toLocaleString()}\n\n此操作不可恢复。`;

    if (confirm(confirmMessage)) {
        const nextRecords = records.filter((record) => String(record.id) !== String(recordId));
        await persistPracticeRecordsAndRefresh(nextRecords, 'single-delete');
        showMessage('记录已删除', 'success');
    }
}

async function clearPracticeData() {
    if (confirm('确定要清除所有练习记录吗？此操作不可恢复。')) {
        await persistPracticeRecordsAndRefresh([], 'clear-all');
        processedSessions.clear();
        clearSelectedRecordsState();
        setBulkDeleteModeState(false);
        refreshBulkDeleteButton();
        showMessage('练习记录已清除', 'success');
    }
}

async function clearCache() {
    const confirmMessage = '确定要清除所有缓存数据并清空练习记录吗？';
    if (!confirm(confirmMessage)) {
        return;
    }

    const localLegacyKeys = [
        'exam_system_practice_records',
        'upgrade_v1_1_0_cleanup_done',
        'browse_state',
        'hasSeenGplLicense',
        'theme',
        'bloom-theme-mode',
        'blue-theme-mode',
        'hp.theme'
    ];
    const sessionLegacyKeys = ['hp.portal.pendingView'];

    try {
        if (window.storage && typeof storage.clear === 'function') {
            await storage.clear();
        } else if (window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.replacePracticeRecords === 'function') {
            await window.PracticeCore.store.replacePracticeRecords([]);
        } else if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.savePracticeRecords === 'function') {
            await window.simpleStorageWrapper.savePracticeRecords([]);
        } else if (window.storage && typeof storage.set === 'function') {
            const practiceKey = ['practice', 'records'].join('_');
            await storage.set(practiceKey, []);
        }
    } catch (error) {
        console.warn('[clearCache] failed to clear managed storage:', error);
    }

    localLegacyKeys.forEach((key) => {
        try { localStorage.removeItem(key); } catch (_) { }
    });
    sessionLegacyKeys.forEach((key) => {
        try { sessionStorage.removeItem(key); } catch (_) { }
    });

    setPracticeRecordsState([]);
    processedSessions.clear();
    if (window.performanceOptimizer && typeof window.performanceOptimizer.cleanup === 'function') {
        window.performanceOptimizer.cleanup();
    }

    showMessage('缓存与练习记录已清除', 'success');
    setTimeout(() => { location.reload(); }, 1000);
}
