/**
 * sessionTracker.js - 练习会话跟踪
 * 从 examSessionMixin.js 提取
 *
 * 职责：练习会话生命周期管理、结果/分数跟踪、状态更新UI、降级记录、回放数据处理
 */
(function (global) {
    const MAX_LEGACY_PRACTICE_RECORDS = 1000;

    const sessionTrackerMethods = {

        /**
         * 开始练习会话
         */
        async startPracticeSession(examId) {
            const exam = await this._findExamDefinition(examId);
            if (!exam) {
                console.error('Exam not found:', examId);
                window.showMessage && window.showMessage('题目索引未加载，请重试或重新导入题库。', 'error');
                return;
            }

            try {
                // 优先使用新的练习页面管理器
                if (window.practicePageManager) {
                    const sessionId = await window.practicePageManager.startPracticeSession(examId, exam);

                    // 更新题目状态
                    this.updateExamStatus(examId, 'in-progress');
                    return sessionId;
                }

                // 使用练习记录器开始会话
                if (this.components.practiceRecorder) {
                    let sessionData;
                    if (typeof this.components.practiceRecorder.startPracticeSession === 'function') {
                        sessionData = this.components.practiceRecorder.startPracticeSession(examId, exam);
                    } else if (typeof this.components.practiceRecorder.startSession === 'function') {
                        sessionData = this.components.practiceRecorder.startSession(examId, exam);
                    } else {
                        console.warn('[App] PracticeRecorder没有可用的启动方法');
                        sessionData = null;
                    }
                } else {
                    // 降级处理
                    const sessionData = {
                        examId: examId,
                        startTime: new Date().toISOString(),
                        status: 'started',
                        sessionId: this.generateSessionId(examId)
                    };

                    const activeSessions = await storage.get('active_sessions', []);
                    activeSessions.push(sessionData);
                    await storage.set('active_sessions', activeSessions);
                }

                // 更新题目状态
                this.updateExamStatus(examId, 'in-progress');

            } catch (error) {
                console.error('[App] 启动练习会话失败:', error);

                // 最终降级方案
                this.startPracticeSessionFallback(examId, exam);
            }
        },

        /**
         * 降级启动练习会话
         */
        async startPracticeSessionFallback(examId, exam) {

            const sessionData = {
                examId: examId,
                startTime: new Date().toISOString(),
                status: 'started',
                sessionId: this.generateSessionId(examId)
            };

            const activeSessions = await storage.get('active_sessions', []);
            activeSessions.push(sessionData);
            await storage.set('active_sessions', activeSessions);

            // 更新题目状态
            this.updateExamStatus(examId, 'in-progress');

            // 尝试打开练习页面
            const practiceUrl = `templates/ielts-exam-template.html?examId=${examId}`;
            window.open(practiceUrl, `practice_${sessionData.sessionId}`, 'width=1200,height=800');
        },

        /**
         * 处理题目完成
         */
        handleExamCompleted(examId, resultData) {

            // 练习记录器会自动处理完成事件
            // 这里只需要更新UI状态
            this.updateExamStatus(examId, 'completed');

            // 显示完成通知
            this.showExamCompletionNotification(examId, resultData);

            // 清理会话
            this.cleanupExamSession(examId);
        },

        /**
         * 处理题目进度
         */
        handleExamProgress(examId, progressData) {

            // 更新进度显示
            this.updateExamProgress(examId, progressData);
        },

        /**
         * 处理题目错误
         */
        handleExamError(examId, errorData) {
            console.error('Exam error:', examId, errorData);

            window.showMessage(`题目出现错误: ${errorData.message || '未知错误'}`, 'error');

            // 清理会话
            this.cleanupExamSession(examId);
        },

        /**
         * 处理数据采集器会话就绪
         */
        handleSessionReady(examId, data) {
            const payload = data && typeof data === 'object' ? data : {};

            // 更新会话状态
            let windowInfo = null;
            if (this.examWindows && this.examWindows.has(examId)) {
                windowInfo = this.examWindows.get(examId);
            } else {
                windowInfo = this.ensureExamWindowSession(examId);
            }

            if (windowInfo) {
                windowInfo.dataCollectorReady = true;
                if (payload.pageType) {
                    windowInfo.pageType = payload.pageType;
                }
                if (payload.sessionId && windowInfo.expectedSessionId !== payload.sessionId) {
                    windowInfo.expectedSessionId = payload.sessionId;
                }
                if (payload.url) {
                    windowInfo.latestUrl = payload.url;
                }
                this.examWindows && this.examWindows.set(examId, windowInfo);
            }

            if (!(windowInfo && windowInfo.reviewMode)
                && this.components
                && this.components.practiceRecorder
                && typeof this.components.practiceRecorder.handleSessionStarted === 'function') {
                const recorderSessionId = (windowInfo && windowInfo.expectedSessionId) || payload.sessionId || this.generateSessionId(examId);
                try {
                    this.components.practiceRecorder.handleSessionStarted({
                        examId,
                        sessionId: recorderSessionId,
                        metadata: {
                            pageType: payload.pageType || null,
                            url: payload.url || null,
                            title: payload.title || null
                        }
                    });
                } catch (recorderError) {
                    console.warn('[PracticeRecorder] 无法同步会话状态:', recorderError);
                }
            }

            // 停止握手重试
            try {
                if (this._handshakeTimers && this._handshakeTimers.has(examId)) {
                    clearInterval(this._handshakeTimers.get(examId));
                    this._handshakeTimers.delete(examId);
                }
            } catch (_) { }

            if (windowInfo && windowInfo.reviewMode) {
                this._dispatchReviewReplayForExam(examId, windowInfo.window || null);
            }

            // 可以在这里发送额外的配置信息给数据采集器
            // 例如题目信息、特殊设置等
        },

        /**
         * 处理练习进度更新
         */
        handleProgressUpdate(examId, data) {

            // 更新UI中的进度显示
            this.updateRealTimeProgress(examId, data);

            // 保存进度到会话数据
            if (this.examWindows && this.examWindows.has(examId)) {
                const windowInfo = this.examWindows.get(examId);
                windowInfo.lastProgress = data;
                windowInfo.lastUpdate = Date.now();
                this.examWindows.set(examId, windowInfo);
            }
        },

        /**
         * 处理练习完成（真实数据）
         */
        async handlePracticeComplete(examId, data, sourceWindow = null) {
            if (data && !data.sessionId) {
                data.sessionId = `${examId}_${Date.now()}`;
            }

            // 仅在P1/P4听力填空场景尝试补齐 spellingErrors（错词抓取）
            try {
                const collector = window.spellingErrorCollector;
                const hasExisting = Array.isArray(data?.spellingErrors) && data.spellingErrors.length > 0;
                const comparison = data?.answerComparison || data?.realData?.answerComparison || null;

                if (!hasExisting && collector && typeof collector.detectErrors === 'function' && comparison && typeof comparison === 'object') {
                    const examIdForDetect = data?.examId || examId;
                    const source = typeof collector.detectSource === 'function'
                        ? collector.detectSource(examIdForDetect)
                        : 'other';

                    if (source === 'p1' || source === 'p4') {
                        const detected = collector.detectErrors(comparison, null, examIdForDetect);
                        if (Array.isArray(detected) && detected.length > 0) {
                            data.spellingErrors = detected;
                        } else if (!Array.isArray(data.spellingErrors)) {
                            data.spellingErrors = [];
                        }
                    }
                }
            } catch (error) {
                console.warn('[DataCollection] 拼写错误检测失败，已忽略:', error);
            }

            const recorderAvailable = this.components
                && this.components.practiceRecorder
                && typeof this.components.practiceRecorder.savePracticeRecord === 'function';

            try {
                if (recorderAvailable) {
                    try {
                        await this.components.practiceRecorder.savePracticeRecord(data);
                    } catch (recErr) {
                        console.warn('[DataCollection] PracticeRecorder 保存失败，改用降级存储:', recErr);
                        await this.saveRealPracticeData(examId, data, { savingAsFallback: true });
                    }
                } else {
                    // 直接保存真实数据（采用旧版本的简单方式）
                    await this.saveRealPracticeData(examId, data, { savingAsFallback: true });
                }

                // 刷新内存中的练习记录，确保无需手动刷新即可看到
                try {
                    if (typeof window.syncPracticeRecords === 'function') {
                        window.syncPracticeRecords();
                    } else if (window.storage) {
                        const latest = await window.storage.get('practice_records', []);
                        this.setState('practice.records', Array.isArray(latest) ? latest : []);
                    }
                } catch (syncErr) {
                    console.warn('[DataCollection] 刷新练习记录失败（UI可能需要手动刷新）:', syncErr);
                }

                // P1/P4：落库后同步保存错词到词表（multi-suite 在 finalizeMultiSuiteRecord 内处理）
                if (Array.isArray(data?.spellingErrors) && data.spellingErrors.length > 0
                    && window.spellingErrorCollector
                    && typeof window.spellingErrorCollector.saveErrors === 'function') {
                    try {
                        await window.spellingErrorCollector.saveErrors(data.spellingErrors);
                    } catch (saveError) {
                        console.warn('[DataCollection] 保存拼写错误词表失败（不影响主流程）:', saveError);
                    }
                }

                // 更新UI状态
                this.updateExamStatus(examId, 'completed');

                // 显示完成通知（使用真实数据）
                this.showRealCompletionNotification(examId, data);

                // 刷新练习记录显示
                if (typeof updatePracticeView === 'function') {
                    updatePracticeView();
                }

            } catch (error) {
                console.error('[DataCollection] 处理练习完成数据失败:', error);
                // 即使出错也要显示通知
                window.showMessage('练习已完成，但数据保存可能有问题', 'warning');
            } finally {
                // 清理会话
                this.cleanupExamSession(examId);
            }
        },

        /**
         * 处理数据采集错误
         */
        async handleDataCollectionError(examId, data) {
            console.error('[DataCollection] 数据采集错误:', examId, data);

            // 记录错误但不中断用户体验
            const errorInfo = {
                examId: examId,
                error: data,
                timestamp: Date.now(),
                type: 'data_collection_error'
            };

            const errorLogs = await storage.get('collection_errors', []);
            errorLogs.push(errorInfo);
            if (errorLogs.length > 50) {
                errorLogs.splice(0, errorLogs.length - 50);
            }
            await storage.set('collection_errors', errorLogs);

            // 标记该会话使用模拟数据
            if (this.examWindows && this.examWindows.has(examId)) {
                const windowInfo = this.examWindows.get(examId);
                windowInfo.useSimulatedData = true;
                this.examWindows.set(examId, windowInfo);
            }
        },

        /**
         * 更新实时进度显示
         */
        updateRealTimeProgress(examId, progressData) {
            // 在UI中显示实时进度
            const examCards = document.querySelectorAll(`[data-exam-id="${examId}"]`);
            examCards.forEach(card => {
                let progressInfo = card.querySelector('.real-progress-info');
                if (!progressInfo) {
                    progressInfo = document.createElement('div');
                    progressInfo.className = 'real-progress-info';
                    progressInfo.style.cssText = `
                        font-size: 12px;
                        color: #666;
                        margin-top: 5px;
                        padding: 3px 6px;
                        background: #f0f8ff;
                        border-radius: 3px;
                    `;
                    card.appendChild(progressInfo);
                }

                const { answeredQuestions, totalQuestions, elapsedTime } = progressData;
                const minutes = Math.floor(elapsedTime / 60);
                const seconds = elapsedTime % 60;

                progressInfo.textContent = `进度: ${answeredQuestions}/${totalQuestions} | 用时: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            });
        },

        /**
         * 保存真实练习数据（采用旧版本的简单直接方式）
         */
        async saveRealPracticeData(examId, realData, options = {}) {
            try {
                const normalizeKey = (rawKey) => {
                    if (rawKey == null) return null;
                    const s = String(rawKey).trim();
                    if (!s) return null;
                    const range = s.match(/^q?(\d+)\s*-\s*(\d+)$/i);
                    if (range) return `q${range[1]}-${range[2]}`;
                    if (/^q\d+$/i.test(s)) return s.toLowerCase();
                    if (/^\d+$/.test(s)) return `q${s}`;
                    return s;
                };

                const normalizeValue = (value) => {
                    if (value == null) return '';
                    if (typeof value === 'boolean') {
                        return value ? 'True' : 'False';
                    }
                    if (Array.isArray(value)) {
                        const tokens = value
                            .map(v => String(v).trim())
                            .filter(Boolean)
                            .map(v => v.toUpperCase());
                        return Array.from(new Set(tokens)).sort().join(', ');
                    }
                    if (typeof value === 'object') {
                        if (value.answer != null) return normalizeValue(value.answer);
                        if (value.value != null) return normalizeValue(value.value);
                        try {
                            const json = JSON.stringify(value);
                            return json === '{}' || json === '[]' ? '' : json;
                        } catch (_) {
                            return '';
                        }
                    }
                    return String(value).trim();
                };

                const normalizeAnswerMap = (raw) => {
                    const map = {};
                    if (!raw) return map;
                    if (Array.isArray(raw)) {
                        raw.forEach((entry, idx) => {
                            if (!entry) return;
                            const k = normalizeKey(entry.questionId || `q${idx + 1}`);
                            const v = normalizeValue(entry.answer ?? entry.userAnswer ?? entry.value ?? entry);
                            if (k) map[k] = v;
                        });
                        return map;
                    }
                    Object.entries(raw).forEach(([rk, rv]) => {
                        const k = normalizeKey(rk);
                        const v = normalizeValue(rv && typeof rv === 'object' && 'answer' in rv ? rv.answer : rv);
                        if (k) map[k] = v;
                    });
                    return map;
                };

                const normalizedAnswers = normalizeAnswerMap(realData?.answers);
                const normalizedCorrectMap = normalizeAnswerMap(realData?.correctAnswers);

                const savingAsFallback = Boolean(options && options.savingAsFallback);

                const exam = await this._findExamDefinition(examId);

                if (!exam) {
                    console.error('[DataCollection] 无法找到题目信息:', examId);
                    return;
                }

                // 构造练习记录（与旧版本完全相同的格式）
                const practiceRecord = {
                    id: Date.now(),
                    examId: examId,
                    title: exam.title,
                    category: exam.category,
                    frequency: exam.frequency,

                    // 真实数据
                    realData: {
                        score: realData.scoreInfo?.correct || 0,
                        totalQuestions: realData.scoreInfo?.total || 0,
                        accuracy: realData.scoreInfo?.accuracy || 0,
                        percentage: realData.scoreInfo?.percentage || 0,
                        duration: realData.duration,
                        answers: normalizedAnswers,
                        correctAnswers: normalizedCorrectMap,
                        answerHistory: realData.answerHistory,
                        interactions: realData.interactions,
                        isRealData: true,
                        source: realData.scoreInfo?.source || 'unknown'
                    },

                    // 数据来源标识
                    dataSource: 'real',

                    date: new Date().toISOString(),
                    sessionId: realData.sessionId,
                    timestamp: Date.now()
                };

                // 兼容旧视图字段（便于总览系统统计与详情展示）
                try {
                    const sInfo = realData && realData.scoreInfo ? realData.scoreInfo : {};
                    const correct = typeof sInfo?.correct === 'number' ? sInfo.correct : 0;
                    const total = typeof sInfo?.total === 'number' ? sInfo.total : (practiceRecord.realData?.totalQuestions || Object.keys(realData.answers || {}).length || 0);
                    const acc = typeof sInfo?.accuracy === 'number' ? sInfo.accuracy : (total > 0 ? correct / total : 0);
                    const pct = typeof sInfo?.percentage === 'number' ? sInfo.percentage : Math.round(acc * 100);

                    practiceRecord.score = correct;
                    practiceRecord.correctAnswers = correct; // 兼容练习记录视图所需字段
                    practiceRecord.totalQuestions = total;
                    practiceRecord.accuracy = acc;
                    practiceRecord.percentage = pct;
                    practiceRecord.answers = normalizedAnswers;
                    practiceRecord.startTime = new Date((realData.startTime ?? (Date.now() - (realData.duration || 0) * 1000))).toISOString();
                    practiceRecord.endTime = new Date((realData.endTime ?? Date.now())).toISOString();

                    // 填充详情，便于在练习记录详情中显示正确答案
                    const comp = realData && realData.answerComparison ? realData.answerComparison : {};
                    const details = {};
                    Object.entries(comp).forEach(([qid, obj]) => {
                        details[qid] = {
                            userAnswer: obj && obj.userAnswer != null ? obj.userAnswer : '',
                            correctAnswer: obj && obj.correctAnswer != null ? obj.correctAnswer : '',
                            isCorrect: !!(obj && obj.isCorrect)
                        };
                    });
                    // 将详情放入 realData.scoreInfo，便于历史详情与Markdown导出读取
                    if (!practiceRecord.realData) practiceRecord.realData = {};
                    practiceRecord.realData.scoreInfo = {
                        correct: correct,
                        total: total,
                        accuracy: acc,
                        percentage: pct,
                        details: details
                    };

                    // 同时保留顶层一致性（仅用于展示，不作为详情读取来源）
                    practiceRecord.scoreInfo = {
                        correct: correct,
                        total: total,
                        accuracy: acc,
                        percentage: pct,
                        details: details
                    };

                    // 将比较结构提升到顶层，便于兼容读取
                    practiceRecord.answerComparison = comp;
                } catch (compatErr) {
                    console.warn('[DataCollection] 兼容字段填充失败:', compatErr);
                }

                // 直接保存到localStorage（与旧版本完全相同的方式）
                let practiceRecords = await storage.get('practice_records', []);
                if (!Array.isArray(practiceRecords)) {
                    // 迁移修复：历史上可能被错误压缩为对象，这里强制纠正为数组
                    practiceRecords = [];
                }

                practiceRecords.unshift(practiceRecord);

                // 限制记录数量
                if (practiceRecords.length > MAX_LEGACY_PRACTICE_RECORDS) {
                    practiceRecords.splice(MAX_LEGACY_PRACTICE_RECORDS);
                }

                let saveResult = null;
                if (window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.savePracticeRecord === 'function') {
                    saveResult = await window.PracticeCore.store.savePracticeRecord(practiceRecord);
                } else if (window.simpleStorageWrapper && typeof window.simpleStorageWrapper.addPracticeRecord === 'function') {
                    saveResult = await window.simpleStorageWrapper.addPracticeRecord(practiceRecord);
                } else {
                    const practiceKey = ['practice', 'records'].join('_');
                    saveResult = await storage.set(practiceKey, practiceRecords);
                }

                // 立即验证保存是否成功
                const verifyRecords = window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.listPracticeRecords === 'function'
                    ? await window.PracticeCore.store.listPracticeRecords()
                    : await storage.get('practice_records', []);
                const savedRecord = Array.isArray(verifyRecords)
                    ? verifyRecords.find(r => r.id === practiceRecord.id)
                    : undefined;

                if (savedRecord) {
                } else {
                    console.error('[DataCollection] ✗ 保存验证失败，记录未找到');
                }

            } catch (error) {
                console.error('[DataCollection] 保存真实数据失败:', error);
            }
        },

        /**
         * 显示真实完成通知
         */
        async showRealCompletionNotification(examId, realData) {
            const exam = window.getExamById ? window.getExamById(examId) : null;

            if (!exam) return;

            const scoreInfo = realData.scoreInfo;
            if (scoreInfo) {
                const accuracy = scoreInfo.percentage || Math.round((scoreInfo.accuracy || 0) * 100);
                const duration = Math.round(realData.duration / 60); // 转换为分钟

                let message = `练习完成！\n${exam.title}\n`;

                if (scoreInfo.correct !== undefined && scoreInfo.total !== undefined) {
                    message += `得分: ${scoreInfo.correct}/${scoreInfo.total} (${accuracy}%)\n`;
                } else {
                    message += `正确率: ${accuracy}%\n`;
                }

                message += `用时: ${duration} 分钟`;

                if (scoreInfo.source) {
                    message += `\n数据来源: ${scoreInfo.source === 'page_extraction' ? '页面提取' : '自动计算'}`;
                }

                window.showMessage(message, 'success');
            } else {
                // 没有分数信息的情况
                const duration = Math.round(realData.duration / 60);
                window.showMessage(`练习完成！\n${exam.title}\n用时: ${duration} 分钟`, 'success');
            }
        },

        /**
         * 处理题目窗口关闭
         */
        handleExamWindowClosed(examId) {

            // 更新题目状态
            this.updateExamStatus(examId, 'interrupted');

            // 清理会话
            this.cleanupExamSession(examId);
        },

        /**
         * 更新题目状态
         */
        updateExamStatus(examId, status) {
            // 更新UI中的题目状态指示器
            const examCards = document.querySelectorAll(`[data-exam-id="${examId}"]`);
            examCards.forEach(card => {
                const statusIndicator = card.querySelector('.exam-status');
                if (statusIndicator) {
                    statusIndicator.className = `exam-status ${status}`;
                }
            });

            // 触发状态更新事件
            document.dispatchEvent(new CustomEvent('examStatusChanged', {
                detail: { examId, status }
            }));
        },

        /**
         * 更新题目进度
         */
        updateExamProgress(examId, progressData) {
            // 这里可以在UI中显示进度信息
            const progressPercentage = Math.round((progressData.completed / progressData.total) * 100);

            // 更新进度显示
            const examCards = document.querySelectorAll(`[data-exam-id="${examId}"]`);
            examCards.forEach(card => {
                let progressBar = card.querySelector('.exam-progress-bar');
                if (!progressBar) {
                    progressBar = document.createElement('div');
                    progressBar.className = 'exam-progress-bar';

                    const progressFillNode = document.createElement('div');
                    progressFillNode.className = 'progress-fill';
                    progressFillNode.style.width = '0%';

                    const progressTextNode = document.createElement('span');
                    progressTextNode.className = 'progress-text';
                    progressTextNode.textContent = '0%';

                    progressBar.appendChild(progressFillNode);
                    progressBar.appendChild(progressTextNode);
                    card.appendChild(progressBar);
                }

                const progressFill = progressBar.querySelector('.progress-fill');
                const progressText = progressBar.querySelector('.progress-text');

                if (progressFill) {
                    progressFill.style.width = `${progressPercentage}%`;
                }
                if (progressText) {
                    progressText.textContent = `${progressPercentage}%`;
                }
            });
        },

        /**
         * 显示题目完成通知
         */
        async showExamCompletionNotification(examId, resultData) {
            const exam = window.getExamById ? window.getExamById(examId) : null;

            if (!exam) return;

            const accuracy = Math.round((resultData.accuracy || 0) * 100);
            const message = `题目完成！\n${exam.title}\n正确率: ${accuracy}%`;

            window.showMessage(message, 'success');

            // 可以显示更详细的结果模态框
            this.showDetailedResults(examId, resultData);
        },

        /**
         * 显示详细结果
         */
        async showDetailedResults(examId, resultData) {
            const exam = window.getExamById ? window.getExamById(examId) : null;

            if (!exam) return;

            const accuracy = Math.round((resultData.accuracy || 0) * 100);
            const duration = this.formatDuration(resultData.duration || 0);

            const resultContent = `
                <div class="exam-result-modal">
                    <div class="result-header">
                        <h3>练习完成</h3>
                        <div class="result-score ${accuracy >= 80 ? 'excellent' : accuracy >= 60 ? 'good' : 'needs-improvement'}">
                            ${accuracy}%
                        </div>
                    </div>
                    <div class="result-body">
                        <h4>${exam.title}</h4>
                        <div class="result-stats">
                            <div class="result-stat">
                                <span class="stat-label">正确率</span>
                                <span class="stat-value">${accuracy}%</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">用时</span>
                                <span class="stat-value">${duration}</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">题目数</span>
                                <span class="stat-value">${resultData.totalQuestions || exam.totalQuestions || 0}</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">正确数</span>
                                <span class="stat-value">${resultData.correctAnswers || 0}</span>
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="btn btn-primary" onclick="window.app.openExam('${examId}')">
                                再次练习
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.navigateToView('analysis')">
                                查看分析
                            </button>
                            <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 显示结果模态框
            // 模态框功能已移除(resultContent);
        },

        /**
         * 清理题目会话
         */
        async cleanupExamSession(examId) {
            // 清理窗口引用
            if (this.examWindows && this.examWindows.has(examId)) {
                this.examWindows.delete(examId);
            }

            // 清理消息处理器
            if (this.messageHandlers && this.messageHandlers.has(examId)) {
                const handler = this.messageHandlers.get(examId);
                window.removeEventListener('message', handler);
                this.messageHandlers.delete(examId);
            }

            // 清理活动会话
            const activeSessions = await storage.get('active_sessions', []);
            const updatedSessions = activeSessions.filter(session => session.examId !== examId);
            await storage.set('active_sessions', updatedSessions);
        },

        /**
         * 设置练习记录器事件监听
         */
        setupPracticeRecorderEvents() {
            if (this._practiceRecorderEventsBound) {
                return;
            }

            this._practiceRecorderEventsBound = true;

            // 监听练习完成事件
            document.addEventListener('practiceSessionCompleted', (event) => {
                const { examId, practiceRecord } = event.detail;

                // 更新UI
                this.updateExamStatus(examId, 'completed');
                this.refreshOverviewData();

                // 显示完成通知
                this.showPracticeCompletionNotification(examId, practiceRecord);
            });

            // 监听练习开始事件
            document.addEventListener('practiceSessionStarted', (event) => {
                const { examId } = event.detail;

                this.updateExamStatus(examId, 'in-progress');
            });

            // 监听练习进度事件
            document.addEventListener('practiceSessionProgress', (event) => {
                const { examId, progress } = event.detail;
                this.updateExamProgress(examId, progress);
            });

            // 监听练习错误事件
            document.addEventListener('practiceSessionError', (event) => {
                const { examId, error } = event.detail;
                console.error('Practice session error:', examId, error);

                this.updateExamStatus(examId, 'error');
                window.showMessage(`练习出现错误: ${error.message || '未知错误'}`, 'error');
            });

            // 监听练习结束事件
            document.addEventListener('practiceSessionEnded', (event) => {
                const { examId, reason } = event.detail;

                if (reason !== 'completed') {
                    this.updateExamStatus(examId, 'interrupted');
                }
            });
        },

        /**
         * 显示练习完成通知
         */
        async showPracticeCompletionNotification(examId, practiceRecord) {
            const exam = window.getExamById ? window.getExamById(examId) : null;

            if (!exam) return;

            const accuracy = Math.round((practiceRecord.accuracy || 0) * 100);
            const duration = this.formatDuration(practiceRecord.duration || 0);

            // 显示简单通知
            const message = `练习完成！\n${exam.title}\n正确率: ${accuracy}% | 用时: ${duration}`;
            window.showMessage(message, 'success');

            // 显示详细结果模态框
            setTimeout(() => {
                this.showDetailedPracticeResults(examId, practiceRecord);
            }, 1000);
        },

        /**
         * 显示详细练习结果
         */
        async showDetailedPracticeResults(examId, practiceRecord) {
            const exam = window.getExamById ? window.getExamById(examId) : null;

            if (!exam) return;

            const accuracy = Math.round((practiceRecord.accuracy || 0) * 100);
            const duration = this.formatDuration(practiceRecord.duration || 0);

            const resultContent = `
                <div class="practice-result-modal">
                    <div class="result-header">
                        <h3>练习完成</h3>
                        <div class="result-score ${accuracy >= 80 ? 'excellent' : accuracy >= 60 ? 'good' : 'needs-improvement'}">
                            ${accuracy}%
                        </div>
                    </div>
                    <div class="result-body">
                        <h4>${exam.title}</h4>
                        <div class="result-stats">
                            <div class="result-stat">
                                <span class="stat-label">正确率</span>
                                <span class="stat-value">${accuracy}%</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">用时</span>
                                <span class="stat-value">${duration}</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">题目数</span>
                                <span class="stat-value">${practiceRecord.totalQuestions || 0}</span>
                            </div>
                            <div class="result-stat">
                                <span class="stat-label">正确数</span>
                                <span class="stat-value">${practiceRecord.correctAnswers || 0}</span>
                            </div>
                        </div>
                        ${practiceRecord.questionTypePerformance && Object.keys(practiceRecord.questionTypePerformance).length > 0 ? `
                            <div class="question-type-performance">
                                <h5>题型表现</h5>
                                <div class="type-performance-list">
                                    ${Object.entries(practiceRecord.questionTypePerformance).map(([type, perf]) => `
                                        <div class="type-performance-item">
                                            <span class="type-name">${this.formatQuestionType(type)}</span>
                                            <span class="type-accuracy">${Math.round((perf.accuracy || 0) * 100)}%</span>
                                            <span class="type-count">(${perf.correct || 0}/${perf.total || 0})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="result-actions">
                            <button class="btn btn-primary" onclick="window.app.openExam('${examId}')">
                                再次练习
                            </button>
                            <button class="btn btn-secondary" onclick="window.app.navigateToView('practice')">
                                查看记录
                            </button>
                            <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 模态框功能已移除(resultContent);
        },

        // ===== 工具方法 =====

        /**
         * 创建简单的练习记录
         */
        createSimplePracticeRecord(exam, realData) {
            const now = new Date();
            const recordId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 提取分数信息
            const scoreInfo = realData.scoreInfo || {};
            const score = scoreInfo.correct || 0;
            const totalQuestions = scoreInfo.total || Object.keys(realData.answers || {}).length;
            const accuracy = scoreInfo.accuracy || (totalQuestions > 0 ? score / totalQuestions : 0);

            return {
                id: recordId,
                examId: exam.id,
                title: exam.title,
                category: exam.category,
                frequency: exam.frequency,

                // 真实数据标识
                dataSource: 'real',
                isRealData: true,

                // 基本信息
                startTime: realData.startTime ? new Date(realData.startTime).toISOString() :
                    new Date(Date.now() - realData.duration * 1000).toISOString(),
                endTime: realData.endTime ? new Date(realData.endTime).toISOString() : now.toISOString(),
                date: now.toISOString(),

                // 成绩数据
                score: score,
                totalQuestions: totalQuestions,
                accuracy: accuracy,
                percentage: Math.round(accuracy * 100),
                duration: realData.duration, // 秒

                // 详细数据
                realData: {
                    sessionId: realData.sessionId,
                    answers: realData.answers || {},
                    interactions: realData.interactions || [],
                    scoreInfo: scoreInfo,
                    pageType: realData.pageType,
                    url: realData.url,
                    source: scoreInfo.source || 'fallback_recorder'
                }
            };
        },

        /**
         * 生成会话ID
         */
        generateSessionId(examId) {
            const suffix = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const normalizedExamId = typeof examId === 'string'
                ? examId.trim().replace(/\s+/g, '-')
                : (examId != null ? String(examId).trim().replace(/\s+/g, '-') : '');

            if (normalizedExamId) {
                return `${normalizedExamId}_${suffix}`;
            }

            return `session_${suffix}`;
        },

        /**
         * 格式化时长
         */
        formatDuration(seconds) {
            if (seconds < 60) {
                return `${seconds}秒`;
            } else if (seconds < 3600) {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
            } else {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
            }
        },

        /**
         * 格式化日期
         */
        formatDate(dateString, format = 'YYYY-MM-DD HH:mm') {
            const date = new Date(dateString);
            if (format === 'HH:mm') {
                return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            }
            return date.toLocaleString('zh-CN');
        },

        /**
         * 检查是否为移动设备
         */
        isMobile() {
            return window.innerWidth <= 768;
        },

        /**
         * 格式化题型名称
         */
        formatQuestionType(type) {
            const typeMap = {
                'heading-matching': '标题匹配',
                'true-false-not-given': '判断题',
                'yes-no-not-given': '是非题',
                'multiple-choice': '选择题',
                'matching-information': '信息匹配',
                'matching-people-ideas': '人物观点匹配',
                'summary-completion': '摘要填空',
                'sentence-completion': '句子填空',
                'short-answer': '简答题',
                'diagram-labelling': '图表标注',
                'flow-chart': '流程图',
                'table-completion': '表格填空'
            };
            return typeMap[type] || type;
        },

        // ===== 回放数据处理 =====

        _cloneReviewData(value) {
            if (value == null) {
                return value;
            }
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_) {
                return value;
            }
        },

        _isReplayObject(value) {
            return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
        },

        _normalizeReplayQuestionKey(rawKey) {
            if (rawKey == null) {
                return '';
            }
            const key = String(rawKey).trim();
            if (!key) {
                return '';
            }
            if (/^q\d+$/i.test(key)) {
                return key.toLowerCase();
            }
            const numericOnly = key.match(/^\d+$/);
            if (numericOnly) {
                return `q${numericOnly[0]}`;
            }
            const ranged = key.match(/^q?(\d+\s*-\s*\d+)$/i);
            if (ranged) {
                return `q${ranged[1].replace(/\s+/g, '')}`;
            }
            const questionMatch = key.match(/^question[-_\s]*(\d+)$/i);
            if (questionMatch) {
                return `q${questionMatch[1]}`;
            }
            return key;
        },

        _splitReplayCompositeKey(rawKey) {
            if (rawKey == null) {
                return { examPrefix: '', questionKey: '' };
            }
            const key = String(rawKey).trim();
            if (!key) {
                return { examPrefix: '', questionKey: '' };
            }
            const sep = key.indexOf('::');
            if (sep === -1) {
                return {
                    examPrefix: '',
                    questionKey: this._normalizeReplayQuestionKey(key)
                };
            }
            const examPrefix = key.slice(0, sep).trim();
            const questionKey = this._normalizeReplayQuestionKey(key.slice(sep + 2));
            return { examPrefix, questionKey };
        },

        _normalizeReplayAnswerMap(rawMap, targetExamId = '', allowUnprefixed = true) {
            const normalized = {};
            if (!this._isReplayObject(rawMap)) {
                return normalized;
            }
            const normalizedTarget = targetExamId ? String(targetExamId).trim().toLowerCase() : '';
            Object.entries(rawMap).forEach(([rawKey, rawValue]) => {
                const split = this._splitReplayCompositeKey(rawKey);
                if (!split.questionKey) {
                    return;
                }
                const hasPrefix = !!split.examPrefix;
                if (hasPrefix) {
                    if (!normalizedTarget || split.examPrefix.toLowerCase() !== normalizedTarget) {
                        return;
                    }
                } else if (!allowUnprefixed) {
                    return;
                }
                normalized[split.questionKey] = this._cloneReviewData(rawValue);
            });
            return normalized;
        },

        _normalizeReplayComparison(rawComparison, targetExamId = '', allowUnprefixed = true) {
            const normalized = {};
            if (!this._isReplayObject(rawComparison)) {
                return normalized;
            }
            const normalizedTarget = targetExamId ? String(targetExamId).trim().toLowerCase() : '';
            Object.entries(rawComparison).forEach(([rawKey, rawValue]) => {
                const split = this._splitReplayCompositeKey(rawKey);
                if (!split.questionKey) {
                    return;
                }
                const hasPrefix = !!split.examPrefix;
                if (hasPrefix) {
                    if (!normalizedTarget || split.examPrefix.toLowerCase() !== normalizedTarget) {
                        return;
                    }
                } else if (!allowUnprefixed) {
                    return;
                }
                const entry = this._isReplayObject(rawValue) ? rawValue : { userAnswer: rawValue };
                normalized[split.questionKey] = {
                    questionId: split.questionKey,
                    userAnswer: this._cloneReviewData(entry.userAnswer),
                    correctAnswer: this._cloneReviewData(entry.correctAnswer),
                    isCorrect: typeof entry.isCorrect === 'boolean' ? entry.isCorrect : null
                };
            });
            return normalized;
        },

        _deriveReplayExamIdFromSources(...sources) {
            for (let i = 0; i < sources.length; i += 1) {
                const source = sources[i];
                if (!this._isReplayObject(source)) {
                    continue;
                }
                const keys = Object.keys(source);
                for (let j = 0; j < keys.length; j += 1) {
                    const split = this._splitReplayCompositeKey(keys[j]);
                    if (split.examPrefix) {
                        return split.examPrefix;
                    }
                }
            }
            return '';
        },

        _hydrateReplayCorrectAnswersFromDetails(detailSource, correctAnswers, comparison, targetExamId = '', allowUnprefixed = true) {
            if (!this._isReplayObject(detailSource)) {
                return;
            }
            const normalizedTarget = targetExamId ? String(targetExamId).trim().toLowerCase() : '';
            Object.entries(detailSource).forEach(([rawKey, rawDetail]) => {
                const split = this._splitReplayCompositeKey(rawKey);
                if (!split.questionKey) {
                    return;
                }
                const hasPrefix = !!split.examPrefix;
                if (hasPrefix) {
                    if (!normalizedTarget || split.examPrefix.toLowerCase() !== normalizedTarget) {
                        return;
                    }
                } else if (!allowUnprefixed) {
                    return;
                }
                const detail = this._isReplayObject(rawDetail) ? rawDetail : {};
                const userAnswer = detail.userAnswer != null ? detail.userAnswer : '';
                const correctAnswer = detail.correctAnswer != null ? detail.correctAnswer : '';
                if (!Object.prototype.hasOwnProperty.call(correctAnswers, split.questionKey) && correctAnswer !== '') {
                    correctAnswers[split.questionKey] = this._cloneReviewData(correctAnswer);
                }
                if (!comparison[split.questionKey]) {
                    comparison[split.questionKey] = {
                        questionId: split.questionKey,
                        userAnswer: this._cloneReviewData(userAnswer),
                        correctAnswer: this._cloneReviewData(correctAnswer),
                        isCorrect: typeof detail.isCorrect === 'boolean' ? detail.isCorrect : null
                    };
                } else if (comparison[split.questionKey].correctAnswer == null || comparison[split.questionKey].correctAnswer === '') {
                    comparison[split.questionKey].correctAnswer = this._cloneReviewData(correctAnswer);
                }
            });
        },

        _finalizeReplayComparison(answers, correctAnswers, comparison) {
            const merged = this._isReplayObject(comparison) ? comparison : {};
            const keySet = new Set([
                ...Object.keys(answers || {}),
                ...Object.keys(correctAnswers || {}),
                ...Object.keys(merged || {})
            ]);
            keySet.forEach((questionId) => {
                if (!questionId) {
                    return;
                }
                const existing = merged[questionId] && this._isReplayObject(merged[questionId])
                    ? merged[questionId]
                    : {};
                const userAnswer = Object.prototype.hasOwnProperty.call(existing, 'userAnswer')
                    ? existing.userAnswer
                    : (Object.prototype.hasOwnProperty.call(answers, questionId) ? answers[questionId] : '');
                const correctAnswer = Object.prototype.hasOwnProperty.call(existing, 'correctAnswer')
                    ? existing.correctAnswer
                    : (Object.prototype.hasOwnProperty.call(correctAnswers, questionId) ? correctAnswers[questionId] : '');
                let isCorrect = typeof existing.isCorrect === 'boolean' ? existing.isCorrect : null;
                if (isCorrect === null && userAnswer != null && correctAnswer != null && String(correctAnswer).trim()) {
                    isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                }
                merged[questionId] = {
                    questionId,
                    userAnswer: this._cloneReviewData(userAnswer),
                    correctAnswer: this._cloneReviewData(correctAnswer),
                    isCorrect
                };
            });
            return merged;
        },

        _deriveReplayScoreInfo(sourceScoreInfo, comparison) {
            const scoreInfo = this._isReplayObject(sourceScoreInfo) ? this._cloneReviewData(sourceScoreInfo) : {};
            const stats = {
                total: 0,
                correct: 0
            };
            Object.values(comparison || {}).forEach((entry) => {
                if (!this._isReplayObject(entry)) {
                    return;
                }
                const hasContent = entry.userAnswer != null
                    || entry.correctAnswer != null
                    || typeof entry.isCorrect === 'boolean';
                if (!hasContent) {
                    return;
                }
                stats.total += 1;
                if (entry.isCorrect === true) {
                    stats.correct += 1;
                }
            });

            const resolvedTotal = Number(scoreInfo.total ?? scoreInfo.totalQuestions);
            const resolvedCorrect = Number(scoreInfo.correct ?? scoreInfo.score);
            const finalTotal = Number.isFinite(resolvedTotal) && resolvedTotal >= 0 ? resolvedTotal : stats.total;
            const finalCorrect = Number.isFinite(resolvedCorrect) && resolvedCorrect >= 0 ? resolvedCorrect : stats.correct;
            const derivedAccuracy = finalTotal > 0 ? finalCorrect / finalTotal : 0;
            const resolvedAccuracy = Number(scoreInfo.accuracy);
            const finalAccuracy = Number.isFinite(resolvedAccuracy) ? resolvedAccuracy : derivedAccuracy;
            const resolvedPercentage = Number(scoreInfo.percentage);
            const finalPercentage = Number.isFinite(resolvedPercentage)
                ? resolvedPercentage
                : Math.round(finalAccuracy * 100);

            scoreInfo.correct = finalCorrect;
            scoreInfo.total = finalTotal;
            scoreInfo.totalQuestions = finalTotal;
            scoreInfo.accuracy = finalAccuracy;
            scoreInfo.percentage = finalPercentage;
            return scoreInfo;
        },

        _collectReplayQuestionIds(entry) {
            const keys = new Set();
            const collect = (source) => {
                if (!this._isReplayObject(source)) {
                    return;
                }
                Object.keys(source).forEach((key) => {
                    const normalized = this._normalizeReplayQuestionKey(key);
                    if (normalized) {
                        keys.add(normalized);
                    }
                });
            };
            collect(entry.answers);
            collect(entry.correctAnswers);
            collect(entry.answerComparison);
            if (Array.isArray(entry.allQuestionIds)) {
                entry.allQuestionIds.forEach((key) => {
                    const normalized = this._normalizeReplayQuestionKey(key);
                    if (normalized) {
                        keys.add(normalized);
                    }
                });
            }
            return Array.from(keys).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        },

        _buildReviewReplayEntriesFromRecord(record) {
            if (!record || typeof record !== 'object') {
                return [];
            }
            const recordMetadata = this._isReplayObject(record.metadata) ? record.metadata : {};
            const baseEntries = [record];
            const isAggregated = baseEntries.length > 1;
            const recordAnswersSource = this._isReplayObject(record.answers) ? record.answers : (this._isReplayObject(record.realData?.answers) ? record.realData.answers : {});
            const recordComparisonSource = this._isReplayObject(record.answerComparison) ? record.answerComparison : (this._isReplayObject(record.realData?.answerComparison) ? record.realData.answerComparison : {});
            const recordCorrectSource = this._isReplayObject(record.correctAnswerMap)
                ? record.correctAnswerMap
                : (this._isReplayObject(record.correctAnswers)
                    ? record.correctAnswers
                    : (this._isReplayObject(record.realData?.correctAnswers) ? record.realData.correctAnswers : {}));
            const recordDetailSource = record.scoreInfo?.details
                || record.realData?.scoreInfo?.details
                || null;

            const builtEntries = [];
            baseEntries.forEach((rawEntry, index) => {
                const entry = this._isReplayObject(rawEntry) ? rawEntry : {};
                const entryMetadata = this._isReplayObject(entry.metadata) ? entry.metadata : {};
                const entryExamId = entry.examId
                    || entryMetadata.examId
                    || this._deriveReplayExamIdFromSources(entry.answers, entry.answerComparison, recordAnswersSource, recordComparisonSource)
                    || (!isAggregated ? (record.examId || recordMetadata.examId) : '');
                const allowUnprefixed = !isAggregated;

                if (!entryExamId) {
                    return;
                }

                let answers = this._normalizeReplayAnswerMap(
                    this._isReplayObject(entry.answers) ? entry.answers : (this._isReplayObject(entry.realData?.answers) ? entry.realData.answers : {}),
                    entryExamId,
                    true
                );
                if (Object.keys(answers).length === 0) {
                    answers = this._normalizeReplayAnswerMap(recordAnswersSource, entryExamId, allowUnprefixed);
                }

                let comparison = this._normalizeReplayComparison(
                    this._isReplayObject(entry.answerComparison) ? entry.answerComparison : (this._isReplayObject(entry.realData?.answerComparison) ? entry.realData.answerComparison : {}),
                    entryExamId,
                    true
                );
                if (Object.keys(comparison).length === 0) {
                    comparison = this._normalizeReplayComparison(recordComparisonSource, entryExamId, allowUnprefixed);
                }

                let correctAnswers = this._normalizeReplayAnswerMap(
                    this._isReplayObject(entry.correctAnswerMap)
                        ? entry.correctAnswerMap
                        : (this._isReplayObject(entry.correctAnswers)
                            ? entry.correctAnswers
                            : (this._isReplayObject(entry.realData?.correctAnswers) ? entry.realData.correctAnswers : {})),
                    entryExamId,
                    true
                );
                if (Object.keys(correctAnswers).length === 0) {
                    correctAnswers = this._normalizeReplayAnswerMap(recordCorrectSource, entryExamId, allowUnprefixed);
                }

                const detailSource = entry.scoreInfo?.details
                    || entry.realData?.scoreInfo?.details
                    || recordDetailSource;
                this._hydrateReplayCorrectAnswersFromDetails(
                    detailSource,
                    correctAnswers,
                    comparison,
                    entryExamId,
                    allowUnprefixed
                );

                comparison = this._finalizeReplayComparison(answers, correctAnswers, comparison);
                const scoreInfo = this._deriveReplayScoreInfo(entry.scoreInfo || entry.realData?.scoreInfo || record.scoreInfo || record.realData?.scoreInfo, comparison);
                const highlights = Array.isArray(entry.highlights)
                    ? entry.highlights.slice()
                    : (Array.isArray(entry.rawData?.highlights) ? entry.rawData.highlights.slice() : []);
                const scrollY = Number.isFinite(Number(entry.scrollY))
                    ? Number(entry.scrollY)
                    : (Number.isFinite(Number(entry.rawData?.scrollY)) ? Number(entry.rawData.scrollY) : 0);
                const mergedMetadata = Object.assign({}, recordMetadata, entryMetadata, {
                    examId: entryExamId
                });
                const built = {
                    examId: String(entryExamId),
                    title: entry.title
                        || mergedMetadata.examTitle
                        || mergedMetadata.title
                        || record.title
                        || recordMetadata.examTitle
                        || `回顾题目 ${index + 1}`,
                    answers,
                    correctAnswers,
                    answerComparison: comparison,
                    scoreInfo,
                    allQuestionIds: [],
                    startTime: entry.startTime || record.startTime || record.date || null,
                    endTime: entry.endTime || record.endTime || record.date || null,
                    duration: Number(entry.duration ?? record.duration) || 0,
                    markedQuestions: Array.isArray(entry.markedQuestions)
                        ? entry.markedQuestions.slice()
                        : (Array.isArray(entryMetadata.markedQuestions)
                            ? entryMetadata.markedQuestions.slice()
                            : (Array.isArray(recordMetadata.markedQuestions) ? recordMetadata.markedQuestions.slice() : [])),
                    highlights,
                    scrollY,
                    metadata: mergedMetadata
                };
                built.allQuestionIds = this._collectReplayQuestionIds(built);
                builtEntries.push(built);
            });
            return builtEntries;
        },

        _ensureReviewReplayStore() {
            if (!this.reviewReplaySessions) {
                this.reviewReplaySessions = new Map();
            }
            return this.reviewReplaySessions;
        },

        _buildReviewSession(record) {
            const entries = this._buildReviewReplayEntriesFromRecord(record);
            const validEntries = entries.filter((entry) => entry && entry.examId);
            if (validEntries.length === 0) {
                return null;
            }
            return {
                sessionId: `review_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                entries: validEntries,
                currentIndex: 0,
                windowRef: null,
                readOnly: true
            };
        },

        _bindReviewWindowRef(reviewSessionId, windowRef) {
            if (!reviewSessionId || !windowRef || windowRef.closed) {
                return;
            }
            const store = this._ensureReviewReplayStore();
            const session = store.get(String(reviewSessionId));
            if (!session) {
                return;
            }
            session.windowRef = windowRef;
            store.set(String(reviewSessionId), session);
        },

        _buildReviewContextPayload(session, entryIndex) {
            const safeIndex = Number.isInteger(entryIndex) ? entryIndex : 0;
            const total = Array.isArray(session.entries) ? session.entries.length : 0;
            const current = session.entries[safeIndex] || {};
            return {
                reviewSessionId: session.sessionId,
                index: safeIndex + 1,
                currentIndex: safeIndex,
                total,
                canPrev: safeIndex > 0,
                canNext: safeIndex < total - 1,
                title: current.title || current.metadata?.examTitle || current.examId || '',
                examId: current.examId || '',
                readOnly: session.readOnly !== false
            };
        },

        _sendReviewReplayMessages(examId, targetWindow, session, entryIndex) {
            if (!targetWindow || targetWindow.closed || !session || !Array.isArray(session.entries)) {
                return false;
            }
            const safeIndex = Number.isInteger(entryIndex) ? entryIndex : 0;
            const entry = session.entries[safeIndex];
            if (!entry || !entry.examId) {
                return false;
            }
            const replayPayload = {
                reviewSessionId: session.sessionId,
                reviewEntryIndex: safeIndex,
                readOnly: session.readOnly !== false,
                entry: this._cloneReviewData(entry)
            };
            const contextPayload = this._buildReviewContextPayload(session, safeIndex);
            try {
                targetWindow.postMessage({ type: 'REPLAY_PRACTICE_RECORD', data: replayPayload }, '*');
                targetWindow.postMessage({ type: 'REVIEW_CONTEXT', data: contextPayload }, '*');
                return true;
            } catch (error) {
                console.warn('[ReviewReplay] 向题目页发送回放数据失败:', error);
                return false;
            }
        },

        _dispatchReviewReplayForExam(examId, targetWindow = null) {
            const windowInfo = this.examWindows && this.examWindows.get(examId);
            if (!windowInfo || !windowInfo.reviewMode || !windowInfo.reviewSessionId) {
                return false;
            }
            const store = this._ensureReviewReplayStore();
            const session = store.get(String(windowInfo.reviewSessionId));
            if (!session) {
                return false;
            }
            const index = Number.isInteger(windowInfo.reviewEntryIndex)
                ? windowInfo.reviewEntryIndex
                : (Number.isInteger(session.currentIndex) ? session.currentIndex : 0);
            const resolvedWindow = targetWindow || windowInfo.window || session.windowRef || null;
            const sent = this._sendReviewReplayMessages(examId, resolvedWindow, session, index);
            if (sent) {
                session.currentIndex = index;
                if (resolvedWindow && !resolvedWindow.closed) {
                    session.windowRef = resolvedWindow;
                }
                store.set(String(session.sessionId), session);
                windowInfo.reviewEntryIndex = index;
                if (resolvedWindow && !resolvedWindow.closed) {
                    windowInfo.window = resolvedWindow;
                }
                this.examWindows && this.examWindows.set(examId, windowInfo);
            }
            return sent;
        },

        async handleReviewReplayNavigate(examId, data = {}, sourceWindow = null) {
            const windowInfo = this.examWindows && this.examWindows.get(examId);
            if (!windowInfo || !windowInfo.reviewMode) {
                return;
            }
            const sessionId = data.reviewSessionId
                ? String(data.reviewSessionId)
                : (windowInfo.reviewSessionId ? String(windowInfo.reviewSessionId) : '');
            if (!sessionId) {
                return;
            }
            const store = this._ensureReviewReplayStore();
            const session = store.get(sessionId);
            if (!session || !Array.isArray(session.entries) || session.entries.length === 0) {
                return;
            }
            const direction = String(data.direction || data.action || '').toLowerCase();
            let nextIndex = Number.isInteger(session.currentIndex) ? session.currentIndex : 0;
            if (direction === 'next') {
                nextIndex += 1;
            } else if (direction === 'prev' || direction === 'previous') {
                nextIndex -= 1;
            } else if (Number.isInteger(data.targetIndex)) {
                nextIndex = data.targetIndex;
            } else {
                return;
            }

            if (nextIndex < 0) {
                nextIndex = 0;
            }
            if (nextIndex >= session.entries.length) {
                nextIndex = session.entries.length - 1;
            }

            const nextEntry = session.entries[nextIndex];
            if (!nextEntry || !nextEntry.examId) {
                return;
            }

            session.currentIndex = nextIndex;
            session.windowRef = sourceWindow || windowInfo.window || session.windowRef || null;
            store.set(sessionId, session);

            if (String(nextEntry.examId) === String(examId)) {
                windowInfo.reviewEntryIndex = nextIndex;
                this.examWindows && this.examWindows.set(examId, windowInfo);
                this._sendReviewReplayMessages(examId, session.windowRef, session, nextIndex);
                return;
            }

            try {
                await this.cleanupExamSession(examId);
            } catch (error) {
                console.warn('[ReviewReplay] 清理旧题目会话失败:', error);
            }

            await this.openExam(nextEntry.examId, {
                reviewMode: true,
                readOnly: true,
                reviewSessionId: sessionId,
                reviewEntryIndex: nextIndex,
                reuseWindow: session.windowRef || null
            });
        },

        async openPracticeRecordReplay(record) {
            const session = this._buildReviewSession(record);
            if (!session) {
                throw new Error('该练习记录缺少可回放的题目映射');
            }
            const store = this._ensureReviewReplayStore();
            store.set(session.sessionId, session);

            const firstEntry = session.entries[0];
            if (!firstEntry || !firstEntry.examId) {
                store.delete(session.sessionId);
                throw new Error('无法解析首题题目标识');
            }

            const openedWindow = await this.openExam(firstEntry.examId, {
                reviewMode: true,
                readOnly: true,
                reviewSessionId: session.sessionId,
                reviewEntryIndex: 0
            });
            if (!openedWindow) {
                store.delete(session.sessionId);
                throw new Error('无法打开回顾页面');
            }
            this._bindReviewWindowRef(session.sessionId, openedWindow);
            return session;
        },

        _buildExamInitPayload(examId, windowInfo = {}, extras = {}) {
            const info = windowInfo || {};
            if (!info.expectedSessionId) {
                info.expectedSessionId = this.generateSessionId(examId);
            }
            const payload = {
                examId: examId,
                parentOrigin: window.location.origin,
                sessionId: info.expectedSessionId,
                reviewMode: Boolean(info.reviewMode),
                reviewSessionId: info.reviewSessionId ? String(info.reviewSessionId) : null,
                reviewEntryIndex: Number.isInteger(info.reviewEntryIndex) ? info.reviewEntryIndex : 0,
                readOnly: Object.prototype.hasOwnProperty.call(info, 'readOnly')
                    ? Boolean(info.readOnly)
                    : Boolean(info.reviewMode)
            };
            if (extras && typeof extras === 'object') {
                Object.assign(payload, extras);
            }
            return payload;
        },

        ensureExamWindowSession(examId, examWindow = null) {
            if (!this.examWindows) {
                this.examWindows = new Map();
            }

            if (!this.examWindows.has(examId)) {
                this.examWindows.set(examId, {
                    window: examWindow || null,
                    startTime: Date.now(),
                    status: 'active',
                    expectedSessionId: this.generateSessionId(examId),
                    origin: (typeof window !== 'undefined' && window.location) ? window.location.origin : '',
                    reviewMode: false,
                    reviewSessionId: null,
                    reviewEntryIndex: 0,
                    readOnly: false
                });
            }

            const windowInfo = this.examWindows.get(examId);

            if (examWindow && (!windowInfo.window || windowInfo.window.closed || windowInfo.window !== examWindow)) {
                windowInfo.window = examWindow;
            }

            if (!windowInfo.expectedSessionId) {
                windowInfo.expectedSessionId = this.generateSessionId(examId);
            }
            if (typeof windowInfo.reviewMode !== 'boolean') {
                windowInfo.reviewMode = false;
            }
            if (!Number.isInteger(windowInfo.reviewEntryIndex)) {
                windowInfo.reviewEntryIndex = 0;
            }
            if (!Object.prototype.hasOwnProperty.call(windowInfo, 'readOnly')) {
                windowInfo.readOnly = Boolean(windowInfo.reviewMode);
            }

            this.examWindows.set(examId, windowInfo);
            return windowInfo;
        },
    };

    global.__examSessionModules = global.__examSessionModules || {};
    global.__examSessionModules.sessionTracker = sessionTrackerMethods;
})(typeof window !== "undefined" ? window : globalThis);
