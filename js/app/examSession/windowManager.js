/**
 * windowManager.js - 练习窗口管理
 * 从 examSessionMixin.js 提取
 *
 * 职责：打开/关闭/守护练习窗口、窗口通信、窗口尺寸计算、窗口事件处理
 */
(function (global) {
    const isFileProtocol = !!(global && global.location && global.location.protocol === 'file:');

    const windowManagerMethods = {

        /**
         * 打开指定题目进行练习
         */
        async openExam(examId, options = {}) {
            const exam = window.getExamById ? window.getExamById(examId) : (await this._getActiveExamIndexSnapshot() || []).find(e => e.id === examId);
            const reviewMode = Boolean(options && options.reviewMode);

            if (!exam) {
                window.showMessage('题目不存在', 'error');
                return;
            }

            try {
                const readingLaunch = typeof this.resolveReadingLaunchDescriptor === 'function'
                    ? this.resolveReadingLaunchDescriptor(exam)
                    : null;

                const listeningLaunch = !readingLaunch && typeof this.resolveListeningLaunchDescriptor === 'function'
                    ? this.resolveListeningLaunchDescriptor(exam)
                    : null;

                if (readingLaunch && readingLaunch.mode === 'pdf_manual' && readingLaunch.pdfUrl) {
                    return this._openPdfWindow(exam, readingLaunch.pdfUrl, options);
                }

                const activeLaunch = readingLaunch || listeningLaunch;

                // 若无HTML，直接打开PDF
                if (!activeLaunch && exam.hasHtml === false) {
                    const pdfUrl = (typeof window.buildResourcePath === 'function')
                        ? window.buildResourcePath(exam, 'pdf')
                        : ((exam.path || '').replace(/\\/g, '/').replace(/\/+\//g, '/') + (exam.pdfFilename || ''));
                    const resolvedPdfUrl = this._ensureAbsoluteUrl(pdfUrl);
                    return this._openPdfWindow(exam, resolvedPdfUrl, options);
                }

                const guardOptions = { ...options, examId };
                let examUrl = (activeLaunch && activeLaunch.mode === 'unified_html' && activeLaunch.url)
                    ? activeLaunch.url
                    : this.buildExamUrl(exam);
                let examWindow = this.openExamWindow(examUrl, exam, guardOptions);

                try {
                    const guardedWindow = this._guardExamWindowContent(examWindow, exam, guardOptions);
                    if (guardedWindow) {
                        examWindow = guardedWindow;
                    }
                } catch (guardError) {
                    console.warn('[App] 题目窗口占位页守护失败:', guardError);
                }

                // 再进行会话记录与脚本注入
                if (!reviewMode) {
                    await this.startPracticeSession(examId);
                }
                this.injectDataCollectionScript(examWindow, examId, exam);
                this.setupExamWindowManagement(examWindow, examId, exam, options);

                if (reviewMode && typeof this._bindReviewWindowRef === 'function') {
                    this._bindReviewWindowRef(options.reviewSessionId, examWindow);
                }

                window.showMessage(
                    reviewMode ? `正在打开历史回顾: ${exam.title}` : `正在打开题目: ${exam.title}`,
                    'info'
                );

                return examWindow;

            } catch (error) {
                console.error('Failed to open exam:', error);
                window.showMessage('打开题目失败，请重试', 'error');
            }
        },

        _openPdfWindow(exam, resolvedPdfUrl, options = {}) {
            let pdfWin = null;

            if (options.reuseWindow && !options.reuseWindow.closed) {
                try {
                    options.reuseWindow.location.href = resolvedPdfUrl;
                    options.reuseWindow.focus();
                    pdfWin = options.reuseWindow;
                } catch (reuseError) {
                    console.warn('[App] 无法复用已打开的标签，尝试重新打开:', reuseError);
                }
            }

            if (!pdfWin) {
                if (options.target === 'tab') {
                    try {
                        pdfWin = window.open(resolvedPdfUrl, '_blank');
                    } catch (_) { }
                } else {
                    try {
                        pdfWin = window.open(resolvedPdfUrl, `pdf_${exam.id}`, 'width=1000,height=800,scrollbars=yes,resizable=yes,status=yes,toolbar=yes');
                    } catch (_) { }
                }
            }

            if (!pdfWin) {
                try {
                    window.location.href = resolvedPdfUrl;
                    return window;
                } catch (error) {
                    throw new Error('无法打开PDF窗口，请检查弹窗设置');
                }
            }

            window.showMessage(`正在打开PDF: ${exam.title}`, 'info');
            return pdfWin;
        },

        /**
         * 在新窗口中打开题目
         */
        openExamWindow(examUrl, exam, options = {}) {
            const reuseWindow = options.reuseWindow;
            const finalUrl = this._ensureAbsoluteUrl(examUrl);
            if (reuseWindow && !reuseWindow.closed) {
                try {
                    reuseWindow.location.href = finalUrl;
                    reuseWindow.focus();
                    return reuseWindow;
                } catch (error) {
                    console.warn('[App] 复用窗口失败，尝试重新打开:', error);
                }
            }

            if (options.target === 'tab') {
                let tabWindow = null;
                const requestedName = typeof options.windowName === 'string' && options.windowName.trim()
                    ? options.windowName.trim()
                    : '_blank';
                try {
                    tabWindow = window.open(finalUrl, requestedName);
                    if (tabWindow && typeof tabWindow.focus === 'function') {
                        tabWindow.focus();
                    }
                } catch (_) { }

                if (tabWindow) {
                    return tabWindow;
                }
            }

            // 计算窗口尺寸和位置
            const windowFeatures = this.calculateWindowFeatures();

            // 打开新窗口
            let examWindow = null;
            try {
                examWindow = window.open(
                    finalUrl,
                    `exam_${exam.id}`,
                    windowFeatures
                );
            } catch (_) { }

            // 弹窗被拦截时，降级为当前窗口打开，确保用户可进入练习页
            if (!examWindow) {
                try {
                    window.location.href = finalUrl;
                    return window; // 以当前窗口作为返回引用
                } catch (e) {
                    throw new Error('无法打开题目页面，请检查弹窗/文件路径设置');
                }
            }

            return examWindow;
        },

        _guardExamWindowContent(examWindow, exam = null, options = {}) {
            if (!examWindow || examWindow.closed) {
                return examWindow;
            }

            const resolveHref = (targetWindow) => {
                try {
                    return targetWindow.location && typeof targetWindow.location.href === 'string'
                        ? targetWindow.location.href
                        : '';
                } catch (error) {
                    const message = String(error && error.message ? error.message : error);
                    if (message && message.toLowerCase().includes('cross-origin')) {
                        console.debug('[App] 题目窗口跨域，使用占位页回退。');
                    } else {
                        console.warn('[App] 无法读取题目窗口地址，准备降级到占位页:', error);
                    }
                    return '';
                }
            };

            const currentHref = resolveHref(examWindow);
            const normalizedHref = (currentHref || '').toLowerCase();
            const retryOptions = options && typeof options === 'object' ? options : {};
            const retryCount = Number.isFinite(retryOptions.guardRetryCount) ? retryOptions.guardRetryCount : 0;
            const examId = retryOptions.examId;

            if (examId && this.examWindows && this.examWindows.has(examId)) {
                const windowInfo = this.examWindows.get(examId);
                if (windowInfo && windowInfo.dataCollectorReady) {
                    return examWindow;
                }
            }

            const isPlaceholder = normalizedHref.includes('templates/exam-placeholder.html');
            if (isPlaceholder) {
                return examWindow;
            }

            const isTestMode = this._shouldUsePlaceholderPage();
            const shouldFallback = () => {
                if (!normalizedHref || normalizedHref === 'about:blank') {
                    if (retryCount < 4) {
                        const nextCount = retryCount + 1;
                        const delay = Math.min(1500, 250 * nextCount);
                        try {
                            setTimeout(() => {
                                try {
                                    this._guardExamWindowContent(examWindow, exam, {
                                        ...retryOptions,
                                        guardRetryCount: nextCount
                                    });
                                } catch (retryError) {
                                    console.warn('[App] 题目窗口占位页重试失败:', retryError);
                                }
                            }, delay);
                        } catch (timerError) {
                            console.warn('[App] 无法安排题目窗口占位页重试:', timerError);
                        }
                        return false;
                    }
                    return true;
                }
                if (normalizedHref.startsWith('chrome-error://')
                    || normalizedHref.startsWith('edge-error://')
                    || normalizedHref.startsWith('opera-error://')
                    || normalizedHref.startsWith('res://ieframe.dll')) {
                    return true;
                }
                return false;
            };

            if (!shouldFallback()) {
                return examWindow;
            }

            if (!isTestMode) {
                console.warn('[App] 非测试环境，跳过占位页重定向');
                return examWindow;
            }
            const placeholderUrl = this._buildExamPlaceholderUrl(exam, options);
            if (!placeholderUrl) {
                return examWindow;
            }

            try {
                if (examWindow.location && typeof examWindow.location.replace === 'function') {
                    examWindow.location.replace(placeholderUrl);
                    return examWindow;
                }
                examWindow.location.href = placeholderUrl;
                return examWindow;
            } catch (navigationError) {
                console.warn('[App] 题目窗口导航占位页失败，尝试重新打开:', navigationError);
                try {
                    const windowName = (options && options.windowName)
                        ? String(options.windowName)
                        : (examWindow.name || '_blank');
                    const reopened = window.open(placeholderUrl, windowName);
                    if (reopened) {
                        return reopened;
                    }
                } catch (openError) {
                    console.warn('[App] 重新打开占位窗口失败:', openError);
                }
            }

            return examWindow;
        },

        /**
         * 计算窗口特性
         */
        calculateWindowFeatures() {
            const screenWidth = window.screen.availWidth;
            const screenHeight = window.screen.availHeight;

            // 窗口尺寸（占屏幕的80%）
            const windowWidth = Math.floor(screenWidth * 0.8);
            const windowHeight = Math.floor(screenHeight * 0.8);

            // 窗口位置（居中）
            const windowLeft = Math.floor((screenWidth - windowWidth) / 2);
            const windowTop = Math.floor((screenHeight - windowHeight) / 2);

            return [
                `width=${windowWidth}`,
                `height=${windowHeight}`,
                `left=${windowLeft}`,
                `top=${windowTop}`,
                'scrollbars=yes',
                'resizable=yes',
                'status=yes',
                'toolbar=no',
                'menubar=no',
                'location=no'
            ].join(',');
        },

        /**
         * 设置题目窗口管理
         */
        setupExamWindowManagement(examWindow, examId, exam = null, options = {}) {
            if (!examWindow) {
                console.warn('[App] 缺少题目窗口引用，无法完成窗口管理');
                return;
            }

            try {
                const guardedWindow = this._guardExamWindowContent(examWindow, exam, { ...options, examId });
                if (guardedWindow) {
                    examWindow = guardedWindow;
                }
            } catch (guardError) {
                console.warn('[App] 守护题目窗口内容失败:', guardError);
            }

            // 存储窗口引用
            if (!this.examWindows) {
                this.examWindows = new Map();
            }

            this.examWindows.set(examId, {
                window: examWindow,
                startTime: Date.now(),
                status: 'active',
                expectedSessionId: null,
                origin: (typeof window !== 'undefined' && window.location) ? window.location.origin : '',
                reviewMode: Boolean(options && options.reviewMode),
                reviewSessionId: options && options.reviewSessionId ? String(options.reviewSessionId) : null,
                reviewEntryIndex: Number.isInteger(options && options.reviewEntryIndex) ? options.reviewEntryIndex : 0,
                readOnly: options && Object.prototype.hasOwnProperty.call(options, 'readOnly')
                    ? Boolean(options.readOnly)
                    : Boolean(options && options.reviewMode)
            });

            // 监听窗口关闭事件
            let checkClosed = null;
            try {
                checkClosed = setInterval(() => {
                    try {
                        if (examWindow.closed) {
                            clearInterval(checkClosed);
                            this.handleExamWindowClosed(examId);
                        }
                    } catch (monitorError) {
                        clearInterval(checkClosed);
                        console.warn('[App] 无法检测题目窗口状态:', monitorError);
                    }
                }, 1000);
            } catch (error) {
                console.warn('[App] 启动窗口关闭监控失败:', error);
            }

            // 设置窗口通信
            try {
                this.setupExamWindowCommunication(examWindow, examId, exam, options);
            } catch (error) {
                console.warn('[App] 初始化题目窗口通信失败:', error);
            }

            // 启动与练习页的会话握手（file:// 下更可靠）
            try {
                this.startExamHandshake(examWindow, examId);
            } catch (e) {
                console.warn('[App] 启动握手失败:', e);
            }

            const emitInitEnvelope = () => {
                const windowInfo = this.ensureExamWindowSession(examId, examWindow);
                const initPayload = this._buildExamInitPayload(examId, windowInfo);
                try {
                    examWindow.postMessage({ type: 'INIT_SESSION', data: initPayload }, '*');
                    examWindow.postMessage({ type: 'init_exam_session', data: initPayload }, '*');
                } catch (postError) {
                    console.warn('[App] 跨源初始化题目窗口失败:', postError);
                }
            };

            if (!isFileProtocol) {
                try {
                    examWindow.addEventListener('load', emitInitEnvelope);
                } catch (error) {
                    console.warn('[App] 监听题目窗口 load 事件失败:', error);
                    emitInitEnvelope();
                }
            } else {
                emitInitEnvelope();
            }

            // 更新UI状态
            if (!(options && options.reviewMode)) {
                this.updateExamStatus(examId, 'in-progress');
            }
        },

        /**
         * 设置题目窗口通信
         */
        setupExamWindowCommunication(examWindow, examId, exam = null, options = {}) {
            const parseJsonSafely = (value) => {
                if (typeof value !== 'string' || !value.trim()) return null;
                try {
                    return JSON.parse(value);
                } catch (_) {
                    return null;
                }
            };

            const isPlainObject = (value) => {
                return value && typeof value === 'object' && !Array.isArray(value);
            };

            const normalizeMessage = (rawEnvelope, depth = 0) => {
                if (depth > 2) return null;

                const practiceProtocol = window.PracticeCore && window.PracticeCore.protocol;
                if (practiceProtocol && typeof practiceProtocol.normalizeMessage === 'function') {
                    const normalizedByCore = practiceProtocol.normalizeMessage(rawEnvelope, depth);
                    if (normalizedByCore) {
                        return normalizedByCore;
                    }
                }

                const allowedTypes = new Set([
                    'exam_completed',
                    'exam_progress',
                    'exam_error',
                    'SESSION_READY',
                    'PROGRESS_UPDATE',
                    'PRACTICE_COMPLETE',
                    'ERROR_OCCURRED',
                    'REQUEST_INIT',
                    'REVIEW_NAVIGATE'
                ]);

                const baseKeys = new Set(['type', 'messageType', 'action', 'event', 'data', 'payload', 'detail', 'args', 'source', 'message', 'messageData']);

                const coerceObject = (value) => {
                    if (isPlainObject(value)) return value;
                    if (typeof value === 'string') {
                        const parsed = parseJsonSafely(value);
                        return isPlainObject(parsed) ? parsed : null;
                    }
                    return null;
                };

                const pickType = (envelope) => {
                    const rawType = envelope.type || envelope.messageType || envelope.action || envelope.event;
                    if (typeof rawType !== 'string') return '';
                    return rawType.trim();
                };

                const pickData = (envelope) => {
                    const candidates = [envelope.data, envelope.payload, envelope.detail];
                    for (let i = 0; i < candidates.length; i++) {
                        const coerced = coerceObject(candidates[i]);
                        if (coerced) return coerced;
                    }

                    if (Array.isArray(envelope.args)) {
                        for (let i = 0; i < envelope.args.length; i++) {
                            const coerced = coerceObject(envelope.args[i]);
                            if (coerced) return coerced;
                        }
                    }

                    const fallback = {};
                    let hasFallback = false;
                    Object.keys(envelope || {}).forEach((key) => {
                        if (!baseKeys.has(key)) {
                            fallback[key] = envelope[key];
                            hasFallback = true;
                        }
                    });

                    return hasFallback ? fallback : null;
                };

                let envelope = rawEnvelope;
                if (typeof envelope === 'string') {
                    envelope = parseJsonSafely(envelope);
                }
                if (!isPlainObject(envelope)) return null;

                const type = pickType(envelope);
                if (!type) {
                    const nested = coerceObject(envelope.message) || coerceObject(envelope.messageData);
                    if (nested) {
                        return normalizeMessage(nested, depth + 1);
                    }
                    return null;
                }

                if (!allowedTypes.has(type)) {
                    return null;
                }

                const data = pickData(envelope) || {};
                if (!isPlainObject(data)) {
                    return null;
                }

                const sourceTag = typeof envelope.source === 'string'
                    ? envelope.source
                    : (typeof data.source === 'string' ? data.source : '');

                return { type, data, sourceTag };
            };

            const resolveWindowName = (targetWindow) => {
                if (!targetWindow) {
                    return '';
                }
                try {
                    const rawName = typeof targetWindow.name === 'string'
                        ? targetWindow.name
                        : '';
                    return rawName.trim();
                } catch (_) {
                    return '';
                }
            };

            const isLikelySameWindowContext = (sourceWindow, expectedWindow) => {
                if (!sourceWindow || !expectedWindow) {
                    return false;
                }
                if (sourceWindow === expectedWindow) {
                    return true;
                }
                const sourceName = resolveWindowName(sourceWindow);
                const expectedName = resolveWindowName(expectedWindow);
                if (sourceName && expectedName && sourceName === expectedName) {
                    return true;
                }
                try {
                    const sourceHref = sourceWindow.location && typeof sourceWindow.location.href === 'string'
                        ? sourceWindow.location.href
                        : '';
                    const expectedHref = expectedWindow.location && typeof expectedWindow.location.href === 'string'
                        ? expectedWindow.location.href
                        : '';
                    if (sourceHref && expectedHref && sourceHref === expectedHref && sourceHref !== 'about:blank') {
                        return true;
                    }
                } catch (_) {
                    // ignore cross-origin href checks
                }
                return false;
            };

            const messageHandler = async (event) => {
                // 取得当前题目窗口引用（可能在 handshake 期间被更新）
                const storedInfo = (this.examWindows && this.examWindows.get(examId)) || {};
                const expectedWindow = storedInfo.window || examWindow;
                const sourceWindow = event ? (event.source || null) : null;

                // 缺少来源窗口直接拒绝
                if (!sourceWindow || !expectedWindow) {
                    return;
                }

                // 校验来源域，允许 file:// (origin 为 null) 与同源页面
                if (event.origin && event.origin !== 'null') {
                    const allowedOrigin = window.location && window.location.origin;
                    if (allowedOrigin && event.origin !== allowedOrigin) {
                        return;
                    }
                }

                const normalized = normalizeMessage(event.data);
                if (!normalized) {
                    return;
                }

                const windowInfo = this.ensureExamWindowSession(examId, expectedWindow);
                if (windowInfo && sourceWindow !== expectedWindow) {
                    windowInfo.window = sourceWindow;
                }
                const expectedSessionId = windowInfo.expectedSessionId || '';

                // 放宽消息源过滤，兼容 inline_collector 与 practice_page
                const src = normalized.sourceTag || '';
                const allowedSources = new Set(['practice_page', 'inline_collector']);
                if (src && !allowedSources.has(src)) {
                    return; // 非预期来源的消息忽略
                }

                const { type, data } = normalized;
                const expectedExamId = String(examId);
                const payloadExamId = data && data.examId != null ? String(data.examId) : '';
                const sourceMatched = isLikelySameWindowContext(sourceWindow, expectedWindow);
                if (!sourceMatched) {
                    return;
                }
                const payloadSessionId = data && typeof data.sessionId === 'string'
                    ? data.sessionId.trim()
                    : '';

                if (payloadSessionId) {
                    if (expectedSessionId && payloadSessionId !== expectedSessionId) {
                        return;
                    }
                    windowInfo.sessionId = payloadSessionId;
                    if (!windowInfo.expectedSessionId) {
                        windowInfo.expectedSessionId = payloadSessionId;
                    }
                } else if (type === 'PRACTICE_COMPLETE') {
                    if (!expectedSessionId) {
                        return;
                    }
                    data.sessionId = expectedSessionId;
                }

                if (payloadExamId && payloadExamId !== expectedExamId) {
                    const allowedLegacy = payloadExamId === 'session';
                    if (!allowedLegacy) {
                        return;
                    }
                }

                data.examId = examId;
                if (!data.sessionId && expectedSessionId) {
                    data.sessionId = expectedSessionId;
                }

                windowInfo.origin = event.origin;
                windowInfo.lastMessageAt = Date.now();
                windowInfo.lastMessageType = type;
                this.examWindows.set(examId, windowInfo);

                switch (type) {
                    case 'exam_completed':
                        this.handleExamCompleted(examId, data);
                        break;
                    case 'exam_progress':
                        this.handleExamProgress(examId, data);
                        break;
                    case 'exam_error':
                        this.handleExamError(examId, data);
                        break;
                    // 新增：处理数据采集器的消息
                    case 'SESSION_READY':
                        this.handleSessionReady(examId, data);
                        break;
                    case 'PROGRESS_UPDATE':
                        this.handleProgressUpdate(examId, data);
                        break;
                    case 'PRACTICE_COMPLETE':
                        if (windowInfo && windowInfo.reviewMode) {
                            console.info('[ReviewReplay] 回顾模式忽略 PRACTICE_COMPLETE:', examId);
                            break;
                        }
                        await this.handlePracticeComplete(examId, data, sourceWindow || expectedWindow);
                        break;
                    case 'ERROR_OCCURRED':
                        this.handleDataCollectionError(examId, data);
                        break;
                    case 'REQUEST_INIT':
                        sendInitEnvelope(sourceWindow || examWindow);
                        break;
                    case 'REVIEW_NAVIGATE':
                        await this.handleReviewReplayNavigate(examId, data, sourceWindow || expectedWindow);
                        break;
                    default:
                }
            };

            if (this.messageHandlers && this.messageHandlers.has(examId)) {
                try {
                    const previousHandler = this.messageHandlers.get(examId);
                    if (previousHandler) {
                        window.removeEventListener('message', previousHandler);
                    }
                } catch (_) {
                    // ignore stale listener cleanup errors
                }
                this.messageHandlers.delete(examId);
            }
            window.addEventListener('message', messageHandler);

            // 存储消息处理器以便清理
            if (!this.messageHandlers) {
                this.messageHandlers = new Map();
            }
            this.messageHandlers.set(examId, messageHandler);

            // 向题目窗口发送初始化消息（兼容 0.2 增强器监听的 INIT_SESSION）
            const sendInitEnvelope = (targetWindow) => {
                try {
                    const windowInfo = this.ensureExamWindowSession(examId, targetWindow);
                    const initPayload = this._buildExamInitPayload(examId, windowInfo);
                    targetWindow.postMessage({ type: 'INIT_SESSION', data: initPayload }, '*');
                    targetWindow.postMessage({ type: 'init_exam_session', data: initPayload }, '*');
                } catch (initError) {
                    console.warn('[App] 发送初始化消息失败:', initError);
                }
            };

            const tryAttachInitHandler = (targetWindow) => {
                if (!targetWindow || isFileProtocol) {
                    return false;
                }
                try {
                    if (typeof targetWindow.addEventListener === 'function') {
                        targetWindow.addEventListener('load', () => sendInitEnvelope(targetWindow));
                        return true;
                    }
                } catch (attachError) {
                    console.warn('[App] 监听题目窗口 load 事件失败:', attachError);
                }
                return false;
            };

            let initAttached = tryAttachInitHandler(examWindow);

            if (!initAttached) {
                try {
                    const guardedWindow = this._guardExamWindowContent(examWindow, exam, options);
                    if (guardedWindow) {
                        examWindow = guardedWindow;
                        initAttached = tryAttachInitHandler(examWindow);
                    }
                } catch (guardError) {
                    console.warn('[App] 无法为题目窗口提供占位内容:', guardError);
                }
            }

            if (!initAttached) {
                sendInitEnvelope(examWindow);
            }
        },

        /**
         * 与练习页建立握手（重复发送 INIT_SESSION，直到收到 SESSION_READY）
         */
        startExamHandshake(examWindow, examId) {
            if (!this._handshakeTimers) this._handshakeTimers = new Map();

            // 避免重复握手
            if (this._handshakeTimers.has(examId)) return;

            const windowInfo = this.ensureExamWindowSession(examId, examWindow);
            const initPayload = this._buildExamInitPayload(examId, windowInfo);

            let attempts = 0;
            const maxAttempts = 30; // ~9s
            const tick = () => {
                if (examWindow && !examWindow.closed) {
                    try {
                        // 直接发送两种事件名，确保增强器任何实现都能收到
                        if (attempts === 0) {
                        }
                        examWindow.postMessage({ type: 'INIT_SESSION', data: initPayload }, '*');
                        examWindow.postMessage({ type: 'init_exam_session', data: initPayload }, '*');
                    } catch (_) { /* 忽略 */ }
                }
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(timer);
                    this._handshakeTimers.delete(examId);
                    console.warn('[App] 握手超时，练习页可能未加载增强器');
                }
            };
            const timer = setInterval(tick, 300);
            this._handshakeTimers.set(examId, timer);
            // 立即发送一次
            tick();
        },

        /**
         * 聚焦到题目窗口
         */
        focusExamWindow(examId) {
            if (this.examWindows && this.examWindows.has(examId)) {
                const windowData = this.examWindows.get(examId);
                if (windowData.window && !windowData.window.closed) {
                    windowData.window.focus();
                    window.showMessage('已切换到题目窗口', 'info');
                } else {
                    window.showMessage('题目窗口已关闭', 'warning');
                    this.cleanupExamSession(examId);
                }
            } else {
                window.showMessage('找不到题目窗口', 'error');
            }
        },

        /**
         * 关闭题目会话
         */
        closeExamSession(examId) {
            if (this.examWindows && this.examWindows.has(examId)) {
                const windowData = this.examWindows.get(examId);
                if (windowData.window && !windowData.window.closed) {
                    windowData.window.close();
                }
            }

            this.cleanupExamSession(examId);
            window.showMessage('会话已结束', 'info');
        },

        /**
         * 关闭所有题目会话
         */
        async closeAllExamSessions() {
            const activeSessions = await storage.get('active_sessions', []);

            activeSessions.forEach(session => {
                this.closeExamSession(session.examId);
            });

            // 关闭模态框
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }

            window.showMessage('所有会话已结束', 'info');
        },

        /**
         * 开始会话监控
         */
        startSessionMonitoring() {
            // 禁用活动会话监控，以避免误判窗口关闭状态
            if (this.sessionMonitorInterval) {
                clearInterval(this.sessionMonitorInterval);
                this.sessionMonitorInterval = null;
            }
            return;
            // 每30秒检查一次活动会话
            this.sessionMonitorInterval = setInterval(() => {
                this.cleanupClosedWindows();
            }, 30000);
        },

        /**
         * 清理已关闭的窗口
         */
        cleanupClosedWindows() {
            if (!this.examWindows) return;

            const closedExamIds = [];

            this.examWindows.forEach((windowData, examId) => {
                if (windowData.window.closed) {
                    closedExamIds.push(examId);
                }
            });

            closedExamIds.forEach(examId => {
                this.handleExamWindowClosed(examId);
            });
        },

        /**
         * 显示活动会话详情
         */
        async showActiveSessionsDetails() {
            const activeSessions = await storage.get('active_sessions', []);
            const examIndex = await this._getActiveExamIndexSnapshot();

            if (activeSessions.length === 0) {
                window.showMessage('当前没有活动的练习会话', 'info');
                return;
            }

            const sessionsContent = `
                <div class="active-sessions-modal">
                    <div class="sessions-header">
                        <h3>活动练习会话 (${activeSessions.length})</h3>
                        <button class="close-sessions" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="sessions-body">
                        ${activeSessions.map(session => {
                const exam = window.getExamById ? window.getExamById(session.examId) : examIndex.find(e => e.id === session.examId);
                const duration = Date.now() - new Date(session.startTime).getTime();

                return `
                                <div class="session-item">
                                    <div class="session-info">
                                        <h4>${exam ? exam.title : '未知题目'}</h4>
                                        <div class="session-meta">
                                            <span>开始时间: ${this.formatDate(session.startTime, 'HH:mm')}</span>
                                            <span>已用时: ${this.formatDuration(Math.floor(duration / 1000))}</span>
                                        </div>
                                    </div>
                                    <div class="session-actions">
                                        <button class="btn btn-sm btn-primary" onclick="window.app.focusExamWindow('${session.examId}')">
                                            切换到窗口
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="window.app.closeExamSession('${session.examId}')">
                                            结束会话
                                        </button>
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                    <div class="sessions-footer">
                        <button class="btn btn-outline" onclick="window.app.closeAllExamSessions()">
                            结束所有会话
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            关闭
                        </button>
                    </div>
                </div>
            `;

            // 模态框功能已移除(sessionsContent);
        },
    };

    global.__examSessionModules = global.__examSessionModules || {};
    global.__examSessionModules.windowManager = windowManagerMethods;
})(typeof window !== "undefined" ? window : globalThis);
