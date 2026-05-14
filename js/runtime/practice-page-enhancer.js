/**
 * 练习页面增强器 - 统一版本
 * 整合了原有的practicePageManager功能，解决数据收集和正确答案提取问题
 */

(function patchPracticeEnhancer() {
    const previousEnhancer = window.practicePageEnhancer;
    if (previousEnhancer && typeof previousEnhancer.cleanup === 'function') {
        try {
            previousEnhancer.cleanup();
        } catch (error) {
            console.warn('[PracticeEnhancer] 旧版本清理失败:', error);
        }
    }

    console.log('[PracticeEnhancer] 初始化增强器');

    const DEFAULT_ENHANCER_CONFIG = {
        autoInitialize: true,
        excludedSelectors: [
            '#volume-slider',
            '#playback-speed',
            '#notes-panel textarea',
            '#notes-panel input',
            '#settings-panel input',
            '#settings-panel select',
            '[data-answer-ignore="true"]'
        ],
        excludedAncestors: [
            '#speed-control',
            '#volume-container',
            '#notes-panel',
            '#settings-panel'
        ],
        excludedNames: ['timer', 'notes', 'note'],
        questionIdAttributes: [
            'name',
            'id',
            'data-question',
            'data-question-id',
            'data-qid',
            'data-for'
        ],
        datasetExcludeAttribute: 'enhancerExclude'
    };

    const mergeConfig = (baseConfig, overrideConfig) => {
        const result = { ...(baseConfig || {}) };
        if (!overrideConfig || typeof overrideConfig !== 'object') {
            return result;
        }

        Object.entries(overrideConfig).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }

            if (Array.isArray(value)) {
                const existing = Array.isArray(result[key]) ? result[key] : [];
                result[key] = Array.from(new Set([...existing, ...value]));
                return;
            }

            if (typeof value === 'object') {
                const existing = (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]))
                    ? result[key]
                    : {};
                result[key] = mergeConfig(existing, value);
                return;
            }

            result[key] = value;
        });

        return result;
    };

    const detectEnhancerScriptUrl = () => {
        try {
            if (document.currentScript && document.currentScript.src) {
                return document.currentScript.src;
            }
            const scripts = document.querySelectorAll('script[src]');
            for (let idx = scripts.length - 1; idx >= 0; idx -= 1) {
                const script = scripts[idx];
                if (script.src && script.src.includes('practice-page-enhancer.js')) {
                    return script.src;
                }
            }
        } catch (_) {
            // ignore
        }
        return null;
    };

    const resolveEnhancerBaseUrl = () => {
        const scriptUrl = detectEnhancerScriptUrl();
        if (scriptUrl) {
            try {
                return new URL('.', scriptUrl).href;
            } catch (_) {
                // ignore and fallback
            }
        }
        try {
            return new URL('./js/', window.location.href).href;
        } catch (_) {
            return './js/';
        }
    };

    const ENHANCER_BASE_URL = resolveEnhancerBaseUrl();
    const dependencyLoader = {
        cache: new Map(),
        loadScript(url) {
            if (!url) {
                return Promise.reject(new Error('script url missing'));
            }
            if (this.cache.has(url)) {
                return this.cache.get(url);
            }
            const promise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.defer = true;
                script.src = url;
                script.onload = () => resolve(true);
                script.onerror = (err) => reject(err);
                (document.head || document.body || document.documentElement).appendChild(script);
            });
            this.cache.set(url, promise);
            return promise;
        }
    };

    function sanitizeExamTitle(rawTitle) {
        if (!rawTitle) return '';
        const title = String(rawTitle).trim();
        if (!title) return '';
        const pattern = /ielts\s+listening\s+practice\s*[-–—]?\s*part\s*\d+\s*[:\-–—]?\s*(.+)$/i;
        const match = title.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
        if (/[-–—]/.test(title)) {
            const segments = title.split(/[-–—]/).map((s) => s.trim()).filter(Boolean);
            if (segments.length > 1) {
                return segments[segments.length - 1];
            }
        }
        return title;
    }

    const enhancerMixinRegistry = [];

    const registerPracticeEnhancerMixin = (definition) => {
        if (!definition || typeof definition.apply !== 'function') {
            return;
        }
        enhancerMixinRegistry.push(definition);
    };

    const applyMixinsToEnhancer = (instance) => {
        if (!instance || typeof instance.getPageContext !== 'function') {
            return [];
        }

        const context = instance.getPageContext();
        const sorted = enhancerMixinRegistry
            .slice()
            .sort((a, b) => ((b && b.priority) || 0) - ((a && a.priority) || 0));
        const applied = [];

        sorted.forEach((mixin) => {
            if (!mixin || typeof mixin.apply !== 'function') {
                return;
            }
            try {
                const shouldApply = typeof mixin.shouldActivate === 'function'
                    ? mixin.shouldActivate(context, instance)
                    : true;
                if (shouldApply) {
                    mixin.apply(instance, context);
                    applied.push(mixin.name || 'anonymous-mixin');
                }
            } catch (mixinError) {
                console.warn('[PracticeEnhancer] mixin apply failed:', mixin && mixin.name, mixinError);
            }
        });

        return applied;
    };

    function createStandardInlineMixin() {
        return {
            name: 'standard-inline-practice',
            priority: 5,
            shouldActivate() {
                return true;
            },
            apply(enhancer, context) {
                if (!enhancer || typeof enhancer.registerHook !== 'function') {
                    return;
                }
                enhancer.registerHook('afterBuildPayload', (payload) => {
                    if (!payload) {
                        return;
                    }
                    payload.metadata = payload.metadata || {};
                    if (!payload.metadata.practiceMode) {
                        payload.metadata.practiceMode = 'single';
                    }
                    if (!payload.metadata.variant) {
                        payload.metadata.variant = context && context.isListening
                            ? 'listening-inline'
                            : 'reading-inline';
                    }
                });
            }
        };
    }

    registerPracticeEnhancerMixin(createStandardInlineMixin());

    const cssEscape = (value) => {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            try {
                return window.CSS.escape(value);
            } catch (_) {
                // ignore and fallback
            }
        }
        return String(value == null ? '' : value).replace(/["\\]/g, '\\$&');
    };

    const initialConfig = mergeConfig(
        DEFAULT_ENHANCER_CONFIG,
        window.practicePageEnhancerConfig || {}
    );

    let cachedPracticePageContext = null;

    const cleanTitleCandidate = (raw) => {
        if (!raw) return '';
        let text = String(raw).replace(/\s+/g, ' ').trim();
        if (!text) return '';
        text = text
            .replace(/^[\d]+[\.\-、\s]+/, '')
            .replace(/^PART\s*\d+/i, '')
            .replace(/^P\s*\d+/i, '')
            .replace(/IELTS\s+Listening\s+Practice\s*-?\s*/i, '')
            .replace(/^-+/, '')
            .replace(/^\s*[-:]\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
        return text;
    };

    const extractLeadingNumber = (text) => {
        if (!text) return null;
        const match = String(text).trim().match(/^(\d{1,4})[\s.\-、_]/);
        return match ? parseInt(match[1], 10) : null;
    };

    const extractPartFromText = (text) => {
        if (!text) return null;
        const match = String(text).match(/P(?:ART)?\s*([1-4])/i) || String(text).match(/PART\s*([1-4])/i);
        if (match) {
            return match[1];
        }
        const partWord = String(text).match(/Part\s*([1-4])/i);
        return partWord ? partWord[1] : null;
    };

    const detectFrequencyLabel = (text) => {
        if (!text) return '未知频率';
        if (/次高频/.test(text)) return '次高频';
        if (/高频/.test(text)) return '高频';
        if (/低频/.test(text)) return '低频';
        return '未知频率';
    };

    const computePracticePageContext = () => {
        const pathname = decodeURIComponent(window.location.pathname || '').replace(/\\/g, '/');
        const segments = pathname.split('/').filter(Boolean);
        const filenameWithExt = segments[segments.length - 1] || '';
        const filename = filenameWithExt.replace(/\.[^.]+$/, '');
        const folderName = segments[segments.length - 2] || '';
        const docTitle = document.title || '';
        const headerTitle = document.querySelector('.header h1, header .header-title')?.textContent || '';
        const pathSignature = [folderName, filename, docTitle, headerTitle].filter(Boolean).join(' || ');
        const part = extractPartFromText(pathSignature);
        const examNumber = extractLeadingNumber(folderName) || extractLeadingNumber(filename);
        const isListening = /listeningpractice/i.test(pathname) || /listening/i.test(docTitle);
        const categoryCode = part ? `P${part}` : 'unknown';
        const categoryLabel = part
            ? (isListening ? `Part ${part}` : `P${part}`)
            : 'unknown';
        const titleCandidates = [headerTitle, filename, docTitle];
        const cleanedTitles = [];
        titleCandidates.forEach(candidate => {
            const cleaned = cleanTitleCandidate(candidate);
            if (cleaned && !cleanedTitles.includes(cleaned)) {
                cleanedTitles.push(cleaned);
            }
        });
        const title = cleanedTitles[0] || (docTitle || '').trim();
        let examId = null;
        if (isListening && part && examNumber != null) {
            const paddedNumber = String(examNumber).padStart(2, '0');
            examId = `listening-p${part}-${paddedNumber}`;
        }
        const frequencyLabel = detectFrequencyLabel(`${pathname} ${docTitle}`);
        return {
            isListening,
            part,
            examNumber,
            examId,
            title,
            categoryCode,
            categoryLabel,
            frequencyLabel
        };
    };

    const getPracticePageContext = (forceRefresh = false) => {
        if (forceRefresh || !cachedPracticePageContext) {
            cachedPracticePageContext = computePracticePageContext();
        }
        return cachedPracticePageContext;
    };

    function extractObjectLiteral(content, startIndex) {
        if (!content || startIndex >= content.length) {
            return null;
        }
        let i = startIndex;
        while (i < content.length && /\s/.test(content[i])) {
            i++;
        }
        if (i >= content.length || content[i] !== '{') {
            return null;
        }
        let depth = 0;
        let literal = '';
        let inString = false;
        let stringQuote = null;
        for (; i < content.length; i++) {
            const char = content[i];
            literal += char;
            if (inString) {
                if (char === '\\') {
                    i++;
                    if (i < content.length) {
                        literal += content[i];
                    }
                    continue;
                }
                if (char === stringQuote) {
                    inString = false;
                    stringQuote = null;
                }
                continue;
            }
            if (char === '"' || char === "'" || char === '`') {
                inString = true;
                stringQuote = char;
                continue;
            }
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return literal;
                }
            }
        }
        return null;
    }

    const normalizeQuestionKey = (value) => {
        if (value === undefined || value === null) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        const cleaned = raw.replace(/[-_](anchor|nav)$/i, '');

        if (/^q[\w-]+/i.test(cleaned)) {
            return cleaned.replace(/^Q/, 'q');
        }

        // 兼容资源页命名（如 t2_q16 / set1_q1），提取最后一个 q+数字
        let qDigits = null;
        const qDigitPattern = /(?:^|[^a-z0-9])q(\d{1,4})/gi;
        let match = null;
        while ((match = qDigitPattern.exec(cleaned)) !== null) {
            qDigits = match[1];
        }
        if (qDigits) {
            return `q${qDigits}`;
        }

        const digitsMatch = cleaned.match(/^\d+/);
        if (digitsMatch) {
            return 'q' + digitsMatch[0];
        }
        const questionPrefix = cleaned.match(/^question[-_\s]*(\d+)/i);
        if (questionPrefix) {
            return 'q' + questionPrefix[1];
        }
        return cleaned;
    };

    // 内嵌CorrectAnswerExtractor功能，确保在练习页面中可用
    if (!window.CorrectAnswerExtractor) {
        window.CorrectAnswerExtractor = class {
            constructor() {
                this.extractionStrategies = [
                    this.extractFromAnswersObject.bind(this),
                    this.extractFromResultsTable.bind(this),
                    this.extractFromDOM.bind(this),
                    this.extractFromScripts.bind(this)
                ];
            }

            extractFromPage(document = window.document) {
                console.log('[CorrectAnswerExtractor] 开始提取正确答案');

                for (const strategy of this.extractionStrategies) {
                    try {
                        const answers = strategy(document);
                        if (answers && Object.keys(answers).length > 0) {
                            console.log('[CorrectAnswerExtractor] 提取成功:', strategy.name, answers);
                            return this.normalizeAnswers(answers);
                        }
                    } catch (error) {
                        console.warn(`[CorrectAnswerExtractor] 策略 ${strategy.name} 失败:`, error);
                    }
                }

                console.warn('[CorrectAnswerExtractor] 所有提取策略都失败了');
                return {};
            }

            extractFromAnswersObject(document = window.document) {
                const win = document.defaultView || window;

                const possibleAnswerObjects = [
                    'answers', 'correctAnswers', 'examAnswers', 'questionAnswers', 'solutionAnswers'
                ];

                for (const objName of possibleAnswerObjects) {
                    if (win[objName] && typeof win[objName] === 'object') {
                        console.log(`[CorrectAnswerExtractor] 找到全局对象: ${objName}`);
                        return win[objName];
                    }
                }

                return this.extractFromScriptVariables(document);
            }

            extractFromScriptVariables(document = window.document) {
                const scripts = document.querySelectorAll('script');
                const candidateNames = ['correctAnswers', 'answerKey', 'answers'];

                for (const script of scripts) {
                    const content = script.textContent || script.innerHTML || '';

                    for (let i = 0; i < candidateNames.length; i++) {
                        const name = candidateNames[i];
                        const pattern = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`, 'g');
                        let match;
                        while ((match = pattern.exec(content)) !== null) {
                            const literal = extractObjectLiteral(content, match.index + match[0].length);
                            if (!literal) {
                                continue;
                            }
                            try {
                                const answers = this.parseAnswersObject(literal);
                                if (answers && Object.keys(answers).length > 0) {
                                    console.log('[CorrectAnswerExtractor] 从脚本变量提取答案:', answers);
                                    return answers;
                                }
                            } catch (error) {
                                console.warn('[CorrectAnswerExtractor] 解析脚本变量失败:', error);
                            }
                        }
                    }
                }

                return null;
            }

            parseAnswersObject(objectStr) {
                try {
                    let cleanStr = objectStr
                        .replace(/\/\/.*$/gm, '')
                        .replace(/\/\*[\s\S]*?\*\//g, '')
                        .trim();

                    if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                        cleanStr = cleanStr.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
                        return JSON.parse(cleanStr);
                    }
                } catch (error) {
                    console.warn('[CorrectAnswerExtractor] JSON解析失败，尝试其他方法:', error);
                }

                return this.manualParseAnswers(objectStr);
            }

            manualParseAnswers(objectStr) {
                const answers = {};
                const keyValuePattern = /([a-zA-Z0-9_]+)\s*:\s*['"`]([^'"`]+)['"`]/g;
                let match;

                while ((match = keyValuePattern.exec(objectStr)) !== null) {
                    const key = match[1];
                    const value = match[2];
                    answers[key] = value;
                }

                return Object.keys(answers).length > 0 ? answers : null;
            }

            extractFromResultsTable(document = window.document) {
                const selectors = [
                    '.results-table', '.answer-table', '.score-table',
                    'table[class*="result"]', 'table[class*="answer"]',
                    '.exam-results table', '#results table'
                ];

                for (const selector of selectors) {
                    const table = document.querySelector(selector);
                    if (table) {
                        return this.parseAnswersFromTable(table);
                    }
                }

                return null;
            }

            extractFromDOM(document = window.document) {
                const answers = {};
                const answerSelectors = [
                    '[data-correct-answer]', '.correct-answer', '.solution',
                    '[class*="correct"]', '[id*="correct"]'
                ];

                for (const selector of answerSelectors) {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach((el, index) => {
                        const questionId = this.extractQuestionId(el) || `q${index + 1}`;
                        const answer = this.extractAnswerFromElement(el);
                        if (answer) {
                            answers[questionId] = answer;
                        }
                    });
                }

                return Object.keys(answers).length > 0 ? answers : null;
            }

            extractFromScripts(document = window.document) {
                const scripts = document.querySelectorAll('script');

                for (const script of scripts) {
                    const content = script.textContent || script.innerHTML;
                    if (content.includes('answer') || content.includes('correct')) {
                        try {
                            const jsonMatch = content.match(/(?:answers?|correct)\s*[:=]\s*(\{[^}]+\}|\[[^\]]+\])/i);
                            if (jsonMatch) {
                                const answers = JSON.parse(jsonMatch[1]);
                                if (answers && typeof answers === 'object') {
                                    return answers;
                                }
                            }
                        } catch (error) {
                            // 继续尝试其他方法
                        }
                    }
                }

                return null;
            }

            parseAnswersFromTable(table) {
                const answers = {};
                const rows = table.querySelectorAll('tr');

                for (const row of rows) {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        const questionCell = cells[0];
                        const answerCell = this.findAnswerCell(cells);

                        if (answerCell) {
                            const questionId = this.extractQuestionId(questionCell);
                            const answer = this.extractAnswerFromElement(answerCell);

                            if (questionId && answer) {
                                answers[questionId] = answer;
                            }
                        }
                    }
                }

                return Object.keys(answers).length > 0 ? answers : null;
            }

            findAnswerCell(cells) {
                for (let i = 1; i < cells.length; i++) {
                    const cell = cells[i];
                    const text = cell.textContent.toLowerCase();
                    const className = cell.className.toLowerCase();

                    if (text.includes('correct') || text.includes('answer') ||
                        className.includes('correct') || className.includes('answer') ||
                        text.includes('正确') || text.includes('答案')) {
                        return cell;
                    }
                }

                return cells[1];
            }

            extractQuestionId(element) {
                if (element.dataset.questionId) {
                    return element.dataset.questionId;
                }

                if (element.id) {
                    const match = element.id.match(/q(\d+)|question[_-]?(\d+)/i);
                    if (match) {
                        return `q${match[1] || match[2]}`;
                    }
                }

                const text = element.textContent;
                const match = text.match(/(?:问题|题目|Question)\s*[#:]?\s*(\d+)|^(\d+)[.)]/);
                if (match) {
                    return `q${match[1] || match[2]}`;
                }

                return null;
            }

            extractAnswerFromElement(element) {
                if (element.dataset.correctAnswer) {
                    return element.dataset.correctAnswer;
                }

                if (element.dataset.answer) {
                    return element.dataset.answer;
                }

                let text = element.textContent.trim();
                text = text.replace(/^(?:正确答案[:：]?|答案[:：]?|Correct Answer[:：]?|Answer[:：]?)\s*/i, '');

                if (/^(true|false)$/i.test(text)) {
                    return text.toUpperCase();
                }

                if (/^[A-Z]$/i.test(text)) {
                    return text.toUpperCase();
                }

                return text;
            }

            normalizeAnswers(answers) {
                const normalized = {};

                for (const [key, value] of Object.entries(answers)) {
                    const normalizedKey = key.toString().toLowerCase().startsWith('q')
                        ? key
                        : `q${key}`;

                    let normalizedValue = value;
                    if (typeof value === 'string') {
                        normalizedValue = value.trim();

                        if (/^(true|t|yes|y|正确|是)$/i.test(normalizedValue)) {
                            normalizedValue = 'TRUE';
                        } else if (/^(false|f|no|n|错误|否)$/i.test(normalizedValue)) {
                            normalizedValue = 'FALSE';
                        }

                        if (/^[A-Z]$/i.test(normalizedValue)) {
                            normalizedValue = normalizedValue.toUpperCase();
                        }
                    }

                    normalized[normalizedKey] = normalizedValue;
                }

                return normalized;
            }
        };
    }

    window.practicePageEnhancer = {
        sessionId: null,
        examId: null, // 新增：存储唯一的examId
        parentWindow: null,
        answers: {},
        correctAnswers: {},
        interactions: [],
        allQuestionIds: [],
        isInitialized: false,
        initRequestTimer: null,
        initializationPromise: null,
        submitInProgress: false,
        hasDispatchedFinalResults: false,
        config: initialConfig,
        customCollectors: [],
        pageContext: null,
        isSubmitting: false, // 新增：提交状态标志，防止并发提交
        reviewMode: false,
        readOnly: false,
        reviewSessionId: null,
        reviewEntryIndex: 0,
        reviewContext: null,
        reviewViewMode: null,
        reviewNavBarElement: null,
        mixinsApplied: false,
        activeMixins: [],
        hookHandlers: {},

        registerHook: function (hookName, handler) {
            if (!hookName || typeof handler !== 'function') {
                return;
            }
            if (!this.hookHandlers[hookName]) {
                this.hookHandlers[hookName] = [];
            }
            this.hookHandlers[hookName].push(handler);
        },

        runHooks: function (hookName, ...args) {
            const handlers = this.hookHandlers && this.hookHandlers[hookName];
            if (!handlers || handlers.length === 0) {
                return;
            }
            handlers.forEach((handler) => {
                try {
                    handler.apply(this, args);
                } catch (hookError) {
                    console.warn(`[PracticeEnhancer] hook ${hookName} 执行失败:`, hookError);
                }
            });
        },

        getPracticeTimerSnapshot: function () {
            return window.__IELTS_PRACTICE_TIMER__.getSnapshot();
        },

        resolvePracticeTiming: function () {
            const snapshot = this.getPracticeTimerSnapshot();
            const startTime = Math.floor(Number(snapshot.effectiveStartTimeMs));
            const duration = Math.max(0, Math.round(Number(snapshot.durationSeconds)));
            const actualEndTimeMsRaw = Number(snapshot.actualEndTimeMs);
            const endTime = Number.isFinite(actualEndTimeMsRaw)
                ? Math.floor(actualEndTimeMsRaw)
                : Date.now();
            return {
                startTime,
                endTime,
                duration,
                effectiveEndTime: Math.max(startTime, startTime + duration * 1000)
            };
        },

        activateMixins: function () {
            if (this.mixinsApplied) {
                return;
            }
            if (!this.hookHandlers) {
                this.hookHandlers = {};
            }
            this.activeMixins = applyMixinsToEnhancer(this) || [];
            if (this.activeMixins.length) {
                console.log('[PracticeEnhancer] 已启用 mixin:', this.activeMixins.join(', '));
            }
            this.mixinsApplied = true;
        },

        initialize: function () {
            if (this.isInitialized) {
                console.log('[PracticeEnhancer] 已经初始化，跳过');
                return Promise.resolve();
            }

            if (this.initializationPromise) {
                console.log('[PracticeEnhancer] 初始化进行中，直接复用');
                return this.initializationPromise;
            }

            this.initializationPromise = (async () => {
                console.log('[PracticeEnhancer] 开始初始化');
                this.hasDispatchedFinalResults = false;
                this.submitInProgress = false;
                this.reviewMode = false;
                this.readOnly = false;
                this.reviewSessionId = null;
                this.reviewEntryIndex = 0;
                this.reviewContext = null;
                this.reviewViewMode = null;
                this.pageContext = this.getPageContext(true);
                this.activateMixins();

                this.enhancerBaseUrl = this.getEnhancerBaseUrl();
                await this.ensureStorageAvailable();
                await this.ensureSpellingErrorCollector();
                await this.prepareStorageNamespace();

                this.setupCommunication();
                this.setupAnswerListeners();
                this.captureQuestionSet();
                this.extractCorrectAnswers(); // 新增：提取正确答案
                this.interceptSubmit();
                this.setupInteractionTracking();
                this.isInitialized = true;
                console.log('[PracticeEnhancer] 初始化完成');

                // 页面加载完成后进行一次初始收集
                if (document.readyState === 'complete') {
                    setTimeout(() => this.collectAllAnswers(), 1000);
                } else {
                    window.addEventListener('load', () => {
                        setTimeout(() => this.collectAllAnswers(), 1000);
                    });
                }
            })().catch((error) => {
                this.initializationPromise = null;
                throw error;
            });

            return this.initializationPromise;
        },

        getEnhancerBaseUrl: function () {
            if (this.enhancerBaseUrl) {
                return this.enhancerBaseUrl;
            }
            this.enhancerBaseUrl = ENHANCER_BASE_URL;
            return this.enhancerBaseUrl;
        },

        buildFallbackUrls: function (paths) {
            return (paths || []).map((p) => {
                try {
                    return new URL(p, window.location.href).href;
                } catch (_) {
                    return null;
                }
            }).filter(Boolean);
        },

        ensureStorageAvailable: async function () {
            try {
                if (window.storage && typeof window.storage.setNamespace === 'function') {
                    if (window.storage.ready && typeof window.storage.ready.then === 'function') {
                        await window.storage.ready;
                    }
                    return true;
                }

                const tryLoad = async (urls) => {
                    for (const url of urls) {
                        if (!url) continue;
                        try {
                            console.log('[PracticeEnhancer] 尝试加载存储管理器:', url);
                            await dependencyLoader.loadScript(url);
                            if (window.storage && typeof window.storage.setNamespace === 'function') {
                                if (window.storage.ready && typeof window.storage.ready.then === 'function') {
                                    await window.storage.ready;
                                }
                                return true;
                            }
                        } catch (error) {
                            console.warn('[PracticeEnhancer] 存储管理器加载失败:', error);
                        }
                    }
                    return false;
                };

                const baseUrl = this.getEnhancerBaseUrl();
                const baseCandidate = new URL('utils/storage.js', baseUrl).href;
                const fallbackUrls = this.buildFallbackUrls([
                    '../../../../js/utils/storage.js',
                    '../../../js/utils/storage.js',
                    '../../js/utils/storage.js',
                    '../js/utils/storage.js',
                    './js/utils/storage.js'
                ]);

                const loaded = await tryLoad([baseCandidate, ...fallbackUrls]);
                if (loaded) return true;
            } catch (error) {
                console.warn('[PracticeEnhancer] 加载存储管理器失败:', error);
            }

            // 创建简易回退存储，确保流程不中断
            console.warn('[PracticeEnhancer] 使用简易回退存储');
            const fallbackPrefix = 'exam_system_';
            const safeStore = (() => {
                try {
                    return window.localStorage;
                } catch (_) {
                    return null;
                }
            })();

            const stubStorage = {
                namespace: '',
                ready: Promise.resolve(),
                setNamespace(ns) { this.namespace = ns ? `${ns}_` : ''; },
                async set(key, value) {
                    if (!safeStore) return false;
                    const k = fallbackPrefix + this.namespace + key;
                    safeStore.setItem(k, JSON.stringify({ value }));
                    return true;
                },
                async get(key) {
                    if (!safeStore) return null;
                    const k = fallbackPrefix + this.namespace + key;
                    const raw = safeStore.getItem(k);
                    if (!raw) return null;
                    try {
                        const parsed = JSON.parse(raw);
                        return parsed && parsed.value !== undefined ? parsed.value : parsed;
                    } catch (_) {
                        return null;
                    }
                },
                async remove(key) {
                    if (!safeStore) return false;
                    const k = fallbackPrefix + this.namespace + key;
                    safeStore.removeItem(k);
                    return true;
                }
            };

            window.storage = stubStorage;
            return true;
        },

        ensureSpellingErrorCollector: async function () {
            if (window.spellingErrorCollector) {
                return true;
            }

            if (window.SpellingErrorCollector) {
                window.spellingErrorCollector = new window.SpellingErrorCollector();
                return true;
            }

            const tryLoad = async (urls) => {
                for (const url of urls) {
                    if (!url) continue;
                    try {
                        console.log('[PracticeEnhancer] 尝试加载SpellingErrorCollector:', url);
                        await dependencyLoader.loadScript(url);
                        if (!window.spellingErrorCollector && window.SpellingErrorCollector) {
                            window.spellingErrorCollector = new window.SpellingErrorCollector();
                        }
                        if (window.spellingErrorCollector) return true;
                    } catch (error) {
                        console.warn('[PracticeEnhancer] 加载SpellingErrorCollector失败:', error);
                    }
                }
                return false;
            };

            const baseUrl = this.getEnhancerBaseUrl();
            const baseCandidate = new URL('app/spellingErrorCollector.js', baseUrl).href;
            const fallbackUrls = this.buildFallbackUrls([
                '../../../../js/app/spellingErrorCollector.js',
                '../../../js/app/spellingErrorCollector.js',
                '../../js/app/spellingErrorCollector.js',
                '../js/app/spellingErrorCollector.js',
                './js/app/spellingErrorCollector.js'
            ]);

            const loaded = await tryLoad([baseCandidate, ...fallbackUrls]);
            return loaded;
        },

        prepareStorageNamespace: async function () {
            // 设置共享命名空间
            try {
                if (window.storage?.ready) {
                    await window.storage.ready;
                }

                if (window.storage && typeof window.storage.setNamespace === 'function') {
                    window.storage.setNamespace('exam_system');
                    console.log('[PracticeEnhancer] 已设置共享命名空间: exam_system');

                    // 验证命名空间设置是否生效
                    setTimeout(async () => {
                        const testKey = 'namespace_test_enhancer';
                        const testValue = 'test_value_enhancer_' + Date.now();
                        try {
                            await window.storage.set(testKey, testValue);
                            const retrievedValue = await window.storage.get(testKey);
                            if (retrievedValue === testValue) {
                                console.log('✅ 增强器命名空间设置验证成功: 存储和读取正常');
                            } else {
                                console.warn('❌ 增强器命名空间设置验证失败: 读取值不匹配');
                            }
                            await window.storage.remove(testKey);
                        } catch (error) {
                            console.error('❌ 增强器命名空间设置验证失败', error);
                        }
                    }, 1000);
                } else {
                    console.warn('[PracticeEnhancer] 存储管理器未加载或setNamespace方法不可用');
                }
            } catch (error) {
                console.error('[PracticeEnhancer] 存储初始化失败，跳过命名空间设置', error);
            }
        },

        cleanup: function () {
            console.log('[PracticeEnhancer] 清理资源');
            if (this.answerCollectionInterval) {
                clearInterval(this.answerCollectionInterval);
                this.answerCollectionInterval = null;
            }
            this.stopInitRequestLoop();
            if (this.reviewNavBarElement && this.reviewNavBarElement.parentNode) {
                this.reviewNavBarElement.parentNode.removeChild(this.reviewNavBarElement);
            }
            this.reviewNavBarElement = null;
        },

        configure: function (options = {}) {
            if (!options || typeof options !== 'object') {
                console.warn('[PracticeEnhancer] configure: 传入的配置无效');
                return;
            }
            this.config = mergeConfig(this.config || DEFAULT_ENHANCER_CONFIG, options);
            console.log('[PracticeEnhancer] 配置已更新:', this.config);
            if (this.isInitialized) {
                this.collectAllAnswers();
            }
        },

        registerCollector: function (collector) {
            if (typeof collector !== 'function') {
                console.warn('[PracticeEnhancer] registerCollector: collector必须为函数');
                return;
            }
            this.customCollectors.push(collector);
            if (this.isInitialized) {
                try {
                    collector({
                        addAnswer: (questionId, value) => this.addAnswer(questionId, value),
                        enhancer: this
                    });
                } catch (error) {
                    console.error('[PracticeEnhancer] 自定义收集器执行失败:', error);
                }
            }
        },

        runCustomCollectors: function () {
            if (!this.customCollectors.length) return;
            this.customCollectors.forEach(collector => {
                try {
                    collector({
                        addAnswer: (questionId, value) => this.addAnswer(questionId, value),
                        enhancer: this
                    });
                } catch (error) {
                    console.error('[PracticeEnhancer] 自定义收集器执行失败:', error);
                }
            });
        },

        normalizeQuestionId: function (questionId) {
            return normalizeQuestionKey(questionId);
        },

        addAnswer: function (questionId, value) {
            if (value === undefined || value === null) return null;
            const normalizedId = this.normalizeQuestionId(questionId);
            if (!normalizedId) return null;

            const normalizeSingle = (val) => {
                if (val === undefined || val === null) return null;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    return trimmed.length ? trimmed : null;
                }
                if (typeof val === 'number' || typeof val === 'boolean') {
                    return String(val).trim();
                }
                if (typeof val === 'object' && val !== null) {
                    if (typeof val.value === 'string') {
                        return val.value.trim() || null;
                    }
                    if (typeof val.text === 'string') {
                        return val.text.trim() || null;
                    }
                }
                const str = String(val).trim();
                return str.length ? str : null;
            };

            if (Array.isArray(value)) {
                const normalizedArray = value
                    .map((item) => normalizeSingle(item))
                    .filter(Boolean);
                if (!normalizedArray.length) {
                    return null;
                }
                const deduped = [];
                normalizedArray.forEach((item) => {
                    if (!deduped.includes(item)) {
                        deduped.push(item);
                    }
                });
                this.answers[normalizedId] = deduped;
                return normalizedId;
            }

            const normalizedValue = normalizeSingle(value);
            if (normalizedValue === null) {
                return null;
            }
            this.answers[normalizedId] = normalizedValue;
            return normalizedId;
        },

        addCorrectAnswer: function (questionId, value) {
            if (value === undefined || value === null) return null;
            const normalizedId = this.normalizeQuestionId(questionId);
            if (!normalizedId) return null;
            this.correctAnswers[normalizedId] = Array.isArray(value) ? value : String(value).trim();
            return normalizedId;
        },

        normalizeReplayMap: function (rawMap) {
            const normalized = {};
            if (!rawMap || typeof rawMap !== 'object') {
                return normalized;
            }
            Object.entries(rawMap).forEach(([key, value]) => {
                let candidate = key;
                if (typeof candidate === 'string' && candidate.includes('::')) {
                    const split = candidate.split('::');
                    candidate = split[split.length - 1];
                }
                const normalizedKey = this.normalizeQuestionId(candidate);
                if (!normalizedKey) {
                    return;
                }
                normalized[normalizedKey] = value;
            });
            return normalized;
        },

        buildReplayResultsFromEntry: function (entry = {}) {
            const answers = this.normalizeReplayMap(entry.answers || {});
            const correctAnswers = this.normalizeReplayMap(entry.correctAnswers || entry.correctAnswerMap || {});
            const rawComparison = this.normalizeReplayMap(entry.answerComparison || {});
            const questionIds = new Set([
                ...Object.keys(answers),
                ...Object.keys(correctAnswers),
                ...Object.keys(rawComparison),
                ...(Array.isArray(entry.allQuestionIds)
                    ? entry.allQuestionIds.map((item) => this.normalizeQuestionId(item)).filter(Boolean)
                    : [])
            ]);

            const answerComparison = {};
            questionIds.forEach((questionId) => {
                const rawEntry = rawComparison[questionId];
                const item = (rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry))
                    ? rawEntry
                    : {};
                const userAnswer = Object.prototype.hasOwnProperty.call(item, 'userAnswer')
                    ? item.userAnswer
                    : (Object.prototype.hasOwnProperty.call(answers, questionId) ? answers[questionId] : '');
                const correctAnswer = Object.prototype.hasOwnProperty.call(item, 'correctAnswer')
                    ? item.correctAnswer
                    : (Object.prototype.hasOwnProperty.call(correctAnswers, questionId) ? correctAnswers[questionId] : '');
                const isCorrect = typeof item.isCorrect === 'boolean'
                    ? item.isCorrect
                    : this.compareAnswers(userAnswer, correctAnswer);
                answerComparison[questionId] = {
                    questionId,
                    userAnswer,
                    correctAnswer,
                    isCorrect
                };
            });

            let scoreInfo = {};
            if (entry.scoreInfo && typeof entry.scoreInfo === 'object') {
                scoreInfo = Object.assign({}, entry.scoreInfo);
            } else {
                scoreInfo = {};
            }
            const derivedScore = this.calculateScoreFromComparison(answerComparison) || { correct: 0, total: questionIds.size, accuracy: 0, percentage: 0 };
            scoreInfo.correct = Number.isFinite(Number(scoreInfo.correct)) ? Number(scoreInfo.correct) : derivedScore.correct;
            scoreInfo.total = Number.isFinite(Number(scoreInfo.total)) ? Number(scoreInfo.total) : derivedScore.total;
            scoreInfo.accuracy = Number.isFinite(Number(scoreInfo.accuracy)) ? Number(scoreInfo.accuracy) : derivedScore.accuracy;
            scoreInfo.percentage = Number.isFinite(Number(scoreInfo.percentage))
                ? Number(scoreInfo.percentage)
                : Math.round(scoreInfo.accuracy * 100);

            return {
                answers,
                correctAnswers,
                answerComparison,
                scoreInfo
            };
        },

        applyReplayAnswersToDom: function (answers) {
            if (!answers || typeof answers !== 'object') {
                return;
            }

            Object.entries(answers).forEach(([questionId, rawValue]) => {
                const normalizedId = this.normalizeQuestionId(questionId);
                if (!normalizedId) {
                    return;
                }

                const aliases = Array.from(new Set([
                    normalizedId,
                    normalizedId.replace(/^q/i, ''),
                    `question${normalizedId.replace(/^q/i, '')}`
                ])).filter(Boolean);

                const values = Array.isArray(rawValue)
                    ? rawValue.map((item) => String(item).trim()).filter(Boolean)
                    : String(rawValue == null ? '' : rawValue).split(',').map((item) => item.trim()).filter(Boolean);
                const firstValue = values[0] || '';

                aliases.forEach((alias) => {
                    const escapedAlias = cssEscape(alias);
                    const selector = [
                        `input[name="${escapedAlias}"]`,
                        `textarea[name="${escapedAlias}"]`,
                        `select[name="${escapedAlias}"]`,
                        `input[id="${escapedAlias}"]`,
                        `textarea[id="${escapedAlias}"]`,
                        `select[id="${escapedAlias}"]`
                    ].join(', ');
                    const fields = document.querySelectorAll(selector);
                    fields.forEach((field) => {
                        if (field instanceof HTMLInputElement) {
                            if (field.type === 'radio' || field.type === 'checkbox') {
                                const candidate = String(field.value || field.dataset.option || field.id || '').trim();
                                field.checked = values.includes(candidate);
                            } else {
                                field.value = firstValue;
                            }
                        } else if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
                            field.value = firstValue;
                        }
                    });
                });
            });
        },

        setReviewMode: function (enabled) {
            this.reviewMode = Boolean(enabled);
            this.readOnly = this.reviewMode;
            document.body.classList.toggle('practice-review-readonly', this.readOnly);

            const controls = document.querySelectorAll('input, textarea, select');
            controls.forEach((control) => {
                if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
                    control.disabled = this.readOnly;
                }
            });

            const actionButtons = document.querySelectorAll('#submit-btn, #reset-btn, button[type="submit"]');
            actionButtons.forEach((button) => {
                if (button instanceof HTMLButtonElement || button instanceof HTMLInputElement) {
                    button.disabled = this.readOnly;
                }
            });
        },

        ensureReviewNavStyles: function () {
            if (document.getElementById('practice-review-nav-style')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'practice-review-nav-style';
            style.textContent = `
                #practice-review-nav { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 8px; z-index: 2; }
                #practice-review-nav button { border: 1px solid rgba(148, 163, 184, 0.6); border-radius: 6px; padding: 4px 10px; background: #fff; color: #0f172a; font-size: 12px; font-weight: 600; cursor: pointer; }
                #practice-review-nav button:disabled { opacity: 0.4; cursor: not-allowed; }
            `;
            document.head.appendChild(style);
        },

        ensureReviewNavBar: function () {
            if (this.reviewNavBarElement && this.reviewNavBarElement.isConnected) {
                return this.reviewNavBarElement;
            }
            this.ensureReviewNavStyles();

            const bar = document.createElement('div');
            bar.id = 'practice-review-nav';
            bar.innerHTML = `
                <button type="button" data-review-nav="prev">上一题</button>
                <button type="button" data-review-nav="next">下一题</button>
            `;
            bar.addEventListener('click', (event) => {
                const button = event.target && event.target.closest
                    ? event.target.closest('button[data-review-nav]')
                    : null;
                if (!button || button.disabled) {
                    return;
                }
                const direction = button.dataset.reviewNav;
                if (!direction) {
                    return;
                }
                this.sendMessage('REVIEW_NAVIGATE', {
                    direction,
                    sessionId: null,
                    reviewSessionId: this.reviewSessionId || (this.reviewContext && this.reviewContext.reviewSessionId) || null,
                    currentIndex: Number.isInteger(this.reviewEntryIndex) ? this.reviewEntryIndex : 0,
                    finalizeOnNext: Boolean(direction === 'next' && bar.dataset && bar.dataset.finalizeOnNext === 'true')
                });
            });
            const header = document.querySelector('body > header') || document.querySelector('header');
            if (header) {
                try {
                    if (window.getComputedStyle(header).position === 'static') {
                        header.style.position = 'relative';
                        header.dataset.reviewNavPatched = '1';
                    }
                } catch (_) {
                    header.style.position = 'relative';
                    header.dataset.reviewNavPatched = '1';
                }
                header.appendChild(bar);
            } else {
                document.body.insertAdjacentElement('afterbegin', bar);
            }
            this.reviewNavBarElement = bar;
            return bar;
        },

        setReviewNavVisibility: function (visible) {
            const bar = this.ensureReviewNavBar();
            if (bar && bar.style) {
                bar.style.display = visible ? 'inline-flex' : 'none';
            }
        },

        applyReviewContext: function (context = {}) {
            const contextExamId = context && context.examId != null ? String(context.examId).trim() : '';
            const currentExamId = this.examId != null ? String(this.examId).trim() : '';
            if (contextExamId && currentExamId && contextExamId !== currentExamId) {
                return;
            }
            this.reviewContext = context;
            const viewMode = context.viewMode === 'answering' ? 'answering' : 'review';
            this.reviewViewMode = viewMode;
            if (context.reviewSessionId) {
                this.reviewSessionId = context.reviewSessionId;
            }
            if (Number.isInteger(context.currentIndex)) {
                this.reviewEntryIndex = context.currentIndex;
            }
            const bar = this.ensureReviewNavBar();
            const shouldShowNav = context.showNav !== false;
            this.setReviewNavVisibility(shouldShowNav);
            const prevBtn = bar.querySelector('button[data-review-nav="prev"]');
            const nextBtn = bar.querySelector('button[data-review-nav="next"]');
            const currentIndex = Number.isFinite(Number(context.currentIndex)) ? Number(context.currentIndex) : this.reviewEntryIndex;
            const total = Number.isFinite(Number(context.total)) ? Number(context.total) : 1;
            bar.dataset.reviewIndex = String(currentIndex);
            bar.dataset.reviewTotal = String(total);
            bar.dataset.viewMode = viewMode;
            bar.dataset.finalizeOnNext = context.finalizeOnNext ? 'true' : 'false';
            if (prevBtn) {
                prevBtn.disabled = !context.canPrev;
            }
            if (nextBtn) {
                nextBtn.disabled = !context.canNext;
            }
            if (viewMode === 'answering') {
                this.setReviewMode(false);
            } else {
                this.setReviewMode(context.readOnly !== false);
            }
        },

        renderReplayFallbackTable: function (results) {
            const resultsEl = document.getElementById('results');
            if (!resultsEl || !results || !results.answerComparison) {
                return;
            }

            const rows = Object.values(results.answerComparison).map((entry) => {
                const label = this.normalizeQuestionId(entry.questionId) || entry.questionId;
                const userAnswer = Array.isArray(entry.userAnswer) ? entry.userAnswer.join(', ') : (entry.userAnswer || '未作答');
                const correctAnswer = Array.isArray(entry.correctAnswer) ? entry.correctAnswer.join(', ') : (entry.correctAnswer || '');
                const status = entry.isCorrect ? '✓' : '✗';
                const statusClass = entry.isCorrect ? 'result-correct' : 'result-incorrect';
                return `
                    <tr>
                        <td>${label}</td>
                        <td>${userAnswer}</td>
                        <td>${correctAnswer}</td>
                        <td class="${statusClass}">${status}</td>
                    </tr>
                `;
            }).join('');

            resultsEl.innerHTML = `
                <h4>回顾结果</h4>
                <p>得分 ${results.scoreInfo?.correct ?? 0} / ${results.scoreInfo?.total ?? 0} · ${results.scoreInfo?.percentage ?? 0}%</p>
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>题号</th>
                            <th>你的答案</th>
                            <th>正确答案</th>
                            <th>结果</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
            resultsEl.style.display = 'block';
        },

        applyReplayRecord: function (payload = {}) {
            const entry = payload && typeof payload.entry === 'object' ? payload.entry : payload;
            const entryExamId = entry && entry.examId != null ? String(entry.examId).trim() : '';
            const currentExamId = this.examId != null ? String(this.examId).trim() : '';
            if (entryExamId && currentExamId && entryExamId !== currentExamId) {
                return;
            }
            const replayResults = this.buildReplayResultsFromEntry(entry || {});
            if (payload.reviewSessionId) {
                this.reviewSessionId = payload.reviewSessionId;
            }
            if (Number.isInteger(payload.reviewEntryIndex)) {
                this.reviewEntryIndex = payload.reviewEntryIndex;
            }
            this.reviewViewMode = 'review';
            this.setReviewMode(payload.readOnly !== false);
            this.answers = Object.assign({}, replayResults.answers);
            this.correctAnswers = Object.assign({}, replayResults.correctAnswers);
            this.allQuestionIds = Object.keys(replayResults.answerComparison || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            this.applyReplayAnswersToDom(this.answers);
            const replayMarks = Array.isArray(payload.markedQuestions)
                ? payload.markedQuestions
                : (Array.isArray(entry.markedQuestions)
                    ? entry.markedQuestions
                    : (Array.isArray(entry.metadata && entry.metadata.markedQuestions)
                        ? entry.metadata.markedQuestions
                        : []));
            if (typeof window.setPracticeMarkedQuestions === 'function') {
                try {
                    window.setPracticeMarkedQuestions(replayMarks);
                } catch (_) {
                    // ignore mark replay failures
                }
            }

            const finalPayload = Object.assign({
                examId: entry.examId || this.examId,
                sessionId: this.sessionId,
                status: 'final',
                metadata: Object.assign({}, entry.metadata || {}, {
                    practiceMode: 'review',
                    readOnly: true,
                    replay: true
                })
            }, replayResults);
            this.dispatchPracticeResultsEvent(finalPayload);

            setTimeout(() => {
                if (!this.hasRenderableResults()) {
                    this.renderReplayFallbackTable(finalPayload);
                }
            }, 120);
        },

        captureQuestionSet: function () {
            const idSet = new Set(Array.isArray(this.allQuestionIds) ? this.allQuestionIds : []);
            const addCandidate = (candidate) => {
                const normalized = this.normalizeQuestionId(candidate);
                if (normalized) {
                    idSet.add(normalized);
                }
            };

            const navItems = document.querySelectorAll('.practice-nav .q-item');
            navItems.forEach((item) => {
                addCandidate(item.dataset.question || item.textContent || item.getAttribute('data-index'));
            });

            const questionHolders = document.querySelectorAll('[data-question], [data-question-id], [data-qid]');
            questionHolders.forEach((element) => {
                addCandidate(
                    element.dataset.question ||
                    element.dataset.questionId ||
                    element.dataset.qid
                );
            });

            const inputs = document.querySelectorAll('input[name], textarea[name], select[name]');
            inputs.forEach((element) => {
                addCandidate(element.name || element.id);
            });

            const sorted = Array.from(idSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            this.allQuestionIds = sorted;
            return sorted;
        },

        setupCommunication: function () {
            this.parentWindow = window.opener || window.parent;
            if (!this.parentWindow || this.parentWindow === window) {
                console.warn('[PracticeEnhancer] 未检测到父窗口');
                return;
            }
            this.startInitRequestLoop();
            window.addEventListener('message', (event) => {
                const payload = event && event.data ? event.data : null;
                if (!payload || typeof payload.type !== 'string') {
                    return;
                }
                const messageType = String(payload.type).toUpperCase();
                const payloadData = payload.data || {};

                if (messageType === 'INIT_SESSION' || messageType === 'INIT_EXAM_SESSION') {
                    const initData = payloadData;
                    this.sessionId = initData.sessionId;
                    this.examId = initData.examId; // 存储 examId
                    if (initData.reviewSessionId) {
                        this.reviewSessionId = initData.reviewSessionId;
                    }
                    if (Number.isInteger(initData.reviewEntryIndex)) {
                        this.reviewEntryIndex = initData.reviewEntryIndex;
                    }
                    if (initData.reviewMode) {
                        this.setReviewMode(initData.readOnly !== false);
                    }
                    this.stopInitRequestLoop();
                    console.log('[PracticeEnhancer] 收到会话初始化:', this.sessionId, 'Exam ID:', this.examId);
                    this.sendMessage('SESSION_READY', {
                        pageType: this.detectPageType(),
                        sessionId: this.sessionId,
                        url: window.location.href,
                        title: document.title,
                        reviewMode: this.reviewMode,
                        viewMode: this.reviewViewMode || (this.reviewMode ? 'review' : 'answering'),
                        readOnly: this.readOnly,
                        reviewSessionId: this.reviewSessionId || null,
                        reviewEntryIndex: this.reviewEntryIndex
                    });
                    return;
                }

                if (messageType === 'REPLAY_PRACTICE_RECORD') {
                    this.applyReplayRecord(payloadData || {});
                    return;
                }

                if (messageType === 'REVIEW_CONTEXT') {
                    this.applyReviewContext(payloadData || {});
                    return;
                }
            });
            console.log('[PracticeEnhancer] 通信设置完成');
        },

        startInitRequestLoop: function () {
            if (!this.parentWindow || this.parentWindow === window) {
                return;
            }
            if (this.initRequestTimer) {
                return;
            }
            const sendRequest = () => {
                if (this.sessionId) {
                    this.stopInitRequestLoop();
                    return;
                }
                const derivedExamId = this.extractExamIdFromUrl();
                if (!this.examId && derivedExamId) {
                    this.examId = derivedExamId;
                }
                this.sendMessage('REQUEST_INIT', {
                    examId: this.examId || null,
                    derivedExamId,
                    url: window.location.href,
                    title: document.title,
                    timestamp: Date.now()
                });
            };
            sendRequest();
            this.initRequestTimer = setInterval(sendRequest, 2000);
        },

        stopInitRequestLoop: function () {
            if (this.initRequestTimer) {
                clearInterval(this.initRequestTimer);
                this.initRequestTimer = null;
            }
        },

        detectPageType: function () {
            const context = this.getPageContext();
            if (context && context.categoryCode && context.categoryCode !== 'unknown') {
                return context.categoryCode;
            }
            const title = document.title || '';
            const url = window.location.href || '';
            if (title.includes('P1') || url.includes('P1')) return 'P1';
            if (title.includes('P2') || url.includes('P2')) return 'P2';
            if (title.includes('P3') || url.includes('P3')) return 'P3';
            if (/Part\s*4/i.test(title) || /Part\s*4/i.test(url) || title.includes('P4') || url.includes('P4')) return 'P4';
            const pathParts = url.split('/');
            for (let part of pathParts) {
                if (part.match(/^P[123]$/i)) {
                    return part.toUpperCase();
                }
                if (part.match(/^P4$/i)) {
                    return 'P4';
                }
            }
            return 'unknown';
        },

        getPageContext: function (forceRefresh = false) {
            const context = getPracticePageContext(forceRefresh);
            this.pageContext = context;
            return context;
        },

        detectPracticeType: function () {
            // 注意：不要返回 categoryCode（它是 'P1'/'P2' 等，不是 'listening'/'reading'）
            const doc = document;
            const fromBody = doc.body && doc.body.dataset
                ? [
                    doc.body.dataset.practiceType,
                    doc.body.dataset.examType,
                    doc.body.dataset.type
                ]
                : [];
            const meta = doc.querySelector('meta[name="practice-type"], meta[name="exam-type"]');
            const hints = [
                ...fromBody,
                meta ? meta.content : null,
                doc.title || ''
            ];
            const url = (window.location.href || '').toLowerCase();
            const bodyClass = doc.body ? doc.body.className.toLowerCase() : '';
            const joined = hints
                .filter(Boolean)
                .map((hint) => hint.toLowerCase())
                .concat([url, bodyClass]);
            const isListening = joined.some((hint) => /listen|audio|hearing/.test(hint))
                || url.includes('listeningpractice')
                || url.includes('/listening/');
            return isListening ? 'listening' : 'reading';
        },

        // 新增：从URL中提取真实的examId
        extractExamIdFromUrl: function () {
            // 优先读取显式配置/参数
            const doc = document;
            const metaExamId = doc.querySelector('meta[name="exam-id"], meta[name="examId"]');
            if (metaExamId && metaExamId.content) {
                return metaExamId.content.trim();
            }
            if (doc.body && doc.body.dataset) {
                if (doc.body.dataset.examId) {
                    return doc.body.dataset.examId.trim();
                }
                if (doc.body.dataset.examid) {
                    return doc.body.dataset.examid.trim();
                }
            }
            const context = this.getPageContext();
            if (context && context.examId) {
                return context.examId;
            }
            try {
                const urlParams = new URLSearchParams(window.location.search || '');
                if (urlParams.has('examId')) {
                    const qp = urlParams.get('examId');
                    if (qp) {
                        return qp.trim();
                    }
                }
            } catch (_) { }

            const url = window.location.href || '';
            const title = document.title || '';
            const pathParts = (window.location.pathname || url).split('/').map((part) => decodeURIComponent(part || '').trim()).filter(Boolean);
            let foundNumber = null;
            let foundPart = null;
            let foundSlug = null;
            let isListening = pathParts.some((part) => /listening/i.test(part));

            const normalizeSlug = (text) => {
                return text
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/gi, '-')
                    .replace(/^-+|-+$/g, '');
            };

            // 尝试从路径中提取编号与 part
            for (let part of pathParts) {
                if (foundNumber === null) {
                    const numMatch = part.match(/^(\d+)[\.\-\s]?/);
                    if (numMatch) {
                        foundNumber = numMatch[1];
                    }
                }
                if (foundPart === null) {
                    const pMatch = part.match(/p(?:art)?\s*([1-4])/i);
                    if (pMatch) {
                        foundPart = pMatch[1];
                    }
                }
                if (!foundSlug && part.length > 6 && /[a-z]/i.test(part)) {
                    foundSlug = normalizeSlug(part);
                }
            }

            // 如果标题包含part/编号也纳入
            if (!foundPart || !foundNumber) {
                const titleMatch = title.match(/p(?:art)?\s*([1-4])[^0-9]*?(\d+)?/i);
                if (titleMatch) {
                    if (!foundPart && titleMatch[1]) {
                        foundPart = titleMatch[1];
                    }
                    if (!foundNumber && titleMatch[2]) {
                        foundNumber = titleMatch[2];
                    }
                }
            }

            // 生成ID优先使用编号
            if (foundNumber) {
                if (foundPart) {
                    const prefix = isListening ? 'listening' : 'p';
                    return `${prefix}${isListening ? '' : foundPart.toLowerCase()}-${foundNumber}`;
                }
                return `${isListening ? 'listening' : 'practice'}-${foundNumber}`;
            }

            if (foundPart && foundSlug) {
                const prefix = isListening ? 'listening' : 'p';
                return `${prefix}${isListening ? '' : foundPart.toLowerCase()}-${foundSlug}`;
            }

            if (foundSlug) {
                return foundSlug;
            }

            // 最后的降级方案：返回页面类型
            return this.detectPageType();
        },

        resolveExamId: function () {
            const derived = this.examId || this.extractExamIdFromUrl();
            const sessionPrefix = this.sessionId ? String(this.sessionId).split('_')[0] : null;
            const pageType = this.detectPageType();
            const fallbackBase = derived || sessionPrefix || (pageType ? `practice-${pageType.toLowerCase()}` : null) || `practice-${Date.now()}`;
            const safe = String(fallbackBase || 'practice-unknown').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/--+/g, '-');
            this.examId = safe;
            return safe;
        },

        normalizeAnswerMap: function (answersMap) {
            const normalized = {};
            if (!answersMap || typeof answersMap !== 'object') {
                return normalized;
            }
            Object.entries(answersMap).forEach(([key, value]) => {
                const normalizedKey = this.addCorrectAnswer(key, value);
                if (normalizedKey) {
                    normalized[normalizedKey] = this.correctAnswers[normalizedKey];
                }
            });
            this.correctAnswers = normalized;
            return normalized;
        },

        extractCorrectAnswers: function () {
            console.log('[PracticeEnhancer] 开始提取正确答案');

            // 使用CorrectAnswerExtractor如果可用
            if (window.CorrectAnswerExtractor) {
                try {
                    const extractor = new CorrectAnswerExtractor();
                    const extractedAnswers = extractor.extractFromPage(document);

                    if (extractedAnswers && Object.keys(extractedAnswers).length > 0) {
                        this.normalizeAnswerMap(extractedAnswers);
                        console.log('[PracticeEnhancer] 使用提取器成功获得正确答案:', this.correctAnswers);
                    } else {
                        console.warn('[PracticeEnhancer] 提取器未找到答案，使用备用方法');
                        this.extractCorrectAnswersBackup();
                    }
                } catch (error) {
                    console.warn('[PracticeEnhancer] 提取器失败，使用备用方法:', error);
                    this.extractCorrectAnswersBackup();
                }
            } else {
                console.warn('[PracticeEnhancer] CorrectAnswerExtractor未加载，使用备用方法');
                this.extractCorrectAnswersBackup();
            }

            // 延迟提取，在页面完全加载后再次尝试
            setTimeout(function () {
                this.extractFromResultsTable();
            }.bind(this), 2000);

            // 定期检查是否有新的正确答案数据
            this.startCorrectAnswerMonitoring();
        },

        extractCorrectAnswersBackup: function () {
            // 多种备用提取方法
            const sources = ['answers', 'correctAnswers', 'answerKey', 'solutions'];

            for (const source of sources) {
                if (window[source] && typeof window[source] === 'object') {
                    Object.keys(window[source]).forEach(key => {
                        const value = window[source][key];
                        if (value !== undefined && value !== null) {
                            let normalizedKey = key;
                            if (!normalizedKey.startsWith('q') && /^\d+$/.test(normalizedKey)) {
                                normalizedKey = 'q' + normalizedKey;
                            }
                            this.addCorrectAnswer(normalizedKey, value);
                        }
                    });
                }
            }

            // 尝试从DOM中提取
            this.extractFromDOM();

            console.log('[PracticeEnhancer] 备用方法提取正确答案:', this.correctAnswers);
        },

        extractFromDOM: function () {
            // 查找包含正确答案的元素
            const selectors = [
                '[data-correct-answer]',
                '.correct-answer',
                '.answer-key',
                '[data-answer]'
            ];

            const self = this;
            for (let i = 0; i < selectors.length; i++) {
                const selector = selectors[i];
                const elements = document.querySelectorAll(selector);
                for (let j = 0; j < elements.length; j++) {
                    const element = elements[j];
                    const questionId =
                        element.dataset.question ||
                        element.dataset.for ||
                        element.dataset.questionId ||
                        this.extractQuestionId(element) ||
                        element.id;
                    const correctAnswer = element.dataset.correctAnswer ||
                        element.dataset.answer ||
                        element.textContent.trim();

                    if (questionId && correctAnswer) {
                        self.addCorrectAnswer(questionId, correctAnswer);
                    }
                }
            }

        },

        extractFromResultsTable: function () {
            console.log('[PracticeEnhancer] 尝试从结果表格提取正确答案');
            const beforeCount = Object.keys(this.correctAnswers).length;

            // 查找结果显示区域
            const resultsEl = document.getElementById('results');
            if (!resultsEl) {
                console.log('[PracticeEnhancer] 未找到results元素');
                return;
            }

            // 查找表格
            const tables = resultsEl.querySelectorAll('table');
            console.log('[PracticeEnhancer] 找到表格数量:', tables.length);

            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const rows = table.querySelectorAll('tr');
                console.log('[PracticeEnhancer] 表格', i, '行数:', rows.length);

                for (let j = 1; j < rows.length; j++) { // 跳过表头
                    const row = rows[j];
                    const cells = row.querySelectorAll('td');

                    if (cells.length >= 3) {
                        const questionCell = cells[0];
                        const userAnswerCell = cells[1];
                        const correctAnswerCell = cells[2];

                        const questionText = questionCell.textContent.trim();
                        const userAnswer = userAnswerCell.textContent.trim();
                        const correctAnswer = correctAnswerCell.textContent.trim();

                        console.log('[PracticeEnhancer] 处理行:', questionText, userAnswer, correctAnswer);

                        // 提取问题编号
                        const questionMatch = questionText.match(/(\d+)/);
                        if (questionMatch && correctAnswer && correctAnswer !== 'N/A' && correctAnswer !== '') {
                            const questionNum = questionMatch[1];
                            const questionKey = 'q' + questionNum;
                            const normalizedKey = this.addCorrectAnswer(questionKey, correctAnswer) || questionKey;

                            // 同时更新用户答案，确保数据一致性
                            if (userAnswer && userAnswer !== 'No Answer') {
                                this.addAnswer(normalizedKey, userAnswer);
                            }

                            console.log('[PracticeEnhancer] 从表格提取:', normalizedKey, '用户答案:', userAnswer, '正确答案:', correctAnswer);
                        }
                    }
                }
            }

            console.log('[PracticeEnhancer] 表格提取完成，正确答案:', this.correctAnswers);
            console.log('[PracticeEnhancer] 表格提取完成，用户答案:', this.answers);
            const afterCount = Object.keys(this.correctAnswers).length;
            if (afterCount > beforeCount) {
                this.broadcastResultsUpdate();
            }
            return afterCount > beforeCount;
        },

        setupAnswerListeners: function () {
            const self = this;

            // 增强的change事件监听
            document.addEventListener('change', function (e) {
                if (!self.isExcludedControl(e.target)) {
                    self.recordAnswer(e.target);
                }
            });

            // 增强的input事件监听
            document.addEventListener('input', function (e) {
                if (!self.isExcludedControl(e.target)) {
                    self.recordAnswer(e.target);
                }
            });

            // 点击事件监听（用于单选框、复选框）
            document.addEventListener('click', function (e) {
                if (e.target.type === 'radio' || e.target.type === 'checkbox') {
                    if (!self.isExcludedControl(e.target)) {
                        setTimeout(() => self.recordAnswer(e.target), 10);
                    }
                }
            });

            // 拖拽事件监听
            document.addEventListener('drop', function (e) {
                setTimeout(function () {
                    self.collectAllAnswers(); // 全面收集一次（多套题/单套题内部会自行处理拖拽答案）
                }, 100);
            });

            // 页面可见性变化时收集答案（替代定期收集）
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    console.log('[PracticeEnhancer] 页面隐藏，收集答案');
                    self.collectAllAnswers();
                } else {
                    console.log('[PracticeEnhancer] 页面显示，准备收集答案');
                }
            });

            // 页面卸载前收集答案和清理
            window.addEventListener('beforeunload', function () {
                console.log('[PracticeEnhancer] 页面卸载，收集答案并清理');
                self.collectAllAnswers();
                self.cleanup();
            });

            // 页面失去焦点时收集答案
            window.addEventListener('blur', function () {
                console.log('[PracticeEnhancer] 页面失去焦点，收集答案');
                self.collectAllAnswers();
            });

            console.log('[PracticeEnhancer] 增强答案监听器设置完成');
        },

        // 判断是否为应当排除的非答题控件（如播放速度、音量滑条等）
        isExcludedControl: function (element) {
            if (!element) return false;
            const config = this.config || {};

            try {
                const datasetFlag = config.datasetExcludeAttribute || 'enhancerExclude';
                if (element.dataset && (element.dataset[datasetFlag] === 'true' || element.dataset[datasetFlag] === '1')) {
                    return true;
                }

                if (element.dataset && element.dataset.practiceExclude === 'true') {
                    return true;
                }

                const excludedNames = config.excludedNames || [];
                if (excludedNames.length) {
                    if ((element.name && excludedNames.includes(element.name)) ||
                        (element.id && excludedNames.includes(element.id))) {
                        return true;
                    }
                }

                const selectors = config.excludedSelectors || [];
                for (let i = 0; i < selectors.length; i++) {
                    const selector = selectors[i];
                    if (element.matches && element.matches(selector)) {
                        return true;
                    }
                }

                const ancestorSelectors = config.excludedAncestors || [];
                for (let i = 0; i < ancestorSelectors.length; i++) {
                    const selector = ancestorSelectors[i];
                    if (element.closest && element.closest(selector)) {
                        return true;
                    }
                }
            } catch (error) {
                console.warn('[PracticeEnhancer] 判断是否排除控件失败:', error);
            }

            return false;
        },

        recordAnswer: function (element) {
            if (!element || this.isExcludedControl(element)) return;

            const questionId = this.getQuestionId(element);
            if (!questionId) {
                return;
            }

            const value = this.getInputValue(element);
            const hasValue = Array.isArray(value) ? value.length > 0 : (value !== null && value !== undefined && value !== '');
            if (!hasValue) {
                return;
            }

            const normalizedId = this.addAnswer(questionId, value);
            if (!normalizedId) return;
            console.log('[PracticeEnhancer] 记录答案:', normalizedId, '=', value);

            this.interactions.push({
                type: 'answer',
                questionId: normalizedId,
                value: value,
                timestamp: Date.now(),
                elementType: element.type || element.tagName.toLowerCase()
            });
        },

        collectDropzoneAnswers: function () {
            // 收集拖拽填空题答案
            const dropzones = document.querySelectorAll('.dropzone');
            for (let i = 0; i < dropzones.length; i++) {
                const zone = dropzones[i];
                const qName = zone.dataset.target;
                const card = zone.querySelector('.card');
                if (qName && card) {
                    this.addAnswer(qName, card.dataset.value || card.textContent.trim());
                }
            }

            // 收集段落匹配题答案
            const paragraphZones = document.querySelectorAll('.paragraph-dropzone');
            for (let i = 0; i < paragraphZones.length; i++) {
                const zone = paragraphZones[i];
                const paragraph = zone.dataset.paragraph;
                const items = zone.querySelectorAll('.drag-item');
                if (paragraph && items.length > 0) {
                    const itemTexts = [];
                    for (let j = 0; j < items.length; j++) {
                        const item = items[j];
                        itemTexts.push(item.dataset.heading || item.textContent.trim());
                    }
                    this.addAnswer('q' + paragraph.toLowerCase(), itemTexts.join(','));
                }
            }

            // 收集匹配题答案
            const matchZones = document.querySelectorAll('.match-dropzone');
            for (let i = 0; i < matchZones.length; i++) {
                const zone = matchZones[i];
                const qName = zone.dataset.question;
                const item = zone.querySelector('.drag-item') || zone.querySelector('.drag-item-clone');
                if (qName && item) {
                    const answerValue = item.dataset.option || item.dataset.country || item.dataset.heading || item.textContent.trim();
                    this.addAnswer(qName, answerValue);
                }
            }
        },

        interceptSubmit: function () {
            // 延迟拦截，确保页面完全加载
            setTimeout(function () {
                // 拦截gradeAnswers函数
                if (typeof window.gradeAnswers === 'function') {
                    const originalGradeAnswers = window.gradeAnswers;
                    const self = this;
                    window.gradeAnswers = function () {
                        console.log('[PracticeEnhancer] 拦截到gradeAnswers调用');
                        self.collectAllAnswers();
                        const result = originalGradeAnswers();
                        self.handleSubmit();
                        return result;
                    };
                    console.log('[PracticeEnhancer] gradeAnswers函数拦截成功');
                } else {
                    console.warn('[PracticeEnhancer] 未找到gradeAnswers函数');
                }

                // 拦截grade函数
                if (typeof window.grade === 'function') {
                    const originalGrade = window.grade;
                    const self = this;
                    window.grade = function () {
                        console.log('[PracticeEnhancer] 拦截到grade调用');
                        self.collectAllAnswers();
                        const result = originalGrade();
                        self.handleSubmit();
                        return result;
                    };
                    console.log('[PracticeEnhancer] grade函数拦截成功');
                }
            }.bind(this), 1000);

            // 监听表单提交
            document.addEventListener('submit', (e) => {
                console.log('[PracticeEnhancer] 拦截到表单提交');
                this.collectAllAnswers();
                this.handleSubmit();
            });

            // 监听提交按钮点击 - 增强版
            const self = this;
            document.addEventListener('click', function (e) {
                const target = e.target;

                // 检查是否为提交按钮
                const isSubmitButton = target.tagName === 'BUTTON' &&
                    (target.textContent.includes('Submit') ||
                        target.textContent.includes('提交') ||
                        target.textContent.includes('完成') ||
                        target.textContent.includes('Check') ||
                        target.classList.contains('primary') ||
                        target.id === 'submit-btn' ||
                        (target.onclick && target.onclick.toString().includes('grade')));

                if (!isSubmitButton) {
                    return;
                }

                console.log('[PracticeEnhancer] 检测到提交按钮点击:', target);

                self.collectAllAnswers();
                self.handleSubmit();
            });

            // 定期检查结果是否出现
            this.startResultsMonitoring();

            console.log('[PracticeEnhancer] 提交拦截设置完成');
        },

        startCorrectAnswerMonitoring: function () {
            let checkCount = 0;
            const maxChecks = 30;
            const self = this;

            function checkForCorrectAnswers() {
                checkCount++;

                // 尝试从结果表格提取
                const resultsEl = document.getElementById('results');
                if (resultsEl && resultsEl.style.display !== 'none') {
                    const tables = resultsEl.querySelectorAll('table');
                    if (tables.length > 0) {
                        const firstTable = tables[0];
                        const rows = firstTable.querySelectorAll('tr');
                        if (rows.length > 1) { // 有数据行
                            console.log('[PracticeEnhancer] 检测到结果表格，提取正确答案');
                            self.extractFromResultsTable();
                        }
                    }
                }

                // 继续检查直到达到最大次数
                if (checkCount < maxChecks && Object.keys(self.correctAnswers).length === 0) {
                    setTimeout(checkForCorrectAnswers, 1000);
                }
            }

            setTimeout(checkForCorrectAnswers, 3000);
        },

        startResultsMonitoring: function () {
            let checkCount = 0;
            const maxChecks = 60;
            const self = this;

            function checkResults() {
                checkCount++;
                const resultsEl = document.getElementById('results');

                if (resultsEl && resultsEl.style.display !== 'none' && resultsEl.textContent.includes('Final Score')) {
                    console.log('[PracticeEnhancer] 检测到结果显示，自动提取分数');
                    self.collectAllAnswers();
                    // 不需要额外延迟，handleSubmit内部已经有延迟处理
                    self.handleSubmit();
                    return;
                }

                if (checkCount < maxChecks) {
                    setTimeout(checkResults, 500);
                }
            }

            setTimeout(checkResults, 2000);
        },

        collectAllAnswers: function () {
            console.log('[PracticeEnhancer] 开始全面收集答案...');
            this.captureQuestionSet();

            // 使用原有逻辑
            const beforeCount = Object.keys(this.answers).length;

            // 1. 收集所有输入元素（更广泛的选择器），同时过滤非答题控件
            const allInputs = Array.from(document.querySelectorAll('input, textarea, select'))
                .filter(el => !this.isExcludedControl(el));
            console.log('[PracticeEnhancer] 找到输入元素总数:', allInputs.length);

            const processedGroups = {
                checkbox: new Set(),
                radio: new Set()
            };

            allInputs.forEach((input, index) => {
                const questionId = this.getQuestionId(input);
                if (!questionId) {
                    return;
                }

                if (input.type === 'checkbox') {
                    const groupKey = `${questionId}::checkbox::${input.name || input.id || index}`;
                    if (processedGroups.checkbox.has(groupKey)) {
                        return;
                    }
                    processedGroups.checkbox.add(groupKey);
                } else if (input.type === 'radio') {
                    const groupKey = `${questionId}::radio::${input.name || input.id || index}`;
                    if (processedGroups.radio.has(groupKey)) {
                        return;
                    }
                    processedGroups.radio.add(groupKey);
                }

                const value = this.getInputValue(input);

                if (input.type === 'text') {
                    console.log(`[DEBUG] Text Input Found: id='${input.id}', name='${input.name}', derived_questionId='${questionId}', value='${value}'`);
                }

                console.log(`[PracticeEnhancer] 输入元素 ${index}: type=${input.type}, name=${input.name}, id=${input.id}, value=${value}, questionId=${questionId}`);

                const hasValue = Array.isArray(value) ? value.length > 0 : (value !== null && value !== undefined && value !== '');
                if (hasValue) {
                    const normalizedId = this.addAnswer(questionId, value);
                    if (normalizedId) {
                        console.log(`[PracticeEnhancer] 记录答案: ${normalizedId} = ${value}`);
                    }
                }
            });

            // 2. 收集拖拽答案
            this.collectDropzoneAnswers();

            // 3. 收集特殊格式的答案（通过data属性）
            const answerElements = document.querySelectorAll('[data-user-answer], [data-value]');
            console.log('[PracticeEnhancer] 找到data答案元素:', answerElements.length);

            answerElements.forEach(element => {
                const questionId = element.dataset.question || element.dataset.for || element.id;
                const answer = element.dataset.answer || element.dataset.userAnswer || element.dataset.value;
                if (questionId && answer) {
                    const normalizedId = this.addAnswer(questionId, answer);
                    if (normalizedId) {
                        console.log(`[PracticeEnhancer] 记录data答案: ${normalizedId} = ${answer}`);
                    }
                }
            });

            // 4. 收集匹配题答案
            this.collectMatchingAnswers();

            // 5. 收集排序题答案
            this.collectOrderingAnswers();

            // 6. 尝试从页面特定结构收集答案
            this.collectFromPageStructure();

            // 7. 运行自定义收集器
            this.runCustomCollectors();

            const afterCount = Object.keys(this.answers).length;
            console.log(`[PracticeEnhancer] 全面收集完成，答案数量从 ${beforeCount} 增加到 ${afterCount}`);
            console.log('[PracticeEnhancer] 收集到的所有答案:', this.answers);
        },

        getQuestionId: function (input) {
            if (this.isExcludedControl(input)) return null;
            const config = this.config || {};
            const attributes = config.questionIdAttributes || [];

            const tryReadAttribute = (key) => {
                if (key === 'name') {
                    return input.name || null;
                }
                if (key === 'id') {
                    return input.id ? input.id.replace(/_input$|-input$|_answer$/, '') : null;
                }
                if (key.startsWith('data-')) {
                    const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                    if (input.dataset && input.dataset[dataKey]) {
                        return input.dataset[dataKey];
                    }
                    return input.getAttribute(key);
                }
                if (input.dataset && input.dataset[key]) {
                    return input.dataset[key];
                }
                return input.getAttribute ? input.getAttribute(key) : null;
            };

            for (let i = 0; i < attributes.length; i++) {
                const value = tryReadAttribute(attributes[i]);
                if (value) return value;
            }

            if (input.dataset && input.dataset.question) return input.dataset.question;
            if (input.dataset && input.dataset.for) return input.dataset.for;

            let parent = input.parentElement;
            while (parent && parent !== document.body) {
                if (parent.dataset.question) return parent.dataset.question;
                if (parent.id && parent.id.includes('q')) return parent.id;
                parent = parent.parentElement;
            }

            const label = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
            if (label && label.textContent) {
                const match = label.textContent.match(/(\d+)/);
                if (match) return 'q' + match[1];
            }

            return null;
        },

        getInputValue: function (input) {
            if (!input) return null;
            if (input.type === 'checkbox') {
                const values = this.getCheckboxGroupValues(input);
                return values.length ? values : null;
            }
            if (input.type === 'radio') {
                return this.getRadioGroupValue(input);
            }
            if (input.tagName === 'SELECT' && input.multiple) {
                const selected = Array.from(input.selectedOptions || [])
                    .map((opt) => (opt.value || opt.textContent || '').trim())
                    .filter(Boolean);
                return selected.length ? selected : null;
            }
            if (typeof input.value === 'string') {
                const trimmed = input.value.trim();
                return trimmed.length ? trimmed : null;
            }
            if (typeof input.value !== 'undefined') {
                return input.value;
            }
            const fallback = (input.textContent || '').trim();
            return fallback.length ? fallback : null;
        },

        getGroupElements: function (input, type) {
            if (!input) {
                return [];
            }
            if (!input.name) {
                return [input];
            }
            const scope = input.form || document;
            const selector = `input[type="${type}"][name="${cssEscape(input.name)}"]`;
            try {
                return Array.from(scope.querySelectorAll(selector));
            } catch (error) {
                console.warn('[PracticeEnhancer] 查询分组元素失败:', error);
                return [input];
            }
        },

        getCheckboxGroupValues: function (input) {
            const elements = this.getGroupElements(input, 'checkbox');
            const values = [];
            elements.forEach((element) => {
                if (!element || this.isExcludedControl(element) || !element.checked) {
                    return;
                }
                const resolved = (element.value || element.textContent || '').trim();
                if (resolved) {
                    values.push(resolved);
                }
            });
            return values;
        },

        getRadioGroupValue: function (input) {
            if (!input) return null;
            const elements = input.name ? this.getGroupElements(input, 'radio') : [input];
            const selected = elements.find((element) => element && element.checked);
            if (!selected) {
                return null;
            }
            const resolved = (selected.value || selected.textContent || '').trim();
            return resolved || null;
        },

        collectFromPageStructure: function () {
            console.log('[PracticeEnhancer] 尝试从页面结构收集答案...');

            // 查找所有可能包含问题的容器
            const questionContainers = document.querySelectorAll(
                '.question, .quiz-question, [class*="question"], [id*="question"], [data-question]'
            );

            console.log('[PracticeEnhancer] 找到问题容器:', questionContainers.length);

            questionContainers.forEach((container, index) => {
                console.log(`[PracticeEnhancer] 处理问题容器 ${index}:`, container.className, container.id);

                // 在容器内查找输入元素
                const inputs = Array.from(container.querySelectorAll('input, textarea, select'))
                    .filter(el => !this.isExcludedControl(el));
                inputs.forEach(input => {
                    const questionId = this.getQuestionId(input) || `q${index + 1}`;
                    const value = this.getInputValue(input);

                    if (value !== null && value !== '') {
                        const normalizedId = this.addAnswer(questionId, value);
                        if (normalizedId) {
                            console.log(`[PracticeEnhancer] 从容器收集答案: ${normalizedId} = ${value}`);
                        }
                    }
                });
            });
        },

        collectMatchingAnswers: function () {
            // 收集匹配题的答案
            const matchContainers = document.querySelectorAll('.matching-container, .match-exercise, [class*="match"]');
            matchContainers.forEach(container => {
                const pairs = container.querySelectorAll('.match-pair, .matched-item');
                pairs.forEach(pair => {
                    const questionId = pair.dataset.question || pair.dataset.left;
                    const answer = pair.dataset.answer || pair.dataset.right;
                    if (questionId && answer) {
                        this.addAnswer(questionId, answer);
                    }
                });
            });
        },

        collectOrderingAnswers: function () {
            // 收集排序题的答案
            const orderContainers = document.querySelectorAll('.ordering-container, .sort-exercise, [class*="order"]');
            orderContainers.forEach(container => {
                const items = container.querySelectorAll('.order-item, .sortable-item');
                const orderedAnswers = [];
                items.forEach((item, index) => {
                    const value = item.dataset.value || item.textContent.trim();
                    if (value) {
                        orderedAnswers.push(value);
                    }
                });

                if (orderedAnswers.length > 0) {
                    const questionId = container.dataset.question || 'ordering';
                    this.addAnswer(questionId, orderedAnswers.join(','));
                }
            });
        },

        setupInteractionTracking: function () {
            const self = this;
            document.addEventListener('click', function (e) {
                self.interactions.push({
                    type: 'click',
                    target: e.target.tagName + (e.target.className ? '.' + e.target.className : ''),
                    timestamp: Date.now()
                });
            });

            let scrollTimeout;
            document.addEventListener('scroll', function () {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(function () {
                    self.interactions.push({
                        type: 'scroll',
                        scrollY: window.scrollY,
                        timestamp: Date.now()
                    });
                }, 500);
            });
        },

        handleSubmit: function () {
            const simulationMode = window.__UNIFIED_READING_SIMULATION_MODE__ === true;
            if (simulationMode) {
                console.info('[PracticeEnhancer] 模拟模式下忽略提交拦截，交由统一阅读页处理');
                return;
            }
            if (this.readOnly) {
                console.info('[PracticeEnhancer] 回顾模式下忽略提交');
                return;
            }
            if (this.hasDispatchedFinalResults) {
                console.log('[PracticeEnhancer] 最终结果已发送，忽略重复提交');
                return;
            }
            if (this.submitInProgress) {
                console.log('[PracticeEnhancer] 提交处理中，跳过重复触发');
                return;
            }
            this.submitInProgress = true;

            const derivedExamId = this.extractExamIdFromUrl();
            if (!this.sessionId) {
                this.examId = this.examId || derivedExamId;
                this.sessionId = this.generateFallbackSessionId(this.examId || derivedExamId);
                console.warn('[PracticeEnhancer] 无会话ID，使用本地生成的回退ID:', this.sessionId);
            }
            this.examId = this.examId || derivedExamId;

            this.collectAllAnswers();

            const preliminary = this.buildResultsPayload({
                includeComparison: true,
                includeScore: false
            });
            preliminary.status = 'preliminary';
            this.dispatchPracticeResultsEvent(preliminary);

            const self = this;
            const finalizeSubmission = function () {
                self.extractFromResultsTable();
                if (Object.keys(self.correctAnswers).length === 0) {
                    self.extractCorrectAnswersBackup();
                }

                const finalResults = self.buildResultsPayload({
                    includeComparison: true,
                    includeScore: true
                });
                finalResults.status = 'final';
                self.dispatchPracticeResultsEvent(finalResults);

                const pushResults = function () {
                    console.log('[PracticeEnhancer] 发送练习完成数据:', finalResults);
                    self.sendMessage('PRACTICE_COMPLETE', finalResults);
                    self.hasDispatchedFinalResults = true;
                    self.submitInProgress = false;
                };

                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(pushResults, { timeout: 1200 });
                } else {
                    setTimeout(pushResults, 0);
                }
            };

            this.waitForResultsRender(5000)
                .then(finalizeSubmission)
                .catch(function (error) {
                    console.warn('[PracticeEnhancer] 等待结果渲染时出错，直接完成提交流程:', error);
                    finalizeSubmission();
                });
        },

        generateFallbackSessionId: function (examId) {
            const safeId = (examId ? String(examId) : 'session')
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .slice(-32);
            return `${safeId || 'session'}_${Date.now()}`;
        },

        hasRenderableResults: function () {
            const resultsEl = document.getElementById('results');
            if (!resultsEl || resultsEl.style.display === 'none') {
                return false;
            }
            const table = resultsEl.querySelector('table');
            if (table && table.querySelectorAll('tr').length > 1) {
                return true;
            }
            return (resultsEl.textContent || '').trim().length > 0;
        },

        waitForResultsRender: function (timeoutMs) {
            const self = this;
            const limit = typeof timeoutMs === 'number' ? timeoutMs : 1500;
            return new Promise(function (resolve) {
                let resolved = false;
                let observer = null;
                const finish = function () {
                    if (resolved) return;
                    resolved = true;
                    if (observer) {
                        observer.disconnect();
                    }
                    resolve();
                };

                if (self.hasRenderableResults()) {
                    finish();
                    return;
                }

                observer = new MutationObserver(function () {
                    if (self.hasRenderableResults()) {
                        finish();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });

                setTimeout(finish, limit);
            });
        },

        dispatchPracticeResultsEvent: function (results) {
            try {
                document.dispatchEvent(new CustomEvent('practiceResultsReady', {
                    detail: results
                }));
                if (this.readOnly && results && results.status === 'final') {
                    setTimeout(() => {
                        if (!this.hasRenderableResults()) {
                            this.renderReplayFallbackTable(results);
                        }
                    }, 120);
                }
            } catch (eventError) {
                console.warn('[PracticeEnhancer] 触发practiceResultsReady事件失败:', eventError);
            }
        },

        broadcastResultsUpdate: function () {
            const results = this.buildResultsPayload({
                includeComparison: true,
                includeScore: false
            });
            results.status = 'update';
            this.dispatchPracticeResultsEvent(results);
        },

        buildResultsPayload: function (options) {
            const endTime = Date.now();
            const resolvedExamId = this.resolveExamId();
            const includeComparison = options && options.includeComparison;
            const includeScore = options && options.includeScore;
            const context = this.getPageContext();
            const practiceType = this.detectPracticeType();
            const pageType = this.detectPageType();
            const baseMetadata = (window.practicePageMetadata && typeof window.practicePageMetadata === 'object')
                ? window.practicePageMetadata
                : {};
            const metadataPayload = Object.assign({}, baseMetadata);
            const derivedTitle = document.title || resolvedExamId;
            if (context && context.title) {
                metadataPayload.examTitle = metadataPayload.examTitle || context.title;
                metadataPayload.title = metadataPayload.title || context.title;
            }
            if (!metadataPayload.examTitle) {
                metadataPayload.examTitle = derivedTitle;
            }
            if (!metadataPayload.title) {
                metadataPayload.title = metadataPayload.examTitle;
            }
            if (!metadataPayload.type) {
                metadataPayload.type = practiceType;
            }
            if (!metadataPayload.examType) {
                metadataPayload.examType = practiceType;
            }
            if (context && context.frequencyLabel) {
                metadataPayload.frequency = metadataPayload.frequency || context.frequencyLabel;
            }
            if (!metadataPayload.frequency) {
                metadataPayload.frequency = '未知频率';
            }
            if (context && context.categoryLabel && context.categoryLabel !== 'unknown') {
                metadataPayload.category = metadataPayload.category || context.categoryLabel;
            }
            if (!metadataPayload.category && pageType) {
                metadataPayload.category = pageType;
            }
            const resolvedTitleRaw = metadataPayload.examTitle || metadataPayload.title || derivedTitle;
            const normalizedTitle = sanitizeExamTitle(resolvedTitleRaw);
            metadataPayload.examTitle = normalizedTitle || resolvedTitleRaw;
            metadataPayload.title = metadataPayload.title || metadataPayload.examTitle;
            const resolvedTitle = metadataPayload.examTitle || metadataPayload.title || derivedTitle;
            const timing = this.resolvePracticeTiming();
            const answerComparison = includeComparison
                ? this.generateAnswerComparison()
                : {};

            const payload = {
                sessionId: this.sessionId,
                examId: resolvedExamId,
                derivedExamId: resolvedExamId,
                originalExamId: this.examId,
                startTime: timing.startTime,
                endTime: timing.endTime,
                duration: timing.duration,
                effectiveEndTime: timing.effectiveEndTime,
                answers: Object.assign({}, this.answers),
                correctAnswers: Object.assign({}, this.correctAnswers),
                answerComparison: answerComparison,
                interactions: Array.isArray(this.interactions) ? this.interactions.slice() : [],
                scoreInfo: includeScore ? this.extractScore() : null,
                practiceType: practiceType,
                type: practiceType,
                pageType: pageType,
                url: window.location.href,
                title: resolvedTitle,
                allQuestionIds: this.captureQuestionSet().slice(),
                metadata: metadataPayload
            };

            // 新增：添加spellingErrors字段（初始为空数组，后续任务会实现）
            payload.spellingErrors = [];

            if (includeScore) {
                const comparisonScore = this.calculateScoreFromComparison(answerComparison);
                const scoreInfo = payload.scoreInfo;
                const needsFallback = !scoreInfo
                    || !Number.isFinite(scoreInfo.total)
                    || scoreInfo.total === 0
                    || (!Number.isFinite(scoreInfo.correct) && comparisonScore)
                    || (scoreInfo.correct === 0 && comparisonScore && comparisonScore.correct > 0);

                if (!scoreInfo && comparisonScore) {
                    payload.scoreInfo = comparisonScore;
                } else if (needsFallback && comparisonScore) {
                    payload.scoreInfo = Object.assign({}, comparisonScore, scoreInfo || {});
                    if (!payload.scoreInfo.source && comparisonScore.source) {
                        payload.scoreInfo.source = comparisonScore.source;
                    }
                }
            }

            this.runHooks('afterBuildPayload', payload);

            return payload;
        },

        generateAnswerComparison: function () {
            const comparison = {};

            // 获取所有问题的键
            const userKeys = Object.keys(this.answers);
            const correctKeys = Object.keys(this.correctAnswers);
            const allQuestions = {};

            // 合并所有问题键
            for (let i = 0; i < userKeys.length; i++) {
                allQuestions[userKeys[i]] = true;
            }
            for (let i = 0; i < correctKeys.length; i++) {
                allQuestions[correctKeys[i]] = true;
            }

            const questionKeys = Object.keys(allQuestions);
            for (let i = 0; i < questionKeys.length; i++) {
                const questionKey = questionKeys[i];
                const userAnswer = this.answers[questionKey];
                let correctAnswer = this.correctAnswers[questionKey];

                comparison[questionKey] = {
                    userAnswer: userAnswer || null,
                    correctAnswer: correctAnswer || null,
                    isCorrect: this.compareAnswers(userAnswer, correctAnswer)
                };
            }

            console.log('[PracticeEnhancer] 生成答案比较:', comparison);
            return comparison;
        },

        calculateScoreFromComparison: function (comparison) {
            if (!comparison || typeof comparison !== 'object') {
                return null;
            }

            let correct = 0;
            let total = 0;

            Object.values(comparison).forEach((item) => {
                if (!item || typeof item !== 'object') {
                    return;
                }
                const hasContent = item.userAnswer != null || item.correctAnswer != null;
                if (!hasContent) {
                    return;
                }
                total += 1;
                if (item.isCorrect) {
                    correct += 1;
                }
            });

            if (total === 0) {
                return null;
            }

            const accuracy = correct / total;
            return {
                correct,
                total,
                accuracy,
                percentage: Math.round(accuracy * 100),
                source: 'comparison_fallback'
            };
        },

        splitAnswerTokensLite: function (value) {
            const core = window.AnswerMatchCore;
            if (core && typeof core.splitAnswerTokens === 'function') {
                return core.splitAnswerTokens(value);
            }
            const normalize = (entry) => {
                const text = String(entry == null ? '' : entry)
                    .replace(/[“”]/g, '"')
                    .replace(/[‘’]/g, "'")
                    .replace(/[‐‑‒–—]/g, '-')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/^[\s"'`()[\]{}<>.,;:!?]+|[\s"'`()[\]{}<>.,;:!?]+$/g, '');
                if (!text) return '';
                const lowered = text.toLowerCase();
                if (['true', 't', 'yes', 'y'].includes(lowered)) return 'true';
                if (['false', 'f', 'no', 'n'].includes(lowered)) return 'false';
                if (['ng', 'notgiven', 'not-given'].includes(lowered)) return 'not given';
                if (/^[a-z]$/i.test(text)) return text.toUpperCase();
                const leadingOption = text.match(/^([A-Za-z])(?:[.)])?\s+/);
                return (leadingOption && text.length > 2) ? leadingOption[1].toUpperCase() : text;
            };
            if (Array.isArray(value)) {
                return Array.from(new Set(value.map(normalize).filter(Boolean)));
            }
            const raw = String(value == null ? '' : value)
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .replace(/[‐‑‒–—]/g, '-')
                .replace(/\s+/g, ' ')
                .trim();
            if (!raw) {
                return [];
            }
            let parts = [raw];
            if (/^[A-Za-z](?:\s*[,/;，、]\s*[A-Za-z])+$/.test(raw)) {
                parts = raw.split(/[,/;，、]/);
            } else if (/^[A-Za-z](?:\s+[A-Za-z])+$/.test(raw)) {
                parts = raw.split(/\s+/);
            }
            return Array.from(new Set(parts.map(normalize).filter(Boolean)));
        },

        compareAnswersFallbackLite: function (userAnswer, correctAnswer) {
            const actual = this.splitAnswerTokensLite(userAnswer);
            const expected = this.splitAnswerTokensLite(correctAnswer);
            if (!expected.length && !actual.length) {
                return null;
            }
            if (!expected.length || !actual.length) {
                return false;
            }
            const core = window.AnswerMatchCore;
            const areEquivalent = (left, right) => {
                if (core && typeof core.areTokensEquivalent === 'function') {
                    return core.areTokensEquivalent(left, right) === true;
                }
                if (left === right) {
                    return true;
                }
                if (/^[A-Z]$/.test(left) || /^[A-Z]$/.test(right)) {
                    return false;
                }
                const looseLeft = String(left).toLowerCase().replace(/[^a-z0-9]+/g, '');
                const looseRight = String(right).toLowerCase().replace(/[^a-z0-9]+/g, '');
                return !!looseLeft && looseLeft === looseRight;
            };
            const compareSets = (leftValues, rightValues) => {
                if (core && typeof core.compareTokenSets === 'function') {
                    return core.compareTokenSets(leftValues, rightValues) === true;
                }
                const left = Array.from(new Set(leftValues || []));
                const right = Array.from(new Set(rightValues || []));
                return left.length === right.length
                    && left.every((leftItem) => right.some((rightItem) => areEquivalent(leftItem, rightItem)));
            };
            if (Array.isArray(correctAnswer)) {
                if (actual.length === 1) {
                    return expected.some((token) => areEquivalent(token, actual[0]));
                }
                return compareSets(expected, actual);
            }
            if (expected.length > 1 || actual.length > 1) {
                return compareSets(expected, actual);
            }
            return areEquivalent(expected[0], actual[0]);
        },

        compareAnswers: function (userAnswer, correctAnswer) {
            if (window.AnswerMatchCore && typeof window.AnswerMatchCore.compareAnswers === 'function') {
                return window.AnswerMatchCore.compareAnswers(userAnswer, correctAnswer) === true;
            }
            return this.compareAnswersFallbackLite(userAnswer, correctAnswer);
        },

        extractScore: function () {
            const resultsEl = document.getElementById('results');
            if (!resultsEl) {
                console.warn('[PracticeEnhancer] 未找到结果元素');
                return null;
            }

            const text = resultsEl.textContent || '';
            console.log('[PracticeEnhancer] 结果文本:', text);

            // 匹配 "Final Score: 85% (11/13)" 格式 - 66号文件格式
            const finalScoreMatch = text.match(/Final\s+Score:\s*(\d+)%\s*\((\d+)\/(\d+)\)/i);
            if (finalScoreMatch) {
                const percentage = parseInt(finalScoreMatch[1]);
                const correct = parseInt(finalScoreMatch[2]);
                const total = parseInt(finalScoreMatch[3]);
                const accuracy = total > 0 ? correct / total : 0;

                console.log('[PracticeEnhancer] 提取Final Score成绩:', { correct, total, accuracy, percentage });

                return {
                    correct: correct,
                    total: total,
                    accuracy: accuracy,
                    percentage: percentage,
                    source: 'final_score_extraction'
                };
            }

            // 匹配 "Score: 11/13" 格式
            const scoreMatch = text.match(/Score:\s*(\d+)\/(\d+)/i);
            if (scoreMatch) {
                const correct = parseInt(scoreMatch[1]);
                const total = parseInt(scoreMatch[2]);
                const accuracy = total > 0 ? correct / total : 0;
                const percentage = Math.round(accuracy * 100);

                console.log('[PracticeEnhancer] 提取Score成绩:', { correct, total, accuracy, percentage });

                return {
                    correct: correct,
                    total: total,
                    accuracy: accuracy,
                    percentage: percentage,
                    source: 'score_extraction'
                };
            }

            // 匹配 "You answered X out of Y questions correctly" 格式 - 80号文件格式
            const answeredMatch = text.match(/You answered (\d+) out of (\d+) questions? correctly/i);
            if (answeredMatch) {
                const correct = parseInt(answeredMatch[1]);
                const total = parseInt(answeredMatch[2]);
                const accuracy = total > 0 ? correct / total : 0;
                const percentage = Math.round(accuracy * 100);

                console.log('[PracticeEnhancer] 提取answered格式成绩:', { correct, total, accuracy, percentage });

                return {
                    correct: correct,
                    total: total,
                    accuracy: accuracy,
                    percentage: percentage,
                    source: 'answered_format_extraction'
                };
            }

            // 匹配 "Accuracy: 85%" 格式
            const accuracyPercentMatch = text.match(/Accuracy:\s*(\d+)%/i);
            if (accuracyPercentMatch) {
                const percentage = parseInt(accuracyPercentMatch[1]);
                // 验证百分比范围
                if (percentage >= 0 && percentage <= 100) {
                    return {
                        correct: 0,
                        total: 0,
                        accuracy: percentage / 100,
                        percentage: percentage,
                        source: 'accuracy_percentage_extraction'
                    };
                }
            }

            // 匹配 "Accuracy 85%" 格式（无冒号）
            const accuracyMatch = text.match(/Accuracy\s+(\d+)%/i);
            if (accuracyMatch) {
                const percentage = parseInt(accuracyMatch[1]);
                // 验证百分比范围
                if (percentage >= 0 && percentage <= 100) {
                    return {
                        correct: 0,
                        total: 0,
                        accuracy: percentage / 100,
                        percentage: percentage,
                        source: 'accuracy_extraction'
                    };
                }
            }

            // 匹配单独的百分比 "85%" 格式 - 更严格的匹配，避免误匹配HTML内容中的数字
            // 要求百分号前有明确的分隔符（空格、冒号等）或在行首
            const percentageMatch = text.match(/(?:^|[\s:])(\d+)%(?:[\s,.]|$)/);
            if (percentageMatch) {
                const percentage = parseInt(percentageMatch[1]);
                // 验证百分比范围，避免误匹配如"31"这样的数字
                if (percentage >= 0 && percentage <= 100) {
                    console.log('[PracticeEnhancer] 提取百分比成绩:', { percentage });

                    return {
                        correct: 0,
                        total: 0,
                        accuracy: percentage / 100,
                        percentage: percentage,
                        source: 'percentage_extraction'
                    };
                }
            }

            // 尝试从表格中提取成绩信息
            const correctCells = resultsEl.querySelectorAll('.result-correct');
            const incorrectCells = resultsEl.querySelectorAll('.result-incorrect');
            if (correctCells.length > 0 || incorrectCells.length > 0) {
                const correct = correctCells.length;
                const total = correctCells.length + incorrectCells.length;
                const accuracy = total > 0 ? correct / total : 0;
                const percentage = Math.round(accuracy * 100);

                console.log('[PracticeEnhancer] 从表格提取成绩:', { correct, total, accuracy, percentage });

                return {
                    correct: correct,
                    total: total,
                    accuracy: accuracy,
                    percentage: percentage,
                    source: 'table_extraction'
                };
            }

            console.warn('[PracticeEnhancer] 无法提取成绩信息，结果文本:', text);
            return null;
        },

        sendMessage: function (type, data) {
            if (!this.parentWindow) {
                console.warn('[PracticeEnhancer] 无父窗口，无法发送消息');
                return;
            }
            if (this.readOnly && type === 'PRACTICE_COMPLETE') {
                console.info('[PracticeEnhancer] 回顾模式阻止 PRACTICE_COMPLETE 上报');
                return;
            }

            this.runHooks('beforeSendMessage', type, data);
            const message = {
                type: type,
                data: data,
                source: 'practice_page',
                timestamp: Date.now()
            };

            try {
                this.parentWindow.postMessage(message, '*');
                console.log('[PracticeEnhancer] 消息已发送:', type);
            } catch (error) {
                console.error('[PracticeEnhancer] 发送消息失败:', error);
            }
        },

        getStatus: function () {
            return {
                isInitialized: this.isInitialized,
                sessionId: this.sessionId,
                hasParentWindow: !!this.parentWindow,
                answersCount: Object.keys(this.answers).length,
                correctAnswersCount: Object.keys(this.correctAnswers).length, // 新增
                interactionsCount: this.interactions.length,
                pageType: this.detectPageType()
            };
        }
    };

    // 添加全局方法供调试和手动触发使用
    window.collectAnswersNow = function () {
        console.log('[PracticeEnhancer] 手动触发答案收集');
        window.practicePageEnhancer.collectAllAnswers();
        return window.practicePageEnhancer.answers;
    };

    window.getCorrectAnswers = function () {
        console.log('[PracticeEnhancer] 获取正确答案');
        window.practicePageEnhancer.extractCorrectAnswers();
        return window.practicePageEnhancer.correctAnswers;
    };

    // 自动初始化
    const shouldAutoInitialize = window.practicePageEnhancer.config.autoInitialize !== false;
    const kickOffInitialization = () => {
        window.practicePageEnhancer.initialize().catch((error) => {
            console.error('[PracticeEnhancer] 初始化失败', error);
        });
    };

    if (shouldAutoInitialize) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', kickOffInitialization);
        } else {
            kickOffInitialization();
        }
    } else {
        console.log('[PracticeEnhancer] 自动初始化已关闭，等待手动调用initialize()');
    }

    // 调试函数
    window.debugPracticeEnhancer = () => {
        console.log('=== 练习页面增强器调试信息 ===');
        console.log('状态:', window.practicePageEnhancer.getStatus());
        console.log('用户答案:', window.practicePageEnhancer.answers);
        console.log('正确答案:', window.practicePageEnhancer.correctAnswers); // 新增
        console.log('答案比较:', window.practicePageEnhancer.generateAnswerComparison()); // 新增
        console.log('交互记录:', window.practicePageEnhancer.interactions);

        // 测试成绩提取
        const scoreInfo = window.practicePageEnhancer.extractScore();
        console.log('成绩提取测试:', scoreInfo);
    };
})();
