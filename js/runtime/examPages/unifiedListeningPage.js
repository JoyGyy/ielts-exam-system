(function initUnifiedListeningPage(global) {
    'use strict';

    const MESSAGE_SOURCE = 'practice_page';
    const INIT_RETRY_MS = 1500;

    function getAnswerMatchCore() {
        const core = global.AnswerMatchCore;
        if (!core || typeof core !== 'object') return null;
        return core;
    }

    /* ========== State ========== */
    const state = {
        examId: null,
        dataKey: null,
        sessionId: null,
        readOnly: false,
        submitted: false,
        dataset: null,
        ready: false,
        parentWindow: global.opener || global.parent || null,
        timerInterval: null,
        timerSeconds: 0,
        transcriptHighlightTimer: null,
        localStorageKey: null,
    };

    const dom = {
        title: null,
        subtitle: null,
        questionsContent: null,
        transcriptPanel: null,
        transcriptContent: null,
        audio: null,
        playPauseBtn: null,
        progressBar: null,
        progressContainer: null,
        timeDisplay: null,
        speedSelect: null,
        questionNav: null,
        submitBtn: null,
        resetBtn: null,
        exitBtn: null,
        results: null,
        timer: null,
        transcriptToggle: null,
    };

    /* ========== Utility ========== */
    function parseQuery() {
        const params = new URLSearchParams(global.location.search);
        state.examId = params.get('examId') || '';
        state.dataKey = params.get('dataKey') || state.examId;
    }

    function captureDom() {
        dom.title = document.getElementById('exam-title');
        dom.subtitle = document.getElementById('exam-subtitle');
        dom.questionsContent = document.getElementById('questions-content');
        dom.transcriptPanel = document.getElementById('transcript-panel');
        dom.transcriptContent = document.getElementById('transcript-content');
        dom.audio = document.getElementById('listening-audio');
        dom.playPauseBtn = document.getElementById('play-pause-btn');
        dom.progressBar = document.getElementById('progress-bar');
        dom.progressContainer = document.getElementById('progress-container');
        dom.timeDisplay = document.getElementById('time-display');
        dom.speedSelect = document.getElementById('playback-speed');
        dom.questionNav = document.getElementById('question-nav');
        dom.submitBtn = document.getElementById('submit-btn');
        dom.resetBtn = document.getElementById('reset-btn');
        dom.exitBtn = document.getElementById('exit-btn');
        dom.results = document.getElementById('results');
        dom.timer = document.getElementById('timer');
        dom.transcriptToggle = document.getElementById('transcript-toggle');
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    /* ========== Data Loading ========== */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function ensureManifest() {
        if (global.__LISTENING_EXAM_MANIFEST__) return;
        try {
            await loadScript('./manifest.js');
        } catch (_) {
            // ignore
        }
    }

    async function ensureDataset() {
        if (state.dataset) return state.dataset;
        await ensureManifest();
        const manifest = global.__LISTENING_EXAM_MANIFEST__;
        const entry = manifest && manifest[state.dataKey || state.examId];
        if (!entry || !entry.script) {
            console.error('[Listening] No manifest entry for', state.dataKey || state.examId, 'manifest exists:', !!manifest);
            return null;
        }
        const scriptUrl = entry.script.startsWith('.') || entry.script.startsWith('/')
            ? entry.script
            : './' + entry.script;
        try {
            await loadScript(scriptUrl);
        } catch (loadErr) {
            console.error('[Listening] Failed to load exam script:', scriptUrl, loadErr);
        }
        const registry = global.__LISTENING_EXAM_DATA__;
        if (!registry || typeof registry.get !== 'function') {
            console.error('[Listening] Registry not available, __LISTENING_EXAM_DATA__:', typeof global.__LISTENING_EXAM_DATA__);
            return null;
        }
        state.dataset = registry.get(state.dataKey || state.examId);
        if (!state.dataset) {
            console.error('[Listening] Dataset not found in registry for key:', state.dataKey || state.examId);
        }
        return state.dataset;
    }

    /* ========== Rendering ========== */
    function renderDataset(dataset) {
        if (!dataset) return;
        const meta = dataset.meta || {};
        if (dom.title) dom.title.textContent = meta.title || 'IELTS Listening';
        if (dom.subtitle) dom.subtitle.textContent = `P${(meta.category || '').replace('P', '')} · ${meta.frequency || ''}`;

        // Set audio source
        if (!dom.audio) {
            console.warn('[Listening] Audio element not found in DOM');
        } else if (!meta.audioSrc) {
            console.warn('[Listening] No audioSrc in meta for', state.examId, meta);
        } else {
            try {
                const resolvedUrl = new URL(meta.audioSrc, window.location.href).href;
                dom.audio.src = resolvedUrl;
                console.log('[Listening] Audio src:', resolvedUrl);
            } catch (_) {
                dom.audio.src = meta.audioSrc;
                console.log('[Listening] Audio src (raw):', meta.audioSrc);
            }
            dom.audio.addEventListener('error', (e) => {
                console.error('[Listening] Audio error:', dom.audio.error?.code, dom.audio.error?.message, dom.audio.src);
            }, { once: true });
        }

        // Render questions
        if (dom.questionsContent && dataset.questionsPageHtml) {
            dom.questionsContent.innerHTML = dataset.questionsPageHtml;
        }

        // Render transcript
        renderTranscript(dataset.transcriptLines);

        // Attach audio events
        attachAudioEvents();
    }

    const transcriptCache = [];

// 1. 添加 escapeHtml
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}





    function renderTranscript(lines) {
        if (!dom.transcriptContent || !Array.isArray(lines)) return;
        transcriptCache.length = 0;
        const html = lines.map((line, i) => {
            const [start, end, text] = line;
            transcriptCache.push({ start: parseTimeString(start), end: parseTimeString(end) });
            // If text contains answer-highlight spans, render as HTML (already sanitized by data source)
            const safeText = text.includes('answer-highlight') ? text : escapeHtml(text);
            return `<div class="transcript-line" data-index="${i}">
                <span class="time">${start}</span>${safeText}
            </div>`;
        }).join('');
        dom.transcriptContent.innerHTML = html;
    }

    function highlightAnswersInTranscript() {
        if (!dom.transcriptContent) return;
        const lines = dom.transcriptContent.querySelectorAll('.transcript-line');
        lines.forEach(line => {
            const html = line.innerHTML;
            if (html.includes('answer-highlight')) {
                line.classList.add('answer-line');
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    /* ========== Audio Player ========== */
    function attachAudioEvents() {
        if (!dom.audio) return;

        dom.audio.addEventListener('timeupdate', () => {
            if (!dom.audio.duration) return;
            const pct = (dom.audio.currentTime / dom.audio.duration) * 100;
            if (dom.progressBar) dom.progressBar.style.width = pct + '%';
            if (dom.timeDisplay) {
                dom.timeDisplay.textContent = formatTime(dom.audio.currentTime) + ' / ' + formatTime(dom.audio.duration);
            }
            highlightTranscriptLine(dom.audio.currentTime);
        });

        dom.audio.addEventListener('ended', () => {
            if (dom.playPauseBtn) dom.playPauseBtn.innerHTML = '&#9658;';
        });

        if (dom.playPauseBtn) {
            dom.playPauseBtn.addEventListener('click', () => {
                console.log("启动了")
                if (dom.audio.paused) {
                    console.log('[Listening] Play clicked, src:', dom.audio.src, 'readyState:', dom.audio.readyState, 'networkState:', dom.audio.networkState);
                    dom.audio.play().catch(err => {
                        console.error('[Listening] Play failed:', err.message, 'src:', dom.audio.src);
                    });
                    dom.playPauseBtn.innerHTML = '&#10074;&#10074;';
                } else {
                    dom.audio.pause();
                    dom.playPauseBtn.innerHTML = '&#9658;';
                }
            });
        }

        if (dom.progressContainer) {
            dom.progressContainer.addEventListener('click', (e) => {
                if (!dom.audio.duration) return;
                const rect = dom.progressContainer.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                dom.audio.currentTime = pct * dom.audio.duration;
            });
        }

        if (dom.speedSelect) {
            dom.speedSelect.addEventListener('change', () => {
                dom.audio.playbackRate = parseFloat(dom.speedSelect.value) || 1.0;
            });
        }
    }

    let lastActiveTranscriptIdx = -1;

    function highlightTranscriptLine(currentTime) {
        if (!dom.transcriptContent || !transcriptCache.length) return;
        let newIdx = -1;
        for (let i = 0; i < transcriptCache.length; i++) {
            if (currentTime >= transcriptCache[i].start && currentTime < transcriptCache[i].end) {
                newIdx = i;
                break;
            }
        }
        if (newIdx === lastActiveTranscriptIdx) return;
        const lines = dom.transcriptContent.children;
        if (lastActiveTranscriptIdx >= 0 && lastActiveTranscriptIdx < lines.length) {
            lines[lastActiveTranscriptIdx].classList.remove('active');
        }
        if (newIdx >= 0 && newIdx < lines.length) {
            lines[newIdx].classList.add('active');
            lines[newIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        lastActiveTranscriptIdx = newIdx;
    }

    function parseTimeString(str) {
        if (!str) return 0;
        // Support "00:00" and "00:00:00,000" formats
        const parts = str.replace(',', '.').split(':');
        if (parts.length === 3) {
            return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        }
        if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        return 0;
    }

    /* ========== Question Navigation ========== */
    function buildQuestionNav() {
        if (!dom.questionNav || !state.dataset) return;
        const questionList = state.dataset.questionList || [];
        dom.questionNav.innerHTML = questionList.map(q =>
            `<button type="button" data-q="${q}">${q}</button>`
        ).join('');
        dom.questionNav.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = btn.dataset.q;
                const el = document.querySelector(`[data-q="${q}"]`) || document.querySelector(`[name="q${q}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    }

    function updateNavStatuses(results) {
        if (!dom.questionNav || !results) return;
        const details = results.scoreInfo?.details || {};
        dom.questionNav.querySelectorAll('button').forEach(btn => {
            const q = btn.dataset.q;
            const qKey = 'q' + q;
            const detail = details[qKey];
            if (!detail) return;
            btn.classList.remove('answered', 'correct', 'incorrect');
            if (detail.isCorrect) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('incorrect');
            }
        });
    }

    function updateNavOnInput() {
        if (!dom.questionNav) return;
        const answers = collectAnswers();
        dom.questionNav.querySelectorAll('button').forEach(btn => {
            const q = btn.dataset.q;
            const qKey = 'q' + q;
            if (answers[qKey] && !btn.classList.contains('correct') && !btn.classList.contains('incorrect')) {
                btn.classList.add('answered');
            } else if (!answers[qKey]) {
                btn.classList.remove('answered');
            }
        });
    }

    /* ========== Answer Collection ========== */
    function collectAnswers() {
        if (!state.dataset) return {};
        const answers = {};
        const answerKey = state.dataset.answerKey || {};
        const questionList = state.dataset.questionList || [];

        questionList.forEach(qNum => {
            const qKey = 'q' + qNum;
            // Determine question type from answerKey
            if (answerKey.text && answerKey.text[qKey] !== undefined) {
                // Fill-in-blank
                const input = document.querySelector(`input[name="${qKey}"]`);
                answers[qKey] = input ? input.value.trim() : '';
            } else if (answerKey.single && answerKey.single[qKey] !== undefined) {
                // Single choice (radio)
                const checked = document.querySelector(`input[type="radio"][name="${qKey}"]:checked`);
                answers[qKey] = checked ? checked.value : '';
            } else if (answerKey.multiple && answerKey.multiple[qKey] !== undefined) {
                // Multiple choice (checkbox)
                const checked = document.querySelectorAll(`input[type="checkbox"][name="${qKey}"]:checked`);
                answers[qKey] = Array.from(checked).map(c => c.value).sort().join(',');
            } else if ((answerKey.matching && answerKey.matching[qKey] !== undefined) ||
                       (answerKey.flowChart && answerKey.flowChart[qKey] !== undefined)) {
                const select = document.querySelector(`select[name="${qKey}"]`);
                if (select) {
                    answers[qKey] = select.value;
                } else {
                    const slot = document.querySelector(`.match-slot[data-q="${qKey}"]`);
                    answers[qKey] = slot ? (slot.textContent.trim() || slot.dataset.value || '') : '';
                }
            }
        });

        return answers;
    }

    /* ========== Grading ========== */
    function compareAnswers(userAnswer, correctAnswer) {
        const core = getAnswerMatchCore();
        if (core && typeof core.compareAnswers === 'function') {
            return core.compareAnswers(userAnswer, correctAnswer);
        }
        // Fallback: normalize and compare
        const normalize = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalize(userAnswer) === normalize(correctAnswer);
    }

    function buildResults() {
        const answers = collectAnswers();
        const answerKey = state.dataset?.answerKey || {};
        const questionList = state.dataset?.questionList || [];
        const answerComparison = {};
        let correctCount = 0;
        let totalQuestions = 0;

        const flatAnswerKey = {};
        if (answerKey.text) Object.assign(flatAnswerKey, answerKey.text);
        if (answerKey.single) Object.assign(flatAnswerKey, answerKey.single);
        if (answerKey.multiple) Object.assign(flatAnswerKey, answerKey.multiple);
        if (answerKey.matching) Object.assign(flatAnswerKey, answerKey.matching);
        if (answerKey.flowChart) Object.assign(flatAnswerKey, answerKey.flowChart);

        questionList.forEach(qNum => {
            const qKey = 'q' + qNum;
            const userAnswer = answers[qKey] || '';
            const correctAnswer = flatAnswerKey[qKey];
            if (correctAnswer === undefined) return;
            totalQuestions++;
            const isCorrect = compareAnswers(userAnswer, correctAnswer);
            if (isCorrect) correctCount++;
            answerComparison[qKey] = { questionId: qKey, userAnswer, correctAnswer, isCorrect };
        });

        const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;
        return {
            answers,
            answerComparison,
            correctAnswers: flatAnswerKey,
            scoreInfo: {
                correct: correctCount,
                total: totalQuestions,
                totalQuestions: totalQuestions,
                accuracy,
                percentage: Math.round(accuracy * 100),
                details: answerComparison,
                source: 'unified_listening_page'
            }
        };
    }

    function renderResults(results) {
        if (!dom.results) return;
        const rows = Object.values(results.answerComparison).map(entry => {
            const qNum = entry.questionId.replace('q', '');
            const userAnswer = entry.userAnswer || '未作答';
            const correctAnswer = Array.isArray(entry.correctAnswer) ? entry.correctAnswer.join(', ') : entry.correctAnswer;
            const status = entry.isCorrect ? '✓' : '✗';
            const cls = entry.isCorrect ? 'correct' : 'incorrect';
            return `<tr><td>${qNum}</td><td class="${cls}">${escapeHtml(userAnswer)}</td><td>${escapeHtml(String(correctAnswer))}</td><td class="${cls}">${status}</td></tr>`;
        }).join('');

        dom.results.innerHTML = `
            <h3 style="margin-bottom: 10px;">练习结果</h3>
            <p style="margin-bottom: 12px;">得分 ${results.scoreInfo.correct} / ${results.scoreInfo.totalQuestions} · ${results.scoreInfo.percentage}%</p>
            <table class="results-table">
                <thead><tr><th>题号</th><th>你的答案</th><th>正确答案</th><th>结果</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    /* ========== Highlight & Notes ========== */
    function attachSelectionToolbar() {
        const selbar = document.getElementById('selbar');
        if (!selbar) return;

        document.addEventListener('mouseup', (e) => {
            const sel = global.getSelection();
            const text = sel ? sel.toString().trim() : '';
            if (!text || selbar.contains(e.target)) {
                selbar.style.display = 'none';
                return;
            }
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            selbar.style.display = 'flex';
            selbar.style.left = (rect.left + rect.width / 2 - selbar.offsetWidth / 2) + 'px';
            selbar.style.top = (rect.top - selbar.offsetHeight - 6 + window.scrollY) + 'px';
        });

        document.addEventListener('mousedown', (e) => {
            if (!selbar.contains(e.target)) {
                selbar.style.display = 'none';
            }
        });

        selbar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const role = btn.dataset.role;
                if (role === 'highlight') {
                    applyHighlight();
                } else if (role === 'remove-highlight') {
                    removeHighlight();
                }
                selbar.style.display = 'none';
            });
        });
    }

    function applyHighlight() {
        const sel = global.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.style.background = '#fef08a';
        mark.style.borderRadius = '2px';
        try {
            range.surroundContents(mark);
        } catch (_) {
            // ignore complex selections
        }
        sel.removeAllRanges();
    }

    function removeHighlight() {
        const sel = global.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const mark = node.closest ? node.closest('mark') : null;
        if (mark) {
            const parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
        }
        sel.removeAllRanges();
    }

    /* ========== Matching (click-to-select) ========== */
    function attachMatchingHandlers() {
        if (!state.dataset) return;
        const answerKey = state.dataset.answerKey || {};

        // Collect all matching options
        document.querySelectorAll('.drag-option').forEach(option => {
            option.addEventListener('click', () => {
                // Find the first empty match-slot
                const pool = option.closest('.drag-pool');
                if (!pool) return;
                const container = pool.closest('.matching-options')?.parentElement;
                if (!container) return;
                const slots = container.querySelectorAll('.match-slot');
                for (const slot of slots) {
                    if (!slot.dataset.value) {
                        slot.dataset.value = option.dataset.value;
                        slot.textContent = option.textContent;
                        slot.classList.add('filled');
                        updateNavOnInput();
                        return;
                    }
                }
            });
        });

        // Click slot to clear
        document.querySelectorAll('.match-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                if (slot.dataset.value) {
                    delete slot.dataset.value;
                    slot.textContent = '';
                    slot.classList.remove('filled');
                    updateNavOnInput();
                }
            });
        });
    }

    /* ========== State Persistence ========== */
    function saveState() {
        if (!state.localStorageKey) return;
        try {
            const data = {
                answers: collectAnswers(),
                timerSeconds: state.timerSeconds,
            };
            localStorage.setItem(state.localStorageKey, JSON.stringify(data));
        } catch (_) {
            // ignore
        }
    }

    function loadState() {
        if (!state.localStorageKey) return;
        try {
            const raw = localStorage.getItem(state.localStorageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.answers) {
                Object.entries(data.answers).forEach(([qKey, value]) => {
                    // Fill-in-blank
                    const input = document.querySelector(`input[name="${qKey}"]`);
                    if (input && input.type === 'text') {
                        input.value = value;
                        return;
                    }
                    // Radio
                    const radio = document.querySelector(`input[type="radio"][name="${qKey}"][value="${value}"]`);
                    if (radio) {
                        radio.checked = true;
                        return;
                    }
                    // Select
                    const select = document.querySelector(`select[name="${qKey}"]`);
                    if (select) {
                        select.value = value;
                    }
                });
            }
            if (data.timerSeconds) {
                state.timerSeconds = data.timerSeconds;
                renderTimer();
            }
        } catch (_) {
            // ignore
        }
    }

    /* ========== Timer ========== */
    function startTimer() {
        if (state.timerInterval) return;
        state.timerInterval = setInterval(() => {
            state.timerSeconds++;
            renderTimer();
            if (state.timerSeconds % 30 === 0) saveState();
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function renderTimer() {
        if (dom.timer) dom.timer.textContent = formatTime(state.timerSeconds);
    }

    /* ========== Message Protocol ========== */
    function postMessage(type, payload) {
        const envelope = { type, source: MESSAGE_SOURCE, data: payload || {} };
        const candidates = [global.opener, state.parentWindow, global.parent];
        const visited = new Set();
        for (const target of candidates) {
            if (!target || target === global || visited.has(target)) continue;
            visited.add(target);
            try {
                target.postMessage(envelope, '*');
                state.parentWindow = target;
                return;
            } catch (_) {
                // try next
            }
        }
    }

    function sendSessionReady() {
        postMessage('SESSION_READY', {
            url: global.location.href,
            pageType: 'unified-listening',
            title: state.dataset?.meta?.title || document.title,
            reviewMode: false,
            readOnly: state.readOnly,
        });
        state.ready = true;
    }

    function handleIncoming(event) {
        const payload = event?.data;
        if (!payload || typeof payload !== 'object') return;
        const type = String(payload.type || payload.action || '').toUpperCase();
        const data = payload.data || {};

        if (type === 'INIT_SESSION' || type === 'INIT_EXAM_SESSION') {
            if (data.examId) state.examId = data.examId;
            if (data.sessionId) state.sessionId = data.sessionId;
            bootstrap();
        }

        if (type === 'EXIT_SESSION' || type === 'SUITE_FORCE_CLOSE') {
            try { global.close(); } catch (_) {}
        }
    }

    /* ========== Submit ========== */
    async function handleSubmit() {
        if (state.readOnly || state.submitted) return;

        const results = buildResults();
        renderResults(results);
        highlightAnswersInTranscript();

        if (typeof SpellingErrorCollector !== 'undefined'&& typeof SpellingErrorCollector === 'function') {
            const collector = new SpellingErrorCollector();
            const answerKey = state.dataset?.answerKey || {};
            if (answerKey.text) {
                const fillInBlankAnswers = {};
                Object.entries(results.answers).forEach(([qKey, userAnswer]) => {
                    if (answerKey.text[qKey] !== undefined) {
                        fillInBlankAnswers[qKey] = {
                            userAnswer,
                            correctAnswer: answerKey.text[qKey],
                        };
                    }
                });
                if (Object.keys(fillInBlankAnswers).length > 0) {
                    const errors = collector.detectErrors(
                        Object.fromEntries(Object.entries(fillInBlankAnswers).map(([k, v]) => [k, { userAnswer: v.userAnswer, correctAnswer: v.correctAnswer, isCorrect: v.userAnswer === v.correctAnswer }])),
                        null,
                        state.examId
                    );
                    if (errors.length > 0) {
                        collector.saveErrors(errors);
                    }
                }
            }
        }

        if (dom.transcriptPanel) {
            dom.transcriptPanel.classList.add('visible');
            if (dom.transcriptToggle) dom.transcriptToggle.classList.add('active');
        }
        updateNavStatuses(results);
        enterSubmittedReadOnlyState();

        postMessage('PRACTICE_COMPLETE', {
            duration: state.timerSeconds,
            startTime: new Date(Date.now() - state.timerSeconds * 1000).toISOString(),
            endTime: new Date().toISOString(),
            metadata: {
                examId: state.examId,
                examTitle: state.dataset?.meta?.title || '',
                title: state.dataset?.meta?.title || '',
                category: state.dataset?.meta?.category || '',
                frequency: state.dataset?.meta?.frequency || '',
                type: 'listening',
                examType: 'listening',
                renderMode: 'unified-listening',
                dataKey: state.dataKey,
            },
            answers: results.answers,
            scoreInfo: results.scoreInfo,
            answerComparison: results.answerComparison,
            correctAnswers: results.correctAnswers,
        });

        saveState();
    }

    function enterSubmittedReadOnlyState() {
        state.submitted = true;
        state.readOnly = true;
        stopTimer();
        if (dom.audio) dom.audio.pause();
        if (dom.submitBtn) dom.submitBtn.disabled = true;
        document.querySelectorAll('input, select').forEach(el => {
            el.disabled = true;
        });
        setExitButtonVisible(true);
    }

    function setExitButtonVisible(visible) {
        if (!dom.exitBtn) return;
        dom.exitBtn.style.display = visible ? 'block' : 'none';
    }

    function handleExitClick() {
        var opener = global.opener && !global.opener.closed ? global.opener : null;
        var hasEndlessMarker = /(?:^|[?&])endless(?:=|&|$)/i.test(global.location.search || '')
            || document.body?.dataset?.endlessMode === 'true'
            || global.__ENDLESS_PRACTICE_MODE__ === true;
        if (hasEndlessMarker && opener) {
            try {
                opener.postMessage({ type: 'ENDLESS_USER_EXIT' }, '*');
                if (typeof opener.stopEndlessPractice === 'function') {
                    opener.stopEndlessPractice();
                } else if (opener.AppActions && typeof opener.AppActions.stopEndlessPractice === 'function') {
                    opener.AppActions.stopEndlessPractice();
                }
            } catch (_) {}
        }
        try {
            global.close();
        } catch (_) {}
    }

    function handleReset() {
        if (state.readOnly || state.submitted) return;
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
        document.querySelectorAll('input[type="text"]').forEach(el => el.value = '');
        document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
        document.querySelectorAll('.match-slot').forEach(slot => {
            delete slot.dataset.value;
            slot.textContent = '';
            slot.classList.remove('filled');
        });
        if (dom.results) dom.results.innerHTML = '';
        if (dom.questionNav) {
            dom.questionNav.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('answered', 'correct', 'incorrect');
            });
        }
        state.timerSeconds = 0;
        renderTimer();
        saveState();
    }

    let navUpdatePending = false;
    function scheduleNavUpdate() {
        if (navUpdatePending) return;
        navUpdatePending = true;
        requestAnimationFrame(() => {
            navUpdatePending = false;
            updateNavOnInput();
        });
    }

    function attachInputListeners() {
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="text"]')) {
                scheduleNavUpdate();
            }
        });
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="radio"], input[type="checkbox"], select')) {
                scheduleNavUpdate();
            }
        });
    }

    /* ========== Transcript Toggle ========== */
    function attachTranscriptToggle() {
        if (dom.transcriptToggle) {
            dom.transcriptToggle.addEventListener('click', () => {
                dom.transcriptPanel.classList.toggle('visible');
                dom.transcriptToggle.classList.toggle('active');
            });
        }
    }

    /* ========== Transcript Click-to-Seek ========== */
    function attachTranscriptClickToSeek() {
        if (!dom.transcriptContent) return;
        dom.transcriptContent.addEventListener('click', (e) => {
            const line = e.target.closest('.transcript-line');
            if (!line || !dom.audio) return;
            const idx = parseInt(line.dataset.index, 10);
            if (Number.isFinite(idx) && transcriptCache[idx]) {
                dom.audio.currentTime = transcriptCache[idx].start;
                if (dom.audio.paused) {
                    dom.audio.play();
                    if (dom.playPauseBtn) dom.playPauseBtn.innerHTML = '&#10074;&#10074;';
                }
            }
        });
    }

    /* ========== Bootstrap ========== */
    async function bootstrap() {
        if (state.ready) return;
        if (state.initTimer) {
            clearInterval(state.initTimer);
            state.initTimer = null;
        }
        parseQuery();
        captureDom();
        const dataset = await ensureDataset();
        if (!dataset) {
            console.error('Failed to load dataset for', state.examId);
            return;
        }
        state.localStorageKey = dataset.meta?.localStorageKey || ('ielts_listening_' + state.examId);
        renderDataset(dataset);
        buildQuestionNav();
        attachMatchingHandlers();
        attachInputListeners();
        attachSelectionToolbar();
        attachTranscriptToggle();
        attachTranscriptClickToSeek();
        loadState();

        dom.submitBtn?.addEventListener('click', handleSubmit);
        dom.resetBtn?.addEventListener('click', handleReset);
        dom.exitBtn?.addEventListener('click', handleExitClick);

        startTimer();
        sendSessionReady();

        // Re-send session ready on init message from parent
        global.addEventListener('message', handleIncoming);
    }


    /* ========== Init ========== */
    global.addEventListener('DOMContentLoaded',async () => {
        // Try bootstrap immediately if query params are present
        const params = new URLSearchParams(global.location.search);
        if (params.get('examId')) {
            await ensureManifest();
            bootstrap();
        } else {
            // Wait for INIT_SESSION message
            state.initTimer = setInterval(() => {
                if (state.ready) {
                    clearInterval(state.initTimer);
                    return;
                }
            }, INIT_RETRY_MS);
        }
    });

})(typeof window !== 'undefined' ? window : globalThis);
