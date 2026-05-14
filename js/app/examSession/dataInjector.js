/**
 * dataInjector.js - 数据注入
 * 从 examSessionMixin.js 提取
 *
 * 职责：向练习窗口注入脚本/数据、postMessage通信设置、脚本加载错误处理
 */
(function (global) {
    const PRACTICE_ENHANCER_SCRIPT_PATH = './js/runtime/practice-page-enhancer.js';
    const ANSWER_MATCH_CORE_SCRIPT_PATH = './js/utils/answerMatchCore.js';
    const PRACTICE_ENHANCER_BUILD_ID = '20250105';

    const dataInjectorMethods = {

        /**
         * 注入数据采集脚本到练习页面
         */
        injectDataCollectionScript(examWindow, examId, exam = null) {
            if (this._isUnifiedReadingExam(exam) || this._isUnifiedListeningExam(exam)) {
                return;
            }

            const ensureScriptUrl = () => {
                const resolved = this._ensureAbsoluteUrl(PRACTICE_ENHANCER_SCRIPT_PATH);
                if (!resolved) {
                    return PRACTICE_ENHANCER_SCRIPT_PATH;
                }
                if (!PRACTICE_ENHANCER_BUILD_ID) {
                    return resolved;
                }
                return resolved.includes('?')
                    ? `${resolved}&v=${PRACTICE_ENHANCER_BUILD_ID}`
                    : `${resolved}?v=${PRACTICE_ENHANCER_BUILD_ID}`;
            };
            const ensureCoreScriptUrl = () => {
                const resolved = this._ensureAbsoluteUrl(ANSWER_MATCH_CORE_SCRIPT_PATH);
                return resolved || ANSWER_MATCH_CORE_SCRIPT_PATH;
            };

            const injectScript = () => {
                try {
                    if (!examWindow || examWindow.closed) {
                        console.warn('[DataInjection] 目标窗口已关闭');
                        return;
                    }

                    if (examWindow.practicePageEnhancer && typeof examWindow.practicePageEnhancer.initialize === 'function') {
                        this.initializePracticeSession(examWindow, examId);
                        return;
                    }

                    let doc;
                    try {
                        doc = examWindow.document;
                    } catch (accessError) {
                        console.warn('[DataInjection] 无法访问题目页文档:', accessError);
                        return;
                    }

                    if (!doc || (!doc.head && !doc.body)) {
                        console.warn('[DataInjection] 题目页尚未准备好');
                        return;
                    }

                    const host = doc.head || doc.body;
                    const existingEnhancerScript = host.querySelector('script[data-practice-enhancer="true"]');
                    if (existingEnhancerScript) {
                        return;
                    }
                    let enhancerInjected = false;
                    const appendEnhancer = () => {
                        if (enhancerInjected || (examWindow.practicePageEnhancer && typeof examWindow.practicePageEnhancer.initialize === 'function')) {
                            return;
                        }
                        enhancerInjected = true;
                        const scriptEl = doc.createElement('script');
                        scriptEl.type = 'text/javascript';
                        scriptEl.defer = true;
                        scriptEl.dataset.practiceEnhancer = 'true';
                        scriptEl.src = ensureScriptUrl();

                        scriptEl.onload = () => {
                            setTimeout(() => {
                                try {
                                    this.initializePracticeSession(examWindow, examId);
                                } catch (sessionError) {
                                    console.warn('[DataInjection] 初始化练习会话失败:', sessionError);
                                }
                            }, 80);
                        };

                        scriptEl.onerror = (loadError) => {
                            console.warn('[DataInjection] 加载增强器失败，回退到内联脚本:', loadError);
                            scriptEl.remove();
                            this.injectInlineScript(examWindow, examId);
                        };

                        host.appendChild(scriptEl);
                    };

                    const waitForDependencyReady = (isReady, timeoutMs = 4500) => (
                        new Promise((resolve) => {
                            if (isReady()) {
                                resolve(true);
                                return;
                            }
                            const startedAt = Date.now();
                            const poll = () => {
                                if (isReady()) {
                                    resolve(true);
                                    return;
                                }
                                if ((Date.now() - startedAt) >= timeoutMs) {
                                    resolve(false);
                                    return;
                                }
                                setTimeout(poll, 40);
                            };
                            poll();
                        })
                    );

                    const ensureDependencyScript = ({
                        selector,
                        dataKey,
                        scriptUrl,
                        isReady,
                        timeoutMs = 4500
                    }) => {
                        if (isReady()) {
                            return Promise.resolve(true);
                        }
                        const existingScript = host.querySelector(selector);
                        if (!existingScript) {
                            const scriptEl = doc.createElement('script');
                            scriptEl.type = 'text/javascript';
                            scriptEl.defer = true;
                            scriptEl.dataset[dataKey] = 'true';
                            scriptEl.src = scriptUrl;
                            host.appendChild(scriptEl);
                        }
                        return waitForDependencyReady(isReady, timeoutMs);
                    };

                    const isAnswerMatchReady = () => {
                        return !!(
                            examWindow.AnswerMatchCore
                            && typeof examWindow.AnswerMatchCore.compareAnswers === 'function'
                        );
                    };

                    ensureDependencyScript({
                        selector: 'script[data-answer-match-core="true"]',
                        dataKey: 'answerMatchCore',
                        scriptUrl: ensureCoreScriptUrl(),
                        isReady: isAnswerMatchReady,
                        timeoutMs: 4500
                    }).finally(() => {
                        appendEnhancer();
                    });
                } catch (error) {
                    console.error('[DataInjection] 注入增强器脚本时出错:', error);
                    this.injectInlineScript(examWindow, examId);
                }
            };

            const checkAndInject = () => {
                try {
                    if (!examWindow || examWindow.closed) {
                        return;
                    }

                    const doc = examWindow.document;
                    if (doc && (doc.readyState === 'interactive' || doc.readyState === 'complete')) {
                        injectScript();
                    } else {
                        setTimeout(checkAndInject, 200);
                    }
                } catch (error) {
                    console.warn('[DataInjection] 检测题目页面就绪状态失败:', error);
                }
            };

            setTimeout(checkAndInject, 300);
        },

        /**
         * 内联脚本注入（备用方案）
         */
        injectInlineScript(examWindow, examId) {
            try {
                if (!examWindow || !examWindow.document || !examWindow.document.head) {
                    throw new Error('inline_target_unavailable');
                }

                const sessionToken = `${examId}_${Date.now()}`;
                const inlineScript = examWindow.document.createElement('script');
                inlineScript.type = 'text/javascript';
                inlineScript.textContent = `
                    (function() {
                        if (window.__IELTS_INLINE_ENHANCER__) {
                            return;
                        }
                        window.__IELTS_INLINE_ENHANCER__ = true;

                        var parentWindow = window.opener || window.parent || null;
                        var state = {
                            sessionId: ${JSON.stringify(sessionToken)},
                            examId: ${JSON.stringify(examId)},
                            startTime: Date.now(),
                            answers: {}
                        };

                        function sendMessage(type, data) {
                            if (!parentWindow || typeof parentWindow.postMessage !== 'function') {
                                return;
                            }
                            try {
                                parentWindow.postMessage({ type: type, data: data || {} }, '*');
                            } catch (error) {
                                console.warn('[InlineEnhancer] 无法发送消息:', error);
                            }
                        }

                        function handleInitSession(message) {
                            var initData = message && message.data ? message.data : {};
                            if (initData.sessionId) {
                                state.sessionId = initData.sessionId;
                            }
                            if (initData.examId) {
                                state.examId = initData.examId;
                            }

                            sendMessage('SESSION_READY', {
                                sessionId: state.sessionId,
                                examId: state.examId,
                                url: window.location.href,
                                title: document.title || ''
                            });
                        }

                        window.addEventListener('message', function(event) {
                            var message = event && event.data ? event.data : null;
                            if (!message || typeof message.type !== 'string') {
                                return;
                            }

                            if (message.type === 'INIT_SESSION') {
                                handleInitSession(message);
                                return;
                            }
                        });

                        var collector = {
                            get sessionId() { return state.sessionId; },
                            get examId() { return state.examId; },
                            get answers() { return state.answers; },
                            startTime: state.startTime,
                            initialize: function() {
                                this.setupBasicListeners();
                                this.setupSubmitListeners();
                            },
                            setupBasicListeners: function() {
                                document.addEventListener('change', function(event) {
                                    var target = event && event.target ? event.target : null;
                                    if (!target || !target.name) {
                                        return;
                                    }
                                    var tag = (target.tagName || '').toUpperCase();
                                    if (target.type === 'radio' || target.type === 'text' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                                        state.answers[target.name] = target.value;
                                    }
                                }, true);
                            },
                            setupSubmitListeners: function() {
                                var buttons = Array.prototype.slice.call(document.querySelectorAll('button, input[type="submit"]'));
                                if (!buttons.length) {
                                    var legacy = document.querySelector('button[onclick*="grade"]');
                                    if (legacy) {
                                        buttons.push(legacy);
                                    }
                                }

                                buttons.forEach(function(btn) {
                                    if (!btn || typeof btn.addEventListener !== 'function') {
                                        return;
                                    }
                                    btn.addEventListener('click', function() {
                                        setTimeout(function() {
                                            collector.sendResults();
                                        }, 200);
                                    }, false);
                                });
                            },
                            sendResults: function() {
                                sendMessage('PRACTICE_COMPLETE', {
                                    sessionId: state.sessionId,
                                    examId: state.examId,
                                    duration: Math.round((Date.now() - state.startTime) / 1000),
                                    answers: state.answers,
                                    source: 'inline_collector'
                                });
                            }
                        };

                        window.practiceDataCollector = collector;

                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', function() {
                                collector.initialize();
                            });
                        } else {
                            collector.initialize();
                        }
                    })();
                `;

                examWindow.document.head.appendChild(inlineScript);

                setTimeout(() => {
                    this.initializePracticeSession(examWindow, examId);
                }, 300);

            } catch (error) {
                console.error('[DataInjection] 内联脚本注入失败:', error);
                this.handleInjectionError(examId, error);
            }
        },

        /**
         * 初始化练习会话
         */
        initializePracticeSession(examWindow, examId) {
            try {
                const now = Date.now();

                let existingInfo = null;
                if (this.examWindows && this.examWindows.has(examId)) {
                    existingInfo = this.examWindows.get(examId) || null;
                }

                const windowInfo = this.ensureExamWindowSession(examId, examWindow);
                const initPayload = this._buildExamInitPayload(examId, windowInfo, { timestamp: now });

                // 发送会话初始化消息
                examWindow.postMessage({
                    type: 'INIT_SESSION',
                    data: initPayload
                }, '*');

                // 存储会话信息
                if (!this.examWindows) {
                    this.examWindows = new Map();
                }

                if (existingInfo) {
                    existingInfo.sessionId = initPayload.sessionId;
                    existingInfo.initTime = now;
                    existingInfo.status = 'initialized';
                    if (!existingInfo.window || existingInfo.window.closed) {
                        existingInfo.window = examWindow;
                    }
                    this.examWindows.set(examId, existingInfo);
                } else {
                    console.warn('[DataInjection] 未找到窗口信息，创建新的');
                    this.examWindows.set(examId, Object.assign({}, windowInfo, {
                        window: examWindow,
                        sessionId: initPayload.sessionId,
                        initTime: now,
                        status: 'initialized'
                    }));
                }

            } catch (error) {
                console.error('[DataInjection] 会话初始化失败:', error);
            }
        },

        /**
         * 处理注入错误
         */
        async handleInjectionError(examId, error) {
            console.error('[DataInjection] 注入错误:', error);

            // 记录错误信息
            const errorInfo = {
                examId: examId,
                error: error.message,
                timestamp: Date.now(),
                type: 'script_injection_error'
            };

            // 保存错误日志到本地存储
            const errorLogs = await storage.get('injection_errors', []);
            errorLogs.push(errorInfo);
            if (errorLogs.length > 50) {
                errorLogs.splice(0, errorLogs.length - 50); // 保留最近50条错误
            }
            await storage.set('injection_errors', errorLogs);

            // 不显示错误给用户，静默处理
            console.warn('[DataInjection] 将使用模拟数据模式');
        },

        /**
         * 创建降级记录器
         */
        createFallbackRecorder() {
            return {
                handleRealPracticeData: async (examId, realData) => {
                    try {
                        // 获取题目信息
                        const exam = await this._findExamDefinition(examId);

                        if (!exam) {
                            console.error('[FallbackRecorder] 无法找到题目信息:', examId);
                            return null;
                        }

                        // 创建练习记录
                        const practiceRecord = this.createSimplePracticeRecord(exam, realData);

                        if (window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.savePracticeRecord === 'function') {
                            await window.PracticeCore.store.savePracticeRecord(practiceRecord);
                        } else if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.addPracticeRecord === 'function') {
                            await window.simpleStorageWrapper.addPracticeRecord(practiceRecord);
                        } else {
                            // 直接保存到localStorage
                            const records = await storage.get('practice_records', []);
                            records.unshift(practiceRecord);
                            const practiceKey = ['practice', 'records'].join('_');
                            await storage.set(practiceKey, records);
                        }

                        return practiceRecord;
                    } catch (error) {
                        console.error('[FallbackRecorder] 保存失败:', error);
                        return null;
                    }
                },

                startSession: (examId) => {
                    // 简单的会话管理
                    return {
                        examId: examId,
                        startTime: new Date().toISOString(),
                        sessionId: this.generateSessionId(examId),
                        status: 'started'
                    };
                },

                getPracticeRecords: async (filters = {}) => {
                    try {
                        const records = await storage.get('practice_records', []);

                        if (Object.keys(filters).length === 0) {
                            return records;
                        }

                        return records.filter(record => {
                            if (filters.examId && record.examId !== filters.examId) return false;
                            if (filters.category && record.category !== filters.category) return false;
                            if (filters.startDate && new Date(record.startTime) < new Date(filters.startDate)) return false;
                            if (filters.endDate && new Date(record.startTime) > new Date(filters.endDate)) return false;
                            if (filters.minAccuracy && record.accuracy < filters.minAccuracy) return false;
                            if (filters.maxAccuracy && record.accuracy > filters.maxAccuracy) return false;

                            return true;
                        });
                    } catch (error) {
                        console.error('[FallbackRecorder] 获取记录失败:', error);
                        return [];
                    }
                }
            };
        },
    };

    global.__examSessionModules = global.__examSessionModules || {};
    global.__examSessionModules.dataInjector = dataInjectorMethods;
})(typeof window !== "undefined" ? window : globalThis);
