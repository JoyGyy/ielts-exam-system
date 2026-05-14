// ===== js/core/practiceCore.js =====
(function initPracticeCore(global) {
    'use strict';

    if (global.PracticeCore && global.PracticeCore.__stable === true) {
        return;
    }

    const MESSAGE_TYPE_ALIASES = Object.freeze({
        practice_complete: 'PRACTICE_COMPLETE',
        practice_completed: 'PRACTICE_COMPLETE',
        PracticeComplete: 'PRACTICE_COMPLETE',
        SESSION_COMPLETE: 'PRACTICE_COMPLETE',
        session_complete: 'PRACTICE_COMPLETE',
        session_completed: 'PRACTICE_COMPLETE',
        EXAM_FINISHED: 'PRACTICE_COMPLETE',
        QUIZ_COMPLETE: 'PRACTICE_COMPLETE',
        QUIZ_COMPLETED: 'PRACTICE_COMPLETE',
        TEST_COMPLETE: 'PRACTICE_COMPLETE',
        LESSON_COMPLETE: 'PRACTICE_COMPLETE',
        WORKOUT_COMPLETE: 'PRACTICE_COMPLETE',
        SESSION_READY: 'SESSION_READY',
        session_ready: 'SESSION_READY',
        EXAM_COMPLETED: 'exam_completed',
        EXAM_PROGRESS: 'exam_progress',
        EXAM_ERROR: 'exam_error',
        progress_update: 'PROGRESS_UPDATE',
        SESSION_PROGRESS: 'PROGRESS_UPDATE',
        session_progress: 'PROGRESS_UPDATE',
        practice_progress: 'PROGRESS_UPDATE',
        SESSION_ERROR: 'ERROR_OCCURRED',
        session_error: 'ERROR_OCCURRED',
        practice_error: 'ERROR_OCCURRED',
        REQUEST_INIT: 'REQUEST_INIT',
        request_init: 'REQUEST_INIT',
        REQUEST_SESSION_INIT: 'REQUEST_INIT',
        INIT_SESSION: 'INIT_SESSION',
        init_session: 'INIT_SESSION'
    });

    const PRACTICE_COMPLETE_TYPES = new Set([
        'PRACTICE_COMPLETE',
        'PRACTICE_COMPLETED',
        'SESSION_COMPLETE',
        'SESSION_COMPLETED',
        'EXAM_FINISHED',
        'QUIZ_COMPLETE',
        'QUIZ_COMPLETED',
        'TEST_COMPLETE',
        'LESSON_COMPLETE',
        'WORKOUT_COMPLETE'
    ]);

    const STORAGE_KEYS = Object.freeze({
        practiceRecords: 'practice_records',
        userStats: 'user_stats',
        activeSessions: 'active_sessions',
        tempPracticeRecords: 'temp_practice_records'
    });

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function safeParseJson(value) {
        if (typeof value !== 'string') {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (_) {
            return null;
        }
    }

    function clonePlainObject(value) {
        if (value == null || typeof value !== 'object') {
            return value ?? null;
        }
        if (Array.isArray(value)) {
            return value.map((item) => clonePlainObject(item)).filter((item) => item !== undefined);
        }
        const clone = {};
        Object.keys(value).forEach((key) => {
            clone[key] = clonePlainObject(value[key]);
        });
        return clone;
    }

    function ensureNumber(value, fallback = 0) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function normalizePracticeType(rawType) {
        if (!rawType) return null;
        const normalized = String(rawType).toLowerCase();
        if (normalized.includes('listen')) return 'listening';
        if (normalized.includes('read')) return 'reading';
        return null;
    }

    function resolveRecordDate(recordData = {}, now = new Date().toISOString()) {
        const candidates = [
            recordData.metadata && recordData.metadata.date,
            recordData.date,
            recordData.endTime,
            recordData.completedAt,
            recordData.startTime,
            recordData.timestamp,
            now
        ];

        for (let i = 0; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            if (!candidate) continue;
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        }

        return now;
    }

    function inferExamId(recordData = {}) {
        if (!recordData || typeof recordData !== 'object') {
            return null;
        }

        if (recordData.examId) {
            return recordData.examId;
        }
        if (recordData.metadata && recordData.metadata.examId) {
            return recordData.metadata.examId;
        }
        if (typeof recordData.id === 'string') {
            const match = recordData.id.match(/^record_([^_]+)_/);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    }

    function normalizeAnswerValue(value) {
        const sanitizer = global.AnswerSanitizer;
        if (sanitizer && typeof sanitizer.normalizeValue === 'function') {
            return sanitizer.normalizeValue(value);
        }

        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return /^\[object\s/i.test(trimmed) ? '' : trimmed;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value).trim();
        }
        if (Array.isArray(value)) {
            return value.map((item) => normalizeAnswerValue(item)).filter(Boolean).join(',');
        }
        if (typeof value === 'object') {
            const preferKeys = ['value', 'label', 'text', 'answer', 'content', 'userAnswer', 'correctAnswer'];
            for (let i = 0; i < preferKeys.length; i += 1) {
                const entry = value[preferKeys[i]];
                if (typeof entry === 'string') {
                    const trimmed = entry.trim();
                    if (trimmed && !/^\[object\s/i.test(trimmed)) {
                        return trimmed;
                    }
                }
            }
            if (typeof value.innerText === 'string') {
                const text = value.innerText.trim();
                if (text && !/^\[object\s/i.test(text)) {
                    return text;
                }
            }
            if (typeof value.textContent === 'string') {
                const text = value.textContent.trim();
                if (text && !/^\[object\s/i.test(text)) {
                    return text;
                }
            }
            return '';
        }

        return String(value).trim();
    }

    function isNoiseKey(key) {
        if (!key) return true;

        const keyStr = String(key).toLowerCase();
        const noiseKeys = [
            'playback-speed', 'playbackspeed', 'volume-slider', 'volumeslider',
            'audio-volume', 'audiocurrenttime', 'audio-duration', 'audioduration',
            'settings', 'lastfocuselement', 'sessionid', 'examid',
            'nextexamid', 'previousexamid', 'folder', 'source', 'result',
            'metadata', 'practicesettings', 'config', 'state'
        ];
        if (noiseKeys.includes(keyStr)) {
            return true;
        }

        const noisePatterns = [
            /playback/i, /volume/i, /slider/i, /speed/i,
            /audio/i, /duration/i, /config/i, /setting/i
        ];
        for (let i = 0; i < noisePatterns.length; i += 1) {
            if (noisePatterns[i].test(keyStr)) {
                return true;
            }
        }

        const questionMatch = keyStr.match(/q?(\d+)/);
        if (questionMatch) {
            const number = parseInt(questionMatch[1], 10);
            if (number < 1 || number > 200) {
                return true;
            }
        }

        return false;
    }

    function normalizeQuestionKey(rawKey, index) {
        if (rawKey == null || rawKey === '') {
            return `q${index + 1}`;
        }
        const key = String(rawKey).trim();
        return key.startsWith('q') ? key : `q${key}`;
    }

    function normalizeAnswerMap(rawAnswers = {}) {
        const map = {};

        if (Array.isArray(rawAnswers)) {
            rawAnswers.forEach((entry, index) => {
                if (!entry) return;
                const key = normalizeQuestionKey(entry.questionId, index);
                const rawValue = entry.answer ?? entry.userAnswer ?? entry.value ?? entry;
                map[key] = normalizeAnswerValue(rawValue);
            });
            return map;
        }

        if (!rawAnswers || typeof rawAnswers !== 'object') {
            return map;
        }

        Object.entries(rawAnswers).forEach(([rawKey, rawValue], index) => {
            if (isNoiseKey(rawKey)) {
                return;
            }
            const key = normalizeQuestionKey(rawKey, index);
            const resolvedValue = rawValue && typeof rawValue === 'object' && 'answer' in rawValue
                ? rawValue.answer
                : rawValue;
            map[key] = normalizeAnswerValue(resolvedValue);
        });

        return map;
    }

    function normalizeAnswerComparison(comparison) {
        if (!comparison || typeof comparison !== 'object') {
            return {};
        }

        const sanitizer = global.AnswerSanitizer;
        if (sanitizer && typeof sanitizer.sanitizeComparisonMap === 'function') {
            return sanitizer.sanitizeComparisonMap(comparison);
        }

        const normalized = {};
        Object.entries(comparison).forEach(([questionId, entry]) => {
            if (isNoiseKey(questionId) || !entry || typeof entry !== 'object') {
                return;
            }
            const userAnswer = normalizeAnswerValue(entry.userAnswer ?? entry.user ?? entry.answer);
            const correctAnswer = normalizeAnswerValue(entry.correctAnswer ?? entry.correct);
            if (!userAnswer && !correctAnswer) {
                return;
            }
            normalized[questionId] = {
                questionId: entry.questionId || questionId,
                userAnswer,
                correctAnswer,
                isCorrect: typeof entry.isCorrect === 'boolean' ? entry.isCorrect : null
            };
        });

        return normalized;
    }

    function convertComparisonToMap(comparison, key = 'correctAnswer') {
        if (!comparison || typeof comparison !== 'object') {
            return {};
        }
        const map = {};
        Object.entries(comparison).forEach(([questionId, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const value = entry[key] ?? (key === 'correctAnswer' ? entry.correct : entry.userAnswer ?? entry.user);
            if (value != null && String(value).trim() !== '') {
                map[questionId] = value;
            }
        });
        return map;
    }

    function convertComparisonToDetails(comparison) {
        if (!comparison || typeof comparison !== 'object') {
            return null;
        }
        const details = {};
        Object.entries(comparison).forEach(([questionId, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            details[questionId] = {
                userAnswer: normalizeAnswerValue(entry.userAnswer ?? entry.user ?? entry.answer),
                correctAnswer: normalizeAnswerValue(entry.correctAnswer ?? entry.correct),
                isCorrect: typeof entry.isCorrect === 'boolean' ? entry.isCorrect : null
            };
        });
        return details;
    }

    function buildAnswerDetails(answerMap = {}, correctMap = {}) {
        const details = {};
        const keys = new Set([
            ...Object.keys(answerMap || {}),
            ...Object.keys(correctMap || {})
        ]);

        keys.forEach((questionId) => {
            const userAnswer = normalizeAnswerValue(answerMap[questionId]);
            const correctAnswer = normalizeAnswerValue(correctMap[questionId]);
            let isCorrect = null;
            if (correctAnswer) {
                const matchCore = global.AnswerMatchCore;
                isCorrect = matchCore && typeof matchCore.compareAnswers === 'function'
                    ? matchCore.compareAnswers(userAnswer, correctAnswer) === true
                    : userAnswer.toLowerCase() === correctAnswer.toLowerCase();
            }
            details[questionId] = {
                userAnswer: userAnswer || '-',
                correctAnswer: correctAnswer || '-',
                isCorrect
            };
        });

        return details;
    }

    function deriveCorrectMapFromDetails(details) {
        if (!details || typeof details !== 'object') {
            return {};
        }
        const map = {};
        Object.entries(details).forEach(([questionId, info]) => {
            if (!info) return;
            const correctAnswer = info.correctAnswer || info.answer || info.value;
            if (correctAnswer != null) {
                map[questionId] = normalizeAnswerValue(correctAnswer);
            }
        });
        return map;
    }

    function buildAnswerArray(answers, correctMap = {}) {
        if (Array.isArray(answers)) {
            return answers.map((answer, index) => ({
                questionId: answer.questionId || `q${index + 1}`,
                answer: normalizeAnswerValue(answer.answer),
                correctAnswer: normalizeAnswerValue(answer.correctAnswer ?? correctMap[answer.questionId || `q${index + 1}`]),
                correct: Boolean(answer.correct),
                timeSpent: ensureNumber(answer.timeSpent, 0),
                questionType: answer.questionType || 'unknown',
                timestamp: answer.timestamp || new Date().toISOString()
            }));
        }

        const answerMap = normalizeAnswerMap(answers);
        const keys = new Set([
            ...Object.keys(answerMap),
            ...Object.keys(correctMap || {})
        ]);

        const list = [];
        keys.forEach((questionId, index) => {
            const userAnswer = normalizeAnswerValue(answerMap[questionId]);
            const normalizedCorrect = normalizeAnswerValue(correctMap[questionId]);
            const isCorrect = normalizedCorrect
                ? userAnswer.toLowerCase() === normalizedCorrect.toLowerCase()
                : false;
            list.push({
                questionId: questionId || `q${index + 1}`,
                answer: userAnswer,
                correctAnswer: normalizedCorrect,
                correct: isCorrect,
                timeSpent: 0,
                questionType: 'unknown',
                timestamp: new Date().toISOString()
            });
        });
        return list;
    }

    function deriveTotalQuestionCount(recordData = {}, fallbackLength = 0) {
        const candidates = [
            recordData.totalQuestions,
            recordData.questionCount,
            recordData.scoreInfo && recordData.scoreInfo.total,
            recordData.scoreInfo && recordData.scoreInfo.totalQuestions,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.totalQuestions,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.total
        ];
        for (let i = 0; i < candidates.length; i += 1) {
            const numeric = Number(candidates[i]);
            if (Number.isFinite(numeric) && numeric >= 0) {
                return numeric;
            }
        }

        if (Array.isArray(recordData.answers)) {
            return recordData.answers.length;
        }
        if (Array.isArray(recordData.answerList)) {
            return recordData.answerList.length;
        }
        const detailSources = [
            recordData.answerDetails,
            recordData.scoreInfo && recordData.scoreInfo.details,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.details
        ];
        for (let i = 0; i < detailSources.length; i += 1) {
            const details = detailSources[i];
            if (details && typeof details === 'object') {
                return Object.keys(details).length;
            }
        }

        return fallbackLength || 0;
    }

    function deriveCorrectAnswerCount(recordData = {}, answers = []) {
        const numericCandidates = [
            recordData.correctAnswers,
            recordData.correct,
            recordData.score,
            recordData.scoreInfo && recordData.scoreInfo.correct,
            recordData.scoreInfo && recordData.scoreInfo.score,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.correct,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.score
        ];
        for (let i = 0; i < numericCandidates.length; i += 1) {
            const numeric = Number(numericCandidates[i]);
            if (Number.isFinite(numeric) && numeric >= 0) {
                return numeric;
            }
        }

        if (Array.isArray(answers) && answers.length > 0) {
            return answers.reduce((sum, answer) => {
                if (!answer || typeof answer !== 'object') {
                    return sum;
                }
                return (answer.correct === true || answer.isCorrect === true) ? sum + 1 : sum;
            }, 0);
        }

        const detailSources = [
            recordData.answerDetails,
            recordData.scoreInfo && recordData.scoreInfo.details,
            recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.details
        ];
        for (let i = 0; i < detailSources.length; i += 1) {
            const details = detailSources[i];
            if (!details || typeof details !== 'object') {
                continue;
            }
            let hasFlag = false;
            let correctCount = 0;
            Object.values(details).forEach((detail) => {
                if (!detail || typeof detail !== 'object') {
                    return;
                }
                if (detail.isCorrect === true || detail.correct === true) {
                    correctCount += 1;
                }
                hasFlag = hasFlag || typeof detail.isCorrect === 'boolean' || typeof detail.correct === 'boolean';
            });
            if (hasFlag) {
                return correctCount;
            }
        }

        return 0;
    }

    function buildMetadata(recordData = {}, type) {
        const metadata = Object.assign({}, recordData.metadata || {});
        const examId = recordData.examId;
        const fallbackTitle = recordData.title || recordData.examTitle || examId || 'Unknown Exam';
        const fallbackCategory = recordData.category || metadata.category || 'Unknown';
        const fallbackFrequency = recordData.frequency || metadata.frequency || 'unknown';

        metadata.examTitle = metadata.examTitle || metadata.title || fallbackTitle;
        metadata.category = metadata.category || fallbackCategory;
        metadata.frequency = metadata.frequency || fallbackFrequency;
        metadata.type = type;
        metadata.examType = metadata.examType || type;
        if (recordData.practiceMode && !metadata.practiceMode) {
            metadata.practiceMode = recordData.practiceMode;
        }
        return metadata;
    }

    function inferPracticeType(recordData = {}) {
        const metadata = recordData.metadata || {};
        const normalized = normalizePracticeType(
            recordData.type
            || metadata.type
            || metadata.examType
            || (recordData.examId && String(recordData.examId).toLowerCase().includes('listening') ? 'listening' : null)
        );
        return normalized || 'reading';
    }

    function mergeAnswerSources() {
        const merged = {};
        Array.prototype.slice.call(arguments).forEach((source) => {
            if (!source) {
                return;
            }
            const normalized = normalizeAnswerMap(source);
            Object.entries(normalized).forEach(([key, value]) => {
                if (value == null) {
                    return;
                }
                const trimmed = String(value).trim();
                if (!trimmed) {
                    return;
                }
                merged[key] = trimmed;
            });
        });
        return merged;
    }

    function defaultGenerateRecordId() {
        return `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function standardizeRecord(recordData, options = {}) {
        const now = new Date().toISOString();
        const type = inferPracticeType(recordData);
        const recordDate = resolveRecordDate(recordData, now);
        const resolvedExamId = inferExamId(recordData);
        const metadata = buildMetadata(
            Object.assign({}, recordData, { examId: resolvedExamId }),
            type
        );
        const comparisonSource = recordData.answerComparison
            || (recordData.realData && recordData.realData.answerComparison)
            || null;
        const normalizedAnswers = buildAnswerArray(recordData.answers || recordData.answerList || [], recordData.correctAnswerMap || {});
        let answerMap = normalizedAnswers.reduce((map, item) => {
            if (item && item.questionId) {
                map[item.questionId] = item.answer || '';
            }
            return map;
        }, {});
        if ((!answerMap || Object.keys(answerMap).length === 0) && comparisonSource) {
            answerMap = convertComparisonToMap(comparisonSource, 'userAnswer');
        }

        let normalizedCorrectMap = (
            recordData.correctAnswerMap && typeof recordData.correctAnswerMap === 'object'
        )
            ? normalizeAnswerMap(recordData.correctAnswerMap)
            : ((recordData.realData && recordData.realData.correctAnswers && typeof recordData.realData.correctAnswers === 'object')
                ? normalizeAnswerMap(recordData.realData.correctAnswers)
                : {});

        if ((!normalizedCorrectMap || Object.keys(normalizedCorrectMap).length === 0) && comparisonSource) {
            normalizedCorrectMap = convertComparisonToMap(comparisonSource, 'correctAnswer');
        }

        const derivedTotalQuestions = deriveTotalQuestionCount(recordData, normalizedAnswers.length);
        const derivedCorrectAnswers = deriveCorrectAnswerCount(recordData, normalizedAnswers);
        const totalQuestions = ensureNumber(recordData.totalQuestions, derivedTotalQuestions);
        const correctAnswers = ensureNumber(recordData.correctAnswers, derivedCorrectAnswers);
        let accuracy = ensureNumber(recordData.accuracy, totalQuestions > 0 ? correctAnswers / totalQuestions : 0);
        if (accuracy > 1 && accuracy <= 100) {
            accuracy = accuracy / 100;
        }
        if (!Number.isFinite(accuracy) || accuracy < 0) {
            accuracy = 0;
        } else if (accuracy > 1) {
            accuracy = 1;
        }

        const detailSource = recordData.answerDetails
            || (recordData.scoreInfo && recordData.scoreInfo.details)
            || (recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.details)
            || (comparisonSource ? convertComparisonToDetails(comparisonSource) : null)
            || buildAnswerDetails(answerMap, normalizedCorrectMap);

        const startTime = recordData.startTime && !Number.isNaN(new Date(recordData.startTime).getTime())
            ? new Date(recordData.startTime).toISOString()
            : recordDate;
        const endTime = recordData.endTime && !Number.isNaN(new Date(recordData.endTime).getTime())
            ? new Date(recordData.endTime).toISOString()
            : recordDate;
        const resolvedTitle = recordData.title
            || metadata.examTitle
            || metadata.title
            || recordData.examTitle
            || recordData.examId
            || '未命名练习';
        const normalizedComparison = comparisonSource && typeof comparisonSource === 'object'
            ? clonePlainObject(comparisonSource)
            : null;
        const generateRecordId = typeof options.generateRecordId === 'function'
            ? options.generateRecordId
            : defaultGenerateRecordId;

        return {
            id: recordData.id || generateRecordId(),
            examId: resolvedExamId,
            sessionId: recordData.sessionId || null,
            title: resolvedTitle,
            type,
            startTime,
            endTime,
            duration: ensureNumber(recordData.duration, 0),
            date: recordDate,
            status: recordData.status || 'completed',
            score: ensureNumber(recordData.score, correctAnswers),
            totalQuestions,
            correctAnswers,
            accuracy,
            answers: normalizedAnswers,
            answerDetails: detailSource || null,
            correctAnswerMap: normalizedCorrectMap || {},
            questionTypePerformance: recordData.questionTypePerformance || {},
            metadata,
            frequency: recordData.frequency || metadata.frequency || null,
            scoreInfo: recordData.scoreInfo
                ? Object.assign({}, recordData.scoreInfo, {
                    details: recordData.scoreInfo.details || detailSource || null
                })
                : (detailSource ? { details: detailSource } : null),
            realData: recordData.realData
                ? Object.assign({}, recordData.realData, {
                    answers: (recordData.realData && recordData.realData.answers) || answerMap,
                    correctAnswers: (recordData.realData && recordData.realData.correctAnswers) || normalizedCorrectMap,
                    scoreInfo: Object.assign({}, (recordData.realData && recordData.realData.scoreInfo) || {}, {
                        details: (recordData.realData && recordData.realData.scoreInfo && recordData.realData.scoreInfo.details) || detailSource || null
                    }),
                    answerComparison: (recordData.realData && recordData.realData.answerComparison)
                        ? clonePlainObject(recordData.realData.answerComparison)
                        : (normalizedComparison || null)
                })
                : (normalizedComparison ? { answerComparison: normalizedComparison } : null),
            answerComparison: normalizedComparison,
            version: options.currentVersion || recordData.version || '1.0.0',
            createdAt: recordData.createdAt || now,
            updatedAt: now
        };
    }

    function extractEnvelopeData(envelope) {
        const candidates = [envelope.data, envelope.payload, envelope.detail];
        for (let i = 0; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            if (isPlainObject(candidate)) return candidate;
            if (typeof candidate === 'string') {
                const parsed = safeParseJson(candidate);
                if (isPlainObject(parsed)) return parsed;
            }
        }
        if (Array.isArray(envelope.args)) {
            for (let i = 0; i < envelope.args.length; i += 1) {
                const candidate = envelope.args[i];
                if (isPlainObject(candidate)) return candidate;
            }
        }
        const fallback = {};
        const baseKeys = new Set(['type', 'messageType', 'action', 'event', 'data', 'payload', 'detail', 'args', 'source', 'message', 'messageData']);
        let hasFallback = false;
        Object.keys(envelope || {}).forEach((key) => {
            if (!baseKeys.has(key)) {
                fallback[key] = envelope[key];
                hasFallback = true;
            }
        });
        return hasFallback ? fallback : {};
    }

    function normalizeMessageType(value) {
        if (typeof value !== 'string') {
            return '';
        }
        const normalized = value.trim();
        if (!normalized) {
            return '';
        }
        return MESSAGE_TYPE_ALIASES[normalized] || normalized.toUpperCase();
    }

    function normalizeMessage(rawEnvelope, depth = 0) {
        if (depth > 2) {
            return null;
        }

        let envelope = rawEnvelope;
        if (typeof envelope === 'string') {
            envelope = safeParseJson(envelope);
        }
        if (!isPlainObject(envelope)) {
            return null;
        }

        const rawType = envelope.type || envelope.messageType || envelope.action || envelope.event || '';
        const type = normalizeMessageType(rawType);

        if (!type) {
            const nested = envelope.message || envelope.messageData;
            if (nested) {
                return normalizeMessage(nested, depth + 1);
            }
            return null;
        }

        const data = extractEnvelopeData(envelope);
        const sourceTag = typeof envelope.source === 'string'
            ? envelope.source
            : (typeof data.source === 'string' ? data.source : '');

        return { type, data: isPlainObject(data) ? data : {}, sourceTag, rawType: rawType || type };
    }

    function isPracticeCompleteType(type) {
        if (!type) {
            return false;
        }
        return PRACTICE_COMPLETE_TYPES.has(type) || normalizeMessageType(type) === 'PRACTICE_COMPLETE';
    }

    function buildEnvelope(type, data) {
        return {
            type,
            data: isPlainObject(data) ? data : {}
        };
    }

    function deriveCategory(recordPayload = {}, examEntry = null, metadata = {}) {
        if (metadata.category) {
            return metadata.category;
        }
        if (recordPayload.category) {
            return recordPayload.category;
        }
        if (examEntry && examEntry.category) {
            return examEntry.category;
        }
        if (recordPayload.pageType) {
            return recordPayload.pageType;
        }
        if (recordPayload.url) {
            const match = String(recordPayload.url).match(/\b(P[1-4])\b/i);
            if (match) return match[1].toUpperCase();
        }
        if (recordPayload.title) {
            const match = String(recordPayload.title).match(/\b(P[1-4])\b/i);
            if (match) return match[1].toUpperCase();
        }
        return 'Unknown';
    }

    function deriveFrequency(recordPayload = {}, examEntry = null, metadata = {}) {
        return recordPayload.frequency
            || metadata.frequency
            || (examEntry && examEntry.frequency)
            || 'unknown';
    }

    function fromCompletion(payload, sessionContext = {}, examEntry = null, options = {}) {
        const normalizedMessage = normalizeMessage(payload);
        const rawPayload = normalizedMessage && isPracticeCompleteType(normalizedMessage.type)
            ? normalizedMessage.data
            : (isPlainObject(payload) ? payload : {});

        if (!rawPayload || typeof rawPayload !== 'object') {
            return null;
        }

        const scoreInfo = Object.assign({}, rawPayload.scoreInfo || {});
        const metadata = Object.assign({}, sessionContext.metadata || {}, rawPayload.metadata || {});
        const resolvedExamId = rawPayload.examId
            || sessionContext.examId
            || metadata.examId
            || (examEntry && examEntry.id)
            || null;
        const answerComparison = normalizeAnswerComparison(
            rawPayload.answerComparison || (rawPayload.realData && rawPayload.realData.answerComparison) || null
        );
        const answerMap = mergeAnswerSources(
            rawPayload.answerMap,
            rawPayload.answers,
            rawPayload.realData && rawPayload.realData.answers,
            sessionContext.answers,
            convertComparisonToMap(answerComparison, 'userAnswer')
        );
        const correctAnswerMap = mergeAnswerSources(
            rawPayload.correctAnswerMap,
            rawPayload.correctAnswers,
            rawPayload.realData && rawPayload.realData.correctAnswers,
            sessionContext.correctAnswerMap,
            deriveCorrectMapFromDetails(scoreInfo.details),
            deriveCorrectMapFromDetails(rawPayload.realData && rawPayload.realData.scoreInfo && rawPayload.realData.scoreInfo.details),
            convertComparisonToMap(answerComparison, 'correctAnswer')
        );
        const answerDetails = rawPayload.answerDetails
            || scoreInfo.details
            || (rawPayload.realData && rawPayload.realData.scoreInfo && rawPayload.realData.scoreInfo.details)
            || buildAnswerDetails(answerMap, correctAnswerMap);
        const answerList = buildAnswerArray(answerMap, correctAnswerMap);
        const totalQuestions = ensureNumber(
            rawPayload.totalQuestions ?? scoreInfo.total ?? scoreInfo.totalQuestions,
            Object.keys(correctAnswerMap).length || Object.keys(answerMap).length
        );
        const correctAnswers = ensureNumber(
            rawPayload.correctAnswers ?? rawPayload.correctAnswersCount ?? scoreInfo.correct ?? scoreInfo.score ?? rawPayload.score,
            deriveCorrectAnswerCount({ answerDetails, scoreInfo }, answerList)
        );
        let accuracy = typeof rawPayload.accuracy === 'number'
            ? rawPayload.accuracy
            : (typeof scoreInfo.accuracy === 'number'
                ? scoreInfo.accuracy
                : (totalQuestions > 0 ? correctAnswers / totalQuestions : 0));
        if (accuracy > 1 && accuracy <= 100) {
            accuracy = accuracy / 100;
        }
        const percentage = typeof scoreInfo.percentage === 'number'
            ? scoreInfo.percentage
            : Math.round(accuracy * 100);
        const completedAt = resolveRecordDate({
            metadata,
            date: rawPayload.date,
            endTime: rawPayload.endTime,
            completedAt: rawPayload.completedAt,
            startTime: rawPayload.startTime,
            timestamp: rawPayload.timestamp
        });
        const duration = ensureNumber(
            rawPayload.duration,
            (rawPayload.endTime && rawPayload.startTime)
                ? Math.round((new Date(rawPayload.endTime) - new Date(rawPayload.startTime)) / 1000)
                : ensureNumber(sessionContext.duration, 0)
        );
        const startTime = rawPayload.startTime
            ? new Date(rawPayload.startTime).toISOString()
            : (sessionContext.startTime
                ? new Date(sessionContext.startTime).toISOString()
                : new Date(new Date(completedAt).getTime() - duration * 1000).toISOString());
        const endTime = rawPayload.endTime
            ? new Date(rawPayload.endTime).toISOString()
            : completedAt;
        const category = deriveCategory(rawPayload, examEntry, metadata);
        const frequency = deriveFrequency(rawPayload, examEntry, metadata);
        const title = rawPayload.title
            || metadata.examTitle
            || metadata.title
            || (examEntry && examEntry.title)
            || resolvedExamId
            || '未命名练习';
        return standardizeRecord({
            id: rawPayload.id,
            examId: resolvedExamId,
            sessionId: rawPayload.sessionId || sessionContext.sessionId || null,
            title,
            type: rawPayload.type || metadata.type || metadata.examType || (examEntry && examEntry.type) || sessionContext.type || null,
            startTime,
            endTime,
            duration,
            date: completedAt,
            status: rawPayload.status || 'completed',
            score: ensureNumber(rawPayload.score ?? scoreInfo.score, correctAnswers),
            totalQuestions,
            correctAnswers,
            accuracy,
            answers: answerList,
            answerDetails,
            correctAnswerMap,
            answerComparison,
            questionTypePerformance: rawPayload.questionTypePerformance || {},
            metadata: Object.assign({}, metadata, {
                examId: resolvedExamId,
                examTitle: title,
                category,
                frequency
            }),
            frequency,
            scoreInfo: Object.assign({}, scoreInfo, {
                correct: correctAnswers,
                total: totalQuestions,
                accuracy,
                percentage,
                details: scoreInfo.details || answerDetails,
                source: scoreInfo.source || rawPayload.pageType || rawPayload.source || 'practice_page'
            }),
            realData: Object.assign({}, rawPayload.realData || {}, {
                answers: answerMap,
                correctAnswers: correctAnswerMap,
                answerComparison,
                scoreInfo: Object.assign({}, (rawPayload.realData && rawPayload.realData.scoreInfo) || scoreInfo, {
                    correct: correctAnswers,
                    total: totalQuestions,
                    accuracy,
                    percentage,
                    details: answerDetails,
                    source: scoreInfo.source || rawPayload.pageType || rawPayload.source || 'practice_page'
                }),
                interactions: rawPayload.interactions || [],
                isRealData: true,
                source: scoreInfo.source || rawPayload.pageType || rawPayload.source || 'practice_page',
                sessionId: rawPayload.sessionId || sessionContext.sessionId || null
            })
        }, options);
    }

    function getRepositories() {
        return global.dataRepositories || null;
    }

    function getStorageManager(storageManager) {
        return storageManager || global.storage || null;
    }

    function syncPracticeRecordState(records) {
        const syncAppState = (nextRecords) => {
            try {
                if (global.app && global.app.state && global.app.state.practice) {
                    global.app.state.practice.records = Array.isArray(nextRecords) ? nextRecords.slice() : [];
                }
            } catch (_) {}
        };

        if (typeof global.setPracticeRecordsState === 'function') {
            try {
                const finalRecords = global.setPracticeRecordsState(records);
                syncAppState(finalRecords);
                try {
                    global.practiceRecords = Array.isArray(finalRecords) ? finalRecords.slice() : [];
                } catch (_) {}
                return;
            } catch (error) {
                console.warn('[PracticeCore] 同步 practice records 状态失败:', error);
            }
        }
        syncAppState(records);
        try {
            global.practiceRecords = Array.isArray(records) ? records.slice() : [];
        } catch (_) {}
    }

    async function readPracticeRecords(storageManager) {
        const repos = getRepositories();
        if (repos && repos.practice && typeof repos.practice.list === 'function') {
            return await repos.practice.list();
        }
        const storage = getStorageManager(storageManager);
        if (storage && typeof storage.get === 'function') {
            return await storage.get(STORAGE_KEYS.practiceRecords, [], { skipPracticeCoreRedirect: true });
        }
        return [];
    }

    async function writePracticeRecords(records, storageManager) {
        const finalRecords = Array.isArray(records) ? records : [];
        const repos = getRepositories();
        if (repos && repos.practice && typeof repos.practice.overwrite === 'function') {
            await repos.practice.overwrite(finalRecords);
            syncPracticeRecordState(finalRecords);
            return true;
        }
        const storage = getStorageManager(storageManager);
        if (storage && typeof storage.writePersistentValue === 'function') {
            const result = await storage.writePersistentValue(STORAGE_KEYS.practiceRecords, finalRecords);
            syncPracticeRecordState(finalRecords);
            return result;
        }
        return false;
    }

    async function writeMeta(key, value, storageManager) {
        const repos = getRepositories();
        if (repos && repos.meta && typeof repos.meta.set === 'function') {
            await repos.meta.set(key, value);
            return true;
        }
        const storage = getStorageManager(storageManager);
        if (storage && typeof storage.writePersistentValue === 'function') {
            return await storage.writePersistentValue(key, value);
        }
        return false;
    }

    async function removeMeta(key, storageManager) {
        const repos = getRepositories();
        if (repos && repos.meta && typeof repos.meta.remove === 'function') {
            await repos.meta.remove(key);
            return true;
        }
        const storage = getStorageManager(storageManager);
        if (storage && typeof storage.removePersistentValue === 'function') {
            return await storage.removePersistentValue(key);
        }
        return false;
    }

    function extractSessionId(record) {
        if (!record || typeof record !== 'object') {
            return null;
        }
        const rawId = record.sessionId
            || (record.realData && record.realData.sessionId)
            || (record.metadata && record.metadata.sessionId)
            || null;
        if (!rawId) return null;
        return String(rawId).trim() || null;
    }

    function dedupePracticeRecords(records) {
        const seenIds = new Set();
        const seenSessions = new Set();
        const deduped = [];

        (Array.isArray(records) ? records : []).forEach((record) => {
            if (!record || typeof record !== 'object') {
                return;
            }
            const recordId = record.id != null ? String(record.id) : null;
            const sessionId = extractSessionId(record);

            if (recordId && seenIds.has(recordId)) {
                return;
            }
            if (sessionId && seenSessions.has(sessionId)) {
                return;
            }

            if (recordId) seenIds.add(recordId);
            if (sessionId) seenSessions.add(sessionId);
            deduped.push(record);
        });

        return deduped;
    }

    function handlesStorageKey(key) {
        return key === STORAGE_KEYS.practiceRecords
            || key === STORAGE_KEYS.userStats
            || key === STORAGE_KEYS.activeSessions
            || key === STORAGE_KEYS.tempPracticeRecords;
    }

    async function replacePracticeRecords(records, options = {}) {
        const canonical = dedupePracticeRecords(
            (Array.isArray(records) ? records : []).map((record) => standardizeRecord(record, options))
        );
        if (Number.isFinite(options.maxRecords) && options.maxRecords > 0 && canonical.length > options.maxRecords) {
            canonical.splice(options.maxRecords);
        }
        return await writePracticeRecords(canonical, options.storageManager);
    }

    async function savePracticeRecord(record, options = {}) {
        const standardizedRecord = standardizeRecord(record, options);
        let records = await readPracticeRecords(options.storageManager);
        records = Array.isArray(records) ? records.slice() : [];

        const existingIndex = records.findIndex((entry) => entry && String(entry.id) === String(standardizedRecord.id));
        if (existingIndex >= 0) {
            records[existingIndex] = standardizedRecord;
        } else {
            records.unshift(standardizedRecord);
        }

        const standardizedSessionId = extractSessionId(standardizedRecord);
        if (standardizedSessionId) {
            records = records.filter((entry, index) => {
                if (index === 0) {
                    return true;
                }
                const sessionId = extractSessionId(entry);
                return !(sessionId && sessionId === standardizedSessionId && String(entry.id) !== String(standardizedRecord.id));
            });
        }

        records = dedupePracticeRecords(records);
        if (Number.isFinite(options.maxRecords) && options.maxRecords > 0 && records.length > options.maxRecords) {
            records.splice(options.maxRecords);
        }
        await writePracticeRecords(records, options.storageManager);
        return standardizedRecord;
    }

    async function routeStorageSet(storageManager, key, value, options = {}) {
        if (key === STORAGE_KEYS.practiceRecords) {
            return await replacePracticeRecords(value, {
                currentVersion: options.currentVersion || '1.0.0',
                maxRecords: options.maxRecords || 1000,
                storageManager
            });
        }
        if (key === STORAGE_KEYS.userStats || key === STORAGE_KEYS.activeSessions || key === STORAGE_KEYS.tempPracticeRecords) {
            return await writeMeta(key, value, storageManager);
        }
        return null;
    }

    async function routeStorageRemove(storageManager, key) {
        if (key === STORAGE_KEYS.practiceRecords) {
            return await writePracticeRecords([], storageManager);
        }
        if (key === STORAGE_KEYS.userStats || key === STORAGE_KEYS.activeSessions || key === STORAGE_KEYS.tempPracticeRecords) {
            return await removeMeta(key, storageManager);
        }
        return null;
    }

    const contracts = Object.freeze({
        ensureNumber,
        normalizePracticeType,
        inferPracticeType,
        resolveRecordDate,
        inferExamId,
        normalizeAnswerValue,
        isNoiseKey,
        normalizeAnswerMap,
        normalizeAnswerComparison,
        mergeAnswerSources,
        buildAnswerArray,
        buildAnswerDetails,
        deriveCorrectMapFromDetails,
        deriveCorrectAnswerCount,
        deriveTotalQuestionCount,
        convertComparisonToMap,
        convertComparisonToDetails,
        buildMetadata,
        standardizeRecord,
        clonePlainObject
    });

    const protocol = Object.freeze({
        MESSAGE_TYPE_ALIASES,
        PRACTICE_COMPLETE_TYPES,
        normalizeMessageType,
        normalizeMessage,
        isPracticeCompleteType,
        buildEnvelope
    });

    const ingestor = Object.freeze({
        fromCompletion
    });

    const store = Object.freeze({
        STORAGE_KEYS,
        handlesStorageKey,
        listPracticeRecords: readPracticeRecords,
        replacePracticeRecords,
        savePracticeRecord,
        routeStorageSet,
        routeStorageRemove,
        writeMeta,
        removeMeta,
        syncPracticeRecordState
    });

    global.PracticeCore = {
        __stable: true,
        version: '1.0.0',
        contracts,
        protocol,
        ingestor,
        store
    };
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/core/resourceCore.js =====
(function (global) {
    'use strict';

    const PATH_PROTOCOL_RE = /^(?:[a-z]+:)?\/\//i;
    const WINDOWS_DRIVE_RE = /^[A-Za-z]:\\/;
    const PATH_MAP_STORAGE_PREFIX = 'exam_path_map__';
    const BASE_PREFIX_STORAGE_KEY = 'hp.basePrefix';
    const PATH_FALLBACK_ORDER = ['map', 'fallback', 'raw', 'relative-up', 'relative-design'];
    const RAW_DEFAULT_PATH_MAP = {
        reading: {
            root: '睡着过项目组/2. 所有文章(11.20)[192篇]/',
            exceptions: {}
        },
        listening: {
            root: 'assets/listening/',
            exceptions: {}
        }
    };

    function isAbsolutePath(value) {
        return PATH_PROTOCOL_RE.test(value || '') || WINDOWS_DRIVE_RE.test(value || '');
    }

    function clonePathMap(map, fallback = RAW_DEFAULT_PATH_MAP) {
        const source = map && typeof map === 'object' ? map : fallback;
        const cloneCategory = (category) => {
            const segment = source[category] && typeof source[category] === 'object' ? source[category] : {};
            return {
                root: typeof segment.root === 'string' ? segment.root : '',
                exceptions: segment.exceptions && typeof segment.exceptions === 'object'
                    ? Object.assign({}, segment.exceptions)
                    : {}
            };
        };
        return {
            reading: cloneCategory('reading'),
            listening: cloneCategory('listening')
        };
    }

    function normalizePathRoot(value) {
        if (!value) {
            return '';
        }
        let root = String(value).replace(/\\/g, '/');
        root = root.replace(/\/+$/, '') + '/';
        if (root.startsWith('./')) {
            root = root.slice(2);
        }
        return root;
    }

    function mergeRootWithFallback(root, fallbackRoot) {
        const normalizedPrimary = normalizePathRoot(root || '');
        if (normalizedPrimary) {
            return normalizedPrimary;
        }
        return normalizePathRoot(fallbackRoot || '');
    }

    function buildOverridePathMap(metadata, fallback = RAW_DEFAULT_PATH_MAP) {
        const base = clonePathMap(fallback);
        if (!metadata || typeof metadata !== 'object') {
            return base;
        }

        const rootMeta = metadata.pathRoot;
        if (rootMeta && typeof rootMeta === 'object') {
            if (rootMeta.reading) {
                base.reading.root = normalizePathRoot(rootMeta.reading);
            }
            if (rootMeta.listening) {
                base.listening.root = normalizePathRoot(rootMeta.listening);
            }
        }

        return base;
    }

    const DEFAULT_PATH_MAP = buildOverridePathMap(
        typeof global !== 'undefined' ? global.examIndexMetadata : null,
        RAW_DEFAULT_PATH_MAP
    );

    function normalizePathMap(map, fallback = DEFAULT_PATH_MAP) {
        const base = clonePathMap(fallback);
        const incoming = clonePathMap(map);
        if (incoming.reading.root) {
            base.reading.root = normalizePathRoot(incoming.reading.root);
        }
        if (incoming.listening.root) {
            base.listening.root = normalizePathRoot(incoming.listening.root);
        }
        if (Object.keys(incoming.reading.exceptions).length) {
            base.reading.exceptions = Object.assign({}, incoming.reading.exceptions);
        }
        if (Object.keys(incoming.listening.exceptions).length) {
            base.listening.exceptions = Object.assign({}, incoming.listening.exceptions);
        }
        return base;
    }

    function computeCommonRoot(paths) {
        if (!paths || !paths.length) {
            return '';
        }
        const segmentsList = paths.map((rawPath) => {
            if (typeof rawPath !== 'string') {
                return [];
            }
            const normalized = rawPath.replace(/\\/g, '/').replace(/\/+$/g, '');
            return normalized ? normalized.split('/') : [];
        }).filter((segments) => segments.length);

        if (!segmentsList.length) {
            return '';
        }

        let prefix = segmentsList[0].slice();
        for (let i = 1; i < segmentsList.length; i += 1) {
            const segments = segmentsList[i];
            let index = 0;
            while (index < prefix.length && index < segments.length && prefix[index] === segments[index]) {
                index += 1;
            }
            if (index === 0) {
                return '';
            }
            prefix = prefix.slice(0, index);
        }

        return prefix.length ? prefix.join('/') + '/' : '';
    }

    function derivePathMapFromIndex(exams, fallbackMap = DEFAULT_PATH_MAP) {
        const fallback = normalizePathMap(fallbackMap);
        const result = clonePathMap(fallback);

        if (!Array.isArray(exams)) {
            return result;
        }

        const pathsByType = { reading: [], listening: [] };
        exams.forEach((exam) => {
            if (!exam || typeof exam.path !== 'string' || !exam.type) {
                return;
            }
            const normalized = exam.path.replace(/\\/g, '/');
            if (exam.type === 'reading') {
                pathsByType.reading.push(normalized);
            } else if (exam.type === 'listening') {
                pathsByType.listening.push(normalized);
            }
        });

        const readingRoot = computeCommonRoot(pathsByType.reading);
        if (pathsByType.reading.length) {
            result.reading.root = readingRoot ? normalizePathRoot(readingRoot) : '';
        }

        const listeningRoot = computeCommonRoot(pathsByType.listening);
        if (pathsByType.listening.length) {
            result.listening.root = listeningRoot ? normalizePathRoot(listeningRoot) : '';
        }

        return result;
    }

    function getPathMapStorageKey(key) {
        return PATH_MAP_STORAGE_PREFIX + key;
    }

    function setActivePathMap(map) {
        const normalized = normalizePathMap(map);
        try { global.__activeLibraryPathMap = normalized; } catch (_) { }
        try { global.pathMap = normalized; } catch (_) { }
        return normalized;
    }

    function getPathMap() {
        if (global.__activeLibraryPathMap && typeof global.__activeLibraryPathMap === 'object') {
            return normalizePathMap(global.__activeLibraryPathMap);
        }
        if (global.pathMap && typeof global.pathMap === 'object') {
            return normalizePathMap(global.pathMap);
        }
        return clonePathMap(DEFAULT_PATH_MAP);
    }

    async function loadPathMapForConfiguration(key) {
        if (!key || !global.storage || typeof global.storage.get !== 'function') {
            return clonePathMap(DEFAULT_PATH_MAP);
        }
        try {
            const stored = await global.storage.get(getPathMapStorageKey(key));
            if (stored && typeof stored === 'object') {
                return normalizePathMap(stored, DEFAULT_PATH_MAP);
            }
        } catch (error) {
            console.warn('[ResourceCore] 读取路径映射失败:', error);
        }
        return clonePathMap(DEFAULT_PATH_MAP);
    }

    async function savePathMapForConfiguration(key, exams, options = {}) {
        if (!key || !Array.isArray(exams)) {
            return null;
        }
        const fallback = options.fallbackMap || getPathMap();
        const overrideMap = options.overrideMap;
        const derived = overrideMap
            ? normalizePathMap(overrideMap, fallback)
            : derivePathMapFromIndex(exams, fallback);

        if (global.storage && typeof global.storage.set === 'function') {
            try {
                await global.storage.set(getPathMapStorageKey(key), derived);
            } catch (error) {
                console.warn('[ResourceCore] 写入路径映射失败:', error);
            }
        }

        if (options.setActive) {
            setActivePathMap(derived);
        }
        return derived;
    }

    async function refreshPathMap() {
        if (!global.storage || typeof global.storage.get !== 'function') {
            return setActivePathMap(getPathMap());
        }
        try {
            const key = await global.storage.get('active_exam_index_key', 'exam_index');
            const next = await loadPathMapForConfiguration(key || 'exam_index');
            return setActivePathMap(next);
        } catch (error) {
            console.warn('[ResourceCore] 刷新路径映射失败:', error);
            return setActivePathMap(getPathMap());
        }
    }

    function ensureTrailingSlash(value) {
        if (!value) {
            return '';
        }
        return value.endsWith('/') ? value : value + '/';
    }

    function joinAbsoluteResource(base, file) {
        const basePart = base ? String(base).replace(/\\/g, '/') : '';
        const filePart = file ? String(file).replace(/\\/g, '/').replace(/^\/+/, '') : '';
        if (!basePart) {
            return encodeURI(filePart);
        }
        if (!filePart) {
            return encodeURI(basePart);
        }
        const baseWithSlash = basePart.endsWith('/') ? basePart : basePart + '/';
        return encodeURI(baseWithSlash + filePart);
    }

    function encodePathSegments(path) {
        if (!path) {
            return '';
        }
        const segments = String(path).split('/');
        return segments.map((segment) => {
            if (!segment) {
                return segment;
            }
            try {
                return encodeURIComponent(decodeURIComponent(segment));
            } catch (_) {
                return encodeURIComponent(segment);
            }
        }).join('/');
    }

    function sanitizeFilename(name, kind) {
        if (!name) {
            return '';
        }
        const value = String(name);
        if (/\.html?$/i.test(value) || /\.pdf$/i.test(value)) {
            return value;
        }
        if (kind === 'html' && /\.pdf$/i.test(value)) {
            return value.replace(/\.pdf$/i, '.pdf.html');
        }
        if (/html$/i.test(value)) {
            return value.replace(/html$/i, '.html');
        }
        if (/pdf$/i.test(value)) {
            return value.replace(/pdf$/i, '.pdf');
        }
        return kind === 'pdf' ? value + '.pdf' : value + '.html';
    }

    function stripQueryAndHash(url) {
        if (!url) {
            return '';
        }
        const withoutHash = String(url).split('#', 1)[0];
        return withoutHash.split('?', 1)[0];
    }

    function normalizeThemeBasePrefix(prefix) {
        if (prefix == null) {
            return './';
        }
        const normalized = String(prefix).trim().replace(/\\/g, '/');
        if (!normalized || normalized === '.' || normalized === './') {
            return './';
        }
        return normalized.replace(/\/+$/g, '');
    }

    function detectScriptBasePrefix() {
        if (typeof document === 'undefined') {
            return null;
        }
        try {
            const scripts = document.getElementsByTagName('script');
            const candidates = [
                'js/core/resourceCore.js',
                'js/main.js',
                'js/app.js',
                'js/boot-fallbacks.js',
                'js/plugins/hp/hp-path.js'
            ];

            for (let i = scripts.length - 1; i >= 0; i -= 1) {
                const script = scripts[i];
                if (!script) {
                    continue;
                }
                const rawSrc = stripQueryAndHash(script.getAttribute('src'));
                if (!rawSrc) {
                    continue;
                }
                const normalized = rawSrc.replace(/\\/g, '/').trim();
                if (!normalized || isAbsolutePath(normalized)) {
                    continue;
                }
                for (let j = 0; j < candidates.length; j += 1) {
                    const candidate = candidates[j];
                    const index = normalized.lastIndexOf(candidate);
                    if (index === -1) {
                        continue;
                    }
                    const prefix = normalized.slice(0, index);
                    return prefix || './';
                }
            }
        } catch (error) {
            console.warn('[ResourceCore] detectScriptBasePrefix failed:', error);
        }
        return null;
    }

    function loadStoredBasePrefix() {
        try {
            return localStorage.getItem(BASE_PREFIX_STORAGE_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function storeBasePrefix(value) {
        try {
            if (value) {
                localStorage.setItem(BASE_PREFIX_STORAGE_KEY, value);
            } else {
                localStorage.removeItem(BASE_PREFIX_STORAGE_KEY);
            }
        } catch (_) { }
    }

    function getBasePrefix() {
        const direct = normalizeThemeBasePrefix(global.HP_BASE_PREFIX);
        if (direct && direct !== './') {
            return direct;
        }

        const stored = normalizeThemeBasePrefix(loadStoredBasePrefix());
        if (stored && stored !== './') {
            global.HP_BASE_PREFIX = stored;
            return stored;
        }

        const detected = normalizeThemeBasePrefix(detectScriptBasePrefix());
        if (detected && detected !== './') {
            global.HP_BASE_PREFIX = detected;
            return detected;
        }

        return direct || stored || detected || './';
    }

    function setBasePrefix(value) {
        const normalized = normalizeThemeBasePrefix(value);
        global.HP_BASE_PREFIX = normalized;
        storeBasePrefix(normalized === './' ? '' : normalized);
        return normalized;
    }

    function resolveExamBasePath(exam) {
        const relativePath = exam && exam.path ? String(exam.path) : '';
        const normalizedRelative = relativePath.replace(/\\/g, '/').trim();
        if (normalizedRelative && isAbsolutePath(normalizedRelative)) {
            return ensureTrailingSlash(normalizedRelative);
        }

        let combined = normalizedRelative;
        try {
            const pathMap = getPathMap() || {};
            const type = exam && exam.type;
            const mapped = type && pathMap[type] ? pathMap[type] : {};
            const fallback = type && DEFAULT_PATH_MAP[type] ? DEFAULT_PATH_MAP[type] : {};
            const root = mergeRootWithFallback(mapped.root, fallback.root);
            const normalizedRoot = root.replace(/\\/g, '/');
            if (normalizedRoot) {
                if (normalizedRelative && normalizedRelative.startsWith(normalizedRoot)) {
                    combined = normalizedRelative;
                } else {
                    combined = normalizedRoot + normalizedRelative;
                }
            }
        } catch (_) { }

        combined = combined.replace(/\\/g, '/');
        combined = combined.replace(/\/{2,}/g, '/');
        return ensureTrailingSlash(combined);
    }

    function joinResourcePath(base, folder, fileName) {
        const segments = [];
        const basePart = base ? String(base).replace(/\\/g, '/').replace(/\/+$/g, '') : '';
        const folderPart = folder ? String(folder).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/g, '') : '';
        const filePart = fileName ? String(fileName).replace(/\\/g, '/').replace(/^\/+/, '') : '';
        if (basePart) {
            segments.push(basePart);
        }
        if (folderPart) {
            segments.push(folderPart);
        }
        if (filePart) {
            segments.push(filePart);
        }
        return segments.join('/');
    }

    function buildResourcePath(exam, kind = 'html') {
        if (!exam) {
            return '';
        }
        const resourceKind = kind === 'pdf' ? 'pdf' : 'html';
        const rawName = resourceKind === 'pdf' ? exam.pdfFilename : exam.filename;
        const file = sanitizeFilename(rawName, resourceKind);
        const basePath = resolveExamBasePath(exam);
        const prefix = getBasePrefix();

        const normalizedFile = file ? String(file).replace(/\\/g, '/') : '';
        if (isAbsolutePath(normalizedFile)) {
            return joinAbsoluteResource(normalizedFile, '');
        }

        // Support centralized PDF storage paths such as "assets/reading/*.pdf".
        // These paths are repository-root relative and must not inherit cached HP_BASE_PREFIX.
        if (resourceKind === 'pdf' && /^readingpractice\/pdf\//i.test(normalizedFile)) {
            const rootedPdfPath = normalizedFile.replace(/^\/+/, '');
            const encodedPdfPath = encodePathSegments(rootedPdfPath);
            return encodedPdfPath ? './' + encodedPdfPath : './';
        }

        const normalizedBasePath = basePath ? String(basePath).replace(/\\/g, '/') : '';
        if (isAbsolutePath(normalizedBasePath)) {
            return joinAbsoluteResource(normalizedBasePath, normalizedFile);
        }

        const baseSegment = normalizedBasePath.replace(/^\.+\//, '').replace(/^\/+/, '');
        const normalizedBase = baseSegment && !baseSegment.endsWith('/') ? baseSegment + '/' : baseSegment;
        const relativePath = (normalizedBase || '') + normalizedFile;
        const encodedRelative = encodePathSegments(relativePath);

        if (prefix === './') {
            return encodedRelative ? './' + encodedRelative : './';
        }

        const trimmedPrefix = prefix ? prefix.replace(/\/+$/g, '') : '';
        return trimmedPrefix ? trimmedPrefix + '/' + encodedRelative : encodedRelative;
    }

    function getResourceAttempts(exam, kind = 'html') {
        if (!exam) {
            return [];
        }
        const attempts = [];
        const seen = new Set();
        const addAttempt = (label, path) => {
            if (!path || seen.has(path)) {
                return;
            }
            seen.add(path);
            attempts.push({ label, path });
        };

        addAttempt('map', buildResourcePath(exam, kind));

        const resourceKind = kind === 'pdf' ? 'pdf' : 'html';
        const file = sanitizeFilename(resourceKind === 'pdf' ? (exam.pdfFilename || exam.filename) : exam.filename, resourceKind);
        if (!file) {
            return attempts;
        }

        const folder = exam.path || '';
        addAttempt('fallback', encodePathSegments(joinResourcePath(getBasePrefix(), folder, file)));
        addAttempt('raw', encodePathSegments(joinResourcePath('', folder, file)));
        addAttempt('relative-up', encodePathSegments(joinResourcePath('..', folder, file)));
        addAttempt('relative-design', encodePathSegments(joinResourcePath('../..', folder, file)));

        return attempts;
    }

    function shouldBypassProbe(url) {
        if (!url) return false;
        try {
            const resolved = new URL(url, global.location && global.location.href ? global.location.href : undefined);
            const protocol = (resolved.protocol || '').toLowerCase();
            if (protocol === 'file:' || protocol === 'app:' || protocol === 'chrome-extension:' || protocol === 'capacitor:' || protocol === 'ionic:') {
                return true;
            }
            if (global.location && global.location.protocol === 'file:' && !isAbsolutePath(url)) {
                return true;
            }
        } catch (_) {
            if (global.location && global.location.protocol === 'file:' && !isAbsolutePath(url)) {
                return true;
            }
        }
        return false;
    }

    const resourceProbeCache = new Map();

    function probeResource(url) {
        if (!url) {
            return Promise.resolve(false);
        }
        if (resourceProbeCache.has(url)) {
            return resourceProbeCache.get(url);
        }
        const attempt = (async () => {
            if (shouldBypassProbe(url)) {
                return true;
            }
            try {
                const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                if (response && (response.ok || response.status === 304 || response.status === 405 || response.type === 'opaque')) {
                    return true;
                }
                if (response && response.status >= 400) {
                    return false;
                }
            } catch (_) {
                if (shouldBypassProbe(url)) {
                    return true;
                }
            }
            return false;
        })();
        resourceProbeCache.set(url, attempt);
        return attempt;
    }

    async function resolveResource(exam, kind = 'html') {
        const attempts = getResourceAttempts(exam, kind);
        for (let i = 0; i < attempts.length; i += 1) {
            const entry = attempts[i];
            try {
                const ok = await probeResource(entry.path);
                if (ok) {
                    return { url: entry.path, attempts };
                }
            } catch (error) {
                console.warn('[ResourceCore] 资源探测失败:', entry, error);
            }
        }
        return { url: '', attempts };
    }

    global.ResourceCore = {
        __stable: true,
        version: '1.0.0',
        RAW_DEFAULT_PATH_MAP,
        DEFAULT_PATH_MAP,
        PATH_MAP_STORAGE_PREFIX,
        PATH_FALLBACK_ORDER,
        clonePathMap,
        normalizePathRoot,
        mergeRootWithFallback,
        buildOverridePathMap,
        derivePathMapFromIndex,
        getPathMapStorageKey,
        getPathMap,
        setActivePathMap,
        loadPathMapForConfiguration,
        savePathMapForConfiguration,
        refreshPathMap,
        getBasePrefix,
        setBasePrefix,
        resolveExamBasePath,
        buildResourcePath,
        getResourceAttempts,
        resolveResource,
        sanitizeFilename,
        encodePathSegments,
        detectScriptBasePrefix,
        normalizeThemeBasePrefix
    };
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/app/state-service.js =====
(function (global) {
    'use strict';

    function cloneArray(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    function cloneSet(value) {
        if (value instanceof Set) {
            return new Set(value);
        }
        if (Array.isArray(value)) {
            return new Set(value);
        }
        return new Set();
    }

    function cloneCustomSuiteExam(value) {
        if (!value || typeof value !== 'object') {
            return null;
        }
        return {
            examId: typeof value.examId === 'string'
                ? value.examId
                : String(value.examId != null ? value.examId : (value.id == null ? '' : value.id)),
            title: typeof value.title === 'string' ? value.title : '',
            category: typeof value.category === 'string' ? value.category : '',
            frequency: typeof value.frequency === 'string' ? value.frequency : '',
            type: typeof value.type === 'string' ? value.type : '',
            hasHtml: value.hasHtml === true
        };
    }

    function getCustomSuiteCategories(value) {
        const categories = value && Array.isArray(value.categories) && value.categories.length
            ? value.categories.slice()
            : ['P1', 'P2', 'P3'];
        return categories.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean);
    }

    function normalizeCustomSuiteDraft(value) {
        if (!value || typeof value !== 'object') {
            return null;
        }

        const categories = getCustomSuiteCategories(value);
        const rawPickedByCategory = value.pickedByCategory && typeof value.pickedByCategory === 'object'
            ? value.pickedByCategory
            : {};
        const pickedByCategory = {};
        const pickedOrder = [];

        categories.forEach((category) => {
            const exam = cloneCustomSuiteExam(rawPickedByCategory[category]);
            if (exam && exam.examId) {
                exam.category = category;
                pickedByCategory[category] = exam;
            }
        });

        let stageIndex = 0;
        for (let i = 0; i < categories.length; i += 1) {
            const category = categories[i];
            const exam = pickedByCategory[category];
            if (!exam) {
                break;
            }
            pickedOrder.push(exam);
            stageIndex = i + 1;
        }

        const rawStatus = typeof value.status === 'string' ? value.status.trim().toLowerCase() : 'selecting';
        const status = stageIndex >= categories.length
            ? 'ready'
            : (rawStatus && rawStatus !== 'ready' ? rawStatus : 'selecting');

        return {
            status,
            stageIndex,
            categories,
            pickedByCategory,
            pickedOrder,
            flowMode: typeof value.flowMode === 'string' && value.flowMode ? value.flowMode : 'classic',
            frequencyScope: typeof value.frequencyScope === 'string' && value.frequencyScope ? value.frequencyScope : 'custom',
            createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
            updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()
        };
    }

    function normalizeFilter(value) {
        if (!value || typeof value !== 'object') {
            return { category: 'all', type: 'all' };
        }
        return {
            category: typeof value.category === 'string' ? value.category : 'all',
            type: typeof value.type === 'string' ? value.type : 'all'
        };
    }

    function emit(listeners, topic, payload) {
        const handlers = listeners[topic];
        if (!handlers) {
            return;
        }
        handlers.forEach((handler) => {
            try {
                handler(payload);
            } catch (error) {
                console.error('[AppStateService] listener error for %s:', topic, error);
            }
        });
    }

    function defineGlobalProperty(globalRef, key, descriptor) {
        try {
            Object.defineProperty(globalRef, key, Object.assign({
                configurable: true,
                enumerable: true
            }, descriptor || {}));
        } catch (error) {
            console.warn('[AppStateService] defineProperty failed:', key, error);
        }
    }

    function enrichPracticeRecordForUI(record) {
        if (!record || typeof record !== 'object') {
            return record;
        }
        if (global.DataConsistencyManager) {
            try {
                const manager = new global.DataConsistencyManager();
                return manager.enrichRecordData(record);
            } catch (error) {
                console.warn('[AppStateService] enrichPracticeRecordForUI failed:', error);
            }
        }
        return record;
    }

    function assignExamSequenceNumbers(exams) {
        if (!Array.isArray(exams)) {
            return [];
        }
        exams.forEach((exam, index) => {
            if (exam && typeof exam === 'object') {
                exam.sequenceNumber = index + 1;
            }
        });
        return exams;
    }

    class AppStateService {
        constructor(options = {}) {
            this.options = Object.assign({
                onBrowseFilterChange: null
            }, options || {});

            this.app = null;
            this.globalRef = global;
            this.globalBindingsInstalled = false;

            this.state = {
                examIndex: cloneArray(global.examIndex),
                practiceRecords: cloneArray(global.practiceRecords),
                filteredExams: Array.isArray(global.filteredExams) ? global.filteredExams : [],
                browseFilter: normalizeFilter(global.__browseFilter),
                bulkDeleteMode: !!global.bulkDeleteMode,
                selectedRecords: cloneSet(global.selectedRecords),
                customSuiteDraft: normalizeCustomSuiteDraft(global.customSuiteDraft),
                processedSessions: global.processedSessions instanceof Set ? global.processedSessions : new Set(),
                fallbackExamSessions: global.fallbackExamSessions instanceof Map ? global.fallbackExamSessions : new Map()
            };

            this.listeners = {
                examIndex: new Set(),
                practiceRecords: new Set(),
                filteredExams: new Set(),
                browseFilter: new Set(),
                bulkDeleteMode: new Set(),
                selectedRecords: new Set(),
                customSuiteDraft: new Set(),
                processedSessions: new Set(),
                fallbackExamSessions: new Set()
            };
        }

        configure(options = {}) {
            if (!options || typeof options !== 'object') {
                return this;
            }
            this.options = Object.assign({}, this.options, options);
            return this;
        }

        subscribe(topic, handler) {
            if (!this.listeners[topic] || typeof handler !== 'function') {
                return function noop() {};
            }
            this.listeners[topic].add(handler);
            return () => this.listeners[topic].delete(handler);
        }

        connectApp(appInstance) {
            if (!appInstance || typeof appInstance !== 'object') {
                return this;
            }

            this.app = appInstance;

            if (!appInstance.__appStateServiceWrapped && typeof appInstance.setState === 'function') {
                const originalSetState = appInstance.setState.bind(appInstance);
                appInstance.setState = (path, value) => {
                    const result = originalSetState(path, value);
                    this.syncFromAppPath(path, value);
                    return result;
                };
                appInstance.__appStateServiceWrapped = true;
            }

            this.applyToApp();
            return this;
        }

        applyToApp() {
            const app = this.app;
            if (!app || !app.state) {
                return;
            }

            try {
                if (app.state.exam) {
                    app.state.exam.index = this.state.examIndex;
                    app.state.exam.currentCategory = this.state.browseFilter.category;
                    app.state.exam.currentExamType = this.state.browseFilter.type;
                    app.state.exam.filteredExams = this.state.filteredExams;
                }
                if (app.state.practice) {
                    app.state.practice.records = this.state.practiceRecords;
                    app.state.practice.selectedRecords = this.state.selectedRecords;
                    app.state.practice.bulkDeleteMode = this.state.bulkDeleteMode;
                }
                if (app.state.ui) {
                    app.state.ui.browseFilter = this.state.browseFilter;
                    app.state.ui.legacyBrowseType = this.state.browseFilter.type;
                    app.state.ui.customSuiteDraft = this.state.customSuiteDraft;
                }
                if (app.state.system) {
                    app.state.system.processedSessions = this.state.processedSessions;
                    app.state.system.fallbackExamSessions = this.state.fallbackExamSessions;
                }
            } catch (error) {
                console.warn('[AppStateService] applyToApp failed:', error);
            }
        }

        syncFromAppPath(path, value) {
            switch (path) {
                case 'exam.index':
                    this.setExamIndex(value, { syncApp: false });
                    break;
                case 'practice.records':
                    this.setPracticeRecords(value, { syncApp: false });
                    break;
                case 'exam.filteredExams':
                    this.setFilteredExams(value, { syncApp: false });
                    break;
                case 'ui.browseFilter':
                    this.setBrowseFilter(value, { syncApp: false });
                    break;
                case 'exam.currentCategory':
                    this.setBrowseFilter({
                        category: typeof value === 'string' ? value : this.state.browseFilter.category,
                        type: this.state.browseFilter.type
                    }, { syncApp: false });
                    break;
                case 'exam.currentExamType':
                case 'ui.legacyBrowseType':
                    this.setBrowseFilter({
                        category: this.state.browseFilter.category,
                        type: typeof value === 'string' ? value : this.state.browseFilter.type
                    }, { syncApp: false });
                    break;
                case 'ui.customSuiteDraft':
                    this.setCustomSuiteDraft(value, { syncApp: false });
                    break;
                case 'practice.bulkDeleteMode':
                    this.setBulkDeleteMode(value, { syncApp: false });
                    break;
                case 'practice.selectedRecords':
                    this.setSelectedRecords(value, { syncApp: false });
                    break;
                case 'system.processedSessions':
                    this.setProcessedSessions(value, { syncApp: false });
                    break;
                case 'system.fallbackExamSessions':
                    this.setFallbackExamSessions(value, { syncApp: false });
                    break;
                default:
                    break;
            }
        }

        getExamIndex() {
            return this.state.examIndex;
        }

        setExamIndex(list, options = {}) {
            const normalized = assignExamSequenceNumbers(cloneArray(list));
            this.state.examIndex = normalized;
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'examIndex', this.state.examIndex);
            return this.state.examIndex;
        }

        getPracticeRecords() {
            return this.state.practiceRecords;
        }

        setPracticeRecords(records, options = {}) {
            const normalized = Array.isArray(records) ? records.map(enrichPracticeRecordForUI) : [];
            this.state.practiceRecords = normalized;
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'practiceRecords', this.state.practiceRecords);
            if (typeof global.updateBrowseAnchorsFromRecords === 'function') {
                try {
                    global.updateBrowseAnchorsFromRecords(this.state.practiceRecords);
                } catch (error) {
                    console.warn('[AppStateService] updateBrowseAnchorsFromRecords failed:', error);
                }
            }
            return this.state.practiceRecords;
        }

        getFilteredExams() {
            return this.state.filteredExams;
        }

        setFilteredExams(exams, options = {}) {
            this.state.filteredExams = cloneArray(exams);
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'filteredExams', this.state.filteredExams);
            return this.state.filteredExams;
        }

        getBrowseFilter() {
            return this.state.browseFilter;
        }

        setBrowseFilter(filter, options = {}) {
            this.state.browseFilter = normalizeFilter(filter);
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'browseFilter', this.state.browseFilter);
            if (typeof global.persistBrowseFilter === 'function') {
                try {
                    global.persistBrowseFilter(this.state.browseFilter.category, this.state.browseFilter.type);
                } catch (error) {
                    console.warn('[AppStateService] persistBrowseFilter failed:', error);
                }
            }
            if (typeof this.options.onBrowseFilterChange === 'function') {
                try {
                    this.options.onBrowseFilterChange(this.state.browseFilter.category, this.state.browseFilter.type);
                } catch (error) {
                    console.warn('[AppStateService] onBrowseFilterChange failed:', error);
                }
            }
            return this.state.browseFilter;
        }

        getBulkDeleteMode() {
            return !!this.state.bulkDeleteMode;
        }

        setBulkDeleteMode(value, options = {}) {
            this.state.bulkDeleteMode = !!value;
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'bulkDeleteMode', this.state.bulkDeleteMode);
            return this.state.bulkDeleteMode;
        }

        clearBulkDeleteMode() {
            return this.setBulkDeleteMode(false);
        }

        getSelectedRecords() {
            return this.state.selectedRecords;
        }

        setSelectedRecords(records, options = {}) {
            this.state.selectedRecords = cloneSet(records);
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'selectedRecords', this.state.selectedRecords);
            return this.state.selectedRecords;
        }

        addSelectedRecord(id) {
            if (id != null) {
                this.state.selectedRecords.add(String(id));
                this.applyToApp();
                emit(this.listeners, 'selectedRecords', this.state.selectedRecords);
            }
            return this.state.selectedRecords;
        }

        removeSelectedRecord(id) {
            if (id != null) {
                this.state.selectedRecords.delete(String(id));
                this.applyToApp();
                emit(this.listeners, 'selectedRecords', this.state.selectedRecords);
            }
            return this.state.selectedRecords;
        }

        clearSelectedRecords() {
            this.state.selectedRecords.clear();
            this.applyToApp();
            emit(this.listeners, 'selectedRecords', this.state.selectedRecords);
            return this.state.selectedRecords;
        }

        getCustomSuiteDraft() {
            return this.state.customSuiteDraft;
        }

        setCustomSuiteDraft(draft, options = {}) {
            this.state.customSuiteDraft = normalizeCustomSuiteDraft(draft);
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'customSuiteDraft', this.state.customSuiteDraft);
            return this.state.customSuiteDraft;
        }

        updateCustomSuiteDraft(updater, options = {}) {
            const current = this.state.customSuiteDraft
                ? normalizeCustomSuiteDraft(this.state.customSuiteDraft)
                : null;
            const next = typeof updater === 'function'
                ? updater(current)
                : current;
            return this.setCustomSuiteDraft(next, options);
        }

        clearCustomSuiteDraft(options = {}) {
            this.state.customSuiteDraft = null;
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'customSuiteDraft', this.state.customSuiteDraft);
            return this.state.customSuiteDraft;
        }

        selectCustomSuiteExam(exam, options = {}) {
            if (!exam || typeof exam !== 'object') {
                return this.state.customSuiteDraft;
            }

            const normalizedExam = cloneCustomSuiteExam(exam);
            if (!normalizedExam || !normalizedExam.examId) {
                return this.state.customSuiteDraft;
            }

            return this.updateCustomSuiteDraft((current) => {
                const next = current ? normalizeCustomSuiteDraft(current) : normalizeCustomSuiteDraft({
                    status: 'selecting',
                    stageIndex: 0,
                    pickedByCategory: {},
                    pickedOrder: [],
                    flowMode: options.flowMode || 'classic',
                    frequencyScope: options.frequencyScope || 'custom'
                });

                if (!next) {
                    return null;
                }

                const categories = getCustomSuiteCategories(next);
                const expectedCategory = categories[Math.min(next.stageIndex, categories.length - 1)];
                const examCategory = typeof normalizedExam.category === 'string' ? normalizedExam.category.trim().toUpperCase() : '';
                if (expectedCategory && examCategory && expectedCategory !== examCategory) {
                    return next;
                }

                normalizedExam.category = expectedCategory || examCategory || normalizedExam.category;
                next.pickedByCategory = Object.assign({}, next.pickedByCategory, {
                    [normalizedExam.category]: normalizedExam
                });
                next.pickedOrder = categories
                    .map((category) => next.pickedByCategory[category])
                    .filter(Boolean);
                next.stageIndex = Math.min(next.pickedOrder.length, categories.length);
                next.status = next.stageIndex >= categories.length ? 'ready' : 'selecting';
                next.flowMode = options.flowMode || next.flowMode || 'classic';
                next.frequencyScope = options.frequencyScope || next.frequencyScope || 'custom';
                next.updatedAt = Date.now();
                return next;
            }, options);
        }

        removeCustomSuiteSelection(category, options = {}) {
            const normalizedCategory = typeof category === 'string' ? category.trim().toUpperCase() : '';
            if (!normalizedCategory || !this.state.customSuiteDraft) {
                return this.state.customSuiteDraft;
            }

            return this.updateCustomSuiteDraft((current) => {
                const next = current ? normalizeCustomSuiteDraft(current) : null;
                if (!next) {
                    return null;
                }
                if (next.pickedByCategory && Object.prototype.hasOwnProperty.call(next.pickedByCategory, normalizedCategory)) {
                    delete next.pickedByCategory[normalizedCategory];
                }
                next.pickedOrder = next.categories
                    .map((entryCategory) => next.pickedByCategory[entryCategory])
                    .filter(Boolean);
                next.stageIndex = Math.min(next.pickedOrder.length, next.categories.length);
                next.status = next.stageIndex >= next.categories.length ? 'ready' : 'selecting';
                next.updatedAt = Date.now();
                return next;
            }, options);
        }

        getProcessedSessions() {
            return this.state.processedSessions;
        }

        setProcessedSessions(value, options = {}) {
            this.state.processedSessions = value instanceof Set ? value : cloneSet(value);
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'processedSessions', this.state.processedSessions);
            return this.state.processedSessions;
        }

        markSessionProcessed(id) {
            if (id != null) {
                this.state.processedSessions.add(String(id));
                this.applyToApp();
                emit(this.listeners, 'processedSessions', this.state.processedSessions);
            }
            return this.state.processedSessions;
        }

        clearProcessedSessions() {
            this.state.processedSessions.clear();
            this.applyToApp();
            emit(this.listeners, 'processedSessions', this.state.processedSessions);
            return this.state.processedSessions;
        }

        getFallbackExamSessions() {
            return this.state.fallbackExamSessions;
        }

        setFallbackExamSessions(map, options = {}) {
            this.state.fallbackExamSessions = map instanceof Map ? map : new Map();
            if (options.syncApp !== false) {
                this.applyToApp();
            }
            emit(this.listeners, 'fallbackExamSessions', this.state.fallbackExamSessions);
            return this.state.fallbackExamSessions;
        }

        clearFallbackExamSessions() {
            this.state.fallbackExamSessions.clear();
            this.applyToApp();
            emit(this.listeners, 'fallbackExamSessions', this.state.fallbackExamSessions);
            return this.state.fallbackExamSessions;
        }

        installGlobalBindings(globalRef) {
            if (!globalRef || this.globalBindingsInstalled) {
                return this;
            }

            const service = this;

            globalRef.getExamIndexState = function getExamIndexState() {
                return service.getExamIndex();
            };
            globalRef.setExamIndexState = function setExamIndexState(list) {
                return service.setExamIndex(list);
            };
            globalRef.getPracticeRecordsState = function getPracticeRecordsState() {
                return service.getPracticeRecords();
            };
            globalRef.setPracticeRecordsState = function setPracticeRecordsState(records) {
                return service.setPracticeRecords(records);
            };
            globalRef.getFilteredExamsState = function getFilteredExamsState() {
                return service.getFilteredExams();
            };
            globalRef.setFilteredExamsState = function setFilteredExamsState(exams) {
                return service.setFilteredExams(exams);
            };
            globalRef.getBrowseFilterState = function getBrowseFilterState() {
                return service.getBrowseFilter();
            };
            globalRef.setBrowseFilterState = function setBrowseFilterState(category, type) {
                return service.setBrowseFilter({ category, type });
            };
            globalRef.getCurrentCategory = function getCurrentCategory() {
                return service.getBrowseFilter().category || 'all';
            };
            globalRef.getCurrentExamType = function getCurrentExamType() {
                return service.getBrowseFilter().type || 'all';
            };
            globalRef.getBulkDeleteModeState = function getBulkDeleteModeState() {
                return service.getBulkDeleteMode();
            };
            globalRef.setBulkDeleteModeState = function setBulkDeleteModeState(value) {
                return service.setBulkDeleteMode(value);
            };
            globalRef.clearBulkDeleteModeState = function clearBulkDeleteModeState() {
                return service.clearBulkDeleteMode();
            };
            globalRef.getSelectedRecordsState = function getSelectedRecordsState() {
                return service.getSelectedRecords();
            };
            globalRef.addSelectedRecordState = function addSelectedRecordState(id) {
                return service.addSelectedRecord(id);
            };
            globalRef.removeSelectedRecordState = function removeSelectedRecordState(id) {
                return service.removeSelectedRecord(id);
            };
            globalRef.clearSelectedRecordsState = function clearSelectedRecordsState() {
                return service.clearSelectedRecords();
            };
            globalRef.getCustomSuiteDraftState = function getCustomSuiteDraftState() {
                return service.getCustomSuiteDraft();
            };
            globalRef.setCustomSuiteDraftState = function setCustomSuiteDraftState(value) {
                return service.setCustomSuiteDraft(value);
            };
            globalRef.updateCustomSuiteDraftState = function updateCustomSuiteDraftState(updater) {
                return service.updateCustomSuiteDraft(updater);
            };
            globalRef.clearCustomSuiteDraftState = function clearCustomSuiteDraftState() {
                return service.clearCustomSuiteDraft();
            };
            globalRef.selectCustomSuiteExamState = function selectCustomSuiteExamState(exam, options) {
                return service.selectCustomSuiteExam(exam, options);
            };
            globalRef.removeCustomSuiteSelectionState = function removeCustomSuiteSelectionState(category, options) {
                return service.removeCustomSuiteSelection(category, options);
            };
            globalRef.assignExamSequenceNumbers = assignExamSequenceNumbers;

            defineGlobalProperty(globalRef, 'examIndex', {
                get: () => service.getExamIndex(),
                set: (value) => service.setExamIndex(value)
            });
            defineGlobalProperty(globalRef, 'practiceRecords', {
                get: () => service.getPracticeRecords(),
                set: (value) => service.setPracticeRecords(value)
            });
            defineGlobalProperty(globalRef, 'filteredExams', {
                get: () => service.getFilteredExams(),
                set: (value) => service.setFilteredExams(value)
            });
            defineGlobalProperty(globalRef, 'bulkDeleteMode', {
                get: () => service.getBulkDeleteMode(),
                set: (value) => service.setBulkDeleteMode(value)
            });
            defineGlobalProperty(globalRef, 'selectedRecords', {
                get: () => service.getSelectedRecords(),
                set: (value) => service.setSelectedRecords(value)
            });
            defineGlobalProperty(globalRef, 'customSuiteDraft', {
                get: () => service.getCustomSuiteDraft(),
                set: (value) => service.setCustomSuiteDraft(value)
            });
            defineGlobalProperty(globalRef, '__browseFilter', {
                get: () => service.getBrowseFilter(),
                set: (value) => service.setBrowseFilter(value)
            });
            defineGlobalProperty(globalRef, 'currentCategory', {
                get: () => service.getBrowseFilter().category || 'all',
                set: (value) => service.setBrowseFilter({
                    category: typeof value === 'string' ? value : 'all',
                    type: service.getBrowseFilter().type || 'all'
                })
            });
            defineGlobalProperty(globalRef, 'currentExamType', {
                get: () => service.getBrowseFilter().type || 'all',
                set: (value) => service.setBrowseFilter({
                    category: service.getBrowseFilter().category || 'all',
                    type: typeof value === 'string' ? value : 'all'
                })
            });
            defineGlobalProperty(globalRef, '__legacyBrowseType', {
                get: () => service.getBrowseFilter().type || 'all',
                set: (value) => service.setBrowseFilter({
                    category: service.getBrowseFilter().category || 'all',
                    type: typeof value === 'string' ? value : 'all'
                })
            });
            defineGlobalProperty(globalRef, 'fallbackExamSessions', {
                get: () => service.getFallbackExamSessions(),
                set: (value) => service.setFallbackExamSessions(value)
            });
            defineGlobalProperty(globalRef, 'processedSessions', {
                get: () => service.getProcessedSessions(),
                set: (value) => service.setProcessedSessions(value)
            });

            this.globalBindingsInstalled = true;
            return this;
        }
    }

    AppStateService.getInstance = function getInstance(options = {}) {
        if (!global.__appStateServiceInstance) {
            global.__appStateServiceInstance = new AppStateService(options);
        } else {
            global.__appStateServiceInstance.configure(options);
        }
        return global.__appStateServiceInstance;
    };

    global.AppStateService = AppStateService;
    global.appStateService = AppStateService.getInstance();
    global.appStateService.installGlobalBindings(global);
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/services/libraryManager.js =====
(function (global) {
    'use strict';

    function getResourceCore() {
        return global.ResourceCore || null;
    }

    function cloneArray(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    class LibraryManager {
        constructor(options = {}) {
            this.options = options || {};
        }

        get resourceCore() {
            return getResourceCore();
        }

        get RAW_DEFAULT_PATH_MAP() {
            return this.resourceCore ? this.resourceCore.RAW_DEFAULT_PATH_MAP : null;
        }

        get DEFAULT_PATH_MAP() {
            return this.resourceCore ? this.resourceCore.DEFAULT_PATH_MAP : null;
        }

        normalizePathRoot(value) {
            return this.resourceCore && typeof this.resourceCore.normalizePathRoot === 'function'
                ? this.resourceCore.normalizePathRoot(value)
                : '';
        }

        mergeRootWithFallback(root, fallbackRoot) {
            return this.resourceCore && typeof this.resourceCore.mergeRootWithFallback === 'function'
                ? this.resourceCore.mergeRootWithFallback(root, fallbackRoot)
                : '';
        }

        buildOverridePathMap(metadata, fallback) {
            return this.resourceCore && typeof this.resourceCore.buildOverridePathMap === 'function'
                ? this.resourceCore.buildOverridePathMap(metadata, fallback)
                : (fallback || null);
        }

        getPathMap() {
            return this.resourceCore && typeof this.resourceCore.getPathMap === 'function'
                ? this.resourceCore.getPathMap()
                : null;
        }

        async loadPathMapForConfiguration(key) {
            return this.resourceCore && typeof this.resourceCore.loadPathMapForConfiguration === 'function'
                ? this.resourceCore.loadPathMapForConfiguration(key)
                : null;
        }

        async savePathMapForConfiguration(key, examIndex, options = {}) {
            return this.resourceCore && typeof this.resourceCore.savePathMapForConfiguration === 'function'
                ? this.resourceCore.savePathMapForConfiguration(key, examIndex, options)
                : null;
        }

        setActivePathMap(map) {
            return this.resourceCore && typeof this.resourceCore.setActivePathMap === 'function'
                ? this.resourceCore.setActivePathMap(map)
                : (map || null);
        }

        async getActiveLibraryConfigurationKey() {
            return global.storage.get('active_exam_index_key', 'exam_index');
        }

        async setActiveLibraryConfiguration(key) {
            try {
                await global.storage.set('active_exam_index_key', key);
            } catch (error) {
                console.error('[LibraryManager] 设置活动题库配置失败:', error);
            }
        }

        async getLibraryConfigurations() {
            return global.storage.get('exam_index_configurations', []);
        }

        async saveLibraryConfiguration(name, key, examCount) {
            try {
                let configs = await global.storage.get('exam_index_configurations', []);
                if (!Array.isArray(configs)) {
                    configs = [];
                }
                const entry = { name, key, examCount, timestamp: Date.now() };
                const existingIndex = configs.findIndex((item) => item && item.key === key);
                if (existingIndex >= 0) {
                    configs[existingIndex] = entry;
                } else {
                    configs.push(entry);
                }
                await global.storage.set('exam_index_configurations', configs);
            } catch (error) {
                console.error('[LibraryManager] 保存题库配置失败:', error);
            }
        }

        resolveScriptPathRoot(type) {
            const defaultRoot = type === 'reading'
                ? '睡着过项目组/2. 所有文章(11.20)[192篇]/'
                : 'assets/listening/';
            try {
                if (type === 'reading') {
                    const rootMeta = global.completeExamIndex && global.completeExamIndex.pathRoot;
                    if (typeof rootMeta === 'string' && rootMeta.trim()) {
                        return rootMeta.trim();
                    }
                    if (rootMeta && typeof rootMeta === 'object' && typeof rootMeta.reading === 'string') {
                        return rootMeta.reading.trim();
                    }
                }
                if (type === 'listening') {
                    const rootMeta = global.listeningExamIndex && global.listeningExamIndex.pathRoot;
                    if (typeof rootMeta === 'string' && rootMeta.trim()) {
                        return rootMeta.trim();
                    }
                    const completeRoot = global.completeExamIndex && global.completeExamIndex.pathRoot;
                    if (completeRoot && typeof completeRoot === 'object' && typeof completeRoot.listening === 'string') {
                        return completeRoot.listening.trim();
                    }
                }
            } catch (_) { }
            return defaultRoot;
        }

        finishLibraryLoading(startTime) {
            const loadTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() - startTime : 0;
            try { global.updateOverview && global.updateOverview(); } catch (_) { }
            try { global.refreshBrowseProgressFromRecords && global.refreshBrowseProgressFromRecords(); } catch (_) { }
            try {
                global.dispatchEvent(new CustomEvent('examIndexLoaded'));
            } catch (_) { }
            return loadTime;
        }

        async loadActiveLibrary(forceReload = false) {
            const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

            const rawKey = await this.getActiveLibraryConfigurationKey();
            const activeConfigKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : 'exam_index';
            const isDefaultConfig = activeConfigKey === 'exam_index';

            let cachedData = null;
            try {
                if (!isDefaultConfig) {
                    cachedData = await global.storage.get(activeConfigKey);
                } else {
                    await global.storage.set('active_exam_index_key', 'exam_index');
                }
            } catch (error) {
                console.warn('[LibraryManager] 读取题库缓存失败:', error);
            }

            if (!forceReload && !isDefaultConfig && Array.isArray(cachedData) && cachedData.length > 0) {
                const updatedIndex = global.setExamIndexState ? global.setExamIndexState(cachedData) : cachedData;
                await this.savePathMapForConfiguration(activeConfigKey, updatedIndex, { setActive: true });
                this.finishLibraryLoading(startTime);
                return updatedIndex;
            }

            if (!isDefaultConfig) {
                const normalized = Array.isArray(cachedData) ? cachedData : [];
                if (global.setExamIndexState) {
                    global.setExamIndexState(normalized);
                }
                if (!normalized.length && typeof global.showMessage === 'function') {
                    global.showMessage('当前题库配置没有数据，请重新导入或切换至默认题库。', 'warning');
                }
                this.finishLibraryLoading(startTime);
                return normalized;
            }

            try {
                if (global.ensureExamDataScripts) {
                    await global.ensureExamDataScripts();
                }

                const readingExams = Array.isArray(global.completeExamIndex)
                    ? global.completeExamIndex.map((exam) => Object.assign({}, exam, { type: 'reading' }))
                    : [];
                const listeningExams = Array.isArray(global.listeningExamIndex)
                    ? global.listeningExamIndex.map((exam) => Object.assign({}, exam, { type: 'listening' }))
                    : [];

                if (!readingExams.length && !listeningExams.length) {
                    if (global.setExamIndexState) {
                        global.setExamIndexState([]);
                    }
                    console.warn('[LibraryManager] 未检测到默认题库脚本中的题源数据');
                    this.finishLibraryLoading(startTime);
                    return [];
                }

                const combined = cloneArray(readingExams).concat(listeningExams);
                if (typeof global.assignExamSequenceNumbers === 'function') {
                    global.assignExamSequenceNumbers(combined);
                }
                const updatedIndex = global.setExamIndexState ? global.setExamIndexState(combined) : combined;

                const metadata = {
                    source: 'default-script',
                    generatedAt: Date.now(),
                    counts: {
                        total: combined.length,
                        reading: readingExams.length,
                        listening: listeningExams.length
                    },
                    pathRoot: {
                        reading: this.resolveScriptPathRoot('reading'),
                        listening: this.resolveScriptPathRoot('listening')
                    }
                };
                try { global.examIndexMetadata = metadata; } catch (_) { }

                const overrideMap = this.buildOverridePathMap(metadata, this.DEFAULT_PATH_MAP);

                await global.storage.set('exam_index', updatedIndex);
                await this.saveLibraryConfiguration('默认题库', 'exam_index', updatedIndex.length);
                await this.setActiveLibraryConfiguration('exam_index');
                await this.savePathMapForConfiguration('exam_index', updatedIndex, { setActive: true, overrideMap });

                this.finishLibraryLoading(startTime);
                return updatedIndex;
            } catch (error) {
                console.error('[LibraryManager] 加载默认题库失败:', error);
                if (typeof global.showMessage === 'function') {
                    global.showMessage('题库刷新失败: ' + (error && error.message ? error.message : error), 'error');
                }
                if (global.setExamIndexState) {
                    global.setExamIndexState([]);
                }
                this.finishLibraryLoading(startTime);
                return [];
            }
        }

        async updateLibraryConfigurationMetadata(key, examCount) {
            if (!key) {
                return;
            }
            try {
                let configs = await this.getLibraryConfigurations();
                if (!Array.isArray(configs)) {
                    configs = [];
                }
                const now = Date.now();
                let mutated = false;
                const updated = configs.map((entry) => {
                    if (!entry) {
                        return entry;
                    }
                    if (typeof entry === 'string') {
                        if (entry.trim() === key) {
                            mutated = true;
                            return {
                                name: key === 'exam_index' ? '默认题库' : key,
                                key,
                                examCount,
                                timestamp: now
                            };
                        }
                        return entry;
                    }
                    if (entry.key === key) {
                        mutated = true;
                        return Object.assign({}, entry, {
                            examCount,
                            timestamp: now
                        });
                    }
                    return entry;
                });
                if (mutated) {
                    await global.storage.set('exam_index_configurations', updated);
                }
            } catch (error) {
                console.warn('[LibraryManager] 无法刷新题库配置元数据', error);
            }
        }

        async fetchLibraryDataset(key) {
            if (!key) {
                return [];
            }
            try {
                const dataset = await global.storage.get(key);
                return Array.isArray(dataset) ? dataset : [];
            } catch (error) {
                console.warn('[LibraryManager] 无法读取题库数据:', key, error);
                return [];
            }
        }

        async applyLibraryConfiguration(key, dataset, options = {}) {
            const exams = Array.isArray(dataset) ? dataset.slice() : await this.fetchLibraryDataset(key);
            if (!Array.isArray(exams) || exams.length === 0) {
                if (typeof global.showMessage === 'function') {
                    global.showMessage('目标题库没有题目，请先加载数据', 'warning');
                }
                return false;
            }

            const currentPathMap = await this.loadPathMapForConfiguration(key);
            const pathMap = this.resourceCore && typeof this.resourceCore.derivePathMapFromIndex === 'function'
                ? this.resourceCore.derivePathMapFromIndex(exams, currentPathMap || this.DEFAULT_PATH_MAP)
                : (currentPathMap || null);
            this.setActivePathMap(pathMap);

            if (global.setExamIndexState) {
                global.setExamIndexState(exams);
            }
            if (typeof global.setBrowseFilterState === 'function') {
                global.setBrowseFilterState('all', 'all');
            }
            if (typeof global.setFilteredExamsState === 'function') {
                global.setFilteredExamsState([]);
            }

            try {
                await this.setActiveLibraryConfiguration(key);
            } catch (error) {
                console.warn('[LibraryManager] 无法写入当前题库配置:', error);
            }

            await this.updateLibraryConfigurationMetadata(key, exams.length);
            await this.savePathMapForConfiguration(key, exams, {
                overrideMap: pathMap,
                setActive: true
            });

            try { global.updateSystemInfo && global.updateSystemInfo(); } catch (_) { }
            try { global.updateOverview && global.updateOverview(); } catch (_) { }
            try { global.loadExamList && global.loadExamList(); } catch (_) { }

            try {
                global.dispatchEvent(new CustomEvent('examIndexLoaded', { detail: { key } }));
            } catch (error) {
                console.warn('[LibraryManager] 题库切换事件派发失败', error);
            }

            if (!options.skipConfigRefresh && typeof global.renderLibraryConfigList === 'function') {
                setTimeout(() => {
                    try {
                        global.renderLibraryConfigList({
                            allowDelete: true,
                            activeKey: key
                        });
                    } catch (error) {
                        console.warn('[LibraryManager] 重渲染题库配置列表失败', error);
                    }
                }, 0);
            }

            return true;
        }

        async loadLibrary(keyOrForceReload) {
            if (keyOrForceReload === 'default' || keyOrForceReload === 'exam_index') {
                return this.loadActiveLibrary(true);
            }
            if (typeof keyOrForceReload === 'string' && keyOrForceReload) {
                return this.applyLibraryConfiguration(keyOrForceReload);
            }
            return this.loadActiveLibrary(!!keyOrForceReload);
        }
    }

    let singleton = null;

    function getInstance(options) {
        if (!singleton) {
            singleton = new LibraryManager(options);
        }
        return singleton;
    }

    async function switchLibraryConfig(key) {
        const manager = getInstance();
        const nextKey = key || await manager.getActiveLibraryConfigurationKey() || 'exam_index';
        return manager.applyLibraryConfiguration(nextKey);
    }

    async function loadLibrary(keyOrForceReload) {
        return getInstance().loadLibrary(keyOrForceReload);
    }

    global.LibraryManager = {
        getInstance,
        switchLibraryConfig,
        loadLibrary,
        get RAW_DEFAULT_PATH_MAP() {
            const manager = getInstance();
            return manager.RAW_DEFAULT_PATH_MAP;
        },
        get DEFAULT_PATH_MAP() {
            const manager = getInstance();
            return manager.DEFAULT_PATH_MAP;
        },
        normalizePathRoot(value) {
            return getInstance().normalizePathRoot(value);
        },
        mergeRootWithFallback(root, fallbackRoot) {
            return getInstance().mergeRootWithFallback(root, fallbackRoot);
        },
        buildOverridePathMap(metadata, fallback) {
            return getInstance().buildOverridePathMap(metadata, fallback);
        },
    };

    global.switchLibraryConfig = switchLibraryConfig;
    global.loadLibrary = loadLibrary;
})(typeof window !== 'undefined' ? window : globalThis);

