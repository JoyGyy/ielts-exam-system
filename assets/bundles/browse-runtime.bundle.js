// ===== js/views/legacyViewBundle.js =====
(function (global) {
    'use strict';

    var domAdapter = global.DOMAdapter || null;

    // --- Practice statistics service ---
    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeTypeValue(value) {
        if (!value) {
            return '';
        }
        var normalized = String(value).toLowerCase();
        if (normalized.indexOf('read') !== -1 || normalized.indexOf('阅读') !== -1) {
            return 'reading';
        }
        if (normalized.indexOf('listen') !== -1 || normalized.indexOf('听力') !== -1) {
            return 'listening';
        }
        return normalized;
    }

    function toDateKey(value) {
        if (!value) {
            return null;
        }
        var date = new Date(value);
        if (isNaN(date.getTime())) {
            return null;
        }
        return date.toISOString().slice(0, 10);
    }

    function getRecordTimestamp(record) {
        if (!record || typeof record !== 'object') {
            return 0;
        }
        var candidates = [
            record.date, record.endTime, record.timestamp, record.createdAt, record.updatedAt,
            record.completedAt
        ];
        var rd = record.realData || {};
        candidates.push(rd.date, rd.endTime, rd.timestamp);

        var maxTs = 0;
        for (var i = 0; i < candidates.length; i += 1) {
            var candidate = candidates[i];
            if (candidate == null) {
                continue;
            }
            var parsed = new Date(candidate).getTime();
            if (!isNaN(parsed) && parsed > maxTs) {
                maxTs = parsed;
                continue;
            }
            if (typeof candidate === 'number' && isFinite(candidate) && candidate > maxTs) {
                maxTs = candidate;
            }
        }
        return maxTs;
    }

    function normalizePathValue(path) {
        if (!path) {
            return '';
        }
        var normalized = String(path).replace(/\\/g, '/').trim().toLowerCase();
        normalized = normalized.replace(/^\.?\//, '');
        return normalized;
    }

    function getPathTail(path) {
        var normalized = normalizePathValue(path);
        var parts = normalized.split('/').filter(Boolean);
        if (!parts.length) {
            return '';
        }
        if (parts.length === 1) {
            return parts[0];
        }
        return parts.slice(-2).join('/');
    }

    function recordMatchesExam(exam, record) {
        if (!exam || !record) {
            return false;
        }
        if (exam.id && record.examId && exam.id === record.examId) {
            return true;
        }
        var examTitle = exam.title || '';
        var recordTitle = record.title || record.examTitle || '';
        if (examTitle && recordTitle && examTitle === recordTitle) {
            return true;
        }
        var examPath = normalizePathValue(exam.path || exam.resourcePath || exam.basePath);
        var recordPath = normalizePathValue(
            record.path ||
            record.examPath ||
            record.resourcePath ||
            (record.realData && (record.realData.path || record.realData.examPath))
        );
        if (examPath && recordPath) {
            if (examPath === recordPath) {
                return true;
            }
            if (recordPath.endsWith('/' + examPath) || examPath.endsWith('/' + recordPath)) {
                return true;
            }
            var examTail = getPathTail(examPath);
            var recordTail = getPathTail(recordPath);
            if (examTail && recordTail && (examTail === recordTail || examTail.endsWith(recordTail) || recordTail.endsWith(examTail))) {
                return true;
            }
        }
        var examFile = (exam.filename || exam.pdfFilename || '').toLowerCase();
        var recordFile = (record.filename || record.examFile || record.examFilename || '').toLowerCase();
        if (!recordFile && record.realData) {
            recordFile = (record.realData.filename || record.realData.examFile || record.realData.pdfFilename || '').toLowerCase();
        }
        if (examFile && recordFile && examFile === recordFile) {
            return true;
        }
        return false;
    }

    function calculateStreak(uniqueDateKeys) {
        if (!uniqueDateKeys.length) {
            return 0;
        }
        var sorted = uniqueDateKeys.slice().sort(function (a, b) {
            return new Date(b) - new Date(a);
        });
        var today = new Date();
        var streak = 0;
        var previousDate = null;

        for (var i = 0; i < sorted.length; i += 1) {
            var currentDate = new Date(sorted[i]);
            if (i === 0) {
                var differenceFromToday = Math.floor((today - currentDate) / (24 * 60 * 60 * 1000));
                if (differenceFromToday > 1) {
                    break;
                }
                streak = 1;
                previousDate = currentDate;
                continue;
            }

            var diff = Math.floor((previousDate - currentDate) / (24 * 60 * 60 * 1000));
            if (diff === 1) {
                streak += 1;
                previousDate = currentDate;
            } else {
                break;
            }
        }

        return streak;
    }

    function calculateSummary(records) {
        var normalized = ensureArray(records);
        var totalPracticed = normalized.length;
        var totalScore = 0;
        var totalMinutes = 0;
        var uniqueDates = [];
        var seenDates = new Set();

        for (var i = 0; i < normalized.length; i += 1) {
            var record = normalized[i];
            var percentage = typeof record.percentage === 'number' ? record.percentage : 0;
            var duration = typeof record.duration === 'number' ? record.duration : 0;
            totalScore += percentage;
            totalMinutes += duration;

            var dateKey = toDateKey(record.date);
            if (dateKey && !seenDates.has(dateKey)) {
                seenDates.add(dateKey);
                uniqueDates.push(dateKey);
            }
        }

        var avgScore = totalPracticed > 0 ? totalScore / totalPracticed : 0;
        var streak = calculateStreak(uniqueDates);

        return {
            totalPracticed: totalPracticed,
            averageScore: avgScore,
            totalStudyMinutes: totalMinutes / 60,
            streak: streak
        };
    }

    function sortByDateDesc(records) {
        return ensureArray(records).slice().sort(function (a, b) {
            return new Date(b.date) - new Date(a.date);
        });
    }

    function filterByExamType(records, exams, type) {
        if (!type || type === 'all') {
            return ensureArray(records);
        }
        var targetType = normalizeTypeValue(type);
        var index = ensureArray(exams);
        return ensureArray(records).filter(function (record) {
            if (!record) {
                return false;
            }
            var exam = index.find(function (item) {
                return item && (item.id === record.examId || item.title === record.title);
            });
            var examType = exam ? normalizeTypeValue(exam.type) : '';
            if (examType) {
                return examType === targetType;
            }
            var recordType = normalizeTypeValue(
                record.type ||
                record.examType ||
                (record.metadata && record.metadata.type) ||
                (record.realData && record.realData.type)
            );
            if (recordType) {
                return recordType === targetType;
            }
            // 无法确定类型时保持展示，避免题库切换导致历史记录被过滤掉
            return true;
        });
    }

    var PracticeStats = {
        calculateSummary: calculateSummary,
        sortByDateDesc: sortByDateDesc,
        filterByExamType: filterByExamType
    };

    // --- Practice dashboard view ---
    function PracticeDashboardView(options) {
        options = options || {};
        this.domAdapter = options.domAdapter || domAdapter;
        this.ids = {
            total: options.totalId || 'total-practiced',
            average: options.averageId || 'avg-score',
            duration: options.durationId || 'study-time',
            streak: options.streakId || 'streak-days'
        };
    }

    PracticeDashboardView.prototype.updateSummary = function updateSummary(summary) {
        summary = summary || {};
        this._setText(this.ids.total, typeof summary.totalPracticed === 'number' ? summary.totalPracticed : 0);
        this._setText(this.ids.average, formatPercentage(summary.averageScore));
        this._setText(this.ids.duration, formatMinutes(summary.totalStudyMinutes));
        this._setText(this.ids.streak, typeof summary.streak === 'number' ? summary.streak : 0);
    };

    PracticeDashboardView.prototype._setText = function _setText(id, value) {
        if (!id || typeof document === 'undefined') {
            return;
        }
        var element = document.getElementById(id);
        if (!element) {
            return;
        }
        if (this.domAdapter && typeof this.domAdapter.setText === 'function') {
            this.domAdapter.setText(element, value);
        } else {
            element.textContent = value;
        }
    };

    function formatPercentage(value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return '0.0%';
        }
        return value.toFixed(1) + '%';
    }

    function formatMinutes(minutes) {
        if (typeof minutes !== 'number' || isNaN(minutes)) {
            return '0';
        }
        return Math.round(minutes).toString();
    }

    // --- Practice history renderer ---
    var historyRenderer = { helpers: {} };

    historyRenderer.helpers.getScoreColor = function (percentage) {
        var pct = Number(percentage) || 0;
        if (pct >= 90) return '#10b981';
        if (pct >= 75) return '#f59e0b';
        if (pct >= 60) return '#f97316';
        return '#ef4444';
    };

    historyRenderer.helpers.formatDurationShort = function (seconds) {
        var s = Math.max(0, Math.floor(Number(seconds) || 0));
        if (s < 60) return s + '秒';
        var m = Math.floor(s / 60);
        if (m < 60) return m + '分钟';
        var h = Math.floor(m / 60);
        var mm = m % 60;
        return h + '小时' + mm + '分钟';
    };

    historyRenderer.helpers.getDurationColor = function (seconds) {
        var minutes = (Number(seconds) || 0) / 60;
        if (minutes < 20) return '#10b981';
        if (minutes < 23) return '#f59e0b';
        if (minutes < 26) return '#f97316';
        if (minutes < 30) return '#ef4444';
        return '#dc2626';
    };

    historyRenderer.helpers.createGridLayoutCalculator = function (options) {
        options = options || {};
        var baseHeight = Number(options.itemHeight) || 120;
        var desktopGap = options.desktopGap != null ? Number(options.desktopGap) : 16;
        var mobileGap = options.mobileGap != null ? Number(options.mobileGap) : 12;

        return function (context) {
            context = context || {};
            var items = Array.isArray(context.items) ? context.items : [];
            var container = context.container;
            var containerWidth = container && container.clientWidth ? container.clientWidth : 0;
            var isMobile = false;
            if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
                isMobile = window.innerWidth <= 768;
            }
            if (!isMobile && containerWidth > 0) {
                isMobile = containerWidth <= 768;
            }

            var itemsPerRow = isMobile ? 1 : 2;
            var gap = isMobile ? mobileGap : desktopGap;
            var rowStride = baseHeight + gap;
            var totalRows = itemsPerRow > 0 ? Math.ceil(items.length / itemsPerRow) : 0;
            var totalHeight = totalRows > 0 ? (totalRows * rowStride - gap) : 0;

            return {
                itemsPerRow: itemsPerRow,
                rowHeight: rowStride,
                gap: gap,
                totalRows: totalRows,
                totalHeight: totalHeight,
                positionFor: function (index) {
                    var row = Math.floor(index / itemsPerRow);
                    var col = index % itemsPerRow;
                    var top = row * rowStride;
                    if (itemsPerRow === 1) {
                        return { top: top, left: 0, width: '100%', height: baseHeight };
                    }
                    var halfGap = gap / 2;
                    return {
                        top: top,
                        left: col === 0 ? 0 : 'calc(50% + ' + halfGap + 'px)',
                        width: 'calc(50% - ' + halfGap + 'px)',
                        height: baseHeight
                    };
                }
            };
        };
    };

    function createNode(tag, attributes, children) {
        if (domAdapter && typeof domAdapter.create === 'function') {
            return domAdapter.create(tag, attributes, children);
        }
        var element = document.createElement(tag);
        var attrs = attributes || {};
        Object.keys(attrs).forEach(function (key) {
            var value = attrs[key];
            if (value == null) return;
            if (key === 'className') {
                element.className = value;
                return;
            }
            if (key === 'dataset' && typeof value === 'object') {
                Object.keys(value).forEach(function (dataKey) {
                    var dataValue = value[dataKey];
                    if (dataValue != null) {
                        element.dataset[dataKey] = String(dataValue);
                    }
                });
                return;
            }
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
                return;
            }
            element.setAttribute(key, value === true ? '' : value);
        });

        var list = Array.isArray(children) ? children : [children];
        list.forEach(function (child) {
            if (child == null) return;
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        return element;
    }

    function replaceContent(container, content) {
        if (domAdapter && typeof domAdapter.replaceContent === 'function') {
            domAdapter.replaceContent(container, content);
            return;
        }
        if (!container) return;
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        var nodes = Array.isArray(content) ? content : [content];
        nodes.forEach(function (node) {
            if (!node) return;
            if (typeof node === 'string') {
                container.appendChild(document.createTextNode(node));
            } else if (node instanceof Node) {
                container.appendChild(node);
            }
        });
    }

    historyRenderer.createRecordNode = function (record, options) {
        options = options || {};
        var bulkDeleteMode = Boolean(options.bulkDeleteMode);
        var selectedRecordsInput = options.selectedRecords;
        var selectedRecords = new Set();
        if (selectedRecordsInput && typeof selectedRecordsInput.forEach === 'function') {
            selectedRecordsInput.forEach(function (value) {
                if (value == null) return;
                selectedRecords.add(String(value));
            });
        }
        var helpers = historyRenderer.helpers;
        var durationInSeconds = Number(record && record.duration) || 0;
        var percentage = typeof record.percentage === 'number'
            ? record.percentage
            : Math.round((record.accuracy || 0) * 100);

        var recordId = '';
        if (record && record.id != null) {
            recordId = String(record.id);
        } else if (record && record.sessionId != null) {
            recordId = String(record.sessionId);
        } else if (record && record.realData && record.realData.sessionId != null) {
            recordId = String(record.realData.sessionId);
        } else if (record && record.timestamp != null) {
            recordId = String(record.timestamp);
        } else if (record && record.realData && record.realData.timestamp != null) {
            recordId = String(record.realData.timestamp);
        }

        var item = createNode('div', {
            className: 'history-item history-record-item',
            dataset: { recordId: recordId }
        });

        var isSelected = recordId && selectedRecords.has(recordId);
        var selection = createNode('div', {
            className: 'record-selection' + (bulkDeleteMode ? '' : ' record-selection-hidden')
        }, [
            createNode('input', {
                type: 'checkbox',
                checked: isSelected ? 'checked' : null,
                dataset: { recordId: recordId },
                tabindex: bulkDeleteMode ? '0' : '-1',
                'aria-label': '选择练习记录'
            })
        ]);
        var checkboxNode = selection && selection.querySelector ? selection.querySelector('input[type="checkbox"]') : null;
        if (checkboxNode) {
            checkboxNode.checked = !!isSelected;
            checkboxNode.defaultChecked = !!isSelected;
            checkboxNode.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        }

        if (bulkDeleteMode) {
            item.classList.add('history-item-selectable');
            if (isSelected) {
                item.classList.add('history-item-selected');
            }
        }

        item.appendChild(selection);
        var infoClass = 'record-info' + (bulkDeleteMode ? ' record-info-selectable' : '');
        var info = createNode('div', { className: infoClass }, [
            createNode('a', {
                href: '#',
                className: 'practice-record-title',
                dataset: { recordAction: 'details', recordId: recordId }
            }, [
                createNode('strong', null, record && record.title ? record.title : '无标题')
            ]),
            createNode('div', { className: 'record-meta-line' }, [
                createNode('small', { className: 'record-date' }, record && record.date ? new Date(record.date).toLocaleString() : '未知时间'),
                createNode('small', { className: 'record-duration-value' }, [
                    createNode('strong', null, '用时'),
                    createNode('strong', {
                        className: 'duration-time',
                        style: { color: helpers.getDurationColor(durationInSeconds) }
                    }, helpers.formatDurationShort(durationInSeconds))
                ])
            ])
        ]);

        var percentageNode = createNode('div', { className: 'record-percentage-container' }, [
            createNode('div', {
                className: 'record-percentage',
                style: { color: helpers.getScoreColor(percentage) }
            }, percentage + '%')
        ]);

        var actions = null;
        if (!bulkDeleteMode) {
            actions = createNode('div', { className: 'record-actions-container' }, [
                createNode('button', {
                    type: 'button',
                    className: 'delete-record-btn',
                    title: '删除此记录',
                    dataset: { recordAction: 'delete', recordId: recordId }
                }, '🗑️')
            ]);
        }

        item.appendChild(info);
        item.appendChild(percentageNode);
        if (actions) {
            item.appendChild(actions);
        }
        return item;
    };

    historyRenderer.renderEmptyState = function (container) {
        if (!container) return;
        replaceContent(container, createNode('div', { className: 'practice-history-empty' }, [
            createNode('div', { className: 'practice-history-empty-icon' }, '📂'),
            createNode('p', { className: 'practice-history-empty-text' }, '暂无任何练习记录')
        ]));
    };

    historyRenderer.renderList = function (container, records, options) {
        options = options || {};
        if (!container) return null;
        var list = Array.isArray(records) ? records : [];
        if (list.length === 0) {
            historyRenderer.renderEmptyState(container);
            return null;
        }

        var itemFactory = typeof options.itemFactory === 'function'
            ? options.itemFactory
            : function (record) {
                return historyRenderer.createRecordNode(record, options);
            };

        function measureMaxItemHeight(list) {
            if (!container || !itemFactory || !Array.isArray(list) || list.length === 0) return null;
            var containerWidth = container.clientWidth || container.offsetWidth || 0;
            var isMobile = false;
            if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
                isMobile = window.innerWidth <= 768;
            }
            if (!isMobile && containerWidth > 0) {
                isMobile = containerWidth <= 768;
            }
            var gapPx = isMobile ? 12 : 16;
            var targetWidth = 0;
            if (containerWidth > 0) {
                targetWidth = isMobile ? containerWidth : Math.max(0, (containerWidth - gapPx) / 2);
            }

            var wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.visibility = 'hidden';
            wrapper.style.pointerEvents = 'none';
            wrapper.style.width = '100%';
            container.appendChild(wrapper);

            var maxHeight = 0;
            var samples = Math.min(list.length, 30);
            for (var i = 0; i < samples; i += 1) {
                var node = itemFactory(list[i], i);
                if (!node || !(node instanceof Node)) continue;
                node.style.position = 'relative';
                node.style.width = targetWidth > 0 ? (targetWidth + 'px') : '100%';
                wrapper.appendChild(node);
                var h = node.offsetHeight || node.clientHeight || 0;
                if (h > maxHeight) {
                    maxHeight = h;
                }
                node.remove();
            }
            wrapper.remove();
            return maxHeight > 0 ? maxHeight : null;
        }

        var useVirtualScroller = global.VirtualScroller && options.scrollerOptions !== false;
        if (useVirtualScroller) {
            var scrollerOpts = Object.assign(
                { itemHeight: 120, containerHeight: 650, bufferSize: 4 },
                options.scrollerOptions || {}
            );
            var measuredHeight = measureMaxItemHeight(list);
            if (measuredHeight && measuredHeight > 0) {
                scrollerOpts.itemHeight = measuredHeight + 8; // 留出安全空间避免文字溢出
            }
            scrollerOpts.layoutCalculator = historyRenderer.helpers.createGridLayoutCalculator(scrollerOpts);
            var scrollerFactory = (global.performanceOptimizer && typeof global.performanceOptimizer.createVirtualScroller === 'function')
                ? global.performanceOptimizer.createVirtualScroller.bind(global.performanceOptimizer)
                : function (c, items, renderer, opts) {
                    return new global.VirtualScroller(c, items, renderer, opts);
                };

            if (options.scroller && typeof options.scroller.updateItems === 'function') {
                options.scroller.renderer = itemFactory;
                options.scroller.layoutCalculator = scrollerOpts.layoutCalculator;
                options.scroller.updateItems(list);
                if (typeof options.scroller.recalculate === 'function') {
                    options.scroller.recalculate();
                }
                return options.scroller;
            }
            return scrollerFactory(container, list, itemFactory, scrollerOpts);
        }

        historyRenderer.destroyScroller(options.scroller);

        if (domAdapter && typeof domAdapter.fragment === 'function') {
            domAdapter.replaceContent(container, domAdapter.fragment(list, itemFactory));
        } else {
            replaceContent(container, list.map(itemFactory));
        }
        return null;
    };

    historyRenderer.helpers.getRecordTimestampSafe = function (record) {
        if (!record || typeof record !== 'object') {
            return 0;
        }
        var candidates = [
            record.date, record.endTime, record.timestamp, record.createdAt, record.updatedAt, record.completedAt
        ];
        var rd = record.realData || {};
        candidates.push(rd.date, rd.endTime, rd.timestamp);
        var maxTs = 0;
        for (var i = 0; i < candidates.length; i += 1) {
            var candidate = candidates[i];
            if (candidate == null) continue;
            var parsed = new Date(candidate).getTime();
            if (!isNaN(parsed) && parsed > maxTs) {
                maxTs = parsed;
                continue;
            }
            if (typeof candidate === 'number' && isFinite(candidate) && candidate > maxTs) {
                maxTs = candidate;
            }
        }
        return maxTs;
    };

    historyRenderer.helpers.computeRecordsSignature = function (records) {
        var list = Array.isArray(records) ? records : [];
        var tokens = list.map(function (record, index) {
            var id = record && record.id != null ? record.id : ('idx' + index);
            var ts = historyRenderer.helpers.getRecordTimestampSafe(record);
            var pct = Number(record && record.percentage) || 0;
            var dur = Number(record && record.duration) || 0;
            return id + ':' + ts + ':' + pct + ':' + dur;
        });
        return list.length + '|' + tokens.join(';');
    };

    /**
     * 渲染练习历史列表（简化版，不使用VirtualScroller以支持Grid布局）
     */
    historyRenderer.renderWithState = function (container, records, options) {
        options = options || {};
        if (!container) return null;

        var list = Array.isArray(records) ? records : [];

        if (list.length === 0) {
            historyRenderer.destroyScroller(options.scroller);
            historyRenderer.renderEmptyState(container);
            return null;
        }

        var scrollerOptions = options.scrollerOptions;
        if (scrollerOptions === undefined) {
            scrollerOptions = { itemHeight: 120, containerHeight: 650 };
        }

        return historyRenderer.renderList(container, list, {
            bulkDeleteMode: options.bulkDeleteMode,
            selectedRecords: options.selectedRecords,
            scrollerOptions: scrollerOptions,
            itemFactory: options.itemFactory,
            scroller: options.scroller
        });
    };

    /**
     * 高阶封装：渲染练习历史视图并返回最新 scroller。
     */
    historyRenderer.renderView = function (params) {
        params = params || {};
        var container = params.container;
        if (!container) {
            return { scroller: null };
        }
        var list = Array.isArray(params.records) ? params.records : [];
        var itemFactory = typeof params.itemFactory === 'function'
            ? params.itemFactory
            : function (record) {
                return historyRenderer.createRecordNode(record, {
                    bulkDeleteMode: params.bulkDeleteMode,
                    selectedRecords: params.selectedRecords
                });
            };
        var scroller = historyRenderer.renderWithState(container, list, {
            bulkDeleteMode: params.bulkDeleteMode,
            selectedRecords: params.selectedRecords,
            scrollerOptions: params.scrollerOptions,
            itemFactory: itemFactory,
            scroller: params.scroller
        });
        return { scroller: scroller };
    };

    historyRenderer.destroyScroller = function (scroller) {
        if (!scroller) return;
        if (typeof scroller.destroy === 'function') {
            try {
                scroller.destroy();
            } catch (error) {
                console.warn('[PracticeHistoryRenderer] 销毁虚拟滚动器失败', error);
            }
        }
    };

    // --- Exam list view ---
    var DEFAULT_CONTAINER_ID = 'exam-list-container';
    var DEFAULT_LOADING_SELECTOR = '#browse-view .loading';
    var DEFAULT_BATCH_SIZE = 20;

    function LegacyExamListView(options) {
        options = options || {};
        this.containerId = options.containerId || DEFAULT_CONTAINER_ID;
        this.loadingSelector = options.loadingSelector || DEFAULT_LOADING_SELECTOR;
        this.batchSize = typeof options.batchSize === 'number' && options.batchSize > 0
            ? options.batchSize
            : DEFAULT_BATCH_SIZE;
        this.domAdapter = options.domAdapter || domAdapter;
        this.supportsGenerate = options.supportsGenerate !== false;
    }

    LegacyExamListView.prototype.render = function render(exams, options) {
        options = options || {};
        var container = this._getContainer();
        if (!container) {
            return;
        }

        var loadingSelector = options.loadingSelector || this.loadingSelector;
        var loadingIndicator = this._getLoadingIndicator(loadingSelector);

        var normalizedExams = ensureArray(exams);
        if (normalizedExams.length === 0) {
            this._renderEmptyState(container, options.emptyState);
            this._hideLoading(loadingIndicator);
            return;
        }

        var examList = this._createExamList();
        if (normalizedExams.length > this.batchSize) {
            this._renderBatched(normalizedExams, examList, options);
        } else {
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < normalizedExams.length; i += 1) {
                var element = this._createExamElement(normalizedExams[i], i, options);
                if (element) {
                    fragment.appendChild(element);
                }
            }
            examList.appendChild(fragment);
        }

        this._replaceContent(container, [examList]);
        this._hideLoading(loadingIndicator);
    };

    LegacyExamListView.prototype._createExamList = function _createExamList() {
        return this._createElement('div', { className: 'exam-list' });
    };

    LegacyExamListView.prototype._renderBatched = function _renderBatched(exams, listElement, options) {
        var view = this;
        var index = 0;

        function processBatch() {
            var endIndex = Math.min(index + view.batchSize, exams.length);
            var fragment = document.createDocumentFragment();

            for (var i = index; i < endIndex; i += 1) {
                var element = view._createExamElement(exams[i], i, options);
                if (element) {
                    fragment.appendChild(element);
                }
            }

            listElement.appendChild(fragment);
            index = endIndex;

            if (index < exams.length) {
                requestAnimationFrame(processBatch);
            }
        }

        requestAnimationFrame(processBatch);
    };

    LegacyExamListView.prototype._createExamElement = function _createExamElement(exam, index, options) {
        if (!exam) {
            return null;
        }

        var status = this._getCompletionStatus(exam);
        var selectionMode = options && options.selectionMode ? String(options.selectionMode) : '';
        var draft = options && options.customSuiteDraft ? options.customSuiteDraft : null;
        var categories = draft && Array.isArray(draft.categories) && draft.categories.length
            ? draft.categories
            : ['P1', 'P2', 'P3'];
        var stageIndex = draft && Number.isInteger(draft.stageIndex) ? draft.stageIndex : 0;
        var currentCategory = draft && draft.status !== 'ready' && stageIndex < categories.length
            ? categories[stageIndex]
            : null;
        var examCategory = exam && typeof exam.category === 'string'
            ? exam.category.trim().toUpperCase()
            : '';
        var isSelecting = selectionMode === 'custom-suite' && !!draft && draft.status !== 'ready';
        var isSelected = !!draft && draft.pickedByCategory && examCategory && draft.pickedByCategory[examCategory]
            && String(draft.pickedByCategory[examCategory].examId) === String(exam.id);
        var examItem = this._createElement('div', {
            className: 'exam-item' + (isSelecting ? ' exam-item--suite-selecting' : '') + (isSelected ? ' exam-item--suite-selected' : ''),
            dataset: { examId: exam.id }
        });
        if (isSelecting) {
            examItem.dataset.action = 'suite-custom-select';
            examItem.setAttribute('role', 'button');
            examItem.setAttribute('tabindex', '0');
        }

        var info = this._createElement('div', { className: 'exam-info' });
        var infoContent = this._createElement('div');

        var title = this._createElement('h4');
        if (status) {
            var dot = this._createCompletionDot(status.percentage);
            if (dot) {
                title.appendChild(dot);
            }
        }
        title.appendChild(document.createTextNode(exam.title || ''));

        var meta = this._createElement('div', { className: 'exam-meta' });
        var metaText;
        if (typeof window !== 'undefined' && typeof window.formatExamMetaText === 'function') {
            metaText = window.formatExamMetaText(exam);
        } else {
            var fallbackParts = [];
            if (exam && typeof exam.sequenceNumber === 'number') {
                fallbackParts.push(String(exam.sequenceNumber));
            }
            if (exam && exam.category) {
                fallbackParts.push(exam.category);
            }
            if (exam && exam.type) {
                fallbackParts.push(exam.type);
            }

            // Add frequency text for reading materials
            if (exam && exam.type === 'reading' && exam.frequency) {
                var frequencyLabels = {
                    'ultra-high': '超高频',
                    'very-high': '次高频',
                    'high': '高频',
                    'medium': '中频',
                    'mid': '中频',
                    'low': '低频',
                    'standard': '标准',
                    '超高频': '超高频',
                    '次高频': '次高频',
                    '高频': '高频',
                    '中频': '中频',
                    '低频': '低频'
                };
                var label = frequencyLabels[exam.frequency] || exam.frequency;
                fallbackParts.push(label);
            }
            if (exam && exam.type === 'reading' && typeof exam.difficultyScore === 'number' && isFinite(exam.difficultyScore)) {
                fallbackParts.push('难度 ' + exam.difficultyScore);
            }

            metaText = fallbackParts.join(' | ');
        }
        meta.textContent = metaText;

        infoContent.appendChild(title);
        infoContent.appendChild(meta);
        info.appendChild(infoContent);
        if (isSelecting && currentCategory) {
            info.appendChild(this._createElement('div', { className: 'suite-custom-selection-badge' }, currentCategory + ' Pending'));
        }

        var actions = this._createElement('div', { className: 'exam-actions' });
        var actionConfig = this._resolveActionConfig(exam, options);

        var startBtn = this._createElement('button', {
            className: actionConfig.startClass,
            dataset: { action: actionConfig.startAction, examId: exam.id },
            type: 'button'
        }, actionConfig.startLabel);
        if (isSelecting) {
            startBtn.disabled = true;
            startBtn.setAttribute('aria-disabled', 'true');
        }
        actions.appendChild(startBtn);

        if (actionConfig.includePdfButton) {
            var pdfBtn = this._createElement('button', {
                className: 'btn btn-secondary exam-item-action-btn',
                dataset: { action: 'pdf', examId: exam.id },
                type: 'button',
                title: '查看PDF版本'
            }, '查看PDF');
            if (isSelecting) {
                pdfBtn.disabled = true;
                pdfBtn.setAttribute('aria-disabled', 'true');
            }
            actions.appendChild(pdfBtn);
        }

        if (this._shouldShowGenerate(exam, options)) {
            var generateBtn = this._createElement('button', {
                className: 'btn btn-info exam-item-action-btn',
                dataset: { action: 'generate', examId: exam.id },
                type: 'button',
                title: '为此题目生成HTML版本'
            }, '生成HTML');
            if (isSelecting) {
                generateBtn.disabled = true;
                generateBtn.setAttribute('aria-disabled', 'true');
            }
            actions.appendChild(generateBtn);
        }

        examItem.appendChild(info);
        examItem.appendChild(actions);
        return examItem;
    };

    LegacyExamListView.prototype._resolveActionConfig = function _resolveActionConfig(exam, options) {
        var hasHtml = !!(exam && exam.hasHtml);
        var config = {
            startAction: 'start',
            startLabel: hasHtml ? '开始练习' : '查看PDF',
            startClass: hasHtml ? 'btn exam-item-action-btn' : 'btn btn-secondary exam-item-action-btn',
            includePdfButton: true
        };

        if (options && typeof options.configureStartButton === 'function') {
            try {
                var override = options.configureStartButton(exam, config) || {};
                config = Object.assign({}, config, override);
            } catch (error) {
                console.warn('[LegacyExamListView] 自定义开始按钮配置失败', error);
            }
        }

        return config;
    };

    LegacyExamListView.prototype._shouldShowGenerate = function _shouldShowGenerate(exam, options) {
        if (!this.supportsGenerate) {
            return false;
        }
        if (options && options.supportsGenerate === false) {
            return false;
        }
        if (!exam || exam.hasHtml) {
            return false;
        }

        if (options && typeof options.canGenerate === 'function') {
            try {
                return !!options.canGenerate(exam);
            } catch (error) {
                console.warn('[LegacyExamListView] canGenerate 回调执行失败', error);
                return false;
            }
        }

        if (typeof global.generateHTML === 'function') {
            return true;
        }

        var app = global.app || (global.window && global.window.app);
        return !!(app && typeof app.generateHTMLForPDFExam === 'function');
    };

    LegacyExamListView.prototype._createCompletionDot = function _createCompletionDot(percentage) {
        if (typeof percentage !== 'number') {
            return null;
        }
        var className = 'completion-dot';
        var levelClass = this._getCompletionClass(percentage);
        if (levelClass) {
            className += ' ' + levelClass;
        }
        var dot = this._createElement('span', {
            className: className,
            ariaHidden: 'true'
        });
        dot.title = '最近正确率 ' + Math.round(percentage) + '%';
        return dot;
    };

    LegacyExamListView.prototype._getCompletionClass = function _getCompletionClass(percentage) {
        if (typeof percentage !== 'number') {
            return '';
        }
        if (percentage >= 90) return 'completion-dot--excellent';
        if (percentage >= 75) return 'completion-dot--strong';
        if (percentage >= 60) return 'completion-dot--average';
        return 'completion-dot--weak';
    };

    LegacyExamListView.prototype._renderEmptyState = function _renderEmptyState(container, config) {
        var safeConfig = config || {};
        var icon = safeConfig.icon || '🔍';
        var title = safeConfig.title || '未找到匹配的题目';
        var description = safeConfig.description || '请调整筛选条件或搜索词后再试';
        var actions = Array.isArray(safeConfig.actions) ? safeConfig.actions.slice() : [];

        if (!actions.length && safeConfig.disableDefaultActions !== true) {
            actions.push({
                action: 'load-library',
                label: safeConfig.defaultActionLabel || '📂 加载题库',
                variant: 'primary',
                ariaLabel: safeConfig.defaultActionAriaLabel || '加载题库'
            });
        }

        var children = [
            this._createElement('div', { className: 'exam-list-empty-icon', ariaHidden: 'true' }, icon),
            this._createElement('p', { className: 'exam-list-empty-text' }, title)
        ];

        if (description) {
            children.push(this._createElement('p', { className: 'exam-list-empty-hint' }, description));
        }

        if (actions.length > 0) {
            var actionContainer = this._createElement('div', {
                className: 'exam-list-empty-actions',
                role: 'group',
                ariaLabel: safeConfig.actionGroupLabel || '题库操作'
            });

            for (var i = 0; i < actions.length; i += 1) {
                var action = actions[i];
                if (!action || !action.action || !action.label) {
                    continue;
                }

                var buttonClasses = ['btn', 'exam-list-empty-action'];
                if (action.variant === 'primary') {
                    buttonClasses.push('btn-primary');
                } else if (action.variant === 'secondary') {
                    buttonClasses.push('btn-secondary');
                }

                var button = this._createElement('button', {
                    className: buttonClasses.join(' '),
                    type: 'button',
                    dataset: { action: action.action },
                    ariaLabel: action.ariaLabel || action.label
                }, action.label);

                if (button && action.action === 'load-library') {
                    try {
                        button.addEventListener('click', function handleLoadLibraryClick(event) {
                            if (event && typeof event.preventDefault === 'function') {
                                event.preventDefault();
                            }
                            if (typeof global.loadLibrary === 'function') {
                                try { global.loadLibrary(false); } catch (_) { }
                            } else if (typeof global.showLibraryLoaderModal === 'function') {
                                global.showLibraryLoaderModal();
                            }
                        });
                    } catch (_) { }
                }

                actionContainer.appendChild(button);
            }

            if (actionContainer.childNodes.length > 0) {
                children.push(actionContainer);
            }
        }

        var emptyState = this._createElement('div', {
            className: 'exam-list-empty',
            role: 'status'
        }, children);

        this._replaceContent(container, [emptyState]);
    };

    LegacyExamListView.prototype._replaceContent = function _replaceContent(container, children) {
        if (!container) {
            return;
        }

        if (this.domAdapter && typeof this.domAdapter.replaceContent === 'function') {
            this.domAdapter.replaceContent(container, children);
            return;
        }

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var normalized = Array.isArray(children) ? children : [children];
        for (var i = 0; i < normalized.length; i += 1) {
            if (normalized[i]) {
                container.appendChild(normalized[i]);
            }
        }
    };

    LegacyExamListView.prototype._createElement = function _createElement(tag, attributes, children) {
        if (this.domAdapter && typeof this.domAdapter.create === 'function') {
            return this.domAdapter.create(tag, attributes, children);
        }

        var element = document.createElement(tag);
        var attrs = attributes || {};
        var keys = Object.keys(attrs);
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            var value = attrs[key];
            if (value == null) {
                continue;
            }
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.keys(value).forEach(function (dataKey) {
                    var dataValue = value[dataKey];
                    if (dataValue != null) {
                        element.dataset[dataKey] = String(dataValue);
                    }
                });
            } else if (key === 'style' && typeof value === 'object') {
                Object.keys(value).forEach(function (styleKey) {
                    element.style[styleKey] = value[styleKey];
                });
            } else if (key === 'ariaHidden') {
                element.setAttribute('aria-hidden', value);
            } else if (key === 'ariaLabel') {
                element.setAttribute('aria-label', value);
            } else {
                element.setAttribute(key, value === true ? '' : value);
            }
        }

        if (children != null) {
            var normalizedChildren = Array.isArray(children) ? children : [children];
            for (var c = 0; c < normalizedChildren.length; c += 1) {
                var child = normalizedChildren[c];
                if (child == null) {
                    continue;
                }
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                }
            }
        }

        return element;
    };

    LegacyExamListView.prototype._getContainer = function _getContainer() {
        return typeof document !== 'undefined'
            ? document.getElementById(this.containerId)
            : null;
    };

    LegacyExamListView.prototype._getLoadingIndicator = function _getLoadingIndicator(selector) {
        if (!selector || typeof document === 'undefined') {
            return null;
        }
        try {
            return document.querySelector(selector);
        } catch (_) {
            return null;
        }
    };

    LegacyExamListView.prototype._hideLoading = function _hideLoading(element) {
        if (!element) {
            return;
        }
        if (this.domAdapter && typeof this.domAdapter.hide === 'function') {
            this.domAdapter.hide(element);
        } else {
            element.style.display = 'none';
        }
    };

    LegacyExamListView.prototype._getCompletionStatus = function _getCompletionStatus(exam) {
        var source = (typeof global.getPracticeRecordsState === 'function')
            ? global.getPracticeRecordsState()
            : global.practiceRecords;
        var records = ensureArray(source).filter(function (record) {
            return recordMatchesExam(exam, record);
        });
        if (records.length === 0) {
            return null;
        }
        records.sort(function (a, b) {
            return getRecordTimestamp(b) - getRecordTimestamp(a);
        });
        var latest = records[0] || {};
        return {
            percentage: typeof latest.percentage === 'number' ? latest.percentage : 0,
            date: latest.date || latest.endTime || latest.timestamp || latest.createdAt || null
        };
    };

    // --- Legacy navigation controller ---
    function LegacyNavigationController(options) {
        options = options || {};
        this.options = {
            containerSelector: options.containerSelector || '.main-nav',
            navButtonSelector: options.navButtonSelector || '.nav-btn[data-view]',
            activeClass: options.activeClass || 'active',
            syncOnNavigate: options.syncOnNavigate !== false,
            onNavigate: typeof options.onNavigate === 'function' ? options.onNavigate : null,
            onRepeatNavigate: typeof options.onRepeatNavigate === 'function' ? options.onRepeatNavigate : null
        };
        this.container = options.container || null;
        this._boundClickHandler = this._handleClick.bind(this);
        this._isMounted = false;
    }

    LegacyNavigationController.prototype.updateOptions = function updateOptions(options) {
        if (!options) {
            return;
        }
        this.options = Object.assign({}, this.options, {
            containerSelector: options.containerSelector || this.options.containerSelector,
            navButtonSelector: options.navButtonSelector || this.options.navButtonSelector,
            activeClass: options.activeClass || this.options.activeClass,
            syncOnNavigate: options.syncOnNavigate === undefined ? this.options.syncOnNavigate : options.syncOnNavigate,
            onNavigate: typeof options.onNavigate === 'function' ? options.onNavigate : this.options.onNavigate,
            onRepeatNavigate: typeof options.onRepeatNavigate === 'function' ? options.onRepeatNavigate : this.options.onRepeatNavigate
        });
        if (options.container) {
            this.container = options.container;
        }
    };

    LegacyNavigationController.prototype.mount = function mount(container) {
        if (typeof document === 'undefined') {
            return null;
        }

        var targetContainer = container;
        if (!targetContainer) {
            if (this.container && document.contains(this.container)) {
                targetContainer = this.container;
            } else if (this.options.containerSelector) {
                targetContainer = document.querySelector(this.options.containerSelector);
            }
        }

        if (!targetContainer) {
            this.unmount();
            return null;
        }

        if (this.container && this.container !== targetContainer) {
            this.unmount();
        }

        this.container = targetContainer;
        if (!this._isMounted) {
            this.container.addEventListener('click', this._boundClickHandler);
        }
        this._isMounted = true;
        return this.container;
    };

    LegacyNavigationController.prototype.unmount = function unmount() {
        if (!this.container) {
            return;
        }
        try {
            this.container.removeEventListener('click', this._boundClickHandler);
        } catch (_) { }
        this.container = null;
        this._isMounted = false;
    };

    LegacyNavigationController.prototype.navigate = function navigate(viewName, event) {
        var handler = this.options.onNavigate;
        if (typeof handler === 'function') {
            handler(viewName, event);
            return;
        }

        if (typeof window.showView === 'function') {
            window.showView(viewName);
            return;
        }

        if (window.app && typeof window.app.navigateToView === 'function') {
            window.app.navigateToView(viewName);
        }
    };

    LegacyNavigationController.prototype.syncActive = function syncActive(viewName) {
        if (typeof document === 'undefined') {
            return;
        }
        var selector = this.options.navButtonSelector || '.nav-btn[data-view]';
        var activeClass = this.options.activeClass || 'active';
        var container = this.container || document.querySelector(this.options.containerSelector || '.main-nav');
        if (!container) {
            return;
        }

        var buttons = container.querySelectorAll(selector);
        for (var i = 0; i < buttons.length; i += 1) {
            var button = buttons[i];
            if (!button) {
                continue;
            }
            if (button.classList) {
                button.classList.toggle(activeClass, button.dataset.view === viewName);
            } else if (typeof button.className === 'string') {
                if (button.dataset.view === viewName) {
                    if ((' ' + button.className + ' ').indexOf(' ' + activeClass + ' ') === -1) {
                        button.className += ' ' + activeClass;
                    }
                } else {
                    button.className = button.className.replace(new RegExp('(?:^|\\s)' + activeClass + '(?:$|\\s)', 'g'), ' ').trim();
                }
            }
        }
    };

    LegacyNavigationController.prototype._handleClick = function _handleClick(event) {
        if (!event) {
            return;
        }
        var selector = this.options.navButtonSelector || '.nav-btn[data-view]';
        var target = event.target && event.target.closest ? event.target.closest(selector) : null;
        if (!target || (this.container && !this.container.contains(target))) {
            return;
        }

        var viewName = target.dataset ? target.dataset.view : null;
        if (!viewName) {
            return;
        }

        var activeClass = this.options.activeClass || 'active';
        var alreadyActive = false;
        if (target.classList && target.classList.contains(activeClass)) {
            alreadyActive = true;
        } else if (typeof target.className === 'string') {
            alreadyActive = new RegExp('(?:^|\\s)' + activeClass + '(?:$|\\s)').test(target.className);
        }

        event.preventDefault();
        this.navigate(viewName, event);
        if (alreadyActive && typeof this.options.onRepeatNavigate === 'function') {
            try {
                this.options.onRepeatNavigate(viewName, event);
            } catch (repeatError) {
                console.warn('[LegacyNavigationController] onRepeatNavigate 执行失败', repeatError);
            }
        }
        if (this.options.syncOnNavigate !== false) {
            this.syncActive(viewName);
        }
    };

    var legacyNavigationControllerInstance = null;

    function ensureLegacyNavigationController(options) {
        options = options || {};
        if (!legacyNavigationControllerInstance) {
            legacyNavigationControllerInstance = new LegacyNavigationController(options);
        } else {
            legacyNavigationControllerInstance.updateOptions(options);
        }

        var container = options.container;
        if (!container && options.containerSelector && typeof document !== 'undefined') {
            container = document.querySelector(options.containerSelector);
        }
        legacyNavigationControllerInstance.mount(container);

        if (options.initialView) {
            legacyNavigationControllerInstance.syncActive(options.initialView);
        }

        global.__legacyNavigationController = legacyNavigationControllerInstance;
        return legacyNavigationControllerInstance;
    }

    // --- Library configuration view ---
    function LibraryConfigView(options) {
        options = options || {};
        this.domAdapter = options.domAdapter || domAdapter;
        this.classNames = Object.assign({
            host: 'library-config-list',
            panel: 'library-config-panel',
            header: 'library-config-panel__header',
            title: 'library-config-panel__title',
            badge: 'library-config-panel__badge',
            list: 'library-config-panel__list',
            item: 'library-config-panel__item',
            itemActive: 'library-config-panel__item--active',
            info: 'library-config-panel__info',
            meta: 'library-config-panel__meta',
            actions: 'library-config-panel__actions',
            footer: 'library-config-panel__footer',
            closeButton: 'library-config-panel__close',
            empty: 'library-config-panel__empty',
            emptyIcon: 'library-config-panel__empty-icon',
            emptyHint: 'library-config-panel__empty-hint'
        }, options.classNames || {});
    }

    LibraryConfigView.prototype.mount = function mount(container, configs, options) {
        if (!container) {
            return null;
        }

        var host = this._ensureHost(container);
        var panel = this._renderPanel(ensureArray(configs), options || {});
        this._replaceContent(host, [panel]);
        this._bindActions(host, options || {});
        return host;
    };

    LibraryConfigView.prototype._renderPanel = function _renderPanel(configs, options) {
        var panel = this._createElement('div', {
            className: this.classNames.panel,
            role: 'dialog',
            ariaLabel: '题库配置列表'
        });

        panel.appendChild(this._renderHeader());

        if (!configs.length) {
            panel.appendChild(this._renderEmptyState(options && options.emptyMessage));
        } else {
            panel.appendChild(this._renderList(configs, options));
        }

        panel.appendChild(this._renderFooter());
        return panel;
    };

    LibraryConfigView.prototype._renderHeader = function _renderHeader() {
        var header = this._createElement('div', { className: this.classNames.header });
        header.appendChild(this._createElement('h3', {
            className: this.classNames.title
        }, ['📚', this._createElement('span', null, ' 题库配置列表')]));
        return header;
    };

    LibraryConfigView.prototype._renderEmptyState = function _renderEmptyState(customMessage) {
        var message = typeof customMessage === 'string' && customMessage.trim().length
            ? customMessage
            : '暂无题库配置记录';

        return this._createElement('div', { className: this.classNames.empty }, [
            this._createElement('span', { className: this.classNames.emptyIcon, ariaHidden: 'true' }, '🗂️'),
            this._createElement('p', { className: this.classNames.emptyHint }, message)
        ]);
    };

    LibraryConfigView.prototype._renderList = function _renderList(configs, options) {
        var list = this._createElement('div', {
            className: this.classNames.list,
            role: 'list'
        });

        var activeKey = options && options.activeKey;
        var allowDelete = options && options.allowDelete !== false;

        for (var i = 0; i < configs.length; i += 1) {
            var config = configs[i];
            if (!config) {
                continue;
            }
            list.appendChild(this._renderItem(config, activeKey, allowDelete));
        }
        return list;
    };

    LibraryConfigView.prototype._renderItem = function _renderItem(config, activeKey, allowDelete) {
        var isActive = activeKey === config.key;
        var isDefault = config.key === 'exam_index';
        var className = this.classNames.item + (isActive ? ' ' + this.classNames.itemActive : '');

        var item = this._createElement('div', {
            className: className,
            role: 'listitem'
        });

        var info = this._createElement('div', { className: this.classNames.info });
        var titleChildren = [config.name || config.key || '未命名题库'];
        if (isDefault) {
            titleChildren.push(this._createElement('span', { className: this.classNames.badge }, '默认'));
        }
        if (isActive) {
            titleChildren.push(this._createElement('span', { className: this.classNames.badge }, '当前'));
        }

        info.appendChild(this._createElement('div', null, titleChildren));

        var metaText = this._formatTimestamp(config.timestamp) + ' · ' + (config.examCount || 0) + ' 个题目';
        info.appendChild(this._createElement('div', { className: this.classNames.meta }, metaText));

        var actions = this._createElement('div', { className: this.classNames.actions });
        var switchButton = this._createElement('button', {
            className: 'btn btn-secondary',
            type: 'button',
            dataset: {
                configAction: 'switch',
                configKey: config.key,
                configActive: isActive ? '1' : '0'
            }
        }, '切换');
        if (typeof switchButton.addEventListener === 'function') {
            (function (button, key) {
                button.addEventListener('click', function (event) {
                    if (event && typeof event.preventDefault === 'function') {
                        event.preventDefault();
                    }
                    if (event && typeof event.stopPropagation === 'function') {
                        event.stopPropagation();
                    }
                    if (typeof window.switchLibraryConfig === 'function') {
                        window.switchLibraryConfig(key);
                    }
                });
            })(switchButton, config.key);
        }
        actions.appendChild(switchButton);

        if (!isDefault && allowDelete !== false) {
            var deleteButton = this._createElement('button', {
                className: 'btn btn-warning',
                type: 'button',
                dataset: {
                    configAction: 'delete',
                    configKey: config.key,
                    configActive: isActive ? '1' : '0'
                }
            }, '删除');
            if (typeof deleteButton.addEventListener === 'function') {
                (function (button, key) {
                    button.addEventListener('click', function (event) {
                        if (event && typeof event.preventDefault === 'function') {
                            event.preventDefault();
                        }
                        if (event && typeof event.stopPropagation === 'function') {
                            event.stopPropagation();
                        }
                        if (typeof window.deleteLibraryConfig === 'function') {
                            window.deleteLibraryConfig(key);
                        }
                    });
                })(deleteButton, config.key);
            }
            actions.appendChild(deleteButton);
        }

        item.appendChild(info);
        item.appendChild(actions);
        return item;
    };

    LibraryConfigView.prototype._renderFooter = function _renderFooter() {
        var footer = this._createElement('div', { className: this.classNames.footer });
        footer.appendChild(this._createElement('button', {
            className: 'btn btn-secondary ' + this.classNames.closeButton,
            type: 'button',
            dataset: { configAction: 'close' }
        }, '关闭'));
        return footer;
    };

    LibraryConfigView.prototype._ensureHost = function _ensureHost(container) {
        var host = container.querySelector('.' + this.classNames.host);
        if (!host) {
            host = this._createElement('div', { className: this.classNames.host });
            container.appendChild(host);
        }
        return host;
    };

    LibraryConfigView.prototype._replaceContent = function _replaceContent(container, nodes) {
        if (this.domAdapter && typeof this.domAdapter.replaceContent === 'function') {
            this.domAdapter.replaceContent(container, nodes);
            return;
        }

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var elements = Array.isArray(nodes) ? nodes : [nodes];
        for (var i = 0; i < elements.length; i += 1) {
            var node = elements[i];
            if (node instanceof Node) {
                container.appendChild(node);
            }
        }
    };

    LibraryConfigView.prototype._bindActions = function _bindActions(host, options) {
        if (!host) {
            return;
        }

        if (host._libraryConfigHandler) {
            host.removeEventListener('click', host._libraryConfigHandler);
        }

        var handlers = options && options.handlers ? options.handlers : {};
        var findActionTarget = function (node) {
            var current = node;
            while (current && current !== host) {
                if (current.dataset && current.dataset.configAction) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        };

        var listener = function (event) {
            var target = findActionTarget(event.target);
            if (!target) {
                return;
            }

            var action = target.dataset.configAction;
            if (action === 'close') {
                event.preventDefault();
                host.remove();
                return;
            }

            var handler = handlers[action];
            if (typeof handler === 'function') {
                handler(target.dataset.configKey, event);
            }
        };

        host._libraryConfigHandler = listener;
        host.addEventListener('click', listener);
    };

    LibraryConfigView.prototype._createElement = function _createElement(tag, attributes, children) {
        if (this.domAdapter && typeof this.domAdapter.create === 'function') {
            return this.domAdapter.create(tag, attributes, children);
        }

        var element = document.createElement(tag);
        if (attributes) {
            Object.keys(attributes).forEach(function (key) {
                var value = attributes[key];
                if (value == null || value === false) {
                    return;
                }
                if (key === 'className') {
                    element.className = value;
                    return;
                }
                if (key === 'dataset' && typeof value === 'object') {
                    Object.keys(value).forEach(function (dataKey) {
                        var dataValue = value[dataKey];
                        if (dataValue != null) {
                            element.dataset[dataKey] = String(dataValue);
                        }
                    });
                    return;
                }
                if (key === 'ariaLabel') {
                    element.setAttribute('aria-label', value);
                    return;
                }
                if (key === 'ariaHidden') {
                    element.setAttribute('aria-hidden', value);
                    return;
                }
                if (key === 'disabled') {
                    element.disabled = !!value;
                    return;
                }
                element.setAttribute(key, value === true ? '' : value);
            });
        }

        var nodes = Array.isArray(children) ? children : (children != null ? [children] : []);
        for (var i = 0; i < nodes.length; i += 1) {
            var child = nodes[i];
            if (child == null) {
                continue;
            }
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        }
        return element;
    };

    LibraryConfigView.prototype._formatTimestamp = function _formatTimestamp(timestamp) {
        if (!timestamp) {
            return '未知时间';
        }
        try {
            return new Date(timestamp).toLocaleString();
        } catch (error) {
            return '未知时间';
        }
    };

    global.PracticeStats = PracticeStats;
    global.PracticeDashboardView = PracticeDashboardView;
    global.PracticeHistoryRenderer = historyRenderer;
    global.LegacyExamListView = LegacyExamListView;
    global.LibraryConfigView = LibraryConfigView;
    global.LegacyNavigationController = LegacyNavigationController;
    global.ensureLegacyNavigationController = ensureLegacyNavigationController;
})(window);


// ===== js/app/examActions.js =====
(function (global) {
    'use strict';

   // 配置与常量
   
    const preferredFirstExamByCategory = {
        'P1_reading': { id: 'p1-09', title: 'Listening to the Ocean 海洋探测' },
        'P2_reading': { id: 'p2-high-12', title: 'The fascinating world of attine ants 切叶蚁' },
        'P3_reading': { id: 'p3-high-11', title: 'The Fruit Book 果实之书' },
        'P1_listening': { id: 'listening-p3-01', title: 'Julia and Bob’s science project is due' },
        'P3_listening': { id: 'listening-p3-02', title: 'Climate change and allergies' }
    };

    const FREQUENCY_SORT_RANK = {
        'ultra-high': 5,
        '超高频': 5,
        'very-high': 2,
        '次高频': 2,
        'high': 3,
        '高频': 3,
        'medium': 2,
        'mid': 2,
        '中频': 2,
        'low': 1,
        '低频': 1
    };
    const CUSTOM_SUITE_PANEL_MARGIN = 12;
    let customSuitePortalPosition = null;

    function normalizeExamSignature(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function deduplicateExams(exams) {
        if (!Array.isArray(exams) || exams.length <= 1) {
            return Array.isArray(exams) ? exams : [];
        }
        const seen = new Set();
        const deduped = [];
        exams.forEach((exam) => {
            if (!exam) return;
            const signature = [
                normalizeExamSignature(exam.type),
                normalizeExamSignature(exam.category),
                normalizeExamSignature(exam.title)
            ].join('::');
            if (seen.has(signature)) {
                return;
            }
            seen.add(signature);
            deduped.push(exam);
        });
        return deduped;
    }

    function resolveFrequencyRank(exam) {
        const raw = String(exam && exam.frequency || '').trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(FREQUENCY_SORT_RANK, raw)) {
            return FREQUENCY_SORT_RANK[raw];
        }
        return 0;
    }

    function applyExamSort(exams) {
        const list = Array.isArray(exams) ? exams.slice() : [];
        const mode = String(global.__browseSortMode || 'default').trim().toLowerCase();
        if (mode !== 'frequency-desc') {
            return list;
        }
        return list.sort((a, b) => {
            const rankDiff = resolveFrequencyRank(b) - resolveFrequencyRank(a);
            if (rankDiff !== 0) {
                return rankDiff;
            }
            const categoryA = String(a && a.category || '');
            const categoryB = String(b && b.category || '');
            const categoryDiff = categoryA.localeCompare(categoryB, 'zh-Hans-CN');
            if (categoryDiff !== 0) {
                return categoryDiff;
            }
            return String(a && a.title || '').localeCompare(String(b && b.title || ''), 'zh-Hans-CN');
        });
    }

    function applyBrowsePostFilters(exams) {
        const deduplicated = deduplicateExams(exams);
        return applyExamSort(deduplicated);
    }

    function formatFrequencyLabel(frequency) {
        const raw = String(frequency || '').trim().toLowerCase();
        if (!raw) {
            return '';
        }
        const map = {
            'ultra-high': '超高频',
            'very-high': '次高频',
            'high': '高频',
            'medium': '中频',
            'mid': '中频',
            'low': '低频',
            '超高频': '超高频',
            '次高频': '次高频',
            '高频': '高频',
            '中频': '中频',
            '低频': '低频'
        };
        return map[raw] || String(frequency);
    }

    function formatDifficultyLabel(score) {
        const value = Number(score);
        if (!Number.isFinite(value)) {
            return '';
        }
        return `难度 ${Number.isInteger(value) ? String(value) : String(value)}`;
    }

    global.formatFrequencyLabel = formatFrequencyLabel;
    global.formatDifficultyLabel = formatDifficultyLabel;

    if (typeof global.formatExamMetaText !== 'function') {
        global.formatExamMetaText = function formatExamMetaText(exam) {
            const parts = [];
            if (exam && typeof exam.sequenceNumber === 'number') {
                parts.push(String(exam.sequenceNumber));
            }
            if (exam && exam.category) {
                parts.push(exam.category);
            }
            if (exam && exam.type) {
                parts.push(exam.type);
            }
            if (exam && exam.type === 'reading' && exam.frequency) {
                parts.push(formatFrequencyLabel(exam.frequency));
            }
            if (exam && exam.type === 'reading') {
                const difficultyLabel = formatDifficultyLabel(exam.difficultyScore);
                if (difficultyLabel) {
                    parts.push(difficultyLabel);
                }
            }
            return parts.join(' | ');
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCustomSuiteDraft() {
        if (global.appStateService && typeof global.appStateService.getCustomSuiteDraft === 'function') {
            return global.appStateService.getCustomSuiteDraft();
        }
        if (typeof global.getCustomSuiteDraftState === 'function') {
            return global.getCustomSuiteDraftState();
        }
        return global.customSuiteDraft || null;
    }

    function isCustomSuiteSelectionActive() {
        const draft = getCustomSuiteDraft();
        return !!draft && draft.status && draft.status !== 'idle';
    }

    function getCustomSuiteCategories() {
        return ['P1', 'P2', 'P3'];
    }

    function normalizeExamCategory(exam) {
        return String(exam && exam.category || '').trim().toUpperCase();
    }

    function buildCustomSuiteEntry(exam) {
        if (!exam || typeof exam !== 'object') {
            return null;
        }
        return {
            examId: String(exam.id == null ? '' : exam.id),
            title: exam.title || '',
            category: normalizeExamCategory(exam),
            frequency: exam.frequency || '',
            type: exam.type || 'reading'
        };
    }

    function getCustomSuiteCurrentCategory(draft) {
        const categories = Array.isArray(draft && draft.categories) && draft.categories.length
            ? draft.categories
            : getCustomSuiteCategories();
        const stageIndex = Number.isInteger(draft && draft.stageIndex) ? draft.stageIndex : 0;
        if (!draft || draft.status === 'ready' || stageIndex >= categories.length) {
            return null;
        }
        return categories[Math.max(0, stageIndex)] || null;
    }

    function findExamById(examId) {
        const list = Array.isArray(global.examIndex)
            ? global.examIndex
            : (global.appStateService && typeof global.appStateService.getExamIndex === 'function'
                ? global.appStateService.getExamIndex()
                : []);
        return Array.isArray(list)
            ? list.find((item) => item && String(item.id) === String(examId))
            : null;
    }

    function ensureCustomSuiteSelectionPortal() {
        if (typeof document === 'undefined' || !document.body) {
            return null;
        }
        let portal = document.getElementById('custom-suite-selection-portal');
        if (portal) {
            return portal;
        }
        portal = document.createElement('div');
        portal.id = 'custom-suite-selection-portal';
        portal.className = 'suite-custom-selection-portal';
        document.body.appendChild(portal);
        return portal;
    }

    function clampCustomSuitePanelPosition(x, y, width, height) {
        const viewportWidth = Math.max(
            document.documentElement ? document.documentElement.clientWidth : 0,
            global.innerWidth || 0
        );
        const viewportHeight = Math.max(
            document.documentElement ? document.documentElement.clientHeight : 0,
            global.innerHeight || 0
        );
        const maxX = Math.max(CUSTOM_SUITE_PANEL_MARGIN, viewportWidth - width - CUSTOM_SUITE_PANEL_MARGIN);
        const maxY = Math.max(CUSTOM_SUITE_PANEL_MARGIN, viewportHeight - height - CUSTOM_SUITE_PANEL_MARGIN);
        return {
            x: Math.min(Math.max(CUSTOM_SUITE_PANEL_MARGIN, x), maxX),
            y: Math.min(Math.max(CUSTOM_SUITE_PANEL_MARGIN, y), maxY)
        };
    }

    function applyCustomSuitePanelFloatingState(portal) {
        if (!portal || !customSuitePortalPosition) {
            return;
        }
        const panel = portal.querySelector('.suite-custom-selection__panel');
        if (!panel) {
            return;
        }
        const rect = panel.getBoundingClientRect();
        const width = rect.width || panel.offsetWidth || 380;
        const height = rect.height || panel.offsetHeight || 420;
        const clamped = clampCustomSuitePanelPosition(
            customSuitePortalPosition.x,
            customSuitePortalPosition.y,
            width,
            height
        );
        customSuitePortalPosition = clamped;
        panel.classList.add('suite-custom-selection__panel--floating');
        panel.style.left = clamped.x + 'px';
        panel.style.top = clamped.y + 'px';
        panel.style.right = 'auto';
        panel.style.transform = 'none';
    }

    function setupCustomSuitePanelDrag(portal) {
        if (!portal) {
            return;
        }
        const panel = portal.querySelector('.suite-custom-selection__panel');
        const header = panel ? panel.querySelector('.suite-custom-selection__header') : null;
        if (!panel || !header || panel.dataset.dragEnabled === 'true') {
            return;
        }
        panel.dataset.dragEnabled = 'true';

        let dragging = false;
        let pointerId = null;
        let originX = 0;
        let originY = 0;
        let startX = 0;
        let startY = 0;

        const handlePointerMove = (event) => {
            if (!dragging || pointerId !== event.pointerId) {
                return;
            }
            const rect = panel.getBoundingClientRect();
            const width = rect.width || panel.offsetWidth || 380;
            const height = rect.height || panel.offsetHeight || 420;
            const nextX = originX + (event.clientX - startX);
            const nextY = originY + (event.clientY - startY);
            const clamped = clampCustomSuitePanelPosition(nextX, nextY, width, height);
            customSuitePortalPosition = clamped;
            panel.style.left = clamped.x + 'px';
            panel.style.top = clamped.y + 'px';
            panel.style.right = 'auto';
            panel.style.transform = 'none';
        };

        const stopDragging = (event) => {
            if (!dragging || (event && pointerId !== event.pointerId)) {
                return;
            }
            dragging = false;
            pointerId = null;
            panel.classList.remove('is-dragging');
            try { header.releasePointerCapture(event.pointerId); } catch (_) {}
            global.removeEventListener('pointermove', handlePointerMove);
            global.removeEventListener('pointerup', stopDragging);
            global.removeEventListener('pointercancel', stopDragging);
        };

        header.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }
            if (event.target && event.target.closest && event.target.closest('button,a,input,select,textarea,[data-action]')) {
                return;
            }
            const rect = panel.getBoundingClientRect();
            const width = rect.width || panel.offsetWidth || 380;
            const height = rect.height || panel.offsetHeight || 420;
            const initial = clampCustomSuitePanelPosition(rect.left, rect.top, width, height);

            customSuitePortalPosition = initial;
            panel.classList.add('suite-custom-selection__panel--floating');
            panel.classList.add('is-dragging');
            panel.style.left = initial.x + 'px';
            panel.style.top = initial.y + 'px';
            panel.style.right = 'auto';
            panel.style.transform = 'none';

            dragging = true;
            pointerId = event.pointerId;
            originX = initial.x;
            originY = initial.y;
            startX = event.clientX;
            startY = event.clientY;

            try { header.setPointerCapture(pointerId); } catch (_) {}
            global.addEventListener('pointermove', handlePointerMove);
            global.addEventListener('pointerup', stopDragging);
            global.addEventListener('pointercancel', stopDragging);
            event.preventDefault();
        });
    }

    function hideCustomSuiteSelectionPortal() {
        if (typeof document === 'undefined') {
            return;
        }
        const portal = document.getElementById('custom-suite-selection-portal');
        if (portal && portal.parentNode) {
            portal.parentNode.removeChild(portal);
        }
        customSuitePortalPosition = null;
    }

    function renderCustomSuiteSelectionPortal() {
        const draft = getCustomSuiteDraft();
        if (!draft || draft.status === 'idle') {
            hideCustomSuiteSelectionPortal();
            return;
        }

        const portal = ensureCustomSuiteSelectionPortal();
        if (!portal) {
            return;
        }

        const categories = Array.isArray(draft.categories) && draft.categories.length
            ? draft.categories
            : getCustomSuiteCategories();
        const pickedByCategory = draft.pickedByCategory && typeof draft.pickedByCategory === 'object'
            ? draft.pickedByCategory
            : {};
        const selectedCount = Array.isArray(draft.pickedOrder) ? draft.pickedOrder.length : 0;
        const isReady = draft.status === 'ready' || selectedCount >= categories.length;
        const currentCategory = getCustomSuiteCurrentCategory(draft);
        const selectedRows = categories.map((category) => {
            const entry = pickedByCategory[category];
            if (!entry) {
                return null;
            }
            return {
                category,
                title: entry.title || '未命名题目',
                frequency: entry.frequency || '未知频率'
            };
        }).filter(Boolean);

        const pendingRows = categories
            .filter((category) => !pickedByCategory[category])
            .map((category) => ({
                category,
                title: category === currentCategory ? '请选择当前题型' : '待选中',
                frequency: '待选'
            }));

        const rowMarkup = (row, includeDelete) => {
            const deleteMarkup = includeDelete
                ? '<button type="button" class="suite-custom-selection__delete" data-action="suite-custom-delete" data-category="' + escapeHtml(row.category) + '" aria-label="删除 ' + escapeHtml(row.category) + '">删除</button>'
                : '';
            return [
                '<div class="suite-custom-selection__row' + (includeDelete ? ' suite-custom-selection__row--selected' : ' suite-custom-selection__row--pending') + '">',
                '<div class="suite-custom-selection__row-main">',
                '<span class="suite-custom-selection__title">' + escapeHtml(row.title) + '</span>',
                '<span class="suite-custom-selection__meta">' + escapeHtml(row.category) + '</span>',
                '<span class="suite-custom-selection__meta">' + escapeHtml(row.frequency) + '</span>',
                '</div>',
                deleteMarkup,
                '</div>'
            ].join('');
        };

        const footerButtons = isReady
            ? [
                '<button type="button" class="suite-custom-selection__button suite-custom-selection__button--primary" data-action="suite-custom-confirm">确认开始</button>',
                '<button type="button" class="suite-custom-selection__button suite-custom-selection__button--secondary" data-action="suite-custom-cancel">取消</button>'
            ].join('')
            : '<button type="button" class="suite-custom-selection__button suite-custom-selection__button--secondary" data-action="suite-custom-cancel">取消</button>';

        const selectedMarkup = selectedRows.length
            ? selectedRows.map((row) => rowMarkup(row, true)).join('')
            : '<div class="suite-custom-selection__empty">尚未选择题目</div>';
        const pendingMarkup = pendingRows.length
            ? pendingRows.map((row) => rowMarkup(row, false)).join('')
            : '';

        portal.innerHTML = [
            '<div class="suite-custom-selection__backdrop" aria-hidden="true"></div>',
            '<section class="suite-custom-selection__panel' + (isReady ? ' suite-custom-selection__panel--ready' : ' suite-custom-selection__panel--dock') + '" aria-live="polite">',
            '<header class="suite-custom-selection__header">',
            '<div>',
            '<p class="suite-custom-selection__eyebrow">套题自选</p>', 
            '<h3 class="suite-custom-selection__title-main">' + (isReady ? '确认开始或取消' : '继续选择下一题型') + '</h3>', 
            '</div>',
            '<div class="suite-custom-selection__progress">' + selectedCount + ' / ' + categories.length + '</div>',
            '</header>',
            '<div class="suite-custom-selection__body">',
            '<div class="suite-custom-selection__group">',
            '<div class="suite-custom-selection__group-title">已选</div>', 
            selectedMarkup,
            '</div>',
            '<div class="suite-custom-selection__group">',
            '<div class="suite-custom-selection__group-title">待选</div>',
            pendingMarkup || '<div class="suite-custom-selection__empty">暂无待选项</div>',
            '</div>',
            '</div>',
            '<footer class="suite-custom-selection__footer">',
            footerButtons,
            '</footer>',
            '</section>'
        ].join('');
        setupCustomSuitePanelDrag(portal);
        applyCustomSuitePanelFloatingState(portal);
    }

    function refreshCustomSuiteSelectionPortal() {
        if (isCustomSuiteSelectionActive()) {
            renderCustomSuiteSelectionPortal();
        } else {
            hideCustomSuiteSelectionPortal();
        }
    }

    function handleCustomSuiteSelect(examId) {
        const draft = getCustomSuiteDraft();
        if (!draft || draft.status === 'ready') {
            return false;
        }

        const exam = findExamById(examId);
        if (!exam) {
            return false;
        }

        const currentCategory = getCustomSuiteCurrentCategory(draft);
        const examCategory = normalizeExamCategory(exam);
        if (currentCategory && examCategory && currentCategory !== examCategory) {
            return false;
        }

        const service = global.appStateService;
        let updatedDraft = null;
        if (service && typeof service.selectCustomSuiteExam === 'function') {
            updatedDraft = service.selectCustomSuiteExam(exam, {
                flowMode: draft.flowMode || 'classic',
                frequencyScope: draft.frequencyScope || 'custom'
            });
        } else if (typeof global.selectCustomSuiteExamState === 'function') {
            updatedDraft = global.selectCustomSuiteExamState(exam, {
                flowMode: draft.flowMode || 'classic',
                frequencyScope: draft.frequencyScope || 'custom'
            });
        }

        if (!updatedDraft) {
            return false;
        }

        if (updatedDraft.status === 'ready') {
            renderCustomSuiteSelectionPortal();
            return true;
        }

        const nextCategory = getCustomSuiteCurrentCategory(updatedDraft);
        if (nextCategory && typeof global.browseCategory === 'function') {
            global.browseCategory(nextCategory, 'reading');
        } else {
            renderCustomSuiteSelectionPortal();
        }

        return true;
    }

    function handleCustomSuiteDelete(category) {
        const normalizedCategory = String(category || '').trim().toUpperCase();
        if (!normalizedCategory) {
            return false;
        }

        const service = global.appStateService;
        let updatedDraft = null;
        if (service && typeof service.removeCustomSuiteSelection === 'function') {
            updatedDraft = service.removeCustomSuiteSelection(normalizedCategory);
        } else if (typeof global.removeCustomSuiteSelectionState === 'function') {
            updatedDraft = global.removeCustomSuiteSelectionState(normalizedCategory);
        }

        if (!updatedDraft) {
            return false;
        }

        const nextCategory = getCustomSuiteCurrentCategory(updatedDraft);
        if (nextCategory && typeof global.browseCategory === 'function') {
            global.browseCategory(nextCategory, 'reading');
        } else {
            refreshCustomSuiteSelectionPortal();
        }

        return true;
    }

    function handleCustomSuiteConfirm() {
        if (global.app && typeof global.app.confirmCustomSuiteSelection === 'function') {
            return global.app.confirmCustomSuiteSelection();
        }
        if (typeof global.confirmCustomSuiteSelectionState === 'function') {
            return global.confirmCustomSuiteSelectionState();
        }
        return false;
    }

    function handleCustomSuiteCancel() {
        if (global.app && typeof global.app.cancelCustomSuiteSelection === 'function') {
            return global.app.cancelCustomSuiteSelection();
        }
        if (typeof global.clearCustomSuiteDraftState === 'function') {
            global.clearCustomSuiteDraftState();
        }
        refreshCustomSuiteSelectionPortal();
        if (typeof global.resetBrowseViewToAll === 'function') {
            global.resetBrowseViewToAll();
        }
        return true;
    }

   // 核心功能：加载与渲染
   
    /**
     * 加载并渲染题库列表
     */
    function loadExamList() {
        console.log('[ExamActions] loadExamList called');
        
        // 1. 频率模式委托给 BrowseController
        if (global.__browseFilterMode && global.__browseFilterMode !== 'default' && global.browseController) {
            try {
                if (!global.browseController.buttonContainer) {
                    global.browseController.initialize('type-filter-buttons');
                }
                if (global.browseController.currentMode !== global.__browseFilterMode) {
                    global.browseController.setMode(global.__browseFilterMode);
                } else {
                    const activeFilter = global.browseController.activeFilter || 'all';
                    global.browseController.applyFilter(activeFilter);
                }
                return;
            } catch (error) {
                console.warn('[Browse] 频率模式刷新失败，回退到默认逻辑:', error);
            }
        }

        // 2. 获取题库快照
        let examIndexSnapshot = [];
        if (global.appStateService) {
            examIndexSnapshot = global.appStateService.getExamIndex();
        } else if (typeof global.getExamIndexState === 'function') {
            examIndexSnapshot = global.getExamIndexState();
        } else {
            examIndexSnapshot = Array.isArray(global.examIndex) ? global.examIndex : [];
        }

        let examsToShow = Array.from(examIndexSnapshot);

        // 3. 获取筛选条件
        let activeCategory = 'all';
        let activeExamType = 'all';

        if (global.browseController) {
            activeCategory = global.browseController.getCurrentCategory();
            activeExamType = global.browseController.getCurrentExamType();
        } else {
            // 降级支持
            activeCategory = typeof global.getCurrentCategory === 'function' ? global.getCurrentCategory() : 'all';
            activeExamType = typeof global.getCurrentExamType === 'function' ? global.getCurrentExamType() : 'all';
        }

        // 4. 执行筛选
        // 仅在频率模式下使用 basePath 过滤
        const isFrequencyMode = global.__browseFilterMode && global.__browseFilterMode !== 'default';
        const basePathFilter = isFrequencyMode && (typeof global.__browsePath === 'string' && global.__browsePath.trim())
            ? global.__browsePath.trim()
            : null;

        if (activeExamType !== 'all') {
            examsToShow = examsToShow.filter(exam => exam.type === activeExamType);
        }
        if (activeCategory !== 'all') {
            const filteredByCategory = examsToShow.filter(exam => exam.category === activeCategory);
            // 只有在有筛选结果或不是频率模式时才应用分类过滤
            if (filteredByCategory.length > 0 || !basePathFilter) {
                examsToShow = filteredByCategory;
            }
        }
        // 只有在频率模式下才应用路径过滤
        if (basePathFilter) {
            examsToShow = examsToShow.filter((exam) => {
                return typeof exam?.path === 'string' && exam.path.includes(basePathFilter);
            });
        }

        // 5. 执行置顶逻辑
        if (activeCategory !== 'all' && activeExamType !== 'all') {
            const key = `${activeCategory}_${activeExamType}`;
            const preferred = preferredFirstExamByCategory[key];

            if (preferred) {
                // 优先通过 preferred.id 在过滤后的 examsToShow 中查找
                let preferredIndex = examsToShow.findIndex(exam => exam.id === preferred.id);

                // 如果失败，fallback 到 preferred.title + currentCategory + currentExamType 匹配
                if (preferredIndex === -1) {
                    preferredIndex = examsToShow.findIndex(exam =>
                        exam.title === preferred.title &&
                        exam.category === activeCategory &&
                        exam.type === activeExamType
                    );
                }

                if (preferredIndex > -1) {
                    const [item] = examsToShow.splice(preferredIndex, 1);
                    examsToShow.unshift(item);
                }
            }
        }

        examsToShow = applyBrowsePostFilters(examsToShow);
        const customSuiteDraft = getCustomSuiteDraft();
        const selectionMode = isCustomSuiteSelectionActive() ? 'custom-suite' : '';

        // 6. 更新状态并渲染
        if (global.appStateService) {
            global.appStateService.setFilteredExams(examsToShow);
        } else if (typeof global.setFilteredExamsState === 'function') {
            global.setFilteredExamsState(examsToShow);
        }

        displayExams(examsToShow, {
            selectionMode,
            customSuiteDraft
        });
        refreshCustomSuiteSelectionPortal();

        // 7. 触发渲染后钩子
        if (typeof global.handlePostExamListRender === 'function') {
            global.handlePostExamListRender(examsToShow, { category: activeCategory, type: activeExamType });
        }

        return examsToShow;
    }

    /**
     * 重置浏览视图
     */
    function resetBrowseViewToAll() {
        // 1. 清除频率模式标记（关键修复）
        if (typeof global.__browseFilterMode !== 'undefined') {
            global.__browseFilterMode = 'default';
        }
        if (typeof global.__browsePath !== 'undefined') {
            global.__browsePath = null;
        }

        // 2. 重置 browseController 到默认模式
        if (global.browseController) {
            global.browseController.clearPendingBrowseAutoScroll();

            // 恢复默认模式（消除频率模式）
            if (typeof global.browseController.resetToDefault === 'function') {
                global.browseController.resetToDefault();
            } else {
                // 降级：手动重置
                global.browseController.currentMode = 'default';
                global.browseController.activeFilter = 'all';
            }

            const currentCategory = global.browseController.getCurrentCategory();
            const currentType = global.browseController.getCurrentExamType();

            if (currentCategory === 'all' && currentType === 'all') {
                if (global.setBrowseTitle) global.setBrowseTitle('题库列表');
                loadExamList();
                return;
            }

            global.browseController.setBrowseFilterState('all', 'all');
        } else {
            // 降级
            if (typeof global.clearPendingBrowseAutoScroll === 'function') global.clearPendingBrowseAutoScroll();
            if (typeof global.setBrowseFilterState === 'function') global.setBrowseFilterState('all', 'all');
        }

        if (global.setBrowseTitle) global.setBrowseTitle('题库列表');
        loadExamList();
    }

    /**
     * 渲染题库列表 DOM
     */
    function displayExams(exams, options = {}) {
        // 1. 尝试使用 BrowseController 管理的 examListViewInstance
        let view = null;
        if (global.browseController && typeof global.browseController.getExamListView === 'function') {
            view = global.browseController.getExamListView();
            // 确保 LegacyExamListView 能被创建（初始值为 null）
            if (!view && typeof global.browseController.ensureExamListView === 'function') {
                view = global.browseController.ensureExamListView();
            }
        }

        if (!view && global.BrowseController && typeof global.BrowseController.getExamListView === 'function') {
            view = global.BrowseController.getExamListView();
        }

        if (!view && global.ensureExamListView) {
            view = global.ensureExamListView();
        }

        if (view) {
            view.render(exams, {
                loadingSelector: '#browse-view .loading',
                selectionMode: options.selectionMode || '',
                customSuiteDraft: options.customSuiteDraft || null
            });
            setupExamActionHandlers();
            return;
        }

        // 2. 降级：直接 DOM 操作 (从 main.js 迁移)
        const container = document.getElementById('exam-list-container');
        if (!container) {
            return;
        }

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // 清除 loading 指示器
        const loadingEl = document.querySelector('#browse-view .loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

        const normalizedExams = Array.isArray(exams) ? exams : [];
        if (normalizedExams.length === 0) {
            renderEmptyState(container);
            return;
        }

        const list = document.createElement('div');
        list.className = 'exam-list';

        normalizedExams.forEach((exam) => {
            if (!exam) return;
            const item = createExamCard(exam, options);
            list.appendChild(item);
        });

        container.appendChild(list);
        setupExamActionHandlers();
    }

    /**
     * 渲染空状态
     */
    function renderEmptyState(container) {
        const empty = document.createElement('div');
        empty.className = 'exam-list-empty';
        empty.setAttribute('role', 'status');

        const icon = document.createElement('div');
        icon.className = 'exam-list-empty-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🔍';

        const text = document.createElement('p');
        text.className = 'exam-list-empty-text';
        text.textContent = '未找到匹配的题目';

        const hint = document.createElement('p');
        hint.className = 'exam-list-empty-hint';
        hint.textContent = '请调整筛选条件或搜索词后再试';

        empty.appendChild(icon);
        empty.appendChild(text);
        empty.appendChild(hint);
        container.appendChild(empty);
    }

    /**
     * 创建单个题库卡片
     */
    function createExamCard(exam, options = {}) {
        const selectionMode = options.selectionMode || (isCustomSuiteSelectionActive() ? 'custom-suite' : '');
        const draft = options.customSuiteDraft || getCustomSuiteDraft();
        const currentCategory = getCustomSuiteCurrentCategory(draft);
        const examCategory = normalizeExamCategory(exam);
        const isSelecting = selectionMode === 'custom-suite' && !!draft && draft.status !== 'ready';
        const isSelected = !!draft && draft.pickedByCategory && draft.pickedByCategory[examCategory]
            && String(draft.pickedByCategory[examCategory].examId) === String(exam.id);
        const item = document.createElement('div');
        item.className = 'exam-item'
            + (isSelecting ? ' exam-item--suite-selecting' : '')
            + (isSelected ? ' exam-item--suite-selected' : '');
        if (exam.id) {
            item.dataset.examId = exam.id;
        }
        if (isSelecting) {
            item.dataset.action = 'suite-custom-select';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
        }

        const info = document.createElement('div');
        info.className = 'exam-info';
        const infoContent = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = exam.title || '';
        const meta = document.createElement('div');
        meta.className = 'exam-meta';

        let metaText = '';
        if (typeof global.formatExamMetaText === 'function') {
            metaText = global.formatExamMetaText(exam);
        } else {
            metaText = `${exam.category || ''} | ${exam.type || ''}`;
        }

        meta.textContent = metaText;
        infoContent.appendChild(title);
        infoContent.appendChild(meta);
        info.appendChild(infoContent);

        if (isSelecting && currentCategory) {
            const selectBadge = document.createElement('div');
            selectBadge.className = 'suite-custom-selection-badge';
            selectBadge.textContent = `${currentCategory} 待选`;
            info.appendChild(selectBadge);
        }

        const actions = document.createElement('div');
        actions.className = 'exam-actions';

        const startBtn = document.createElement('button');
        startBtn.className = 'btn exam-item-action-btn';
        startBtn.type = 'button';
        startBtn.dataset.action = 'start';
        if (exam.id) {
            startBtn.dataset.examId = exam.id;
        }
        startBtn.textContent = '开始练习';
        if (isSelecting) {
            startBtn.disabled = true;
            startBtn.setAttribute('aria-disabled', 'true');
        }
        actions.appendChild(startBtn);

        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn btn-outline exam-item-action-btn';
        pdfBtn.type = 'button';
        pdfBtn.dataset.action = 'pdf';
        if (exam.id) {
            pdfBtn.dataset.examId = exam.id;
        }
        pdfBtn.textContent = 'PDF';
        if (isSelecting) {
            pdfBtn.disabled = true;
            pdfBtn.setAttribute('aria-disabled', 'true');
        }
        actions.appendChild(pdfBtn);

        item.appendChild(info);
        item.appendChild(actions);
        return item;
    }

    // ============================================================================
    // 事件处理与工具
    // ============================================================================

    var examActionHandlersConfigured = false;

    function setupExamActionHandlers() {
        if (examActionHandlersConfigured) {
            return;
        }

        var invoke = function (target, event) {
            var action = target.dataset.action;
            var examId = target.dataset.examId;
            var category = target.dataset.category || target.dataset.examCategory || '';

            if (!action) {
                return;
            }

            event.preventDefault();

            if (action === 'suite-custom-select') {
                handleCustomSuiteSelect(examId);
                return;
            }

            if (action === 'suite-custom-delete') {
                handleCustomSuiteDelete(category);
                return;
            }

            if (action === 'suite-custom-confirm') {
                handleCustomSuiteConfirm();
                return;
            }

            if (action === 'suite-custom-cancel') {
                handleCustomSuiteCancel();
                return;
            }

            if (!examId) {
                return;
            }

            if (action === 'start' && typeof global.openExam === 'function') {
                global.openExam(examId);
                return;
            }

            if (action === 'pdf' && typeof global.viewPDF === 'function') {
                global.viewPDF(examId);
                return;
            }

            if (action === 'generate' && typeof global.generateHTML === 'function') {
                global.generateHTML(examId);
            }
        };

        var hasDomDelegate = typeof global !== 'undefined'
            && global.DOM
            && typeof global.DOM.delegate === 'function';

        if (hasDomDelegate) {
            global.DOM.delegate('click', '[data-action="start"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="pdf"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="generate"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="suite-custom-select"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="suite-custom-delete"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="suite-custom-confirm"]', function (event) {
                invoke(this, event);
            });
            global.DOM.delegate('click', '[data-action="suite-custom-cancel"]', function (event) {
                invoke(this, event);
            });
        } else if (typeof document !== 'undefined') {
            document.addEventListener('click', function (event) {
                var target = event.target.closest('[data-action]');
                if (!target) {
                    return;
                }

                var container = document.getElementById('exam-list-container');
                if (container && !container.contains(target) && !document.getElementById('custom-suite-selection-portal')?.contains(target)) {
                    return;
                }

                invoke(target, event);
            });
        }

        examActionHandlersConfigured = true;
        try { console.log('[ExamActions] 考试操作按钮事件委托已设置'); } catch (_) { }
    }
    function ensureBrowseGroupReady() {
        if (typeof global.ensureBrowseGroup === 'function') {
            return global.ensureBrowseGroup();
        }
        if (global.AppEntry && typeof global.AppEntry.ensureBrowseGroup === 'function') {
            return global.AppEntry.ensureBrowseGroup();
        }
        if (global.AppLazyLoader && typeof global.AppLazyLoader.ensureGroup === 'function') {
            return global.AppLazyLoader.ensureGroup('browse-view');
        }
        return Promise.resolve();
    }

    // ============================================================================
    // 导出到全局
    // ============================================================================

    global.ExamActions = {
        loadExamList,
        resetBrowseViewToAll,
        displayExams,
        setupExamActionHandlers,
        deduplicateExams,
        applyExamSort,
        applyBrowsePostFilters
    };

    global.loadExamList = loadExamList;
    global.resetBrowseViewToAll = resetBrowseViewToAll;
    global.displayExams = displayExams;
    global.setupExamActionHandlers = setupExamActionHandlers;

    console.log('[ExamActions] 模块已加载 (Phase 2)');

})(typeof window !== 'undefined' ? window : this);


// ===== js/app/readingLaunchMixin.js =====
(function (global) {
    'use strict';

    const mixin = {
        _isReadingLibraryExam(exam) {
            if (!exam || typeof exam !== 'object') {
                return false;
            }

            const examType = typeof exam.type === 'string'
                ? exam.type.trim().toLowerCase()
                : '';
            if (examType === 'listening') {
                return false;
            }

            const examId = typeof exam.id === 'string'
                ? exam.id.trim().toLowerCase()
                : '';
            if (examId.startsWith('listening-')) {
                return false;
            }

            return true;
        },

        _getUnifiedReadingManifestEntry(exam) {
            if (!this._isReadingLibraryExam(exam) || !exam.id) {
                return null;
            }
            const manifest = (typeof window !== 'undefined' && window.__READING_EXAM_MANIFEST__)
                ? window.__READING_EXAM_MANIFEST__
                : null;
            const manifestEntry = manifest && exam.id ? manifest[exam.id] : null;
            if (!manifestEntry || !(manifestEntry.dataKey || manifestEntry.examId)) {
                return null;
            }
            return manifestEntry;
        },

        _isUnifiedReadingExam(exam) {
            return !!this._getUnifiedReadingManifestEntry(exam);
        },

        _buildUnifiedReadingUrl(exam) {
            const manifestEntry = this._getUnifiedReadingManifestEntry(exam);
            if (!manifestEntry) {
                return '';
            }
            const params = new URLSearchParams();
            if (exam && exam.id) {
                params.set('examId', String(exam.id));
            }
            const resolvedDataKey = manifestEntry.dataKey || manifestEntry.examId || exam?.id;
            if (resolvedDataKey) {
                params.set('dataKey', String(resolvedDataKey));
            }
            const query = params.toString();
            const url = query
                ? `assets/generated/reading-exams/reading-practice-unified.html?${query}`
                : 'assets/generated/reading-exams/reading-practice-unified.html';
            return typeof this._ensureAbsoluteUrl === 'function'
                ? this._ensureAbsoluteUrl(url)
                : url;
        },

        _buildReadingPdfUrl(exam) {
            if (!this._isReadingLibraryExam(exam) || !exam || !exam.pdfFilename) {
                return '';
            }

            const pdfUrl = (typeof window.buildResourcePath === 'function')
                ? window.buildResourcePath(exam, 'pdf')
                : ((exam.path || '').replace(/\\/g, '/').replace(/\/+\//g, '/') + (exam.pdfFilename || ''));

            return typeof this._ensureAbsoluteUrl === 'function'
                ? this._ensureAbsoluteUrl(pdfUrl)
                : pdfUrl;
        },

        resolveReadingLaunchDescriptor(exam) {
            if (!this._isReadingLibraryExam(exam)) {
                return null;
            }

            const manifestEntry = this._getUnifiedReadingManifestEntry(exam);
            if (manifestEntry) {
                return {
                    mode: 'unified_html',
                    examId: exam.id,
                    dataKey: manifestEntry.dataKey || manifestEntry.examId || exam.id,
                    manifestEntry,
                    url: this._buildUnifiedReadingUrl(exam)
                };
            }

            const pdfUrl = this._buildReadingPdfUrl(exam);
            if (!pdfUrl) {
                return null;
            }

            return {
                mode: 'pdf_manual',
                examId: exam.id,
                pdfUrl,
                reviewReason: 'manual_mapping_needed'
            };
        }
    };

    global.ExamSystemAppMixins = global.ExamSystemAppMixins || {};
    global.ExamSystemAppMixins.readingLaunch = mixin;
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/app/listeningLaunchMixin.js =====
(function (global) {
    'use strict';

    const mixin = {
        _isListeningLibraryExam(exam) {
            if (!exam || typeof exam !== 'object') return false;

            const examType = typeof exam.type === 'string'
                ? exam.type.trim().toLowerCase() : '';
            if (examType === 'listening') return true;

            const examId = typeof exam.id === 'string'
                ? exam.id.trim().toLowerCase() : '';
            if (examId.startsWith('listening-')) return true;

            return false;
        },

        _getUnifiedListeningManifestEntry(exam) {
            if (!this._isListeningLibraryExam(exam) || !exam.id) return null;
            const manifest = window.__LISTENING_EXAM_MANIFEST__ || null;
            const manifestEntry = manifest && exam.id ? manifest[exam.id] : null;
            if (!manifestEntry || !(manifestEntry.dataKey || manifestEntry.examId)) return null;
            return manifestEntry;
        },

        _isUnifiedListeningExam(exam) {
            return !!this._getUnifiedListeningManifestEntry(exam);
        },

        _buildUnifiedListeningUrl(exam) {
            const manifestEntry = this._getUnifiedListeningManifestEntry(exam);
            if (!manifestEntry) return '';
            const params = new URLSearchParams();
            if (exam && exam.id) {
                params.set('examId', String(exam.id));
            }
            const resolvedDataKey = manifestEntry.dataKey || manifestEntry.examId || exam?.id;
            if (resolvedDataKey) {
                params.set('dataKey', String(resolvedDataKey));
            }
            const query = params.toString();
            const url = query
                ? `assets/generated/listening-exams/unifiedListeningPage.html?${query}`
                : 'assets/generated/listening-exams/unifiedListeningPage.html';
            return typeof this._ensureAbsoluteUrl === 'function'
                ? this._ensureAbsoluteUrl(url)
                : url;
        },

        resolveListeningLaunchDescriptor(exam) {
            if (!this._isListeningLibraryExam(exam)) return null;

            const manifestEntry = this._getUnifiedListeningManifestEntry(exam);
            if (manifestEntry) {
                return {
                    mode: 'unified_html',
                    examId: exam.id,
                    dataKey: manifestEntry.dataKey || manifestEntry.examId || exam.id,
                    manifestEntry,
                    url: this._buildUnifiedListeningUrl(exam)
                };
            }

            return null;
        }
    };

    global.ExamSystemAppMixins = global.ExamSystemAppMixins || {};
    global.ExamSystemAppMixins.listeningLaunch = mixin;
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/app/examSessionMixin.js =====
(function (global) {
    const MAX_LEGACY_PRACTICE_RECORDS = 1000;
    const isFileProtocol = !!(global && global.location && global.location.protocol === 'file:');
    const PRACTICE_ENHANCER_SCRIPT_PATH = './js/runtime/practice-page-enhancer.js';
    const ANSWER_MATCH_CORE_SCRIPT_PATH = './js/utils/answerMatchCore.js';
    const PRACTICE_ENHANCER_BUILD_ID = '20250105';

    async function getActiveExamIndexSnapshot() {
        const stateGetters = [
            () => (typeof global.getExamIndexState === 'function') ? global.getExamIndexState() : null,
            () => (typeof getExamIndexState === 'function') ? getExamIndexState : null
        ];

        for (const getterFactory of stateGetters) {
            try {
                const getter = getterFactory();
                if (typeof getter === 'function') {
                    const state = getter();
                    if (Array.isArray(state) && state.length) {
                        return state.slice();
                    }
                }
            } catch (_) { }
        }

        let activeKey = 'exam_index';
        try {
            if (typeof global.getActiveLibraryConfigurationKey === 'function') {
                const resolved = await global.getActiveLibraryConfigurationKey();
                if (resolved && typeof resolved === 'string' && resolved.trim()) {
                    activeKey = resolved.trim();
                }
            } else {
                const storedKey = await storage.get('active_exam_index_key', 'exam_index');
                if (storedKey && typeof storedKey === 'string' && storedKey.trim()) {
                    activeKey = storedKey.trim();
                }
            }
        } catch (_) {
            try {
                const storedKey = await storage.get('active_exam_index_key', 'exam_index');
                if (storedKey && typeof storedKey === 'string' && storedKey.trim()) {
                    activeKey = storedKey.trim();
                }
            } catch (_) { }
        }

        let dataset = await storage.get(activeKey, []) || [];
        if ((!Array.isArray(dataset) || dataset.length === 0) && activeKey !== 'exam_index') {
            dataset = await storage.get('exam_index', []) || [];
        }
        if (!Array.isArray(dataset) || dataset.length === 0) {
            if (Array.isArray(global.examIndex) && global.examIndex.length) {
                dataset = global.examIndex.slice();
            } else if (Array.isArray(global.completeExamIndex) && global.completeExamIndex.length) {
                dataset = global.completeExamIndex.slice();
            }
        }
        return Array.isArray(dataset) ? dataset : [];
    }

    async function findExamDefinition(examId) {
        if (!examId) {
            return null;
        }
        const list = await getActiveExamIndexSnapshot();
        const match = list.find(entry => entry && entry.id === examId);
        if (match) {
            return match;
        }

        const fallbacks = [
            Array.isArray(global.examIndex) ? global.examIndex : null,
            Array.isArray(global.completeExamIndex) ? global.completeExamIndex : null,
            Array.isArray(global.listeningExamIndex) ? global.listeningExamIndex : null
        ];
        for (const fallback of fallbacks) {
            if (!Array.isArray(fallback)) continue;
            const found = fallback.find(entry => entry && entry.id === examId);
            if (found) {
                return found;
            }
        }

        return null;
    }

    const mixin = {
        /**
          * 打开指定题目进行练习
          */
        async openExam(examId, options = {}) {
            const examIndex = await getActiveExamIndexSnapshot();
            const list = Array.isArray(examIndex) ? examIndex : (Array.isArray(window.examIndex) ? window.examIndex : []);
            const exam = list.find(e => e.id === examId);
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
         * 构造题目URL
         */
        buildExamUrl(exam) {
            const readingLaunch = typeof this.resolveReadingLaunchDescriptor === 'function'
                ? this.resolveReadingLaunchDescriptor(exam)
                : null;
            const listeningLaunch = !readingLaunch && typeof this.resolveListeningLaunchDescriptor === 'function'
                ? this.resolveListeningLaunchDescriptor(exam)
                : null;
            const activeLaunch = readingLaunch || listeningLaunch;
            if (activeLaunch && activeLaunch.mode === 'unified_html' && activeLaunch.url) {
                return activeLaunch.url;
            }
            if (activeLaunch && activeLaunch.mode === 'pdf_manual' && activeLaunch.pdfUrl) {
                return activeLaunch.pdfUrl;
            }

            // 使用全局的路径构建器以确保阅读/听力路径正确
            if (typeof window.buildResourcePath === 'function') {
                return window.buildResourcePath(exam, 'html');
            }

            // 回退：基于exam对象构造完整的文件路径（可能不含根前缀）
            let examPath = exam.path || '';
            if (!examPath.endsWith('/')) {
                examPath += '/';
            }
            return examPath + exam.filename;
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

        _ensureAbsoluteUrl(rawUrl) {
            if (!rawUrl) {
                return rawUrl;
            }

            try {
                if (typeof rawUrl === 'string' && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
                    return rawUrl;
                }

                if (typeof window !== 'undefined' && window.location) {
                    return new URL(rawUrl, window.location.href).href;
                }

                return new URL(rawUrl, 'http://localhost/').href;
            } catch (error) {
                console.warn('[App] 无法解析题目URL为绝对路径:', error, rawUrl);
                return rawUrl;
            }
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

        _buildExamPlaceholderUrl(exam = null, options = {}) {
            const basePath = 'templates/exam-placeholder.html';
            const params = new URLSearchParams();

            const safeSet = (key, value) => {
                if (value == null) {
                    return;
                }
                const stringValue = String(value).trim();
                if (stringValue) {
                    params.set(key, stringValue);
                }
            };

            if (exam && typeof exam === 'object') {
                safeSet('examId', exam.id);
                safeSet('title', exam.title);
                safeSet('category', exam.category);
            }

            if (options && typeof options === 'object') {
                if (options.sequenceIndex != null && Number.isFinite(options.sequenceIndex)) {
                    params.set('index', String(options.sequenceIndex));
                }
            }

            const query = params.toString();
            const url = query ? `${basePath}?${query}` : basePath;
            return this._ensureAbsoluteUrl(url);
        },

        _shouldUsePlaceholderPage() {
            try {
                if (window.EnvironmentDetector && typeof window.EnvironmentDetector.isInTestEnvironment === 'function') {
                    return window.EnvironmentDetector.isInTestEnvironment();
                }
            } catch (error) {
                console.warn('[App] 无法访问 EnvironmentDetector:', error);
            }
            return false;
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
         * 创建降级记录器
         */
        createFallbackRecorder() {
            return {
                handleRealPracticeData: async (examId, realData) => {
                    try {
                        // 获取题目信息
                        const exam = await findExamDefinition(examId);

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

        // ExamBrowser组件已移除，使用内置的题目列表功能

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

        /**
         * 开始练习会话
         */
        async startPracticeSession(examId) {
            const exam = await findExamDefinition(examId);
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

                const exam = await findExamDefinition(examId);

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
            const examIndex = await getActiveExamIndexSnapshot();
            const list = Array.isArray(examIndex) ? examIndex : [];
            const exam = list.find(e => e.id === examId);

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
            const examIndex = await getActiveExamIndexSnapshot();
            const exam = examIndex.find(e => e.id === examId);

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
            const examIndex = await getActiveExamIndexSnapshot();
            const exam = examIndex.find(e => e.id === examId);

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
         * 显示模态框
         */

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
            const examIndex = await getActiveExamIndexSnapshot();
            const exam = examIndex.find(e => e.id === examId);

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
            const examIndex = await getActiveExamIndexSnapshot();
            const exam = examIndex.find(e => e.id === examId);

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

        // createReturnNavigation 方法已删除

        /**
         * 显示活动会话指示器
         */

        /**
         * 显示活动会话详情
         */
        async showActiveSessionsDetails() {
            const activeSessions = await storage.get('active_sessions', []);
            const examIndex = await getActiveExamIndexSnapshot();

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
                const exam = examIndex.find(e => e.id === session.examId);
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
    };

    global.ExamSystemAppMixins = global.ExamSystemAppMixins || {};
    global.ExamSystemAppMixins.examSession = mixin;
})(typeof window !== "undefined" ? window : globalThis);


// ===== js/app/browseController.js =====
/**
 * Browse Controller - 题库浏览控制器
 * 
 * 职责：
 * 1. 管理浏览模式（默认模式、P1频率模式、P4频率模式）
 * 2. 动态渲染筛选按钮
 * 3. 实现频率筛选逻辑
 * 4. 状态管理和持久化
 */

(function (global) {
    'use strict';

    // ============================================================================
    // 数据结构定义
    // ============================================================================

    /**
     * 浏览模式配置
     * 
     * 设计原则：
     * - 消除特殊情况：P4的"全部"按钮通过配置统一处理
     * - 数据驱动：所有按钮和筛选逻辑由配置决定
     */
    const BROWSE_MODES = {
        // 默认模式：全部/阅读/听力
        'default': {
            id: 'default',
            filters: [
                { id: 'all', label: '全部', type: 'all' },
                { id: 'reading', label: '阅读', type: 'reading' },
                { id: 'listening', label: '听力', type: 'listening' }
            ],
            filterLogic: 'type-based'
        },

        // P1 频率模式：超高频/高频/中频
        'frequency-p1': {
            id: 'frequency-p1',
            basePath: 'assets/listening/100 P1',
            filters: [
                { id: 'ultra-high', label: '超高频', folder: 'P1 超高频（43）' },
                { id: 'high', label: '高频', folder: 'P1 高频（35）' },
                { id: 'medium', label: '中频', folder: 'P1 中频(48)' }
            ],
            filterLogic: 'folder-based',
            folderMap: {
                'ultra-high': ['P1 超高频（43）'],
                'high': ['P1 高频（35）'],
                'medium': ['P1 中频(48)']
            }
        },

        // P4 频率模式：全部/超高频/高频/中频
        'frequency-p4': {
            id: 'frequency-p4',
            basePath: 'assets/listening/100 P4',
            filters: [
                { id: 'all', label: '全部', folder: 'numbered' },
                { id: 'ultra-high', label: '超高频', folder: 'P4 超高频(51)' },
                { id: 'high', label: '高频', folder: 'P4 高频(52)' },
                { id: 'medium', label: '中频', folder: 'P4 中频(64)' }
            ],
            filterLogic: 'folder-based',
            folderMap: {
                'all': ['1-10', '11-20', '21-30', '31-40', '41-50',
                    '51-60', '61-70', '71-80', '81-90', '91-100'],
                'ultra-high': ['P4 超高频(51)'],
                'high': ['P4 高频(52)'],
                'medium': ['P4 中频(64)']
            }
        }
    };

    // ============================================================================
    // BrowseController 类
    // ============================================================================

    class BrowseController {
        constructor() {
            this.currentMode = 'default';
            this.activeFilter = 'all';
            this.buttonContainer = null;
        }

        /**
         * 初始化控制器
         * @param {string} containerId - 按钮容器的DOM ID
         */
        initialize(containerId = 'type-filter-buttons') {
            this.buttonContainer = document.getElementById(containerId);
            if (!this.buttonContainer) {
                console.warn('[BrowseController] 按钮容器未找到:', containerId);
                return false;
            }

            // 从全局状态恢复模式
            this.restoreMode();

            // 渲染初始按钮
            this.renderFilterButtons();

            return true;
        }

        /**
         * 设置浏览模式
         * @param {string} mode - 模式ID (default | frequency-p1 | frequency-p4)
         */
        setMode(mode) {
            if (!BROWSE_MODES[mode]) {
                console.warn('[BrowseController] 无效的模式:', mode);
                return;
            }

            this.currentMode = mode;
            this.activeFilter = 'all'; // 重置为默认筛选

            // 保存到全局状态
            this.saveMode();

            // 重新渲染按钮
            this.renderFilterButtons();

            // 应用筛选
            this.applyFilter(this.activeFilter);
        }

        /**
         * 获取当前模式配置
         * @returns {Object} 模式配置对象
         */
        getCurrentModeConfig() {
            return BROWSE_MODES[this.currentMode] || BROWSE_MODES.default;
        }

        /**
         * 渲染筛选按钮
         */
        renderFilterButtons() {
            if (!this.buttonContainer) {
                return;
            }

            const config = this.getCurrentModeConfig();

            // 清空现有按钮
            this.buttonContainer.innerHTML = '';

            // 确保容器拥有 segmented control 类
            if (!this.buttonContainer.classList.contains('shui-segmented-control')) {
                this.buttonContainer.classList.add('shui-segmented-control');
            }

            // 生成新按钮
            config.filters.forEach(filter => {
                const button = document.createElement('button');
                button.className = 'shui-segmented-btn';
                button.textContent = filter.label;
                button.dataset.filterId = filter.id;

                // 设置激活状态
                if (filter.id === this.activeFilter) {
                    button.classList.add('active');
                }
                button.setAttribute('aria-pressed', filter.id === this.activeFilter ? 'true' : 'false');

                // 绑定点击事件
                button.addEventListener('click', () => {
                    this.handleFilterClick(filter.id);
                });

                this.buttonContainer.appendChild(button);
            });

            // 触发滑块指示器同步
            if (typeof global.updateSegmentedIndicators === 'function') {
                setTimeout(global.updateSegmentedIndicators, 20);
            }
        }

        /**
         * 处理筛选按钮点击
         * @param {string} filterId - 筛选器ID
         */
        handleFilterClick(filterId) {
            this.activeFilter = filterId;

            // 更新按钮激活状态
            this.updateButtonStates();

            // 应用筛选
            this.applyFilter(filterId);
        }

        /**
         * 更新按钮激活状态
         */
        updateButtonStates() {
            if (!this.buttonContainer) {
                return;
            }

            const buttons = this.buttonContainer.querySelectorAll('.shui-segmented-btn');
            buttons.forEach(button => {
                const filterId = button.dataset.filterId;
                if (filterId === this.activeFilter) {
                    button.classList.add('active');
                    button.setAttribute('aria-pressed', 'true');
                } else {
                    button.classList.remove('active');
                    button.setAttribute('aria-pressed', 'false');
                }
            });
        }

        /**
         * 应用筛选
         * @param {string} filterId - 筛选器ID
         */
        applyFilter(filterId) {
            const config = this.getCurrentModeConfig();

            if (config.filterLogic === 'type-based') {
                // 默认模式：按类型筛选
                this.filterByType(filterId);
            } else if (config.filterLogic === 'folder-based') {
                // 频率模式：按文件夹筛选
                this.filterByFolder(filterId);
            }
        }

        /**
         * 按类型筛选（默认模式）
         * @param {string} type - 类型 (all | reading | listening)
         */
        filterByType(type) {
            // 调用全局的 filterByType 函数
            if (typeof global.filterByType === 'function') {
                global.filterByType(type);
            } else {
                console.warn('[BrowseController] filterByType 函数未定义');
            }
        }

        /**
         * 按文件夹筛选（频率模式）
         * @param {string} filterId - 筛选器ID
         */
        filterByFolder(filterId) {
            const config = this.getCurrentModeConfig();
            const basePath = global.__browsePath || config.basePath || null;
            const folders = config.folderMap[filterId];

            // 允许“全部”入口只按 basePath 过滤（frequency-p1 无全量按钮）
            const isAllFilter = filterId === 'all';
            if (!folders && !isAllFilter) {
                console.warn('[BrowseController] 未找到文件夹映射:', filterId);
                return;
            }

            // 获取题库索引
            const examIndex = this.getExamIndex();

            // 筛选题目
            const filtered = examIndex.filter(exam => {
                if (!exam || !exam.path) {
                    return false;
                }

                if (basePath && !exam.path.includes(basePath)) {
                    return false;
                }

                // “全部”仅做 basePath 过滤
                if (isAllFilter) {
                    return true;
                }

                // 检查路径是否包含任一目标文件夹
                return folders.some(folder => {
                    return exam.path.includes(folder);
                });
            });

            // 显示筛选结果
            this.displayFilteredExams(filtered);
        }



        /**
         * 获取题库索引
         * @returns {Array} 题库数组
         */
        getExamIndex() {
            // 优先使用全局状态服务
            if (typeof global.getExamIndexState === 'function') {
                return global.getExamIndexState();
            }

            // 回退到全局变量
            return Array.isArray(global.examIndex) ? global.examIndex : [];
        }

        /**
         * 显示筛选后的题目
         * @param {Array} exams - 题目数组
         */
        displayFilteredExams(exams) {
            // 更新筛选状态
            if (typeof global.setFilteredExamsState === 'function') {
                global.setFilteredExamsState(exams);
            }

            // 显示题目
            if (typeof global.displayExams === 'function') {
                global.displayExams(exams);
            }

            // 处理渲染后逻辑
            if (typeof global.handlePostExamListRender === 'function') {
                const category = global.getCurrentCategory ? global.getCurrentCategory() : 'all';
                const type = global.getCurrentExamType ? global.getCurrentExamType() : 'all';
                global.handlePostExamListRender(exams, { category, type });
            }
        }

        /**
         * 保存模式到全局状态
         */
        saveMode() {
            try {
                global.__browseFilterMode = this.currentMode;
            } catch (error) {
                console.warn('[BrowseController] 保存模式失败:', error);
            }
        }

        /**
         * 从全局状态恢复模式
         */
        restoreMode() {
            try {
                const savedMode = global.__browseFilterMode;
                if (savedMode && BROWSE_MODES[savedMode]) {
                    this.currentMode = savedMode;
                }
            } catch (error) {
                console.warn('[BrowseController] 恢复模式失败:', error);
            }
        }

        /**
         * 重置为默认模式
         */
        resetToDefault() {
            this.setMode('default');
        }

        // ============================================================================
        // Phase 2: 筛选状态管理迁移
        // ============================================================================

        /**
         * 设置浏览筛选状态
         * @param {string} category - 类别 (all, reading, listening)
         * @param {string} type - 类型 (all, reading, listening)
         */
        setBrowseFilterState(category, type) {
            if (global.appStateService) {
                global.appStateService.setBrowseFilter({ category, type });
            }
            this.updateBrowseTitle();
        }

        /**
         * 获取当前类别
         * @returns {string}
         */
        getCurrentCategory() {
            if (global.appStateService) {
                return global.appStateService.getBrowseFilter().category || 'all';
            }
            return 'all';
        }

        /**
         * 获取当前类型
         * @returns {string}
         */
        getCurrentExamType() {
            if (global.appStateService) {
                return global.appStateService.getBrowseFilter().type || 'all';
            }
            return 'all';
        }

        /**
         * 更新浏览标题
         */
        updateBrowseTitle() {
            const titleElement = document.getElementById('browse-title');
            if (!titleElement) return;

            const category = this.getCurrentCategory();
            const mode = this.currentMode;

            let title = '题库列表';

            if (mode === 'frequency-p1') {
                title = 'P1 频率模式';
            } else if (mode === 'frequency-p4') {
                title = 'P4 频率模式';
            } else {
                // 默认模式
                const map = {
                    'all': '全部题目',
                    'reading': '阅读理解',
                    'listening': '听力训练'
                };
                title = map[category] || '题库列表';
            }

            titleElement.textContent = title;
        }

        /**
         * 清除待处理的自动滚动
         */
        clearPendingBrowseAutoScroll() {
            if (typeof global.clearPendingBrowseAutoScroll === 'function'
                && global.clearPendingBrowseAutoScroll !== this.clearPendingBrowseAutoScroll) {
                try {
                    global.clearPendingBrowseAutoScroll();
                    return;
                } catch (error) {
                    console.warn('[BrowseController] 清理自动滚动请求失败:', error);
                }
            }
        }

        /**
         * 应用筛选（统一入口）
         * @param {string} category 
         * @param {string} type 
         * @param {Object} options - 可选参数 { path, filterMode }
         */
        applyBrowseFilter(category, type, options = {}) {
            // 1. 更新状态
            this.setBrowseFilterState(category, type);

            // 2. 处理额外参数（path, filterMode）
            if (options.path) {
                global.__browsePath = options.path;
            }
            if (options.filterMode) {
                global.__browseFilterMode = options.filterMode;
            }

            // 3. 更新标题
            this.updateBrowseTitle();

            // 4. 调用 ExamActions.loadExamList 来执行真正的筛选和渲染
            // 这确保了所有逻辑（包括频率模式、置顶等）都由 ExamActions 统一处理
            if (global.ExamActions && typeof global.ExamActions.loadExamList === 'function') {
                global.ExamActions.loadExamList();
            } else if (typeof global.loadExamList === 'function') {
                global.loadExamList();
            } else {
                console.warn('[BrowseController] 无法加载题库列表: loadExamList 未定义');
            }
        }

        // ============================================================================
        // Phase 2: 全局实例迁移 (examListViewInstance)
        // ============================================================================

        getExamListView() {
            return this._examListViewInstance || null;
        }

        setExamListView(instance) {
            this._examListViewInstance = instance;
            return instance;
        }
    }
    // 导出到全局
    // ============================================================================

    global.BrowseController = BrowseController;
    global.BROWSE_MODES = BROWSE_MODES;

    // 创建全局实例
    global.browseController = new BrowseController();

    console.log('[BrowseController] 模块已加载');

})(window);


// ===== js/presentation/message-center.js =====
(function (global) {
    'use strict';

    const DEFAULT_MAX_MESSAGES = 3;
    const MESSAGE_ICONS = {
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️'
    };

    function ensureContainer(containerId) {
        if (typeof document === 'undefined') {
            return null;
        }
        let node = document.getElementById(containerId);
        if (!node) {
            node = document.createElement('div');
            node.id = containerId;
            node.className = 'message-container';
            document.body.appendChild(node);
        }
        return node;
    }

    function createMessageNode(message, type) {
        const note = document.createElement('div');
        note.className = 'message ' + (type || 'info');
        const icon = document.createElement('strong');
        icon.textContent = MESSAGE_ICONS[type] || MESSAGE_ICONS.info;
        note.appendChild(icon);
        note.appendChild(document.createTextNode(' ' + String(message || '')));
        return note;
    }

    class MessageCenter {
        constructor(options = {}) {
            this.options = Object.assign({
                containerId: 'message-container',
                maxMessages: DEFAULT_MAX_MESSAGES
            }, options || {});
        }

        show(message, type = 'info', duration = 4000) {
            if (typeof document === 'undefined') {
                if (typeof console !== 'undefined') {
                    const logMethod = type === 'error' ? 'error' : 'log';
                    console[logMethod]('[Message:' + type + ']', message);
                }
                return null;
            }

            const container = ensureContainer(this.options.containerId);
            if (!container) {
                return null;
            }

            const note = createMessageNode(message, type);
            container.appendChild(note);

            while (container.children.length > this.options.maxMessages) {
                container.removeChild(container.firstChild);
            }

            const timeout = typeof duration === 'number' && duration > 0 ? duration : 4000;
            window.setTimeout(() => {
                note.classList.add('message-leaving');
                window.setTimeout(() => {
                    if (note.parentNode) {
                        note.parentNode.removeChild(note);
                    }
                }, 320);
            }, timeout);

            return note;
        }
    }

    MessageCenter.getInstance = function getInstance(options = {}) {
        if (!global.__messageCenterInstance) {
            global.__messageCenterInstance = new MessageCenter(options);
        }
        return global.__messageCenterInstance;
    };

    if (!global.MessageCenter) {
        global.MessageCenter = MessageCenter;
    }

    const sharedInstance = MessageCenter.getInstance();

    if (typeof global.getMessageCenter !== 'function') {
        global.getMessageCenter = function getMessageCenter() {
            return sharedInstance;
        };
    }

    global.showMessage = function showMessage(message, type, duration) {
        return sharedInstance.show(message, type, duration);
    };
})(typeof window !== 'undefined' ? window : this);


// ===== js/components/PDFHandler.js =====
/**
 * PDF Handler Component
 * Handles PDF viewing, validation, and management for the IELTS practice system
 */
class PDFHandler {
    constructor() {
        this.pdfViewerUrl = null;
        this.supportedFormats = ['.pdf'];
        this.openWindows = new Map(); // Track opened PDF windows

        // 全局引用，供事件委托使用
        window.pdfHandler = this;

        console.log('[PDFHandler] PDF Handler initialized');
    }

    /**
     * Open PDF in new tab/window
     * @param {string} pdfPath - Path to the PDF file
     * @param {string} examTitle - Title of the exam for window naming
     * @param {Object} options - Additional options for PDF viewing
     * @returns {Window|null} - Reference to opened window or null if failed
     */
    openPDF(pdfPath, examTitle = 'PDF Exam', options = {}) {
        try {
            console.log('[PDFHandler] Opening PDF:', pdfPath);
            
            // Validate PDF path
            if (!this.isValidPDFPath(pdfPath)) {
                throw new Error('Invalid PDF path provided');
            }

            // Prepare window options
            const windowOptions = this.prepareWindowOptions(options);
            
            // Generate unique window name
            const windowName = this.generateWindowName(examTitle);
            
            // Open PDF in new window
            const pdfWindow = window.open(pdfPath, windowName, windowOptions);
            
            if (!pdfWindow) {
                throw new Error('Failed to open PDF window. Please check popup blocker settings.');
            }

            // Track the opened window
            this.trackPDFWindow(pdfPath, pdfWindow, examTitle);
            
            // Set up window event handlers
            this.setupWindowHandlers(pdfWindow, pdfPath);
            
            console.log('[PDFHandler] PDF opened successfully:', examTitle);
            return pdfWindow;
            
        } catch (error) {
            console.error('[PDFHandler] Failed to open PDF:', error);
            this.handlePDFError(error, pdfPath, examTitle);
            return null;
        }
    }

    /**
     * Validate PDF file accessibility
     * @param {string} pdfPath - Path to the PDF file
     * @returns {Promise<boolean>} - True if PDF is accessible
     */
    async validatePDF(pdfPath) {
        try {
            console.log('[PDFHandler] Validating PDF:', pdfPath);
            
            if (!this.isValidPDFPath(pdfPath)) {
                return false;
            }

            // Use HEAD request to check if file exists
            const response = await fetch(pdfPath, { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            const isValid = response.ok && this.isPDFContentType(response);
            
            console.log('[PDFHandler] PDF validation result:', isValid ? 'Valid' : 'Invalid');
            return isValid;
            
        } catch (error) {
            console.error('[PDFHandler] PDF validation failed:', error);
            return false;
        }
    }

    /**
     * Get PDF metadata if available
     * @param {string} pdfPath - Path to the PDF file
     * @returns {Promise<Object|null>} - PDF metadata or null
     */
    async getPDFInfo(pdfPath) {
        try {
            console.log('[PDFHandler] Getting PDF info:', pdfPath);
            
            const response = await fetch(pdfPath, { method: 'HEAD' });
            
            if (!response.ok) {
                return null;
            }

            const info = {
                path: pdfPath,
                size: response.headers.get('content-length'),
                lastModified: response.headers.get('last-modified'),
                contentType: response.headers.get('content-type'),
                isAccessible: true,
                timestamp: new Date().toISOString()
            };

            console.log('[PDFHandler] PDF info retrieved:', info);
            return info;
            
        } catch (error) {
            console.error('[PDFHandler] Failed to get PDF info:', error);
            return {
                path: pdfPath,
                isAccessible: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check if path is a valid PDF path
     * @param {string} path - File path to check
     * @returns {boolean} - True if valid PDF path
     */
    isValidPDFPath(path) {
        if (!path || typeof path !== 'string') {
            return false;
        }

        // Check file extension
        const hasValidExtension = this.supportedFormats.some(ext => 
            path.toLowerCase().endsWith(ext)
        );

        // Basic path validation
        const isValidPath = !path.includes('..') && // Prevent directory traversal
                           !path.startsWith('javascript:') && // Prevent XSS
                           !path.startsWith('data:'); // Prevent data URLs

        return hasValidExtension && isValidPath;
    }

    /**
     * Check if response has PDF content type
     * @param {Response} response - Fetch response object
     * @returns {boolean} - True if PDF content type
     */
    isPDFContentType(response) {
        const contentType = response.headers.get('content-type');
        return contentType && (
            contentType.includes('application/pdf') ||
            contentType.includes('application/x-pdf')
        );
    }

    /**
     * Prepare window options for PDF viewing
     * @param {Object} options - Custom options
     * @returns {string} - Window features string
     */
    prepareWindowOptions(options = {}) {
        const defaultOptions = {
            width: Math.floor(window.screen.availWidth * 0.8),
            height: Math.floor(window.screen.availHeight * 0.9),
            left: Math.floor(window.screen.availWidth * 0.1),
            top: Math.floor(window.screen.availHeight * 0.05),
            scrollbars: 'yes',
            resizable: 'yes',
            status: 'yes',
            toolbar: 'yes', // Allow toolbar for PDF controls
            menubar: 'no',
            location: 'yes' // Show location bar for PDF URL
        };

        const finalOptions = { ...defaultOptions, ...options };

        return Object.entries(finalOptions)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
    }

    /**
     * Generate unique window name for PDF
     * @param {string} examTitle - Exam title
     * @returns {string} - Unique window name
     */
    generateWindowName(examTitle) {
        const cleanTitle = examTitle.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();
        return `pdf_${cleanTitle}_${timestamp}`;
    }

    /**
     * Track opened PDF window
     * @param {string} pdfPath - PDF file path
     * @param {Window} pdfWindow - Window reference
     * @param {string} examTitle - Exam title
     */
    trackPDFWindow(pdfPath, pdfWindow, examTitle) {
        const windowInfo = {
            window: pdfWindow,
            path: pdfPath,
            title: examTitle,
            openedAt: new Date().toISOString(),
            isActive: true
        };

        this.openWindows.set(pdfPath, windowInfo);
        
        // Clean up when window is closed
        const checkClosed = () => {
            if (pdfWindow.closed) {
                this.openWindows.delete(pdfPath);
                console.log('[PDFHandler] PDF window closed:', examTitle);
            } else {
                setTimeout(checkClosed, 1000);
            }
        };
        
        setTimeout(checkClosed, 1000);
    }

    /**
     * Set up event handlers for PDF window
     * @param {Window} pdfWindow - PDF window reference
     * @param {string} pdfPath - PDF file path
     */
    setupWindowHandlers(pdfWindow, pdfPath) {
        try {
            // Handle window load event
            pdfWindow.addEventListener('load', () => {
                console.log('[PDFHandler] PDF loaded successfully');
                this.onPDFLoaded(pdfPath);
            });

            // Handle window error event
            pdfWindow.addEventListener('error', (error) => {
                console.error('[PDFHandler] PDF window error:', error);
                this.onPDFError(pdfPath, error);
            });

        } catch (error) {
            // Cross-origin restrictions may prevent event listener setup
            console.warn('[PDFHandler] Could not set up window event handlers:', error.message);
        }
    }

    /**
     * Handle PDF loading success
     * @param {string} pdfPath - PDF file path
     */
    onPDFLoaded(pdfPath) {
        const windowInfo = this.openWindows.get(pdfPath);
        if (windowInfo) {
            windowInfo.loadedAt = new Date().toISOString();
            windowInfo.status = 'loaded';
        }

        // Dispatch custom event
        document.dispatchEvent(new CustomEvent('pdfLoaded', {
            detail: { path: pdfPath }
        }));
    }

    /**
     * Handle PDF loading error
     * @param {string} pdfPath - PDF file path
     * @param {Error} error - Error object
     */
    onPDFError(pdfPath, error) {
        const windowInfo = this.openWindows.get(pdfPath);
        if (windowInfo) {
            windowInfo.status = 'error';
            windowInfo.error = error.message;
        }

        // Dispatch custom event
        document.dispatchEvent(new CustomEvent('pdfError', {
            detail: { path: pdfPath, error: error.message }
        }));
    }

    /**
     * Handle PDF opening errors
     * @param {Error} error - Error object
     * @param {string} pdfPath - PDF file path
     * @param {string} examTitle - Exam title
     */
    handlePDFError(error, pdfPath, examTitle) {
        let userMessage = 'Failed to open PDF';
        let suggestion = '';

        if (error.message.includes('popup blocker')) {
            userMessage = 'PDF blocked by popup blocker';
            suggestion = 'Please allow popups for this site and try again';
        } else if (error.message.includes('Invalid PDF path')) {
            userMessage = 'Invalid PDF file';
            suggestion = 'The PDF file path is not valid';
        } else {
            userMessage = 'Cannot open PDF';
            suggestion = 'Please check if the file exists and try again';
        }

        // Show user-friendly error message
        if (window.showMessage) {
            window.showMessage(`${userMessage}: ${examTitle}. ${suggestion}`, 'error');
        }

        // Log detailed error for debugging
        console.error('[PDFHandler] Detailed error:', {
            error: error.message,
            path: pdfPath,
            title: examTitle,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get list of currently open PDF windows
     * @returns {Array} - Array of open window information
     */
    getOpenWindows() {
        const openWindows = [];
        
        for (const [path, info] of this.openWindows.entries()) {
            if (!info.window.closed) {
                openWindows.push({
                    path: path,
                    title: info.title,
                    openedAt: info.openedAt,
                    status: info.status || 'open'
                });
            }
        }
        
        return openWindows;
    }

    /**
     * Close all open PDF windows
     */
    closeAllWindows() {
        let closedCount = 0;
        
        for (const [path, info] of this.openWindows.entries()) {
            if (!info.window.closed) {
                try {
                    info.window.close();
                    closedCount++;
                } catch (error) {
                    console.warn('[PDFHandler] Could not close window:', error);
                }
            }
        }
        
        this.openWindows.clear();
        console.log(`[PDFHandler] Closed ${closedCount} PDF windows`);
        
        return closedCount;
    }

    /**
     * Get handler status and statistics
     * @returns {Object} - Handler status information
     */
    getStatus() {
        return {
            isInitialized: true,
            supportedFormats: this.supportedFormats,
            openWindowsCount: this.openWindows.size,
            openWindows: this.getOpenWindows(),
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PDFHandler = PDFHandler;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFHandler;
}

// ===== js/components/SystemDiagnostics.js =====
/**
 * 系统诊断和修复工具
 * 合并了索引验证、通信测试、通信恢复和错误修复功能
 */
class SystemDiagnostics {
    constructor() {
        // 索引验证相关
        this.validationResults = [];
        this.totalChecked = 0;
        this.successCount = 0;
        this.failureCount = 0;

        // 通信测试相关
        this.testResults = [];
        this.activeTests = new Map();

        // 通信恢复相关
        this.activeConnections = new Map();
        this.failedConnections = new Set();
        this.recoveryAttempts = new Map();
        this.maxRecoveryAttempts = 3;
        this.heartbeatInterval = 5000;
        this.recoveryStrategies = new Map();

        // 错误修复相关
        this.fixStrategies = new Map();
        this.fixHistory = [];
        this.brokenExams = [];

        // 初始化
        this.registerDefaultStrategies();
        this.registerRecoveryStrategies();
        this.startHeartbeat();

        console.log('[SystemDiagnostics] 系统诊断工具已初始化');
    }

    // ==================== 索引验证功能 ====================

    /**
     * 验证单个题目文件
     */
    async validateExamFile(exam) {
        const fullPath = exam.path + exam.filename;

        try {
            const response = await fetch(fullPath, { method: 'HEAD' });

            if (response.ok) {
                this.successCount++;
                return {
                    id: exam.id,
                    title: exam.title,
                    path: fullPath,
                    status: 'success',
                    message: '文件存在且可访问'
                };
            } else {
                this.failureCount++;
                return {
                    id: exam.id,
                    title: exam.title,
                    path: fullPath,
                    status: 'error',
                    message: `HTTP ${response.status}: 文件不存在或无法访问`
                };
            }
        } catch (error) {
            this.failureCount++;
            return {
                id: exam.id,
                title: exam.title,
                path: fullPath,
                status: 'error',
                message: `网络错误: ${error.message}`
            };
        }
    }

    /**
     * 验证所有题目
     */
    async validateAllExams(examIndex) {
        console.log('[SystemDiagnostics] 开始验证题目索引...');
        this.validationResults = [];
        this.totalChecked = 0;
        this.successCount = 0;
        this.failureCount = 0;

        const promises = examIndex.map(exam => {
            this.totalChecked++;
            return this.validateExamFile(exam);
        });

        this.validationResults = await Promise.all(promises);
        const report = this.generateValidationReport();
        console.log('[SystemDiagnostics] 验证完成:', report);

        return report;
    }

    /**
     * 生成验证报告
     */
    generateValidationReport() {
        const failedExams = this.validationResults.filter(result => result.status === 'error');

        return {
            summary: {
                total: this.totalChecked,
                success: this.successCount,
                failed: this.failureCount,
                successRate: Math.round((this.successCount / this.totalChecked) * 100)
            },
            failedExams: failedExams,
            allResults: this.validationResults
        };
    }

    // ==================== 通信测试功能 ====================

    /**
     * 测试单个题目的通信功能
     */
    async testExamCommunication(examId, timeout = 10000) {
        const exam = window.examIndex?.find(e => e.id === examId);
        if (!exam) {
            return {
                examId,
                success: false,
                error: '题目不存在于索引中',
                timestamp: Date.now()
            };
        }

        console.log(`[SystemDiagnostics] 开始测试题目通信: ${exam.title}`);

        try {
            const fullPath = exam.path + exam.filename;

            // 打开题目页面
            const examWindow = window.open(fullPath, `comm_test_${examId}`,
                'width=1000,height=700,scrollbars=yes,resizable=yes');

            if (!examWindow) {
                return {
                    examId,
                    examTitle: exam.title,
                    success: false,
                    error: '无法打开题目窗口，请检查弹窗设置',
                    timestamp: Date.now()
                };
            }

            // 等待页面加载
            await this.sleep(3000);

            // 检查窗口是否仍然打开
            if (examWindow.closed) {
                return {
                    examId,
                    examTitle: exam.title,
                    success: false,
                    error: '题目窗口意外关闭',
                    timestamp: Date.now()
                };
            }

            // 发送测试消息
            const testMessage = {
                type: 'COMMUNICATION_TEST',
                data: {
                    testId: Date.now(),
                    examId: examId,
                    timestamp: Date.now()
                }
            };

            examWindow.postMessage(testMessage, '*');

            // 等待响应
            const result = await new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    cleanup();
                    resolve({
                        examId,
                        examTitle: exam.title,
                        success: false,
                        error: '通信测试超时',
                        timestamp: Date.now()
                    });
                }, timeout);

                const messageHandler = (event) => {
                    if (event.data.type === 'COMMUNICATION_TEST_RESPONSE') {
                        clearTimeout(timeoutId);
                        cleanup();
                        resolve({
                            examId,
                            examTitle: exam.title,
                            success: true,
                            responseData: event.data,
                            timestamp: Date.now()
                        });
                    }
                };

                const cleanup = () => {
                    window.removeEventListener('message', messageHandler);
                    if (!examWindow.closed) {
                        examWindow.close();
                    }
                };

                window.addEventListener('message', messageHandler);
            });

            this.testResults.push(result);
            return result;

        } catch (error) {
            const result = {
                examId,
                examTitle: exam.title,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
            this.testResults.push(result);
            return result;
        }
    }

    /**
     * 批量测试通信功能
     */
    async testMultipleExams(examIds, concurrency = 3) {
        console.log(`[SystemDiagnostics] 开始批量测试 ${examIds.length} 个题目的通信功能`);

        const results = [];
        for (let i = 0; i < examIds.length; i += concurrency) {
            const batch = examIds.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(examId => this.testExamCommunication(examId))
            );
            results.push(...batchResults);
        }

        const report = {
            summary: {
                total: results.length,
                success: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                successRate: Math.round((results.filter(r => r.success).length / results.length) * 100)
            },
            details: results,
            timestamp: Date.now()
        };

        console.log('[SystemDiagnostics] 批量通信测试完成:', report.summary);
        return report;
    }

    // ==================== 通信恢复功能 ====================

    /**
     * 注册恢复策略
     */
    registerRecoveryStrategies() {
        this.recoveryStrategies.set('connection_lost', this.recoverConnectionLost.bind(this));
        this.recoveryStrategies.set('message_timeout', this.recoverMessageTimeout.bind(this));
        this.recoveryStrategies.set('window_closed', this.recoverWindowClosed.bind(this));
        this.recoveryStrategies.set('permission_denied', this.recoverPermissionDenied.bind(this));
    }

    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        setInterval(() => {
            this.checkConnections();
        }, this.heartbeatInterval);
    }

    /**
     * 检查连接状态
     */
    checkConnections() {
        this.activeConnections.forEach((connection, examId) => {
            try {
                if (connection.window && connection.window.closed) {
                    this.handleConnectionLost(examId, 'window_closed');
                } else {
                    // 发送心跳消息
                    connection.window.postMessage({
                        type: 'HEARTBEAT',
                        timestamp: Date.now()
                    }, '*');
                }
            } catch (error) {
                this.handleConnectionLost(examId, 'connection_error');
            }
        });
    }

    /**
     * 处理连接丢失
     */
    handleConnectionLost(examId, reason) {
        console.warn(`[SystemDiagnostics] 连接丢失: ${examId}, 原因: ${reason}`);

        this.failedConnections.add(examId);
        const connection = this.activeConnections.get(examId);
        if (connection) {
            this.activeConnections.delete(examId);
        }

        // 尝试恢复
        this.attemptRecovery(examId, reason);
    }

    /**
     * 尝试恢复连接
     */
    async attemptRecovery(examId, reason) {
        const attempts = this.recoveryAttempts.get(examId) || 0;

        if (attempts >= this.maxRecoveryAttempts) {
            console.error(`[SystemDiagnostics] 恢复失败，已达到最大尝试次数: ${examId}`);
            return;
        }

        this.recoveryAttempts.set(examId, attempts + 1);

        const strategy = this.recoveryStrategies.get(reason);
        if (strategy) {
            await strategy(examId);
        } else {
            console.warn(`[SystemDiagnostics] 未找到恢复策略: ${reason}`);
        }
    }

    /**
     * 恢复策略：连接丢失
     */
    async recoverConnectionLost(examId) {
        console.log(`[SystemDiagnostics] 尝试恢复连接: ${examId}`);
        // 重新建立连接的逻辑
    }

    /**
     * 恢复策略：消息超时
     */
    async recoverMessageTimeout(examId) {
        console.log(`[SystemDiagnostics] 恢复消息超时: ${examId}`);
        // 重新发送消息的逻辑
    }

    /**
     * 恢复策略：窗口关闭
     */
    async recoverWindowClosed(examId) {
        console.log(`[SystemDiagnostics] 恢复关闭窗口: ${examId}`);
        // 重新打开窗口的逻辑
    }

    /**
     * 恢复策略：权限拒绝
     */
    async recoverPermissionDenied(examId) {
        console.log(`[SystemDiagnostics] 恢复权限拒绝: ${examId}`);
        // 请求权限或使用替代方案
    }

    // ==================== 错误修复功能 ====================

    /**
     * 注册修复策略
     */
    registerDefaultStrategies() {
        // 索引验证修复策略
        this.registerFixStrategy('file_not_found', this.fixFileNotFound.bind(this));
        this.registerFixStrategy('path_format_error', this.fixPathFormat.bind(this));
        this.registerFixStrategy('filename_mismatch', this.fixFilenameMismatch.bind(this));
        this.registerFixStrategy('missing_field', this.fixMissingField.bind(this));

        // 通信错误修复策略
        this.registerFixStrategy('connection_lost', this.fixConnectionLost.bind(this));
        this.registerFixStrategy('message_timeout', this.fixMessageTimeout.bind(this));
        this.registerFixStrategy('window_blocked', this.fixWindowBlocked.bind(this));
    }

    /**
     * 注册修复策略
     */
    registerFixStrategy(errorType, strategy) {
        this.fixStrategies.set(errorType, strategy);
    }

    /**
     * 修复文件不存在错误
     */
    async fixFileNotFound(exam) {
        console.log(`[SystemDiagnostics] 修复文件不存在: ${exam.title}`);
        // 实现文件路径修复逻辑
        return {
            examId: exam.id,
            fixed: true,
            action: 'updated_path',
            newDetails: { path: exam.path }
        };
    }

    /**
     * 修复路径格式错误
     */
    async fixPathFormat(exam) {
        console.log(`[SystemDiagnostics] 修复路径格式: ${exam.title}`);
        // 实现路径格式修复逻辑
        return {
            examId: exam.id,
            fixed: true,
            action: 'format_corrected'
        };
    }

    /**
     * 修复文件名不匹配
     */
    async fixFilenameMismatch(exam) {
        console.log(`[SystemDiagnostics] 修复文件名不匹配: ${exam.title}`);
        // 实现文件名修复逻辑
        return {
            examId: exam.id,
            fixed: true,
            action: 'filename_corrected'
        };
    }

    /**
     * 修复缺失字段
     */
    async fixMissingField(exam, field) {
        console.log(`[SystemDiagnostics] 修复缺失字段: ${exam.title}, 字段: ${field}`);
        // 实现字段补充逻辑
        return {
            examId: exam.id,
            fixed: true,
            action: 'field_added',
            field: field
        };
    }

    /**
     * 修复连接丢失
     */
    async fixConnectionLost(examId) {
        console.log(`[SystemDiagnostics] 修复连接丢失: ${examId}`);
        return await this.recoverConnectionLost(examId);
    }

    /**
     * 修复消息超时
     */
    async fixMessageTimeout(examId) {
        console.log(`[SystemDiagnostics] 修复消息超时: ${examId}`);
        return await this.recoverMessageTimeout(examId);
    }

    /**
     * 修复窗口被阻止
     */
    async fixWindowBlocked(examId) {
        console.log(`[SystemDiagnostics] 修复窗口被阻止: ${examId}`);
        // 实现替代方案
        return {
            examId: examId,
            fixed: true,
            action: 'alternative_method'
        };
    }

    /**
     * 自动修复检测到的问题
     */
    async autoFixIssues(issues) {
        console.log(`[SystemDiagnostics] 开始自动修复 ${issues.length} 个问题`);

        const results = [];
        for (const issue of issues) {
            const strategy = this.fixStrategies.get(issue.type);
            if (strategy) {
                try {
                    const result = await strategy(issue.exam, issue.details);
                    results.push(result);
                } catch (error) {
                    console.error(`[SystemDiagnostics] 修复失败:`, error);
                    results.push({
                        examId: issue.exam.id,
                        fixed: false,
                        error: error.message
                    });
                }
            } else {
                console.warn(`[SystemDiagnostics] 未找到修复策略: ${issue.type}`);
                results.push({
                    examId: issue.exam.id,
                    fixed: false,
                    error: `未找到修复策略: ${issue.type}`
                });
            }
        }

        console.log(`[SystemDiagnostics] 修复完成，成功: ${results.filter(r => r.fixed).length}/${results.length}`);
        return results;
    }

    // ==================== 综合诊断功能 ====================

    /**
     * 执行完整的系统诊断
     */
    async fullSystemDiagnostics() {
        console.log('[SystemDiagnostics] 开始完整系统诊断...');

        const examIndex = window.examIndex || [];
        const diagnosticReport = {
            timestamp: Date.now(),
            indexValidation: null,
            communicationTest: null,
            issues: [],
            recommendations: []
        };

        // 1. 索引验证
        if (examIndex.length > 0) {
            try {
                diagnosticReport.indexValidation = await this.validateAllExams(examIndex);

                // 如果有失败的题目，进行通信测试
                if (diagnosticReport.indexValidation.failedExams.length > 0) {
                    const failedExamIds = diagnosticReport.indexValidation.failedExams.map(exam => exam.id);
                    diagnosticReport.communicationTest = await this.testMultipleExams(failedExamIds.slice(0, 5)); // 限制测试数量
                }
            } catch (error) {
                console.error('[SystemDiagnostics] 索引验证失败:', error);
                diagnosticReport.issues.push({
                    type: 'validation_error',
                    message: `索引验证失败: ${error.message}`
                });
            }
        }

        // 2. 生成问题分析和建议
        diagnosticReport.issues = this.analyzeIssues(diagnosticReport);
        diagnosticReport.recommendations = this.generateRecommendations(diagnosticReport);

        console.log('[SystemDiagnostics] 系统诊断完成');
        return diagnosticReport;
    }

    /**
     * 分析问题
     */
    analyzeIssues(report) {
        const issues = [];

        if (report.indexValidation) {
            const { summary } = report.indexValidation;
            if (summary.failed > 0) {
                if (summary.successRate < 50) {
                    issues.push({
                        type: 'critical',
                        message: `超过50%的题目文件无法访问，成功率仅${summary.successRate}%`
                    });
                } else if (summary.successRate < 80) {
                    issues.push({
                        type: 'warning',
                        message: `部分题目文件无法访问，成功率为${summary.successRate}%`
                    });
                }
            }
        }

        if (report.communicationTest) {
            const { summary } = report.communicationTest;
            if (summary.failed > 0) {
                issues.push({
                    type: 'communication_error',
                    message: `${summary.failed}个题目通信测试失败`
                });
            }
        }

        return issues;
    }

    /**
     * 生成建议
     */
    generateRecommendations(report) {
        const recommendations = [];

        if (report.indexValidation && report.indexValidation.failedExams.length > 0) {
            recommendations.push({
                type: 'file_check',
                message: '检查题目文件路径和文件是否存在',
                action: 'verify_file_paths'
            });

            if (report.communicationTest && report.communicationTest.summary.failed > 0) {
                recommendations.push({
                    type: 'communication_config',
                    message: '检查浏览器弹窗设置和跨窗口通信配置',
                    action: 'check_browser_settings'
                });
            }
        }

        return recommendations;
    }

    // ==================== 工具方法 ====================

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 生成诊断报告HTML
     */
    generateReportHTML(report) {
        return `
            <div class="system-diagnostics-report">
                <h3>系统诊断报告</h3>
                <p><strong>诊断时间:</strong> ${new Date(report.timestamp).toLocaleString()}</p>

                ${report.indexValidation ? `
                <div class="validation-results">
                    <h4>索引验证结果</h4>
                    <p>总计: ${report.indexValidation.summary.total} |
                       成功: ${report.indexValidation.summary.success} |
                       失败: ${report.indexValidation.summary.failed} |
                       成功率: ${report.indexValidation.summary.successRate}%</p>
                </div>
                ` : ''}

                ${report.issues.length > 0 ? `
                <div class="issues">
                    <h4>发现的问题</h4>
                    <ul>
                        ${report.issues.map(issue => `<li class="issue-${issue.type}">${issue.message}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${report.recommendations.length > 0 ? `
                <div class="recommendations">
                    <h4>建议</h4>
                    <ul>
                        ${report.recommendations.map(rec => `<li>${rec.message}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 销毁诊断工具
     */
    destroy() {
        // 清理活动连接
        this.activeConnections.forEach((connection) => {
            if (connection.window && !connection.window.closed) {
                connection.window.close();
            }
        });

        // 清理数据
        this.activeConnections.clear();
        this.failedConnections.clear();
        this.recoveryAttempts.clear();
        this.testResults = [];
        this.validationResults = [];
        this.fixHistory = [];

        console.log('[SystemDiagnostics] 系统诊断工具已销毁');
    }
}

// 导出到全局
window.SystemDiagnostics = SystemDiagnostics;

// ===== js/components/PerformanceOptimizer.js =====
/**
 * 虚拟滚动器组件
 * 用于处理大量数据的高性能渲染
 */
class VirtualScroller {
    constructor(container, items, renderer, options = {}) {
        this.container = container;
        this.items = items;
        this.renderer = renderer;
        this.itemHeight = options.itemHeight || 120;
        this.baseItemHeight = this.itemHeight;
        this.bufferSize = options.bufferSize || 5;
        this.containerHeight = options.containerHeight || this.getContainerHeight();
        this.layoutCalculator = typeof options.layoutCalculator === 'function' ? options.layoutCalculator : null;

        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.renderedItems = new Map();
        this.scrollTop = 0;
        this.totalHeight = 0;
        this.itemsPerRow = 1;
        this.layoutMetrics = null;
        this.gap = 0;

        this.handleResize = this.recalculateLayout.bind(this);

        this.initialize();
    }
    
    /**
     * 初始化虚拟滚动器
     */
    initialize() {
        console.log('[VirtualScroller] 初始化虚拟滚动器', {
            items: this.items.length,
            itemHeight: this.itemHeight,
            containerHeight: this.containerHeight
        });
        
        this.setupScrollContainer();
        this.calculateVisibleRange();
        this.renderVisible();
        this.setupScrollListener();
    }
    
    /**
     * 设置滚动容器
     */
    setupScrollContainer() {
        this.updateLayoutMetrics();

        // 计算总高度
        this.totalHeight = this.getTotalHeight();

        // 设置容器样式
        this.container.style.display = 'block';
        this.container.style.gridTemplateColumns = 'none';
        this.container.style.gap = '0px';
        this.container.style.position = 'relative';
        this.container.style.overflowY = 'auto';
        this.container.style.overflowX = 'hidden';
        this.container.style.height = `${this.containerHeight}px`;

        // 创建虚拟内容区域
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.height = `${this.totalHeight}px`;
        this.viewport.style.width = '100%';

        // 清空容器并添加视窗
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);
    }
    
    /**
     * 计算可见范围
     */
    calculateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const metrics = this.layoutMetrics;
        const rowHeight = metrics && metrics.rowHeight ? metrics.rowHeight : this.itemHeight;
        const itemsPerRow = metrics && metrics.itemsPerRow ? metrics.itemsPerRow : 1;
        const totalRows = metrics && metrics.totalRows ? metrics.totalRows : Math.ceil(this.items.length / itemsPerRow);
        const visibleRows = Math.ceil(this.containerHeight / rowHeight);
        const bufferRows = this.bufferSize;

        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
        const endRow = Math.min(totalRows - 1, startRow + visibleRows + bufferRows * 2);

        this.visibleStart = Math.max(0, startRow * itemsPerRow);
        this.visibleEnd = Math.min(this.items.length - 1, ((endRow + 1) * itemsPerRow) - 1);

        this.scrollTop = scrollTop;
    }
    
    /**
     * 渲染可见元素
     */
    renderVisible() {
        const applyPosition = (element, index) => {
            const position = this.getItemPosition(index);
            element.style.position = 'absolute';
            const topValue = position.top != null ? position.top : (index * this.itemHeight);
            if (typeof topValue === 'number') {
                element.style.top = `${topValue}px`;
            } else if (typeof topValue === 'string') {
                element.style.top = topValue;
            } else {
                element.style.top = `${index * this.itemHeight}px`;
            }
            const leftValue = position.left != null ? position.left : 0;
            if (typeof leftValue === 'number') {
                element.style.left = `${leftValue}px`;
            } else if (typeof leftValue === 'string') {
                element.style.left = leftValue;
            } else {
                element.style.left = '0px';
            }
            const widthValue = position.width !== undefined ? position.width : '100%';
            element.style.width = typeof widthValue === 'number' ? `${widthValue}px` : widthValue;
            if (position.height) {
                element.style.height = typeof position.height === 'number' ? `${position.height}px` : position.height;
            }
            element.style.boxSizing = 'border-box';
        };

        // 清理不可见的元素
        this.renderedItems.forEach((element, index) => {
            if (index < this.visibleStart || index > this.visibleEnd) {
                element.remove();
                this.renderedItems.delete(index);
            }
        });
        
        // 渲染可见的元素
        for (let i = this.visibleStart; i <= this.visibleEnd; i++) {
            let element = this.renderedItems.get(i);
            if (!element) {
                element = this.renderer(this.items[i], i);
                this.renderedItems.set(i, element);
            }
            applyPosition(element, i);
            if (!element.parentNode) {
                this.viewport.appendChild(element);
            }
        }
    }
    
    /**
     * 设置滚动监听器
     */
    setupScrollListener() {
        let scrollTimer = null;

        const onScroll = () => {
            // 使用防抖优化滚动性能
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }

            scrollTimer = setTimeout(() => {
                this.calculateVisibleRange();
                this.renderVisible();
            }, 10);
        };

        this.handleScroll = onScroll;
        this.container.addEventListener('scroll', onScroll, { passive: true });

        window.addEventListener('resize', this.handleResize, { passive: true });
    }

    /**
     * 更新数据
     */
    updateItems(newItems) {
        this.items = newItems;
        this.updateLayoutMetrics();
        this.totalHeight = this.getTotalHeight();
        this.viewport.style.height = `${this.totalHeight}px`;

        // 清除所有渲染的元素
        this.renderedItems.forEach(element => element.remove());
        this.renderedItems.clear();

        // 重新计算并渲染
        this.calculateVisibleRange();
        this.renderVisible();
    }

    /**
     * 重新计算布局
     */
    recalculateLayout() {
        this.updateLayoutMetrics();
        this.totalHeight = this.getTotalHeight();
        if (this.viewport) {
            this.viewport.style.height = `${this.totalHeight}px`;
        }
        this.calculateVisibleRange();
        this.renderVisible();
    }

    /**
     * 对外暴露的重新计算方法
     */
    recalculate() {
        this.recalculateLayout();
    }
    
    /**
     * 滚动到指定索引
     */
    scrollToIndex(index) {
        const targetScrollTop = index * this.itemHeight;
        this.container.scrollTop = targetScrollTop;
    }
    
    /**
     * 获取容器高度
     */
    getContainerHeight() {
        const computedStyle = window.getComputedStyle(this.container);
        const height = parseFloat(computedStyle.height);
        return height > 0 ? height : 600; // 默认600px
    }
    
    /**
     * 销毁虚拟滚动器
     */
    destroy() {
        console.log('[VirtualScroller] 销毁虚拟滚动器');

        // 清除所有渲染的元素
        this.renderedItems.forEach(element => element.remove());
        this.renderedItems.clear();

        // 移除滚动监听器
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);

        // 清空容器
        this.container.innerHTML = '';
    }

    /**
     * 计算元素位置
     */
    getItemPosition(index) {
        if (this.layoutMetrics && typeof this.layoutMetrics.positionFor === 'function') {
            const position = this.layoutMetrics.positionFor(index) || {};
            const normalizeAxis = (value) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'number' && !isNaN(value)) return value;
                if (typeof value === 'string' && value.trim() !== '') return value;
                return null;
            };
            return {
                top: normalizeAxis(position.top),
                left: normalizeAxis(position.left),
                width: position.width !== undefined ? position.width : '100%',
                height: position.height !== undefined ? position.height : null
            };
        }
        return {
            top: index * this.itemHeight,
            left: 0,
            width: '100%',
            height: null
        };
    }

    updateLayoutMetrics() {
        if (!this.layoutCalculator) {
            this.layoutMetrics = null;
            this.itemsPerRow = 1;
            return;
        }

        try {
            const metrics = this.layoutCalculator({
                container: this.container,
                items: this.items.slice()
            }) || {};
            if (metrics && typeof metrics === 'object') {
                if (typeof metrics.rowHeight === 'number' && metrics.rowHeight > 0) {
                    this.itemHeight = metrics.rowHeight;
                }
                this.itemsPerRow = Math.max(1, Number(metrics.itemsPerRow) || 1);
                this.gap = Math.max(0, Number(metrics.gap) || 0);
                this.layoutMetrics = Object.assign({}, metrics, {
                    itemsPerRow: this.itemsPerRow,
                    rowHeight: metrics.rowHeight || this.itemHeight,
                    totalRows: metrics.totalRows || Math.ceil(this.items.length / this.itemsPerRow)
                });
                return;
            }
        } catch (error) {
            console.warn('[VirtualScroller] layoutCalculator 计算失败，回退至单列布局', error);
        }

        this.layoutMetrics = null;
        this.itemsPerRow = 1;
    }

    getTotalHeight() {
        if (this.layoutMetrics && typeof this.layoutMetrics.totalHeight === 'number') {
            return this.layoutMetrics.totalHeight;
        }
        return this.items.length * this.itemHeight;
    }
}

/**
 * 性能优化器
 * 提供各种性能优化功能
 */
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = new Map();
        this.observers = new Map();
        
        // 性能监控
        this.performanceMetrics = {
            renderTime: [],
            scrollPerformance: [],
            cacheHits: 0,
            cacheMisses: 0
        };
        
        this.initialize();
    }
    
    /**
     * 初始化性能优化器
     */
    initialize() {
        console.log('[PerformanceOptimizer] 初始化性能优化器');
        
        // 设置缓存清理定时器
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000); // 每分钟清理一次过期缓存
        
        // 监控性能指标
        this.setupPerformanceMonitoring();
    }
    
    /**
     * 设置缓存
     */
    setCache(key, value, options = {}) {
        const ttl = options.ttl || 300000; // 默认5分钟
        
        this.cache.set(key, value);
        this.cacheTTL.set(key, Date.now() + ttl);
        
        console.log(`[PerformanceOptimizer] 缓存已设置: ${key}`);
    }
    
    /**
     * 获取缓存
     */
    getCache(key) {
        const now = Date.now();
        const expiry = this.cacheTTL.get(key);
        
        if (expiry && now > expiry) {
            // 缓存已过期
            this.cache.delete(key);
            this.cacheTTL.delete(key);
            this.performanceMetrics.cacheMisses++;
            return null;
        }
        
        if (this.cache.has(key)) {
            this.performanceMetrics.cacheHits++;
            return this.cache.get(key);
        }
        
        this.performanceMetrics.cacheMisses++;
        return null;
    }
    
    /**
     * 清理过期缓存
     */
    cleanExpiredCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        this.cacheTTL.forEach((expiry, key) => {
            if (now > expiry) {
                this.cache.delete(key);
                this.cacheTTL.delete(key);
                cleanedCount++;
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`[PerformanceOptimizer] 清理了 ${cleanedCount} 个过期缓存项`);
        }
    }
    
    /**
     * 批量处理大数据
     */
    batchProcess(items, processor, batchSize = 10, delay = 5) {
        return new Promise((resolve) => {
            let index = 0;
            const results = [];
            
            const processBatch = () => {
                const endIndex = Math.min(index + batchSize, items.length);
                
                for (let i = index; i < endIndex; i++) {
                    const result = processor(items[i], i);
                    results.push(result);
                }
                
                index = endIndex;
                
                if (index < items.length) {
                    setTimeout(processBatch, delay);
                } else {
                    resolve(results);
                }
            };
            
            processBatch();
        });
    }
    
    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 预加载图片
     */
    preloadImages(imageUrls) {
        const promises = imageUrls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => reject(url);
                img.src = url;
            });
        });
        
        return Promise.allSettled(promises);
    }
    
    /**
     * 创建虚拟滚动器
     */
    createVirtualScroller(container, items, renderer, options) {
        return new VirtualScroller(container, items, renderer, options);
    }
    
    /**
     * 优化渲染性能
     */
    optimizeRender(renderFunc) {
        return (...args) => {
            const startTime = performance.now();
            
            // 使用requestAnimationFrame优化渲染
            requestAnimationFrame(() => {
                renderFunc(...args);
                
                const endTime = performance.now();
                const renderTime = endTime - startTime;
                
                this.performanceMetrics.renderTime.push(renderTime);
                
                // 只保留最近100次的性能数据
                if (this.performanceMetrics.renderTime.length > 100) {
                    this.performanceMetrics.renderTime.shift();
                }
            });
        };
    }
    
    /**
     * 设置性能监控
     */
    setupPerformanceMonitoring() {
        // 监控页面性能
        if (typeof PerformanceObserver !== 'undefined') {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure') {
                        console.log(`[Performance] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['measure'] });
            this.observers.set('performance', observer);
        }
    }
    
    /**
     * 获取性能统计
     */
    getPerformanceStats() {
        const renderTimes = this.performanceMetrics.renderTime;
        const avgRenderTime = renderTimes.length > 0 
            ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
            : 0;
            
        const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
            ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
            : 0;
            
        return {
            averageRenderTime: avgRenderTime.toFixed(2),
            cacheHitRate: cacheHitRate.toFixed(2),
            cacheSize: this.cache.size,
            totalCacheHits: this.performanceMetrics.cacheHits,
            totalCacheMisses: this.performanceMetrics.cacheMisses
        };
    }
    
    /**
     * 记录加载时间 - 向后兼容API修复
     */
    recordLoadTime(loadTime) {
        console.log(`[PerformanceOptimizer] 记录加载时间: ${loadTime}ms`);
        this.performanceMetrics.loadTime = this.performanceMetrics.loadTime || [];
        this.performanceMetrics.loadTime.push(loadTime);

        // 只保留最近100次记录
        if (this.performanceMetrics.loadTime.length > 100) {
            this.performanceMetrics.loadTime.shift();
        }
    }

    /**
     * 记录渲染时间 - 向后兼容API修复
     */
    recordRenderTime(renderTime) {
        console.log(`[PerformanceOptimizer] 记录渲染时间: ${renderTime}ms`);

        // 复用现有的renderTime数组
        this.performanceMetrics.renderTime.push(renderTime);

        // 只保留最近100次记录
        if (this.performanceMetrics.renderTime.length > 100) {
            this.performanceMetrics.renderTime.shift();
        }
    }

    /**
     * 清理资源 - 向后兼容API修复
     */
    cleanup() {
        console.log('[PerformanceOptimizer] 清理资源');

        // 清理过期缓存
        this.cleanExpiredCache();

        // 清理性能指标（保留基础结构）
        this.performanceMetrics = {
            renderTime: [],
            scrollPerformance: [],
            cacheHits: this.performanceMetrics.cacheHits,
            cacheMisses: this.performanceMetrics.cacheMisses,
            loadTime: this.performanceMetrics.loadTime || []
        };
    }

    /**
     * 获取性能报告 - 兼容性修复：恢复旧字段结构
     */
    getPerformanceReport() {
        const stats = this.getPerformanceStats();
        const loadTimes = this.performanceMetrics.loadTime || [];
        const renderTimes = this.performanceMetrics.renderTime;

        // 计算平均值
        const avgLoadTime = loadTimes.length > 0
            ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length
            : 0;
        const avgRenderTime = renderTimes.length > 0
            ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
            : 0;

        // 估算缓存大小（简化计算）
        const estimatedCacheSize = this.cache.size * 1024; // 假设每项1KB

        return {
            // 新结构（保留）
            timestamp: new Date().toISOString(),
            summary: {
                averageRenderTime: parseFloat(stats.averageRenderTime),
                cacheHitRate: parseFloat(stats.cacheHitRate),
                cacheSize: stats.cacheSize,
                totalCacheHits: stats.totalCacheHits,
                totalCacheMisses: stats.totalCacheMisses
            },
            detailed: {
                recentRenderTimes: renderTimes.slice(-10),
                recentLoadTimes: loadTimes.slice(-10),
                cacheEntries: Array.from(this.cache.keys()).slice(0, 10)
            },
            recommendations: this.generateRecommendations(stats),

            // 旧结构（兼容性修复）
            cache: {
                itemCount: this.cache.size,
                totalSize: estimatedCacheSize,
                hitRate: parseFloat(stats.cacheHitRate)
            },
            performance: {
                averageLoadTime: Math.round(avgLoadTime),
                averageRenderTime: Math.round(avgRenderTime),
                totalLoadSamples: loadTimes.length,
                totalRenderSamples: renderTimes.length
            },
            memory: {
                used: Math.round(estimatedCacheSize / 1024 / 1024), // MB
                total: Math.round(estimatedCacheSize / 1024 / 1024), // MB
                limit: 100 // MB，假设限制
            }
        };
    }

    /**
     * 生成性能建议
     */
    generateRecommendations(stats) {
        const recommendations = [];

        if (parseFloat(stats.cacheHitRate) < 70) {
            recommendations.push({
                type: 'cache',
                message: '缓存命中率较低，建议增加缓存时间或预加载策略'
            });
        }

        if (parseFloat(stats.averageRenderTime) > 100) {
            recommendations.push({
                type: 'render',
                message: '平均渲染时间较长，建议使用虚拟滚动或减少DOM操作'
            });
        }

        if (stats.cacheSize > 1000) {
            recommendations.push({
                type: 'memory',
                message: '缓存项较多，建议定期清理或优化缓存策略'
            });
        }

        return recommendations.length > 0 ? recommendations : [{
            type: 'good',
            message: '系统性能良好，无明显问题'
        }];
    }

    /**
     * 销毁性能优化器
     */
    destroy() {
        console.log('[PerformanceOptimizer] 销毁性能优化器');

        // 清理缓存
        this.cache.clear();
        this.cacheTTL.clear();

        // 断开观察者
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
    }
}

// 导出到全局
window.VirtualScroller = VirtualScroller;
window.PerformanceOptimizer = PerformanceOptimizer;


// ===== js/components/BrowseStateManager.js =====
/**
 * 浏览状态管理器
 * 负责管理题库浏览的状态和过滤器，支持完整的状态持久化和回滚
 */
class BrowseStateManager {
    constructor() {
        this.currentFilter = 'all';
        this.previousFilter = null;
        this.browseHistory = [];
        this.maxHistorySize = 10;
        this.subscribers = [];
        this.state = {
            currentCategory: null,
            currentFrequency: null,
            viewMode: 'grid',
            sortBy: 'title',
            sortOrder: 'asc',
            filters: {
                frequency: 'all',
                status: 'all',
                difficulty: 'all'
            },
            searchQuery: '',
            pagination: {
                page: 1,
                pageSize: 20,
                total: 0
            }
        };

        // 全局引用，供事件委托使用
        window.browseStateManager = this;
        
        // 绑定方法上下文
        this.handleBrowseNavigation = this.handleBrowseNavigation.bind(this);
        
        // 初始化
        this.initialize();
    }

    /**
     * 初始化浏览状态管理器
     */
    initialize() {
        console.log('[BrowseStateManager] 初始化浏览状态管理器');
        
        // 恢复保存的状态
        this.restorePersistentState();
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 初始化完成后通知订阅者
        this.notifySubscribers();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 使用事件委托替换独立监听器
        if (typeof window.DOM !== 'undefined' && window.DOM.delegate) {
            // 监听导航按钮点击
            window.DOM.delegate('click', '.nav-btn', function(e) {
                if (this.textContent.includes('题库浏览')) {
                    window.browseStateManager.handleBrowseNavigation();
                }
            });

            console.log('[BrowseStateManager] 使用事件委托设置监听器');
        } else {
            // 降级到传统监听器
            document.addEventListener('click', (event) => {
                const navBtn = event.target.closest('.nav-btn');
                if (navBtn && navBtn.textContent.includes('题库浏览')) {
                    this.handleBrowseNavigation();
                }
            });
        }

        // 自定义事件和窗口事件监听（这些事件不能用DOM.delegate处理）
        document.addEventListener('categoryBrowse', (event) => {
            window.browseStateManager.setBrowseFilter(event.detail.category);
        });

        window.addEventListener('beforeunload', () => {
            window.browseStateManager.saveBrowseState();
        });
    }

    /**
     * 处理浏览导航
     */
    handleBrowseNavigation() {
        console.log('[BrowseStateManager] 处理浏览导航，重置为显示所有考试');

        if (typeof window.clearPendingBrowseAutoScroll === 'function') {
            try { window.clearPendingBrowseAutoScroll(); } catch (_) {}
        }

        // 重置到全部考试视图
        this.resetToAllExams();

        // 记录导航历史
        this.addToHistory({
            action: 'navigate_to_browse',
            filter: 'all',
            timestamp: Date.now()
        });
    }

    /**
     * 设置浏览过滤器
     */
    setBrowseFilter(filter) {
        console.log(`[BrowseStateManager] 设置浏览过滤器: ${filter}`);
        
        // 保存之前的过滤器
        this.previousFilter = this.currentFilter;
        
        // 设置新的过滤器
        this.currentFilter = filter;
        
        // 更新全局变量（保持向后兼容）
        if (window.currentCategory !== undefined) {
            window.currentCategory = filter;
        }
        
        // 更新状态
        this.setState({
            currentCategory: filter === 'all' ? null : filter
        });
        
        // 更新浏览标题
        this.updateBrowseTitle(filter);
        
        // 记录状态变更
        this.addToHistory({
            action: 'filter_change',
            from: this.previousFilter,
            to: filter,
            timestamp: Date.now()
        });
        
        // 保存状态
        this.saveBrowseState();
        
        // 触发过滤器变更事件
        this.dispatchFilterChangeEvent(filter);
    }

    /**
     * 设置状态并通知订阅者
     */
    setState(newState) {
        // 保存历史状态
        this.browseHistory.push({
            action: 'state_change',
            previousState: JSON.parse(JSON.stringify(this.state)),
            newState: JSON.parse(JSON.stringify(newState)),
            timestamp: Date.now()
        });
        
        if (this.browseHistory.length > this.maxHistorySize) {
            this.browseHistory.shift();
        }
        
        // 更新状态
        this.state = { ...this.state, ...newState };
        
        // 通知订阅者
        this.notifySubscribers();
        
        // 持久化状态
        this.persistState();
    }

    /**
     * 订阅状态变化
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        
        // 返回取消订阅的方法
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }

    /**
     * 通知所有订阅者
     */
    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('[BrowseStateManager] 订阅者回调错误:', error);
            }
        });
    }

    /**
     * 持久化状态
     */
    persistState() {
        try {
            const dataToSave = {
                currentFilter: this.currentFilter,
                previousFilter: this.previousFilter,
                state: this.state,
                browseHistory: this.browseHistory.slice(-this.maxHistorySize),
                timestamp: Date.now()
            };
            
            localStorage.setItem('browse_state', JSON.stringify(dataToSave));
            console.log('[BrowseStateManager] 状态已持久化');
        } catch (error) {
            console.error('[BrowseStateManager] 持久化状态失败:', error);
        }
    }

    /**
     * 恢复持久化的状态
     */
    restorePersistentState() {
        try {
            const savedData = localStorage.getItem('browse_state');
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // 恢复基本状态
                this.previousFilter = data.previousFilter || null;
                this.browseHistory = data.browseHistory || [];
                
                // 恢复完整状态
                if (data.state) {
                    this.state = { ...this.state, ...data.state };
                }
                
                // 默认重置为'all'，确保主界面浏览按钮总是显示所有考试
                this.currentFilter = 'all';
                this.state.currentCategory = null;
                
                console.log('[BrowseStateManager] 持久化状态已恢复');
            }
        } catch (error) {
            console.error('[BrowseStateManager] 恢复持久化状态失败:', error);
            this.resetToDefaults();
        }
    }

    /**
     * 重置为默认状态
     */
    resetToDefaults() {
        this.currentFilter = 'all';
        this.previousFilter = null;
        this.browseHistory = [];
        this.state = {
            currentCategory: null,
            currentFrequency: null,
            viewMode: 'grid',
            sortBy: 'title',
            sortOrder: 'asc',
            filters: {
                frequency: 'all',
                status: 'all',
                difficulty: 'all'
            },
            searchQuery: '',
            pagination: {
                page: 1,
                pageSize: 20,
                total: 0
            }
        };
    }

    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 重置到全部考试视图
     */
    resetToAllExams() {
        console.log('[BrowseStateManager] 重置到全部考试视图');
        
        // 保存之前的状态
        this.previousFilter = this.currentFilter;
        
        // 重置过滤器
        this.currentFilter = 'all';

        // 更新全局变量
        if (window.currentCategory !== undefined) {
            window.currentCategory = 'all';
        }

        if (typeof window.setBrowseFilterState === 'function') {
            try { window.setBrowseFilterState('all', 'all'); } catch (_) {}
        }

        // 更新状态
        this.setState({
            currentCategory: null,
            currentFrequency: null,
            searchQuery: '',
            pagination: {
                page: 1,
                pageSize: 20,
                total: 0
            }
        });
        
        // 更新浏览标题
        this.updateBrowseTitle('all');
        
        // 清除搜索状态
        this.clearSearchState();
        
        // 记录重置操作
        this.addToHistory({
            action: 'reset_to_all',
            from: this.previousFilter,
            timestamp: Date.now()
        });
        
        // 保存状态
        this.persistState();
        
        // 触发重置事件
        this.dispatchResetEvent();
    }

    /**
     * 更新浏览标题
     */
    updateBrowseTitle(filter) {
        const label = filter === 'all'
            ? '题库浏览'
            : `${filter} 题库浏览`;
        if (typeof window.setBrowseTitle === 'function') {
            window.setBrowseTitle(label);
            return;
        }
        const browseTitle = document.getElementById('browse-title');
        if (browseTitle) {
            browseTitle.textContent = label;
        }
    }

    /**
     * 清除搜索状态
     */
    clearSearchState() {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    }

    /**
     * 保存浏览状态（兼容性方法）
     */
    saveBrowseState() {
        this.persistState();
    }

    /**
     * 恢复浏览状态（兼容性方法）
     */
    restoreBrowseState() {
        this.restorePersistentState();
    }

    /**
     * 添加到历史记录
     */
    addToHistory(historyItem) {
        this.browseHistory.push(historyItem);
        
        // 限制历史记录大小
        if (this.browseHistory.length > this.maxHistorySize) {
            this.browseHistory.shift();
        }
    }

    /**
     * 清除浏览历史
     */
    clearBrowseHistory() {
        this.browseHistory = [];
        this.saveBrowseState();
        console.log('[BrowseStateManager] 浏览历史已清除');
    }

    /**
     * 获取当前过滤器
     */
    getCurrentFilter() {
        return this.currentFilter;
    }

    /**
     * 获取之前的过滤器
     */
    getPreviousFilter() {
        return this.previousFilter;
    }

    /**
     * 获取浏览历史
     */
    getBrowseHistory() {
        return [...this.browseHistory];
    }

    /**
     * 检查是否可以返回上一个状态
     */
    canGoBack() {
        return this.previousFilter !== null && this.previousFilter !== this.currentFilter;
    }

    /**
     * 返回上一个浏览状态
     */
    goBack() {
        if (this.canGoBack()) {
            const backToFilter = this.previousFilter;
            this.setBrowseFilter(backToFilter);
            
            console.log(`[BrowseStateManager] 返回到上一个状态: ${backToFilter}`);
            return true;
        }
        return false;
    }

    /**
     * 触发过滤器变更事件
     */
    dispatchFilterChangeEvent(filter) {
        const event = new CustomEvent('browseFilterChanged', {
            detail: {
                filter: filter,
                previousFilter: this.previousFilter,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 触发重置事件
     */
    dispatchResetEvent() {
        const event = new CustomEvent('browseReset', {
            detail: {
                previousFilter: this.previousFilter,
                timestamp: Date.now()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取浏览统计信息
     */
    getBrowseStats() {
        const filterCounts = {};
        this.browseHistory.forEach(item => {
            if (item.action === 'filter_change') {
                filterCounts[item.to] = (filterCounts[item.to] || 0) + 1;
            }
        });

        return {
            currentFilter: this.currentFilter,
            previousFilter: this.previousFilter,
            historySize: this.browseHistory.length,
            filterUsage: filterCounts,
            lastActivity: this.browseHistory.length > 0 ? 
                this.browseHistory[this.browseHistory.length - 1].timestamp : null
        };
    }

    /**
     * 重置浏览状态管理器
     */
    reset() {
        console.log('[BrowseStateManager] 重置浏览状态管理器');
        
        this.currentFilter = 'all';
        this.previousFilter = null;
        this.browseHistory = [];
        
        // 更新UI
        this.updateBrowseTitle('all');
        this.clearSearchState();
        
        // 更新全局变量
        if (window.currentCategory !== undefined) {
            window.currentCategory = 'all';
        }
        
        // 保存重置后的状态
        this.saveBrowseState();
        
        // 触发重置事件
        this.dispatchResetEvent();
    }

    /**
     * 导出浏览历史
     */
    exportBrowseHistory() {
        const exportData = {
            currentFilter: this.currentFilter,
            previousFilter: this.previousFilter,
            browseHistory: this.browseHistory,
            stats: this.getBrowseStats(),
            exportTime: new Date().toISOString()
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 导入浏览历史
     */
    importBrowseHistory(importData) {
        try {
            const data = typeof importData === 'string' ? JSON.parse(importData) : importData;
            
            if (data.browseHistory && Array.isArray(data.browseHistory)) {
                this.browseHistory = data.browseHistory.slice(-this.maxHistorySize);
                this.saveBrowseState();
                
                console.log('[BrowseStateManager] 浏览历史导入成功');
                return true;
            } else {
                throw new Error('无效的导入数据格式');
            }
        } catch (error) {
            console.error('[BrowseStateManager] 导入浏览历史失败:', error);
            return false;
        }
    }
}

// 导出类
window.BrowseStateManager = BrowseStateManager;

// ===== js/utils/dataConsistencyManager.js =====
/**
 * 数据一致性管理器
 * 确保弹窗显示和导出数据的一致性
 */
class DataConsistencyManager {
    constructor() {
        this.validationRules = {
            requiredFields: ['id', 'startTime', 'answers'],
            optionalFields: ['correctAnswers', 'answerComparison', 'scoreInfo'],
            answerKeyFormats: ['q1', 'q2', 'question1', 'question2']
        };
    }

    /**
     * 验证记录数据完整性
     */
    validateRecordData(record) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            missingFields: [],
            dataQuality: 'good'
        };

        // 检查必需字段
        this.validationRules.requiredFields.forEach(field => {
            if (!record[field]) {
                validation.errors.push(`缺少必需字段: ${field}`);
                validation.missingFields.push(field);
                validation.isValid = false;
            }
        });

        // 检查答案数据
        if (record.answers) {
            const answerValidation = this.validateAnswers(record.answers);
            if (!answerValidation.isValid) {
                validation.warnings.push('用户答案数据存在问题');
                validation.dataQuality = 'fair';
            }
        }

        // 检查正确答案数据
        if (record.correctAnswers) {
            const correctAnswerValidation = this.validateAnswers(record.correctAnswers);
            if (!correctAnswerValidation.isValid) {
                validation.warnings.push('正确答案数据存在问题');
            }
        } else {
            validation.warnings.push('缺少正确答案数据');
            validation.dataQuality = 'poor';
        }

        // 检查答案比较数据
        if (!record.answerComparison && record.answers && record.correctAnswers) {
            validation.warnings.push('缺少答案比较数据，将自动生成');
        }

        // 设置数据质量等级
        if (validation.errors.length > 0) {
            validation.dataQuality = 'invalid';
        } else if (validation.warnings.length > 2) {
            validation.dataQuality = 'poor';
        } else if (validation.warnings.length > 0) {
            validation.dataQuality = 'fair';
        }

        console.log('[DataConsistencyManager] 数据验证结果:', validation);
        return validation;
    }

    /**
     * 补充缺失的数据
     */
    enrichRecordData(record) {
        console.log('[DataConsistencyManager] 开始数据补充:', record.id);
        
        const enriched = { ...record };

        // 标准化答案格式
        if (enriched.answers) {
            enriched.answers = this.standardizeAnswerFormat(enriched.answers);
        }

        if (enriched.correctAnswers) {
            enriched.correctAnswers = this.standardizeAnswerFormat(enriched.correctAnswers);
        }

        // 生成缺失的答案比较数据
        if (!enriched.answerComparison && enriched.answers) {
            enriched.answerComparison = this.generateAnswerComparison(
                enriched.answers, 
                enriched.correctAnswers || {}
            );
            console.log('[DataConsistencyManager] 生成答案比较数据');
        }

        // 修复分数信息
        if (!enriched.scoreInfo && enriched.answerComparison) {
            enriched.scoreInfo = this.calculateScoreFromComparison(enriched.answerComparison);
            console.log('[DataConsistencyManager] 从答案比较计算分数');
        }
        // 从 realData.scoreInfo 合并缺失项
        if (enriched.realData && enriched.realData.scoreInfo) {
            enriched.scoreInfo = { ...(enriched.scoreInfo || {}), ...enriched.realData.scoreInfo };
        }

        // 顶层字段兜底：score / totalQuestions / accuracy / percentage
        if (typeof enriched.score !== 'number') {
            if (enriched.scoreInfo && typeof enriched.scoreInfo.correct === 'number') {
                enriched.score = enriched.scoreInfo.correct;
            } else if (typeof enriched.correctAnswers === 'number') {
                enriched.score = enriched.correctAnswers;
            }
        }
        if (typeof enriched.totalQuestions !== 'number') {
            if (enriched.scoreInfo && typeof enriched.scoreInfo.total === 'number') {
                enriched.totalQuestions = enriched.scoreInfo.total;
            } else if (enriched.answers) {
                enriched.totalQuestions = Object.keys(enriched.answers).length;
            } else if (enriched.realData && enriched.realData.answers) {
                enriched.totalQuestions = Object.keys(enriched.realData.answers).length;
            }
        }
        if (typeof enriched.accuracy !== 'number') {
            if (enriched.scoreInfo && typeof enriched.scoreInfo.accuracy === 'number') {
                enriched.accuracy = enriched.scoreInfo.accuracy;
            } else if (typeof enriched.score === 'number' && typeof enriched.totalQuestions === 'number' && enriched.totalQuestions > 0) {
                enriched.accuracy = enriched.score / enriched.totalQuestions;
            } else {
                enriched.accuracy = 0;
            }
        }
        if (typeof enriched.percentage !== 'number') {
            if (enriched.scoreInfo && typeof enriched.scoreInfo.percentage === 'number') {
                enriched.percentage = enriched.scoreInfo.percentage;
            } else {
                enriched.percentage = Math.round((enriched.accuracy || 0) * 100);
            }
        }

        // 时间信息兜底：start/end/duration（秒）
        if (!enriched.startTime) {
            const rs = enriched.realData && enriched.realData.startTime;
            if (rs) enriched.startTime = new Date(rs).toISOString();
        }
        if (!enriched.endTime) {
            const re = enriched.realData && enriched.realData.endTime;
            if (re) enriched.endTime = new Date(re).toISOString();
        }
        if (typeof enriched.duration !== 'number') {
            if (enriched.realData && typeof enriched.realData.duration === 'number') {
                enriched.duration = enriched.realData.duration;
            } else if (enriched.startTime && enriched.endTime) {
                enriched.duration = Math.max(0, Math.floor((new Date(enriched.endTime) - new Date(enriched.startTime)) / 1000));
            } else {
                enriched.duration = 0;
            }
        }

        // 标题/分类兜底
        if (!enriched.title && enriched.metadata && enriched.metadata.examTitle) enriched.title = enriched.metadata.examTitle;
        if (!enriched.category && enriched.metadata && enriched.metadata.category) enriched.category = enriched.metadata.category;
        if (!enriched.frequency && enriched.metadata && enriched.metadata.frequency) enriched.frequency = enriched.metadata.frequency;

        // 确保realData结构的兼容性
        if (!enriched.realData) {
            enriched.realData = {
                answers: enriched.answers || {},
                correctAnswers: enriched.correctAnswers || {},
                answerComparison: enriched.answerComparison || {},
                scoreInfo: enriched.scoreInfo || null
            };
        } else {
            // 更新realData以包含新数据
            enriched.realData.correctAnswers = enriched.correctAnswers || enriched.realData.correctAnswers || {};
            enriched.realData.answerComparison = enriched.answerComparison || enriched.realData.answerComparison || {};
        }

        console.log('[DataConsistencyManager] 数据补充完成');
        return enriched;
    }

    /**
     * 标准化答案格式
     */
    standardizeAnswerFormat(answers) {
        const standardized = {};
        
        Object.keys(answers).forEach(key => {
            let normalizedKey = key;
            let value = answers[key];

            // 标准化键名 - 确保以q开头
            if (/^\d+$/.test(normalizedKey)) {
                normalizedKey = 'q' + normalizedKey;
            } else if (normalizedKey.startsWith('question')) {
                normalizedKey = normalizedKey.replace('question', 'q');
            }

            // 标准化值
            if (value !== null && value !== undefined) {
                value = String(value).trim();
                
                // 标准化常见答案格式
                if (value.toLowerCase() === 'true') value = 'TRUE';
                if (value.toLowerCase() === 'false') value = 'FALSE';
                if (value.toLowerCase() === 'not given') value = 'NOT GIVEN';
                
                standardized[normalizedKey] = value;
            }
        });

        return standardized;
    }

    /**
     * 验证答案数据
     */
    validateAnswers(answers) {
        const validation = {
            isValid: true,
            errors: [],
            answerCount: 0,
            emptyAnswers: 0,
            invalidKeys: []
        };

        if (!answers || typeof answers !== 'object') {
            validation.isValid = false;
            validation.errors.push('答案数据不是有效对象');
            return validation;
        }

        Object.keys(answers).forEach(key => {
            validation.answerCount++;
            
            // 检查键名格式
            if (!key.match(/^q\d+$/) && !key.match(/^question\d+$/)) {
                validation.invalidKeys.push(key);
            }
            
            // 检查值
            const value = answers[key];
            if (!value || String(value).trim() === '') {
                validation.emptyAnswers++;
            }
        });

        if (validation.invalidKeys.length > 0) {
            validation.errors.push(`无效的键名格式: ${validation.invalidKeys.join(', ')}`);
        }

        if (validation.emptyAnswers > validation.answerCount * 0.5) {
            validation.isValid = false;
            validation.errors.push('超过50%的答案为空');
        }

        return validation;
    }

    /**
     * 生成答案比较数据
     */
    generateAnswerComparison(userAnswers, correctAnswers) {
        const comparison = {};
        
        // 获取所有问题键
        const allKeys = new Set([
            ...Object.keys(userAnswers || {}),
            ...Object.keys(correctAnswers || {})
        ]);

        allKeys.forEach(key => {
            const userAnswer = userAnswers[key];
            const correctAnswer = correctAnswers[key];
            
            comparison[key] = {
                userAnswer: userAnswer || null,
                correctAnswer: correctAnswer || null,
                isCorrect: this.compareAnswers(userAnswer, correctAnswer)
            };
        });

        return comparison;
    }

    /**
     * 从答案比较计算分数
     */
    calculateScoreFromComparison(answerComparison) {
        let correct = 0;
        let total = 0;

        Object.values(answerComparison).forEach(comparison => {
            total++;
            if (comparison.userAnswer !== null && comparison.isCorrect) {
                correct++;
            }
        });

        const accuracy = total > 0 ? correct / total : 0;
        
        return {
            correct: correct,
            total: total,
            accuracy: accuracy,
            percentage: Math.round(accuracy * 100),
            source: 'comparison_calculation'
        };
    }

    /**
     * 比较两个答案
     */
    compareAnswers(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) {
            return false;
        }

        // 标准化比较
        const normalize = (str) => String(str).trim().toLowerCase();
        return normalize(userAnswer) === normalize(correctAnswer);
    }

    /**
     * 修复数据不一致问题
     */
    fixDataInconsistencies(records) {
        console.log('[DataConsistencyManager] 开始修复数据不一致问题');
        
        const fixed = records.map(record => {
            const validation = this.validateRecordData(record);
            
            if (!validation.isValid || validation.dataQuality === 'poor') {
                console.log(`[DataConsistencyManager] 修复记录: ${record.id}`);
                return this.enrichRecordData(record);
            }
            
            return record;
        });

        console.log('[DataConsistencyManager] 数据修复完成');
        return fixed;
    }

    /**
     * 确保弹窗和导出数据一致性
     */
    ensureConsistency(record) {
        // 验证数据
        const validation = this.validateRecordData(record);
        
        // 如果数据有问题，进行修复
        if (!validation.isValid || validation.dataQuality !== 'good') {
            return this.enrichRecordData(record);
        }
        
        return record;
    }

    /**
     * 获取数据质量报告
     */
    getDataQualityReport(records) {
        const list = Array.isArray(records) ? records : [];

        const report = {
            totalRecords: list.length,
            validRecords: 0,
            recordsWithCorrectAnswers: 0,
            recordsWithComparison: 0,
            averageAnswerCount: 0,
            qualityDistribution: {
                good: 0,
                fair: 0,
                poor: 0,
                invalid: 0
            }
        };

        let totalAnswers = 0;

        list.forEach(record => {
            const validation = this.validateRecordData(record);
            
            if (validation.isValid) {
                report.validRecords++;
            }
            
            if (record.correctAnswers && Object.keys(record.correctAnswers).length > 0) {
                report.recordsWithCorrectAnswers++;
            }
            
            if (record.answerComparison) {
                report.recordsWithComparison++;
            }
            
            if (record.answers) {
                totalAnswers += Object.keys(record.answers).length;
            }
            
            report.qualityDistribution[validation.dataQuality]++;
        });

        report.averageAnswerCount = list.length > 0 ? totalAnswers / list.length : 0;

        console.log('[DataConsistencyManager] 数据质量报告:', report);
        return report;
    }
}

// 导出类
window.DataConsistencyManager = DataConsistencyManager;


// ===== js/utils/answerMatchCore.js =====
(function initAnswerMatchCore(global) {
    'use strict';

    const BOOLEAN_SYNONYMS = new Map([
        ['true', 'true'],
        ['t', 'true'],
        ['yes', 'true'],
        ['y', 'true'],
        ['false', 'false'],
        ['f', 'false'],
        ['no', 'false'],
        ['n', 'false']
    ]);

    const NOT_GIVEN_SYNONYMS = new Map([
        ['ng', 'not given'],
        ['notgiven', 'not given'],
        ['not-given', 'not given']
    ]);

    function normalizeToken(value) {
        if (value == null) {
            return '';
        }
        const cleaned = String(value)
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[‐‑‒–—]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[\s"'`()[\]{}<>.,;:!?]+|[\s"'`()[\]{}<>.,;:!?]+$/g, '');
        if (!cleaned) {
            return '';
        }

        const lowered = cleaned.toLowerCase();
        if (BOOLEAN_SYNONYMS.has(lowered)) {
            return BOOLEAN_SYNONYMS.get(lowered);
        }
        if (NOT_GIVEN_SYNONYMS.has(lowered)) {
            return NOT_GIVEN_SYNONYMS.get(lowered);
        }
        if (/^[a-z]$/i.test(cleaned)) {
            return cleaned.toUpperCase();
        }
        const leadingOption = cleaned.match(/^([A-Za-z])(?:[.)])?\s+/);
        if (leadingOption && cleaned.length > 2) {
            return leadingOption[1].toUpperCase();
        }
        return cleaned;
    }

    function normalizeLooseToken(value) {
        return String(value == null ? '' : value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }

    function splitAnswerTokens(value) {
        if (Array.isArray(value)) {
            return value
                .map((entry) => normalizeToken(entry))
                .filter(Boolean);
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

        if (/^[A-Za-z](?:\s*[,/;，、]\s*[A-Za-z])+$/.test(raw)) {
            return raw
                .split(/[,/;，、]/)
                .map((entry) => normalizeToken(entry))
                .filter(Boolean);
        }

        if (/^[A-Za-z](?:\s+[A-Za-z])+$/.test(raw)) {
            return raw
                .split(/\s+/)
                .map((entry) => normalizeToken(entry))
                .filter(Boolean);
        }

        const normalized = normalizeToken(raw);
        if (!normalized) {
            return [];
        }
        return [normalized];
    }

    function areTokensEquivalent(left, right) {
        const normalizedLeft = normalizeToken(left);
        const normalizedRight = normalizeToken(right);
        if (!normalizedLeft || !normalizedRight) {
            return false;
        }
        if (normalizedLeft === normalizedRight) {
            return true;
        }
        if (/^[A-Z]$/.test(normalizedLeft) || /^[A-Z]$/.test(normalizedRight)) {
            return false;
        }
        return normalizeLooseToken(normalizedLeft) === normalizeLooseToken(normalizedRight);
    }

    function compareTokenSets(leftValues, rightValues) {
        const left = Array.from(new Set((leftValues || []).map((entry) => normalizeToken(entry)).filter(Boolean)));
        const right = Array.from(new Set((rightValues || []).map((entry) => normalizeToken(entry)).filter(Boolean)));
        if (left.length !== right.length) {
            return false;
        }
        return left.every((leftItem) => right.some((rightItem) => areTokensEquivalent(leftItem, rightItem)));
    }

    function compareAnswers(userAnswer, correctAnswer) {
        const expected = splitAnswerTokens(correctAnswer);
        const actual = splitAnswerTokens(userAnswer);

        if (expected.length === 0 && actual.length === 0) {
            return null;
        }
        if (expected.length === 0 || actual.length === 0) {
            return false;
        }

        if (Array.isArray(correctAnswer)) {
            if (actual.length === 1) {
                return expected.some((token) => areTokensEquivalent(token, actual[0]));
            }
            return compareTokenSets(expected, actual);
        }

        if (expected.length > 1 || actual.length > 1) {
            return compareTokenSets(expected, actual);
        }
        return areTokensEquivalent(expected[0], actual[0]);
    }

    function ensureAnswerMatchCoreReady(options = {}) {
        const targetGlobal = options && options.global && typeof options.global === 'object'
            ? options.global
            : global;
        const timeoutMs = Number.isFinite(Number(options.timeoutMs))
            ? Math.max(0, Number(options.timeoutMs))
            : 4500;
        const pollMs = Number.isFinite(Number(options.pollMs))
            ? Math.max(10, Number(options.pollMs))
            : 40;

        return new Promise((resolve) => {
            const isReady = () => !!(
                targetGlobal
                && targetGlobal.AnswerMatchCore
                && typeof targetGlobal.AnswerMatchCore.compareAnswers === 'function'
            );
            if (isReady()) {
                resolve(true);
                return;
            }
            let settled = false;
            const finish = (ready) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve(Boolean(ready));
            };
            const intervalId = setInterval(() => {
                if (isReady()) {
                    finish(true);
                }
            }, pollMs);
            const timeoutId = setTimeout(() => {
                finish(isReady());
            }, timeoutMs);
        });
    }

    const api = {
        normalizeToken,
        splitAnswerTokens,
        areTokensEquivalent,
        compareTokenSets,
        compareAnswers,
        ensureReady: ensureAnswerMatchCoreReady
    };

    global.AnswerMatchCore = api;
    global.ensureAnswerMatchCoreReady = ensureAnswerMatchCoreReady;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/utils/answerComparisonUtils.js =====
(function(global) {
    'use strict';

    const MAX_QUESTION_NUMBER = 200;
    const NOISE_KEYS = new Set([
        'playback-speed',
        'playbackspeed',
        'volume-slider',
        'volumeslider',
        'audio-volume',
        'audioCurrentTime',
        'audio-duration',
        'audioDuration',
        'settings',
        'lastFocusElement',
        'sessionid',
        'examid',
        'nextExamId',
        'previousExamId',
        'folder',
        'source',
        'result',
        'metadata',
        'practiceSettings'
    ]);
    const NOISE_PATTERNS = [
        /playback/i,
        /volume/i,
        /slider/i,
        /speed/i,
        /audio/i,
        /duration/i,
        /config/i
    ];
    const NO_ANSWER_MARKERS = new Set([
        'no answer',
        '未作答',
        'none',
        'n/a',
        'null',
        'undefined',
        'no-answer'
    ]);
    function getAnswerMatchCore() {
        const core = global.AnswerMatchCore;
        if (!core || typeof core !== 'object') {
            return null;
        }
        return core;
    }

    function toStringKey(value) {
        if (value == null) {
            return '';
        }
        return String(value).trim();
    }

    function normalizeKey(rawKey) {
        const original = toStringKey(rawKey);
        if (!original) {
            return { canonicalKey: null, questionNumber: null, originalKey: original };
        }

        const lowered = original.toLowerCase();

        // 处理范围题号（如 q21-22 或 21-22），保留完整键用于展示
        const rangeMatch = lowered.match(/^q?(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const canonicalKey = `q${start}-${end}`;
            return {
                canonicalKey,
                questionNumber: Number.isFinite(start) ? start : null,
                originalKey: original,
                rangeLabel: `${start}-${end}`
            };
        }

        let preferredDigits = null;
        try {
            const qDigitPattern = /(?:^|[^a-z0-9])q(\d{1,4})/g;
            let match = null;
            while ((match = qDigitPattern.exec(lowered)) !== null) {
                preferredDigits = match[1];
            }
        } catch (_) {
            preferredDigits = null;
        }

        const digitMatch = preferredDigits
            ? [null, preferredDigits]
            : lowered.match(/(\d{1,4})/);
        let questionNumber = null;
        let canonicalKey = lowered;

        if (digitMatch) {
            questionNumber = parseInt(digitMatch[1], 10);
            if (Number.isFinite(questionNumber)) {
                canonicalKey = `q${questionNumber}`;
            } else {
                questionNumber = null;
            }
        } else if (/^q[a-z]+$/.test(lowered)) {
            canonicalKey = lowered;
        } else if (/^[a-z]$/.test(lowered)) {
            canonicalKey = `q${lowered}`;
        } else if (lowered.startsWith('question')) {
            const numeric = lowered.replace(/question/i, '').trim();
            if (numeric) {
                return normalizeKey(numeric);
            }
        }

        return { canonicalKey, questionNumber, originalKey: original };
    }

    function isNoiseKey(canonicalKey, questionNumber) {
        if (!canonicalKey) {
            return true;
        }

        if (NOISE_KEYS.has(canonicalKey)) {
            return true;
        }

        for (const pattern of NOISE_PATTERNS) {
            if (pattern.test(canonicalKey)) {
                return true;
            }
        }

        if (questionNumber != null) {
            if (!Number.isFinite(questionNumber) || questionNumber <= 0 || questionNumber > MAX_QUESTION_NUMBER) {
                return true;
            }
        }

        return false;
    }

    function normalizeForComparison(value) {
        if (value == null) {
            return { display: null, normalized: null };
        }

        if (Array.isArray(value)) {
            const joined = value
                .map(item => toStringKey(item))
                .filter(Boolean)
                .join(', ');
            return normalizeForComparison(joined);
        }

        if (typeof value === 'object') {
            if (value.answer != null) {
                return normalizeForComparison(value.answer);
            }
            if (value.value != null) {
                return normalizeForComparison(value.value);
            }
            // 无法提取有效值的对象，返回null
            return { display: null, normalized: null };
        }

        const str = toStringKey(value);
        if (!str) {
            return { display: null, normalized: null };
        }

        const collapsed = str.replace(/\s+/g, ' ').trim();
        
        // 过滤 [object Object] 这样的无效字符串
        if (/^\[object\s/i.test(collapsed)) {
            return { display: null, normalized: null };
        }
        
        const lowered = collapsed.toLowerCase();

        if (NO_ANSWER_MARKERS.has(lowered)) {
            return { display: null, normalized: null };
        }

        const core = getAnswerMatchCore();
        if (core && typeof core.splitAnswerTokens === 'function') {
            const tokens = core.splitAnswerTokens(collapsed);
            if (!Array.isArray(tokens) || !tokens.length) {
                return { display: null, normalized: null };
            }
            if (tokens.length === 1) {
                const normalizedText = String(tokens[0]);
                return { display: normalizedText, normalized: normalizedText };
            }
            return { display: tokens.join(', '), normalized: tokens.slice() };
        }
        if (core && typeof core.normalizeToken === 'function') {
            const normalized = core.normalizeToken(collapsed);
            if (!normalized) {
                return { display: null, normalized: null };
            }
            const normalizedText = String(normalized);
            return { display: normalizedText, normalized: normalizedText };
        }

        return { display: collapsed, normalized: lowered };
    }

    function answersMatch(userInfo, correctInfo) {
        if (!userInfo || !correctInfo) {
            return null;
        }

        if (userInfo.normalized == null && correctInfo.normalized == null) {
            return null;
        }

        if (userInfo.normalized == null) {
            return false;
        }

        if (correctInfo.normalized == null) {
            return false;
        }

        const core = getAnswerMatchCore();
        if (core && typeof core.compareAnswers === 'function') {
            return core.compareAnswers(userInfo.normalized, correctInfo.normalized) === true;
        }
        return String(userInfo.normalized) === String(correctInfo.normalized);
    }

    function mergeSourceMaps(sources) {
        const target = {};
        sources.forEach(source => {
            if (!source || typeof source !== 'object') {
                return;
            }
            Object.keys(source).forEach(key => {
                if (key == null) {
                    return;
                }
                const strKey = String(key).trim();
                if (!strKey) {
                    return;
                }
                if (target[strKey] == null || target[strKey] === '') {
                    target[strKey] = source[key];
                }
            });
        });
        return target;
    }

    function extractFromComparison(comparison, selector) {
        if (!comparison || typeof comparison !== 'object') {
            return {};
        }
        const result = {};
        Object.keys(comparison).forEach(key => {
            const entry = comparison[key];
            if (entry && typeof entry === 'object') {
                const value = selector(entry);
                if (value != null) {
                    result[key] = value;
                }
            }
        });
        return result;
    }

    function extractFromDetails(details, selector) {
        if (!details || typeof details !== 'object') {
            return {};
        }
        const result = {};
        Object.keys(details).forEach(key => {
            const entry = details[key];
            if (entry && typeof entry === 'object') {
                const value = selector(entry);
                if (value != null) {
                    result[key] = value;
                }
            }
        });
        return result;
    }

    function lookupAnswer(map, keyVariants) {
        for (const key of keyVariants) {
            if (key && map[key] != null) {
                return map[key];
            }
        }
        return null;
    }

    function alignLetterKeys(entryMap) {
        const letterKeys = Object.keys(entryMap).filter(key => /^q[a-z]+$/.test(key) && entryMap[key]);
        if (letterKeys.length === 0) {
            return;
        }

        const numericEntries = Object.keys(entryMap)
            .map(key => ({ key, entry: entryMap[key] }))
            .filter(item => item.entry && Number.isFinite(item.entry.questionNumber))
            .sort((a, b) => a.entry.questionNumber - b.entry.questionNumber);

        if (numericEntries.length === 0) {
            return;
        }

        const sortedLetterKeys = letterKeys.slice().sort();
        const requiredLength = sortedLetterKeys.length;

        for (let start = 0; start <= numericEntries.length - requiredLength; start += 1) {
            const firstNumber = numericEntries[start].entry.questionNumber;
            const lastNumber = numericEntries[start + requiredLength - 1].entry.questionNumber;

            if (!Number.isFinite(firstNumber) || !Number.isFinite(lastNumber)) {
                continue;
            }

            if ((lastNumber - firstNumber + 1) !== requiredLength) {
                continue;
            }

            for (let index = 0; index < requiredLength; index += 1) {
                const letterKey = sortedLetterKeys[index];
                const numericKey = numericEntries[start + index].key;
                const letterEntry = entryMap[letterKey];
                const numericEntry = entryMap[numericKey];

                if (!letterEntry || !numericEntry) {
                    continue;
                }

                if (!numericEntry.hasUserAnswer && letterEntry.hasUserAnswer) {
                    numericEntry.userAnswer = letterEntry.userAnswer;
                    numericEntry.userInfo = letterEntry.userInfo;
                    numericEntry.hasUserAnswer = true;
                }

                if (!numericEntry.hasCorrectAnswer && letterEntry.hasCorrectAnswer) {
                    numericEntry.correctAnswer = letterEntry.correctAnswer;
                    numericEntry.correctInfo = letterEntry.correctInfo;
                    numericEntry.hasCorrectAnswer = true;
                }
            }

            sortedLetterKeys.forEach(letterKey => {
                delete entryMap[letterKey];
            });
            break;
        }
    }

    function finaliseEntry(entry) {
        const displayNumber = entry.rangeLabel
            ? entry.rangeLabel
            : entry.questionNumber != null
            ? String(entry.questionNumber)
            : entry.canonicalKey ? entry.canonicalKey.replace(/^q/i, '').toUpperCase() : '';

        const userDisplay = entry.hasUserAnswer ? entry.userAnswer : 'No Answer';
        const correctDisplay = entry.hasCorrectAnswer ? entry.correctAnswer : 'N/A';
        const isCorrect = answersMatch(entry.userInfo, entry.correctInfo);

        return {
            canonicalKey: entry.canonicalKey,
            originalKeys: Array.from(entry.originalKeys),
            questionNumber: entry.questionNumber,
            displayNumber,
            userAnswer: userDisplay,
            correctAnswer: correctDisplay,
            isCorrect,
            hasUserAnswer: entry.hasUserAnswer,
            hasCorrectAnswer: entry.hasCorrectAnswer
        };
    }

    function getNormalizedEntries(record) {
        if (!record || typeof record !== 'object') {
            return [];
        }

        const comparisonSources = [
            record.answerComparison,
            record.realData && record.realData.answerComparison
        ].filter(Boolean);

        const userSources = [
            extractFromComparison(record.answerComparison, entry => entry.userAnswer ?? entry.user ?? entry.answer),
            extractFromComparison(record.realData && record.realData.answerComparison, entry => entry.userAnswer ?? entry.user ?? entry.answer),
            record.answers,
            record.realData && record.realData.answers,
            extractFromDetails(record.scoreInfo && record.scoreInfo.details, entry => entry.userAnswer ?? entry.user),
            extractFromDetails(record.realData && record.realData.scoreInfo && record.realData.scoreInfo.details, entry => entry.userAnswer ?? entry.user)
        ].filter(Boolean);

        const correctSources = [
            extractFromComparison(record.answerComparison, entry => entry.correctAnswer ?? entry.correct),
            extractFromComparison(record.realData && record.realData.answerComparison, entry => entry.correctAnswer ?? entry.correct),
            record.correctAnswers,
            record.realData && record.realData.correctAnswers,
            extractFromDetails(record.scoreInfo && record.scoreInfo.details, entry => entry.correctAnswer ?? entry.correct),
            extractFromDetails(record.realData && record.realData.scoreInfo && record.realData.scoreInfo.details, entry => entry.correctAnswer ?? entry.correct)
        ].filter(Boolean);

        const comparisonMap = mergeSourceMaps(comparisonSources);
        const userMap = mergeSourceMaps(userSources);
        const correctMap = mergeSourceMaps(correctSources);

        const allKeys = new Set([
            ...Object.keys(comparisonMap),
            ...Object.keys(userMap),
            ...Object.keys(correctMap)
        ]);

        const entryMap = {};

        allKeys.forEach(rawKey => {
            const keyInfo = normalizeKey(rawKey);
            if (!keyInfo.canonicalKey) {
                return;
            }
            if (isNoiseKey(keyInfo.canonicalKey, keyInfo.questionNumber)) {
                return;
            }

            if (!entryMap[keyInfo.canonicalKey]) {
                entryMap[keyInfo.canonicalKey] = {
                    canonicalKey: keyInfo.canonicalKey,
                    questionNumber: keyInfo.questionNumber,
                    rangeLabel: keyInfo.rangeLabel || null,
                    originalKeys: new Set(),
                    userAnswer: null,
                    correctAnswer: null,
                    hasUserAnswer: false,
                    hasCorrectAnswer: false,
                    userInfo: { display: null, normalized: null },
                    correctInfo: { display: null, normalized: null }
                };
            }

            const entry = entryMap[keyInfo.canonicalKey];
            entry.originalKeys.add(keyInfo.originalKey);

            if (keyInfo.questionNumber != null && entry.questionNumber == null) {
                entry.questionNumber = keyInfo.questionNumber;
            }
            if (keyInfo.rangeLabel && !entry.rangeLabel) {
                entry.rangeLabel = keyInfo.rangeLabel;
            }

            const lookupKeys = [
                keyInfo.originalKey,
                keyInfo.canonicalKey,
                keyInfo.questionNumber != null ? String(keyInfo.questionNumber) : null,
                keyInfo.questionNumber != null ? `q${keyInfo.questionNumber}` : null
            ].filter(Boolean);

            const userValue = lookupAnswer(userMap, lookupKeys);
            if (!entry.hasUserAnswer && userValue != null) {
                const userInfo = normalizeForComparison(userValue);
                if (userInfo.display != null) {
                    entry.userAnswer = userInfo.display;
                    entry.hasUserAnswer = true;
                }
                entry.userInfo = userInfo;
            }

            const correctValue = lookupAnswer(correctMap, lookupKeys);
            if (!entry.hasCorrectAnswer && correctValue != null) {
                const correctInfo = normalizeForComparison(correctValue);
                if (correctInfo.display != null) {
                    entry.correctAnswer = correctInfo.display;
                    entry.hasCorrectAnswer = true;
                }
                entry.correctInfo = correctInfo;
            }

            if ((!entry.hasUserAnswer || !entry.hasCorrectAnswer) && comparisonMap[keyInfo.originalKey]) {
                const fromComparison = comparisonMap[keyInfo.originalKey];
                if (fromComparison && typeof fromComparison === 'object') {
                    if (!entry.hasUserAnswer && (fromComparison.userAnswer || fromComparison.user || fromComparison.answer)) {
                        const compUserInfo = normalizeForComparison(fromComparison.userAnswer ?? fromComparison.user ?? fromComparison.answer);
                        if (compUserInfo.display != null) {
                            entry.userAnswer = compUserInfo.display;
                            entry.hasUserAnswer = true;
                        }
                        entry.userInfo = compUserInfo;
                    }
                    if (!entry.hasCorrectAnswer && (fromComparison.correctAnswer || fromComparison.correct)) {
                        const compCorrectInfo = normalizeForComparison(fromComparison.correctAnswer ?? fromComparison.correct);
                        if (compCorrectInfo.display != null) {
                            entry.correctAnswer = compCorrectInfo.display;
                            entry.hasCorrectAnswer = true;
                        }
                        entry.correctInfo = compCorrectInfo;
                    }
                }
            }
        });

        alignLetterKeys(entryMap);

        const entries = Object.keys(entryMap)
            .map(key => entryMap[key])
            .filter(entry => entry && (entry.hasUserAnswer || entry.hasCorrectAnswer));

        const finalEntries = entries.map(finaliseEntry);

        return finalEntries.sort((a, b) => {
            const aNumber = Number.isFinite(a.questionNumber) ? a.questionNumber : null;
            const bNumber = Number.isFinite(b.questionNumber) ? b.questionNumber : null;

            if (aNumber != null && bNumber != null) {
                return aNumber - bNumber;
            }
            if (aNumber != null) {
                return -1;
            }
            if (bNumber != null) {
                return 1;
            }
            return a.displayNumber.localeCompare(b.displayNumber, undefined, { sensitivity: 'base' });
        });
    }

    function summariseEntries(entries) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return {
                total: 0,
                correct: 0,
                incorrect: 0,
                unanswered: 0
            };
        }

        let correct = 0;
        let incorrect = 0;
        let unanswered = 0;

        entries.forEach(entry => {
            if (!entry) {
                return;
            }
            if (!entry.hasUserAnswer || entry.userAnswer == null || entry.userAnswer === 'No Answer') {
                unanswered += 1;
                return;
            }
            if (entry.isCorrect === true) {
                correct += 1;
            } else {
                incorrect += 1;
            }
        });

        return {
            total: entries.length,
            correct,
            incorrect,
            unanswered
        };
    }

    function getAllExamIndexes(globalObj) {
        const sources = [
            globalObj.completeExamIndex,
            globalObj.examIndex,
            globalObj.readingExamIndex,
            globalObj.listeningExamIndex,
            globalObj.fullExamIndex,
            globalObj.practiceExamIndex
        ];
        return sources
            .filter(Array.isArray)
            .reduce((acc, list) => acc.concat(list), []);
    }

    function normalizeTitle(title) {
        return toStringKey(title)
            .toLowerCase()
            .replace(/[\s\-_\u3000]+/g, '')
            .replace(/[^\w\u4e00-\u9fa5]/g, '');
    }

    function findExamEntry(record, metadata, globalObj) {
        const indexes = getAllExamIndexes(globalObj);
        if (indexes.length === 0) {
            return null;
        }

        const candidateIds = [
            record && record.examId,
            record && record.originalExamId,
            record && record.derivedExamId,
            record && record.realData && record.realData.examId,
            metadata && metadata.examId,
            metadata && metadata.id
        ]
            .map(toStringKey)
            .filter(Boolean);

        // 1. 精确 ID 匹配
        if (candidateIds.length > 0) {
            const idLookup = new Map();
            indexes.forEach(item => {
                if (!item || typeof item !== 'object') {
                    return;
                }
                const itemId = toStringKey(item.id);
                if (itemId) {
                    idLookup.set(itemId.toLowerCase(), item);
                }
            });

            for (const id of candidateIds) {
                const normalizedId = id.toLowerCase();
                if (idLookup.has(normalizedId)) {
                    return idLookup.get(normalizedId);
                }
            }
        }

        // 2. 通过 URL 路径匹配（针对全量题库）
        if (record && record.url) {
            const urlPath = record.url.toLowerCase();
            const match = indexes.find(item => {
                if (!item || !item.path) return false;
                const itemPath = item.path.toLowerCase();
                // 提取 URL 中的文件夹名称
                const urlParts = urlPath.split('/').filter(Boolean);
                const pathParts = itemPath.split('/').filter(Boolean);
                
                // 检查是否有共同的文件夹路径
                for (let i = 0; i < Math.min(urlParts.length, pathParts.length); i++) {
                    if (urlParts[urlParts.length - 1 - i] === pathParts[pathParts.length - 1 - i]) {
                        return true;
                    }
                }
                return false;
            });
            if (match) {
                console.log('[AnswerComparisonUtils] 通过 URL 路径匹配到题目:', match.id, match.title);
                return match;
            }
        }

        // 3. 精确标题匹配
        const candidateTitles = [
            metadata && metadata.examTitle,
            metadata && metadata.title,
            record && record.title,
            record && record.examTitle,
            record && record.realData && record.realData.title
        ]
            .map(normalizeTitle)
            .filter(Boolean);

        if (candidateTitles.length > 0) {
            const titleLookup = new Map();
            indexes.forEach(item => {
                if (!item || typeof item !== 'object') {
                    return;
                }
                const itemTitle = normalizeTitle(item.title);
                if (itemTitle) {
                    titleLookup.set(itemTitle, item);
                }
            });

            for (const title of candidateTitles) {
                if (titleLookup.has(title)) {
                    return titleLookup.get(title);
                }
            }
            
            // 4. 模糊标题匹配（移除标签前缀后比较）
            for (const candidateTitle of candidateTitles) {
                const match = indexes.find(item => {
                    if (!item || !item.title) return false;
                    const itemTitle = normalizeTitle(item.title);
                    // 移除标签前缀，如 "[听力全量-...] City Development" vs "City Development"
                    const cleanCandidate = candidateTitle.replace(/^\[.*?\]\s*/, '');
                    const cleanItem = itemTitle.replace(/^\[.*?\]\s*/, '');
                    return cleanCandidate === cleanItem || 
                           (cleanCandidate.length > 5 && cleanItem.includes(cleanCandidate)) ||
                           (cleanItem.length > 5 && cleanCandidate.includes(cleanItem));
                });
                if (match) {
                    console.log('[AnswerComparisonUtils] 通过模糊标题匹配到题目:', match.id, match.title);
                    return match;
                }
            }
        }

        return null;
    }

    function inferCategory(record, metadata, examEntry) {
        if (examEntry && examEntry.category) {
            return examEntry.category;
        }

        if (metadata && metadata.category && metadata.category !== 'Unknown') {
            return metadata.category;
        }

        const candidates = [
            record && record.examId,
            metadata && metadata.examId,
            metadata && metadata.title,
            metadata && metadata.examTitle,
            record && record.originalExamId
        ]
            .map(toStringKey)
            .filter(Boolean);

        for (const item of candidates) {
            const match = item.match(/p([1-4])/i);
            if (match) {
                return `P${match[1]}`;
            }
        }

        if (examEntry && examEntry.type === 'listening') {
            return examEntry.category || 'Listening';
        }

        return metadata && metadata.category ? metadata.category : 'Unknown';
    }

    function enrichRecordMetadata(record) {
        if (!record || typeof record !== 'object') {
            return {
                category: 'Unknown',
                frequency: 'unknown',
                examTitle: record && record.examId ? record.examId : '未知题目'
            };
        }

        const metadata = Object.assign({}, record.metadata || {});

        if (metadata.__enrichedMetadata) {
            record.metadata = metadata;
            return metadata;
        }

        const globalObj = global || {};
        const examEntry = findExamEntry(record, metadata, globalObj);

        if (examEntry) {
            if (examEntry.title && !metadata.examTitle) {
                metadata.examTitle = examEntry.title;
            }
            if (examEntry.frequency && !metadata.frequency) {
                metadata.frequency = examEntry.frequency;
            }
            if (examEntry.type && !metadata.type) {
                metadata.type = examEntry.type;
            }
        }

        metadata.category = inferCategory(record, metadata, examEntry);
        if (!metadata.frequency) {
            if (examEntry && examEntry.frequency) {
                metadata.frequency = examEntry.frequency;
            } else if (metadata.frequency == null) {
                metadata.frequency = 'unknown';
            }
        }

        if (!metadata.examTitle) {
            metadata.examTitle = record.title || record.examId || '未知题目';
        }

        metadata.__enrichedMetadata = true;

        record.metadata = metadata;

        if (!record.category || record.category === 'Unknown') {
            record.category = metadata.category;
        }

        if (!record.frequency || record.frequency === 'unknown') {
            record.frequency = metadata.frequency;
        }

        if (!record.title && metadata.examTitle) {
            record.title = metadata.examTitle;
        }

        return metadata;
    }

    function withEnrichedMetadata(record) {
        if (!record || typeof record !== 'object') {
            return record;
        }
        const clone = Object.assign({}, record);
        clone.metadata = Object.assign({}, record.metadata || {});
        enrichRecordMetadata(clone);
        return clone;
    }

    const AnswerComparisonUtils = {
        getNormalizedEntries,
        summariseEntries,
        enrichRecordMetadata,
        withEnrichedMetadata
    };

    global.AnswerComparisonUtils = AnswerComparisonUtils;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AnswerComparisonUtils;
    }

})(typeof window !== 'undefined' ? window : globalThis);


// ===== js/utils/BrowsePreferencesUtils.js =====
// Browse Preferences and View Management Utilities
// Extracted from main.js to modularize browse view logic

(function (global) {
    'use strict';

    const BROWSE_VIEW_PREFERENCE_KEY = 'browse_view_preferences_v2';
    let browsePreferencesCache = null;
    let currentBrowseScrollElement = null;
    let removeBrowseScrollListener = null;
    let pendingBrowseAutoScroll = null;
    let browsePreferenceUiInitialized = false;
    let pendingBrowseScrollSnapshot = null;

    // --- Helper Functions ---

    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = null;
                fn.apply(this, args);
            }, wait);
        };
    }

    function escapeCssIdentifier(value) {
        if (typeof value !== 'string') {
            return '';
        }
        if (global.CSS && typeof global.CSS.escape === 'function') {
            return global.CSS.escape(value);
        }
        return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    // --- Normalization Functions ---

    function normalizeCategoryKey(category) {
        if (!category || typeof category !== 'string') {
            return 'all';
        }
        const trimmed = category.trim();
        if (!trimmed) {
            return 'all';
        }
        const match = trimmed.match(/^(P\d)$/i);
        if (match) {
            return match[1].toUpperCase();
        }
        // 处理 "Part 1", "Part 2" 等格式
        const partMatch = trimmed.match(/^Part\s+([1-4])$/i);
        if (partMatch) {
            return 'P' + partMatch[1];
        }
        const embedded = trimmed.match(/\b(P[1-4])\b/i);
        if (embedded) {
            return embedded[1].toUpperCase();
        }
        return trimmed;
    }

    function normalizeExamType(type) {
        if (!type || typeof type !== 'string') {
            return 'all';
        }
        const lower = type.toLowerCase();
        if (lower === 'reading' || lower === 'listening') {
            return lower;
        }
        if (lower.includes('阅读')) {
            return 'reading';
        }
        if (lower.includes('听力')) {
            return 'listening';
        }
        return 'all';
    }

    function buildBrowseFilterKey(category, type) {
        return `${normalizeCategoryKey(category)}|${normalizeExamType(type)}`;
    }

    // --- Preference Management ---

    function getDefaultBrowsePreferences() {
        return {
            scrollPositions: {},
            listAnchors: {},
            autoScrollEnabled: true,
            lastFilter: null
        };
    }

    function mergeBrowseAnchors(currentAnchors = {}, updates) {
        const next = Object.assign({}, currentAnchors);
        if (!updates || typeof updates !== 'object') {
            return next;
        }

        for (const [key, value] of Object.entries(updates)) {
            if (typeof key !== 'string' || !key) {
                continue;
            }
            if (value === null) {
                delete next[key];
                continue;
            }
            if (!value || typeof value !== 'object') {
                continue;
            }

            const normalized = {};
            if (typeof value.examId === 'string' && value.examId.trim()) {
                normalized.examId = value.examId.trim();
            }
            if (typeof value.title === 'string' && value.title.trim()) {
                normalized.title = value.title.trim();
            }
            if (Number.isFinite(value.scrollTop) && value.scrollTop >= 0) {
                normalized.scrollTop = Math.round(value.scrollTop);
            }
            const ts = Number(value.timestamp);
            normalized.timestamp = Number.isFinite(ts) && ts > 0 ? Math.round(ts) : Date.now();

            if (!normalized.examId && !normalized.title && typeof normalized.scrollTop !== 'number') {
                delete next[key];
                continue;
            }

            next[key] = normalized;
        }

        return next;
    }

    function loadBrowsePreferencesFromStorage() {
        try {
            const raw = localStorage.getItem(BROWSE_VIEW_PREFERENCE_KEY);
            if (!raw) {
                return getDefaultBrowsePreferences();
            }
            const parsed = JSON.parse(raw);
            const defaults = getDefaultBrowsePreferences();
            const next = Object.assign({}, defaults, parsed || {});
            if (!next.scrollPositions || typeof next.scrollPositions !== 'object') {
                next.scrollPositions = {};
            }
            next.listAnchors = mergeBrowseAnchors({}, next.listAnchors);
            return next;
        } catch (error) {
            console.warn('[BrowsePreferences] 无法读取浏览偏好，使用默认值', error);
            return getDefaultBrowsePreferences();
        }
    }

    function getBrowseViewPreferences() {
        if (!browsePreferencesCache) {
            browsePreferencesCache = loadBrowsePreferencesFromStorage();
        }
        return browsePreferencesCache;
    }

    function saveBrowseViewPreferences(partial = {}) {
        const current = getBrowseViewPreferences();
        const next = {
            scrollPositions: Object.assign({}, current.scrollPositions, partial.scrollPositions || {}),
            listAnchors: mergeBrowseAnchors(current.listAnchors, partial.listAnchors),
            autoScrollEnabled: Object.prototype.hasOwnProperty.call(partial, 'autoScrollEnabled')
                ? !!partial.autoScrollEnabled
                : current.autoScrollEnabled,
            lastFilter: Object.prototype.hasOwnProperty.call(partial, 'lastFilter')
                ? (partial.lastFilter || null)
                : current.lastFilter
        };

        try {
            localStorage.setItem(BROWSE_VIEW_PREFERENCE_KEY, JSON.stringify(next));
            browsePreferencesCache = next;
        } catch (error) {
            console.warn('[BrowsePreferences] 保存浏览偏好失败', error);
            browsePreferencesCache = next;
        }
        return browsePreferencesCache;
    }

    function persistBrowseFilter(category, type) {
        const normalizedCategory = normalizeCategoryKey(category);
        const normalizedType = normalizeExamType(type);
        saveBrowseViewPreferences({
            lastFilter: { category: normalizedCategory, type: normalizedType }
        });
    }

    function getPersistedBrowseFilter() {
        const prefs = getBrowseViewPreferences();
        if (!prefs.lastFilter) {
            return null;
        }
        return {
            category: normalizeCategoryKey(prefs.lastFilter.category),
            type: normalizeExamType(prefs.lastFilter.type)
        };
    }

    // --- Scroll Management ---

    function captureBrowseScrollSnapshot(category, type, scrollTop) {
        const normalizedCategory = normalizeCategoryKey(category);
        const normalizedType = normalizeExamType(type);
        const sanitizedScrollTop = Math.max(0, Math.round(scrollTop || 0));
        pendingBrowseScrollSnapshot = {
            category: normalizedCategory,
            type: normalizedType,
            scrollTop: sanitizedScrollTop
        };
        return pendingBrowseScrollSnapshot;
    }

    function persistBrowseScrollSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        const key = buildBrowseFilterKey(snapshot.category, snapshot.type);
        saveBrowseViewPreferences({
            scrollPositions: { [key]: snapshot.scrollTop }
        });
    }

    function flushPendingBrowseScrollPosition() {
        persistBrowseScrollSnapshot(pendingBrowseScrollSnapshot);
    }

    function recordBrowseScrollPosition(category, type, scrollTop) {
        const snapshot = captureBrowseScrollSnapshot(category, type, scrollTop);
        persistBrowseScrollSnapshot(snapshot);
    }

    function restoreBrowseScrollPosition(scrollEl, category, type) {
        const prefs = getBrowseViewPreferences();
        const key = buildBrowseFilterKey(category, type);
        const stored = prefs.scrollPositions[key];
        if (typeof stored === 'number' && stored >= 0) {
            scrollEl.scrollTop = stored;
            return true;
        }
        return false;
    }

    function ensureBrowseScrollListener(scrollEl) {
        if (!scrollEl) {
            return;
        }
        if (currentBrowseScrollElement === scrollEl) {
            return;
        }
        if (typeof removeBrowseScrollListener === 'function') {
            removeBrowseScrollListener();
            removeBrowseScrollListener = null;
        }

        const persist = debounce(() => {
            flushPendingBrowseScrollPosition();
        }, 150);

        const handleScroll = () => {
            const category = global.getCurrentCategory ? global.getCurrentCategory() : 'all';
            const type = global.getCurrentExamType ? global.getCurrentExamType() : 'all';
            captureBrowseScrollSnapshot(category, type, scrollEl.scrollTop);
            persist();
        };

        const initialCategory = global.getCurrentCategory ? global.getCurrentCategory() : 'all';
        const initialType = global.getCurrentExamType ? global.getCurrentExamType() : 'all';
        captureBrowseScrollSnapshot(initialCategory, initialType, scrollEl.scrollTop);

        scrollEl.addEventListener('scroll', handleScroll, { passive: true });
        currentBrowseScrollElement = scrollEl;
        removeBrowseScrollListener = () => {
            try { scrollEl.removeEventListener('scroll', handleScroll); } catch (_) { }
            currentBrowseScrollElement = null;
            flushPendingBrowseScrollPosition();
        };
    }

    // --- Auto Scroll Logic ---

    function requestBrowseAutoScroll(category, type, source = 'category-card') {
        pendingBrowseAutoScroll = {
            category: normalizeCategoryKey(category),
            type: normalizeExamType(type),
            source,
            timestamp: Date.now()
        };
    }

    function clearPendingBrowseAutoScroll() {
        pendingBrowseAutoScroll = null;
    }

    function consumeBrowseAutoScroll(category, type) {
        if (!pendingBrowseAutoScroll) {
            return null;
        }
        const now = Date.now();
        if (now - pendingBrowseAutoScroll.timestamp > 5000) {
            pendingBrowseAutoScroll = null;
            return null;
        }
        const normalizedCategory = normalizeCategoryKey(category);
        const normalizedType = normalizeExamType(type);
        const categoryMatch = pendingBrowseAutoScroll.category === normalizedCategory;
        const typeMatch = pendingBrowseAutoScroll.type === 'all'
            || pendingBrowseAutoScroll.type === normalizedType;
        if (categoryMatch && typeMatch) {
            const context = pendingBrowseAutoScroll;
            pendingBrowseAutoScroll = null;
            return context;
        }
        return null;
    }

    // --- Data Helpers ---

    function deriveRecordTimestamp(record) {
        if (!record || typeof record !== 'object') {
            return Number.NaN;
        }
        const candidates = [];
        if (record.date) candidates.push(record.date);
        if (record.endTime) candidates.push(record.endTime);
        if (record.completedAt) candidates.push(record.completedAt);
        if (record.timestamp) candidates.push(record.timestamp);
        if (record.startTime) candidates.push(record.startTime);
        const realData = record.realData || {};
        if (realData.completedAt) candidates.push(realData.completedAt);
        if (realData.endTime) candidates.push(realData.endTime);
        if (realData.date) candidates.push(realData.date);

        for (const value of candidates) {
            if (value == null) {
                continue;
            }
            if (typeof value === 'number') {
                if (Number.isFinite(value)) {
                    return value;
                }
                continue;
            }
            const parsed = Date.parse(value);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
        return Number.NaN;
    }

    function resolveRecordExamInfo(record, examIndex) {
        if (!record || typeof record !== 'object') {
            return null;
        }
        const metadata = record.metadata || {};
        const examId = record.examId || metadata.examId || metadata.originalExamId || null;
        let category = normalizeCategoryKey(record.category || record.examCategory || metadata.category);
        let type = normalizeExamType(record.type || record.examType || metadata.examType);
        let title = record.title || record.examTitle || metadata.examTitle || metadata.title || null;

        if (category === 'all' || category === 'Unknown' || !title || type === 'all') {
            const list = Array.isArray(examIndex) ? examIndex : [];
            let entry = null;
            if (examId) {
                entry = list.find((exam) => exam && exam.id === examId);
            }
            if (!entry && title) {
                entry = list.find((exam) => exam && exam.title === title);
            }
            if (entry) {
                if ((category === 'all' || category === 'Unknown') && entry.category) {
                    category = normalizeCategoryKey(entry.category);
                }
                if (type === 'all' && entry.type) {
                    type = normalizeExamType(entry.type);
                }
                if (!title && entry.title) {
                    title = entry.title;
                }
            }
        }

        if (!examId && !title) {
            return null;
        }

        return {
            examId,
            category,
            type,
            title: title || examId
        };
    }

    function findLastPracticeExamEntry(exams, category, type) {
        const normalizedCategory = normalizeCategoryKey(category);
        const normalizedType = normalizeExamType(type);
        const records = global.getPracticeRecordsState ? global.getPracticeRecordsState() : [];
        if (!Array.isArray(records) || records.length === 0) {
            return null;
        }

        const examIndex = global.getExamIndexState ? global.getExamIndexState() : [];
        let latest = null;
        let latestTimestamp = Number.NEGATIVE_INFINITY;

        records.forEach((record) => {
            const info = resolveRecordExamInfo(record, examIndex);
            if (!info) {
                return;
            }
            if (normalizedCategory !== 'all' && info.category !== normalizedCategory) {
                return;
            }
            if (normalizedType !== 'all' && info.type !== normalizedType) {
                return;
            }
            const timestamp = deriveRecordTimestamp(record);
            if (!Number.isFinite(timestamp)) {
                return;
            }
            if (timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
                latest = info;
            }
        });

        if (!latest) {
            return null;
        }

        const list = Array.isArray(exams) ? exams : [];
        const index = list.findIndex((exam) => {
            if (!exam) {
                return false;
            }
            if (latest.examId && exam.id === latest.examId) {
                return true;
            }
            if (latest.title && exam.title === latest.title) {
                return true;
            }
            return false;
        });

        if (index === -1) {
            return null;
        }

        return { index, exam: list[index] };
    }

    function findExamEntryByAnchor(exams, anchor) {
        if (!anchor || typeof anchor !== 'object') {
            return null;
        }
        const list = Array.isArray(exams) ? exams : [];
        let index = -1;
        if (anchor.examId) {
            index = list.findIndex((exam) => exam && exam.id === anchor.examId);
        }
        if (index === -1 && anchor.title) {
            index = list.findIndex((exam) => exam && exam.title === anchor.title);
        }
        if (index === -1) {
            return null;
        }
        return { index, exam: list[index] };
    }

    function getBrowseListAnchor(category, type) {
        const prefs = getBrowseViewPreferences();
        const key = buildBrowseFilterKey(category, type);
        const anchor = prefs.listAnchors && prefs.listAnchors[key];
        if (!anchor || typeof anchor !== 'object') {
            return null;
        }
        const result = {};
        if (typeof anchor.examId === 'string' && anchor.examId.trim()) {
            result.examId = anchor.examId.trim();
        }
        if (typeof anchor.title === 'string' && anchor.title.trim()) {
            result.title = anchor.title.trim();
        }
        if (Number.isFinite(anchor.timestamp) && anchor.timestamp > 0) {
            result.timestamp = Math.round(anchor.timestamp);
        }
        if (!result.examId && !result.title) {
            return null;
        }
        return result;
    }

    function scrollExamListToEntry(scrollEl, entry) {
        if (!scrollEl || !entry || entry.index == null || entry.index < 0) {
            return false;
        }
        const exam = entry.exam || {};
        let selector = null;
        if (exam.id) {
            selector = `[data-exam-id="${escapeCssIdentifier(exam.id)}"]`;
        }

        let element = selector ? scrollEl.querySelector(selector) : null;
        if (!element) {
            const items = scrollEl.querySelectorAll('.exam-item');
            element = Array.from(items).find((item) => {
                const titleNode = item.querySelector('h4');
                return titleNode && titleNode.textContent && exam.title && titleNode.textContent.trim() === exam.title.trim();
            }) || null;
        }

        if (!element) {
            return false;
        }

        const targetTop = element.offsetTop - (scrollEl.clientHeight / 2) + (element.offsetHeight / 2);
        scrollEl.scrollTop = Math.max(0, targetTop);
        return true;
    }

    // --- UI Logic ---

    function updateBrowsePreferenceIndicator(enabled) {
        const trigger = document.getElementById('browse-title-trigger');
        if (!trigger) {
            return;
        }
        const isEnabled = !!enabled;
        trigger.classList.toggle('active', isEnabled);
        trigger.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
        trigger.setAttribute('title', isEnabled ? '列表位置记录：已开启' : '列表位置记录：已关闭');
    }

    function setBrowseTitle(text) {
        const titleEl = document.getElementById('browse-title');
        if (titleEl) {
            titleEl.textContent = text;
        }
    }

    function formatBrowseTitle(category = 'all', type = 'all') {
        const normalizedCategory = normalizeCategoryKey(category);
        const normalizedType = normalizeExamType(type);
        if (normalizedCategory === 'all' && normalizedType === 'all') {
            return '题库浏览';
        }

        const parts = [];
        if (normalizedCategory !== 'all') {
            parts.push(normalizedCategory);
        }
        if (normalizedType !== 'all') {
            parts.push(normalizedType === 'reading' ? '阅读' : '听力');
        }
        parts.push('题库浏览');
        return parts.join(' ');
    }

    function setupBrowsePreferenceUI() {
        const trigger = document.getElementById('browse-title-trigger');
        const panel = document.getElementById('browse-preference-panel');
        const checkbox = document.getElementById('browse-remember-position');

        if (!trigger || !panel || !checkbox) {
            return;
        }

        const prefs = getBrowseViewPreferences();
        checkbox.checked = !!prefs.autoScrollEnabled;
        updateBrowsePreferenceIndicator(prefs.autoScrollEnabled);

        if (browsePreferenceUiInitialized) {
            return;
        }

        browsePreferenceUiInitialized = true;

        const closePanel = () => {
            if (panel) {
                panel.hidden = true;
            }
            trigger.setAttribute('aria-expanded', 'false');
        };

        const applyAutoScrollPreference = (enabled, showMessage = false) => {
            const next = saveBrowseViewPreferences({ autoScrollEnabled: !!enabled });
            checkbox.checked = !!next.autoScrollEnabled;
            updateBrowsePreferenceIndicator(next.autoScrollEnabled);
            if (showMessage && typeof global.showMessage === 'function') {
                const message = next.autoScrollEnabled
                    ? '已开启列表位置记录，将自动恢复到上次答题的位置'
                    : '已关闭列表位置记录';
                global.showMessage(message, 'info');
            }
            closePanel();
        };

        // 兼容原始交互：📚 按钮直接作为开关入口
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            applyAutoScrollPreference(!checkbox.checked, true);
        });

        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                applyAutoScrollPreference(!checkbox.checked, true);
            }
        });

        document.addEventListener('click', (event) => {
            if (panel.hidden) {
                return;
            }
            if (event.target === trigger || trigger.contains(event.target)) {
                return;
            }
            if (panel.contains(event.target)) {
                return;
            }
            closePanel();
        });

        checkbox.addEventListener('change', (event) => {
            applyAutoScrollPreference(!!event.target.checked, true);
        });
    }

    function handlePostExamListRender(exams, { category, type } = {}) {
        const scrollEl = document.querySelector('#exam-list-container .exam-list');
        if (!scrollEl) {
            return;
        }

        ensureBrowseScrollListener(scrollEl);

        const normalizedCategory = normalizeCategoryKey(category || (global.getCurrentCategory ? global.getCurrentCategory() : 'all'));
        const normalizedType = normalizeExamType(type || (global.getCurrentExamType ? global.getCurrentExamType() : 'all'));
        const autoScrollContext = consumeBrowseAutoScroll(normalizedCategory, normalizedType);
        const prefs = getBrowseViewPreferences();

        const applyScroll = () => {
            const performFallback = () => {
                if (!restoreBrowseScrollPosition(scrollEl, normalizedCategory, normalizedType)) {
                    if (prefs.autoScrollEnabled) {
                        scrollEl.scrollTop = 0;
                    }
                }
            };

            const attemptScrollToEntry = (entry, remaining, onFail) => {
                if (scrollExamListToEntry(scrollEl, entry)) {
                    recordBrowseScrollPosition(normalizedCategory, normalizedType, scrollEl.scrollTop);
                    return;
                }
                if (remaining > 0) {
                    setTimeout(() => attemptScrollToEntry(entry, remaining - 1, onFail), 80);
                    return;
                }
                if (typeof onFail === 'function') {
                    onFail();
                }
            };

            if (prefs.autoScrollEnabled && (normalizedCategory !== 'all' || normalizedType !== 'all')) {
                const entry = findLastPracticeExamEntry(exams, normalizedCategory, normalizedType);
                if (entry) {
                    const retries = autoScrollContext ? 7 : 4;
                    attemptScrollToEntry(entry, retries, performFallback);
                    return;
                }
                const anchor = getBrowseListAnchor(normalizedCategory, normalizedType);
                if (anchor) {
                    const entryFromAnchor = findExamEntryByAnchor(exams, anchor);
                    if (entryFromAnchor) {
                        attemptScrollToEntry(entryFromAnchor, 3, performFallback);
                        return;
                    }
                }
            }

            performFallback();
        };

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(applyScroll);
        } else {
            applyScroll();
        }
    }

    function updateBrowseAnchorsFromRecords(records) {
        const list = Array.isArray(records) ? records : [];
        const examIndex = global.getExamIndexState ? global.getExamIndexState() : [];
        const updates = {};
        const seenKeys = new Set();

        list.forEach((record) => {
            const info = resolveRecordExamInfo(record, examIndex);
            if (!info) {
                return;
            }
            const key = buildBrowseFilterKey(info.category, info.type);
            const timestamp = deriveRecordTimestamp(record);
            if (!Number.isFinite(timestamp)) {
                return;
            }
            const anchor = {
                examId: info.examId || null,
                title: info.title || null,
                timestamp
            };
            const existing = updates[key];
            if (!existing || timestamp > existing.timestamp) {
                updates[key] = anchor;
            }
            seenKeys.add(key);
        });

        const currentAnchors = getBrowseViewPreferences().listAnchors || {};
        Object.keys(currentAnchors || {}).forEach((key) => {
            if (!seenKeys.has(key)) {
                updates[key] = null;
            }
        });

        if (Object.keys(updates).length === 0) {
            return;
        }

        saveBrowseViewPreferences({ listAnchors: updates });
    }

    // --- Global Event Listeners ---

    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', flushPendingBrowseScrollPosition);
        window.addEventListener('beforeunload', flushPendingBrowseScrollPosition);

        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    flushPendingBrowseScrollPosition();
                }
            });
        }
    }

    // --- Exports ---

    global.normalizeCategoryKey = normalizeCategoryKey;
    global.normalizeExamType = normalizeExamType;
    global.buildBrowseFilterKey = buildBrowseFilterKey;
    global.getBrowseViewPreferences = getBrowseViewPreferences;
    global.saveBrowseViewPreferences = saveBrowseViewPreferences;
    global.persistBrowseFilter = persistBrowseFilter;
    global.getPersistedBrowseFilter = getPersistedBrowseFilter;
    global.updateBrowseAnchorsFromRecords = updateBrowseAnchorsFromRecords;

    global.setBrowseTitle = setBrowseTitle;
    global.formatBrowseTitle = formatBrowseTitle;
    global.handlePostExamListRender = handlePostExamListRender;
    global.requestBrowseAutoScroll = requestBrowseAutoScroll;
    global.clearPendingBrowseAutoScroll = clearPendingBrowseAutoScroll;
    global.setupBrowsePreferenceUI = setupBrowsePreferenceUI;
    global.deriveRecordTimestamp = deriveRecordTimestamp;
    global.resolveRecordExamInfo = resolveRecordExamInfo;

})(typeof window !== "undefined" ? window : globalThis);


// ===== js/utils/performance.js =====
/**
 * 性能优化工具库 - Linus式实用主义
 * 整合所有性能相关的重复代码
 */

/**
 * 统一缓存系统
 */
class CacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 100;
        this.defaultTTL = options.defaultTTL || 300000; // 5分钟
        this.timers = new Map();
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * 设置缓存
     * @param {string} key 键
     * @param {any} value 值
     * @param {number} ttl 过期时间(毫秒)
     */
    set(key, value, ttl = this.defaultTTL) {
        // 清理过期的定时器
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // 检查容量
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            // LRU: 删除最旧的条目
            const firstKey = this.cache.keys().next().value;
            this.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });

        // 设置过期定时器
        if (ttl > 0) {
            const timer = setTimeout(() => {
                this.delete(key);
            }, ttl);
            this.timers.set(key, timer);
        }
    }

    /**
     * 获取缓存
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.missCount++;
            return null;
        }

        // 检查过期
        if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
            this.delete(key);
            this.missCount++;
            return null;
        }

        // LRU: 移到最后
        this.cache.delete(key);
        this.cache.set(key, item);
        this.hitCount++;

        return item.value;
    }

    /**
     * 删除缓存
     */
    delete(key) {
        this.cache.delete(key);
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }

    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * 估算内存使用
     */
    estimateMemoryUsage() {
        let total = 0;
        for (const [key, item] of this.cache) {
            total += key.length * 2; // 字符串大小估算
            total += JSON.stringify(item.value).length * 2;
        }
        return total;
    }
}

/**
 * 防抖和节流管理器
 */
class ThrottleManager {
    constructor() {
        this.debounces = new Map();
        this.throttles = new Map();
        this.rafCallbacks = new Set();
    }

    /**
     * 防抖函数
     */
    debounce(key, func, wait, immediate = false) {
        const existing = this.debounces.get(key);
        if (existing) {
            clearTimeout(existing.timer);
        }

        const timer = setTimeout(() => {
            if (!immediate) {
                func.apply(this, arguments);
            }
            this.debounces.delete(key);
        }, wait);

        this.debounces.set(key, { timer, func, immediate });

        if (immediate && !existing) {
            func.apply(this, arguments);
        }
    }

    /**
     * 节流函数
     */
    throttle(key, func, limit) {
        const existing = this.throttles.get(key);
        if (existing) {
            return existing; // 返回相同的包装函数
        }

        let inThrottle = false;
        const throttledFunc = (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };

        this.throttles.set(key, throttledFunc);
        return throttledFunc;
    }

    /**
     * RAF节流
     */
    raf(key, func) {
        if (this.rafCallbacks.has(func)) {
            return; // 已经在队列中
        }

        this.rafCallbacks.add(func);

        const runCallback = () => {
            func();
            this.rafCallbacks.delete(func);
        };

        requestAnimationFrame(runCallback);
    }

    /**
     * 清理所有定时器
     */
    cleanup() {
        for (const { timer } of this.debounces.values()) {
            clearTimeout(timer);
        }
        this.debounces.clear();
        this.throttles.clear();
        this.rafCallbacks.clear();
    }
}

/**
 * 渲染性能监控
 */
class RenderMonitor {
    constructor() {
        this.metrics = {
            renderCount: 0,
            totalRenderTime: 0,
            slowRenders: [],
            lastRenderTime: 0
        };
        this.slowThreshold = 16; // 16ms = 60fps
    }

    /**
     * 开始监控渲染
     */
    startRender(name = 'unknown') {
        return {
            startTime: performance.now(),
            name
        };
    }

    /**
     * 结束监控渲染
     */
    endRender(renderContext) {
        const duration = performance.now() - renderContext.startTime;

        this.metrics.renderCount++;
        this.metrics.totalRenderTime += duration;
        this.metrics.lastRenderTime = duration;

        if (duration > this.slowThreshold) {
            this.metrics.slowRenders.push({
                name: renderContext.name,
                duration,
                timestamp: Date.now()
            });

            // 只保留最近100个慢渲染
            if (this.metrics.slowRenders.length > 100) {
                this.metrics.slowRenders.shift();
            }

            console.warn(`[RenderMonitor] 慢渲染检测: ${renderContext.name} 耗时 ${duration.toFixed(2)}ms`);
        }

        return duration;
    }

    /**
     * 获取渲染统计
     */
    getStats() {
        const avgRenderTime = this.metrics.renderCount > 0
            ? this.metrics.totalRenderTime / this.metrics.renderCount
            : 0;

        return {
            ...this.metrics,
            averageRenderTime: avgRenderTime,
            slowRenderCount: this.metrics.slowRenders.length,
            performance: avgRenderTime < this.slowThreshold ? 'good' : 'poor'
        };
    }

    /**
     * 清理统计数据
     */
    clear() {
        this.metrics = {
            renderCount: 0,
            totalRenderTime: 0,
            slowRenders: [],
            lastRenderTime: 0
        };
    }
}

/**
 * 内存泄漏检测
 */
class MemoryLeakDetector {
    constructor() {
        this.references = new Map();
        this.timers = new Set();
        this.listeners = new Set();
    }

    /**
     * 跟踪对象引用
     */
    track(key, object, description = '') {
        this.references.set(key, {
            object,
            description,
            timestamp: Date.now()
        });
    }

    /**
     * 释放对象引用
     */
    release(key) {
        this.references.delete(key);
    }

    /**
     * 跟踪定时器
     */
    trackTimer(timerId, description = '') {
        this.timers.add({
            id: timerId,
            description,
            timestamp: Date.now()
        });
    }

    /**
     * 清理定时器
     */
    clearTimer(timerId) {
        for (const timer of this.timers) {
            if (timer.id === timerId) {
                clearTimeout(timerId);
                this.timers.delete(timer);
                return true;
            }
        }
        return false;
    }

    /**
     * 检查潜在泄漏
     */
    detectLeaks() {
        const now = Date.now();
        const leaks = [];

        // 检查长时间存活的对象引用
        for (const [key, ref] of this.references) {
            const age = now - ref.timestamp;
            if (age > 300000) { // 5分钟
                leaks.push({
                    type: 'object',
                    key,
                    description: ref.description,
                    age
                });
            }
        }

        // 检查长时间存活的定时器
        for (const timer of this.timers) {
            const age = now - timer.timestamp;
            if (age > 60000) { // 1分钟
                leaks.push({
                    type: 'timer',
                    id: timer.id,
                    description: timer.description,
                    age
                });
            }
        }

        return leaks;
    }

    /**
     * 清理所有跟踪的资源
     */
    cleanup() {
        // 清理所有定时器
        for (const timer of this.timers) {
            clearTimeout(timer.id);
        }
        this.timers.clear();

        // 清理所有引用
        this.references.clear();
    }
}

/**
 * 全局性能工具实例
 */
const Performance = {
    cache: new CacheManager({ maxSize: 200, defaultTTL: 300000 }),
    throttle: new ThrottleManager(),
    render: new RenderMonitor(),
    memory: new MemoryLeakDetector(),

    // 便捷方法
    debounce: (key, func, wait, immediate) => Performance.throttle.debounce(key, func, wait, immediate),
    throttle: (key, func, limit) => Performance.throttle.throttle(key, func, limit),
    raf: (key, func) => Performance.throttle.raf(key, func),
    cacheGet: (key) => Performance.cache.get(key),
    cacheSet: (key, value, ttl) => Performance.cache.set(key, value, ttl),
    startRender: (name) => Performance.render.startRender(name),
    endRender: (context) => Performance.render.endRender(context),
    track: (key, object, description) => Performance.memory.track(key, object, description),
    release: (key) => Performance.memory.release(key),
    trackTimer: (timerId, description) => Performance.memory.trackTimer(timerId, description),

    // 性能报告
    getReport() {
        return {
            cache: Performance.cache.getStats(),
            render: Performance.render.getStats(),
            memory: {
                trackedObjects: Performance.memory.references.size,
                activeTimers: Performance.memory.timers.size,
                leaks: Performance.memory.detectLeaks()
            },
            timestamp: Date.now()
        };
    },

    // 清理资源
    cleanup() {
        Performance.cache.clear();
        Performance.throttle.cleanup();
        Performance.render.clear();
        Performance.memory.cleanup();
    }
};

// 导出到全局 (避免覆盖浏览器原生Performance API)
window.AppPerformance = Performance;

// 向后兼容别名
window.CacheManager = CacheManager;
window.ThrottleManager = ThrottleManager;
window.RenderMonitor = RenderMonitor;
window.MemoryLeakDetector = MemoryLeakDetector;

console.log('[AppPerformance] 性能工具库已加载，统一缓存、防抖节流、渲染监控和内存管理');

// ===== js/utils/typeChecker.js =====
/**
 * IELTS系统类型检查工具 - JSDoc实现
 * 无需构建工具，IDE自动支持类型检查
 */

/**
 * JSDoc类型定义模板
 * 使用VS Code + JSDoc可获得完整的类型支持
 */

/**
 * @typedef {Object} ExamItem 题目数据结构
 * @property {string} id - 题目ID
 * @property {string} type - 题目类型: reading|listening
 * @property {string} category - 题目分类: P1|P2|P3|P4
 * @property {string} title - 题目标题
 * @property {string} content - 题目内容
 * @property {Object} options - 选项对象
 * @property {string} answer - 正确答案
 * @property {string} explanation - 解释说明
 * @property {number} difficulty - 难度等级 1-5
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * @typedef {Object} PracticeRecord 练习记录数据结构
 * @property {string} id - 记录ID
 * @property {string} examId - 题目ID
 * @property {string} userAnswer - 用户答案
 * @property {boolean} isCorrect - 是否正确
 * @property {number} score - 得分
 * @property {number} timeSpent - 耗时(秒)
 * @property {Date} startTime - 开始时间
 * @property {Date} endTime - 结束时间
 * @property {Object} metadata - 元数据
 */

/**
 * @typedef {Object} UserSettings 用户设置数据结构
 * @property {Object} preferences - 用户偏好
 * @property {string} preferences.theme - 主题: light|dark
 * @property {string} preferences.language - 语言: zh-CN|en-US
 * @property {Object} practice - 练习设置
 * @property {number} practice.dailyGoal - 每日目标
 * @property {boolean} practice.showTimer - 显示计时器
 * @property {boolean} practice.showScore - 显示分数
 * @property {Object} ui - UI设置
 * @property {boolean} ui.showHints - 显示提示
 * @property {boolean} ui.autoSave - 自动保存
 */

/**
 * @typedef {Object} PerformanceStats 性能统计数据结构
 * @property {Object} cache - 缓存统计
 * @property {number} cache.size - 缓存大小
 * @property {number} cache.hitRate - 命中率
 * @property {Object} render - 渲染统计
 * @property {number} render.count - 渲染次数
 * @property {number} render.averageTime - 平均渲染时间
 * @property {Object} memory - 内存统计
 * @property {number} memory.used - 已使用内存
 * @property {number} memory.limit - 内存限制
 */

/**
 * 类型检查工具类
 */
class TypeChecker {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.typeDefinitions = new Map();
        this.setupTypeDefinitions();
    }

    /**
     * 设置基础类型定义
     */
    setupTypeDefinitions() {
        // 基础类型验证器
        this.typeDefinitions.set('string', (value) => typeof value === 'string');
        this.typeDefinitions.set('number', (value) => typeof value === 'number' && !isNaN(value));
        this.typeDefinitions.set('boolean', (value) => typeof value === 'boolean');
        this.typeDefinitions.set('object', (value) => typeof value === 'object' && value !== null);
        this.typeDefinitions.set('array', (value) => Array.isArray(value));
        this.typeDefinitions.set('function', (value) => typeof value === 'function');
        this.typeDefinitions.set('date', (value) => value instanceof Date);
        this.typeDefinitions.set('element', (value) => value instanceof Element);

        // 自定义类型验证器
        this.typeDefinitions.set('ExamItem', this.validateExamItem.bind(this));
        this.typeDefinitions.set('PracticeRecord', this.validatePracticeRecord.bind(this));
        this.typeDefinitions.set('UserSettings', this.validateUserSettings.bind(this));
    }

    /**
     * 验证ExamItem类型
     * @param {any} value 要验证的值
     * @returns {boolean} 是否为有效的ExamItem
     */
    validateExamItem(value) {
        if (!value || typeof value !== 'object') return false;

        const requiredFields = ['id', 'type', 'category', 'title', 'content'];
        for (const field of requiredFields) {
            if (typeof value[field] !== 'string') return false;
        }

        if (!['reading', 'listening'].includes(value.type)) return false;
        if (!['P1', 'P2', 'P3', 'P4'].includes(value.category)) return false;
        if (typeof value.difficulty !== 'number' || value.difficulty < 1 || value.difficulty > 5) return false;

        return true;
    }

    /**
     * 验证PracticeRecord类型
     * @param {any} value 要验证的值
     * @returns {boolean} 是否为有效的PracticeRecord
     */
    validatePracticeRecord(value) {
        if (!value || typeof value !== 'object') return false;

        const requiredFields = ['id', 'examId', 'userAnswer', 'isCorrect', 'score', 'timeSpent'];
        for (const field of requiredFields) {
            if (field === 'isCorrect') {
                if (typeof value[field] !== 'boolean') return false;
            } else if (field === 'score' || field === 'timeSpent') {
                if (typeof value[field] !== 'number' || value[field] < 0) return false;
            } else {
                if (typeof value[field] !== 'string') return false;
            }
        }

        if (!(value.startTime instanceof Date) || !(value.endTime instanceof Date)) return false;
        if (value.endTime < value.startTime) return false;

        return true;
    }

    /**
     * 验证UserSettings类型
     * @param {any} value 要验证的值
     * @returns {boolean} 是否为有效的UserSettings
     */
    validateUserSettings(value) {
        if (!value || typeof value !== 'object') return false;

        // 验证preferences
        if (!value.preferences || typeof value.preferences !== 'object') return false;
        if (!['light', 'dark'].includes(value.preferences.theme)) return false;
        if (!['zh-CN', 'en-US'].includes(value.preferences.language)) return false;

        // 验证practice设置
        if (!value.practice || typeof value.practice !== 'object') return false;
        if (typeof value.practice.dailyGoal !== 'number' || value.practice.dailyGoal <= 0) return false;

        return true;
    }

    /**
     * 验证单个值的类型
     * @param {any} value 要验证的值
     * @param {string} expectedType 期望的类型
     * @param {string} context 上下文信息
     * @returns {boolean} 验证是否通过
     */
    validateType(value, expectedType, context = '') {
        const validator = this.typeDefinitions.get(expectedType);
        if (!validator) {
            this.warnings.push(`Unknown type: ${expectedType} at ${context}`);
            return true; // 未知类型不报错
        }

        const isValid = validator(value);
        if (!isValid) {
            const actualType = Array.isArray(value) ? 'array' :
                            value instanceof Date ? 'date' :
                            value instanceof Element ? 'element' :
                            typeof value;
            this.errors.push(`Type mismatch at ${context}: expected ${expectedType}, got ${actualType}`);
        }

        return isValid;
    }

    /**
     * 验证函数参数
     * @param {function} func 要验证的函数
     * @param {Array} args 实际参数
     * @param {Array} expectedTypes 期望的类型数组
     */
    validateFunctionArguments(func, args, expectedTypes) {
        const funcName = func.name || 'anonymous';

        for (let i = 0; i < Math.min(args.length, expectedTypes.length); i++) {
            this.validateType(args[i], expectedTypes[i], `${funcName} argument ${i + 1}`);
        }

        if (args.length < expectedTypes.length) {
            this.warnings.push(`Function ${funcName} missing ${expectedTypes.length - args.length} arguments`);
        }
    }

    /**
     * 验证对象属性类型
     * @param {Object} obj 要验证的对象
     * @param {Object} schema 类型模式
     * @param {string} context 上下文
     */
    validateObjectSchema(obj, schema, context = 'object') {
        if (!obj || typeof obj !== 'object') {
            this.errors.push(`Expected object at ${context}, got ${typeof obj}`);
            return false;
        }

        let isValid = true;

        for (const [key, expectedType] of Object.entries(schema)) {
            if (!(key in obj)) {
                this.warnings.push(`Missing required property '${key}' at ${context}`);
                isValid = false;
                continue;
            }

            if (!this.validateType(obj[key], expectedType, `${context}.${key}`)) {
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * 检查函数返回值类型
     * @param {function} func 要检查的函数
     * @param {any} returnValue 返回值
     * @param {string} expectedType 期望的返回类型
     */
    validateReturnValue(func, returnValue, expectedType) {
        const funcName = func.name || 'anonymous';
        this.validateType(returnValue, expectedType, `${funcName} return value`);
    }

    /**
     * 运行时类型检查装饰器
     * @param {Object} schema 类型模式
     */
    runtimeTypeCheck(schema) {
        return (target, propertyName, descriptor) => {
            const method = descriptor.value;

            descriptor.value = function(...args) {
                // 检查参数类型
                if (schema.args) {
                    for (let i = 0; i < schema.args.length; i++) {
                        const expectedType = schema.args[i];
                        if (i < args.length) {
                            if (!window.typeChecker.validateType(args[i], expectedType, `${target.constructor.name}.${propertyName} arg ${i}`)) {
                                throw new TypeError(`Argument ${i} type mismatch`);
                            }
                        }
                    }
                }

                // 调用原方法
                const result = method.apply(this, args);

                // 检查返回值类型
                if (schema.returns) {
                    if (!window.typeChecker.validateType(result, schema.returns, `${target.constructor.name}.${propertyName} return`)) {
                        throw new TypeError(`Return value type mismatch`);
                    }
                }

                return result;
            };
        };
    }

    /**
     * 获取验证报告
     */
    getReport() {
        return {
            errors: [...this.errors],
            warnings: [...this.warnings],
            isValid: this.errors.length === 0,
            timestamp: Date.now()
        };
    }

    /**
     * 清理错误和警告
     */
    clear() {
        this.errors = [];
        this.warnings = [];
    }
}

/**
 * JSDoc类型注释生成器
 */
class JSDocGenerator {
    /**
     * 生成函数类型注释
     * @param {string} functionName 函数名
     * @param {Array} parameters 参数数组
     * @param {string} returnType 返回类型
     * @param {string} description 描述
     */
    static generateFunctionDoc(functionName, parameters, returnType, description = '') {
        let doc = `/**\n`;

        if (description) {
            doc += ` * ${description}\n`;
        }

        parameters.forEach((param, index) => {
            const { name, type, description: paramDesc } = param;
            doc += ` * @param {${type}} ${name}`;
            if (paramDesc) doc += ` - ${paramDesc}`;
            doc += `\n`;
        });

        if (returnType && returnType !== 'void') {
            doc += ` * @returns {${returnType}} 返回值\n`;
        }

        doc += ` */`;
        return doc;
    }

    /**
     * 生成类类型注释
     * @param {string} className 类名
     * @param {Array} properties 属性数组
     * @param {Array} methods 方法数组
     * @param {string} description 描述
     */
    static generateClassDoc(className, properties, methods, description = '') {
        let doc = `/**\n`;

        if (description) {
            doc += ` * ${description}\n`;
        }

        properties.forEach(prop => {
            const { name, type, description: propDesc } = prop;
            doc += ` * @property {${type}} ${name}`;
            if (propDesc) doc += ` - ${propDesc}`;
            doc += `\n`;
        });

        methods.forEach(method => {
            const { name, parameters, returnType, description: methodDesc } = method;
            doc += ` * @method {${returnType}} ${name}`;
            if (methodDesc) doc += ` - ${methodDesc}`;
            doc += `\n`;
        });

        doc += ` */`;
        return doc;
    }
}

// 导出到全局
window.TypeChecker = TypeChecker;
window.JSDocGenerator = JSDocGenerator;

// 创建全局实例
window.typeChecker = new TypeChecker();

console.log('[TypeChecker] JSDoc类型检查工具已加载');

// ===== js/utils/codeStandards.js =====
/**
 * IELTS系统代码规范 - Linus式简洁标准
 * 消除中文化注释，统一命名和代码风格
 */

/**
 * Linus式代码质量原则
 *
 * 1. 好品味 > 复杂设计
 *    - 消除特殊情况，而不是处理它们
 *    - 数据结构优于代码逻辑
 *    - 简单直接永远正确
 *
 * 2. Never break userspace
 *    - 向后兼容是铁律
 *    - API设计要谨慎
 *    - 破坏性改动 = Bug
 *
 * 3. 实用主义至上
 *    - 解决真实问题，不是理论问题
 *    - 性能优化基于测量，不是猜测
 *    - 简单可维护 > 理论完美
 */

/**
 * 命名规范
 */

// 函数命名：动词开头，驼峰命名，描述行为
const NAMING_CONVENTIONS = {
    // ✅ 好的命名
    goodFunctionNames: [
        'getUserData',           // 清晰的动词+名词
        'calculateScore',        // 明确的计算动作
        'renderList',           // 渲染动作
        'validateInput',        // 验证动作
        'cacheResults',         // 缓存动作
        'filterByType',         // 过滤动作
        'initComponents'        // 初始化动作
    ],

    // ❌ 垃圾命名
    badFunctionNames: [
        'data',                 // 名词，不是动词
        'handleClick',          // 太通用
        'process',              // 模糊不清
        'doStuff',             // 完全无意义
        'temp',                // 临时变量思维
        'helper',              // 辅助函数思维
        'func1',               // 数字后缀
        '处理数据'              // 中文命名
    ],

    // 变量命名：名词或形容词，驼峰命名
    goodVariableNames: [
        'userScore',            // 描述性名词
        'isLoading',            // 布尔值以is开头
        'examList',            // 集合以复数或List结尾
        'currentIndex',         // 索引清晰
        'hasPermission',        // 布尔值以has开头
        'maxAttempts'          // 极限值以max开头
    ],

    // 常量命名：全大写，下划线分隔
    goodConstantNames: [
        'MAX_RETRY_ATTEMPTS',    // 清晰的常量
        'DEFAULT_TIMEOUT',       // 默认值
        'API_BASE_URL',         // 配置常量
        'CACHE_SIZE_LIMIT'      // 限制常量
    ],

    // 类命名：PascalCase，描述实体
    goodClassNames: [
        'PerformanceMonitor',    // 监控器类
        'CacheManager',         // 管理器类
        'DOMBuilder',           // 构建器类
        'ValidationError'       // 错误类
    ]
};

/**
 * 注释规范
 */

// Linus式注释原则：
// 1. 解释"为什么"，不是"是什么"
// 2. 消除特殊情况，而不是注释它们
// 3. 好代码不需要注释，差代码注释也没用

const COMMENT_STANDARDS = {
    // ✅ 好的注释 - 解释设计决策
    goodComments: [
        // 使用事件委托而不是直接绑定，避免内存泄漏
        'DOM.delegate("click", ".item", handler)',

        // 缓存结果避免重复计算，数据量大时性能提升明显
        'const cached = this.cache.get(key)',

        // 强制使用DocumentFragment，避免多次DOM重排
        'DOM.replaceContent(container, fragment)',

        // 防抖处理，避免用户快速点击导致的重复请求
        'Performance.debounce("submit", handleSubmit, 1000)'
    ],

    // ❌ 垃圾注释 - 重复代码内容
    badComments: [
        // 定义变量
        'let count = 0;',

        // 返回结果
        'return result;',

        // 获取用户数据
        'function getUserData() {',

        // 如果存在则处理
        'if (element) { process(element); }'
    ],

    // ❌ 中文化注释 - 统一使用英文
    chineseComments: [
        '// 获取数据',
        '// 处理逻辑',
        '// 返回结果',
        '// 初始化组件',
        '// 检查条件'
    ]
};

/**
 * 代码结构规范
 */

const STRUCTURE_STANDARDS = {
    // 函数长度：不超过30行，理想情况<15行
    functionLength: {
        max: 30,
        ideal: 15,
        reason: '超过3层缩进就该重写'
    },

    // 函数复杂度：单一职责
    singleResponsibility: [
        '✅ 一个函数只做一件事',
        '✅ 参数不超过5个',
        '✅ 嵌套不超过3层',
        '✅ 圈复杂度<10'
    ],

    // 数据结构优先
    dataStructureFirst: [
        '✅ 先设计数据结构，再写逻辑',
        '✅ 用对象参数代替多个参数',
        '✅ 用配置对象代替硬编码',
        '✅ 用枚举代替魔法数字'
    ]
};

/**
 * 错误处理规范
 */

const ERROR_HANDLING_STANDARDS = {
    // ✅ 好的错误处理
    goodErrorHandling: [
        // 具体的错误类型
        'throw new ValidationError("Invalid input: email required")',

        // 有意义的错误消息
        'console.error("[CacheManager] Failed to save data:", error)',

        // 优雅降级
        'return defaultValue || null',

        // 错误边界处理
        'try { riskyOperation() } catch (error) { fallback() }'
    ],

    // ❌ 垃圾错误处理
    badErrorHandling: [
        // 吞掉所有错误
        'try { something() } catch (e) {}',

        // 无意义的错误消息
        'console.log("error")',

        // 重复的错误处理
        'if (!data) return null; // 数据为空返回null'
    ]
};

/**
 * 性能规范
 */

const PERFORMANCE_STANDARDS = {
    // DOM操作规范
    domOperations: [
        '✅ 使用事件委托，不是直接绑定',
        '✅ 使用DocumentFragment，不是多次appendChild',
        '✅ 批量样式更新，不是单独设置',
        '✅ 避免innerHTML，使用DOM构建器'
    ],

    // 内存管理规范
    memoryManagement: [
        '✅ 及时清理事件监听器',
        '✅ 清理定时器和引用',
        '✅ 使用WeakMap避免内存泄漏',
        '✅ 避免闭包中的循环引用'
    ],

    // 异步操作规范
    asyncOperations: [
        '✅ 使用防抖节流控制频率',
        '✅ 使用Promise处理异步',
        '✅ 避免回调地狱',
        '✅ 合理使用缓存'
    ]
};

/**
 * 代码审查检查清单
 */

const CODE_REVIEW_CHECKLIST = {
    // 必须回答的问题
    mandatoryQuestions: [
        '这个改动是否解决了真实问题？',
        '能否用更简单的方式实现？',
        '是否会破坏现有功能？',
        '数据结构是否正确？',
        '是否消除了特殊情况？'
    ],

    // 拒绝标准
    rejectCriteria: [
        '❌ 增加不必要的复杂性',
        '❌ 破坏现有功能',
        '❌ 引入全局状态',
        '❌ 创建循环依赖',
        '❌ 代码难以理解',
        '❌ 中文化注释',
        '❌ 魔法数字和硬编码'
    ],

    // 接受标准
    acceptCriteria: [
        '✅ 简单直接的数据结构',
        '✅ 清晰的职责分离',
        '✅ 消除特殊情况',
        '✅ 保持向后兼容',
        '✅ 代码自文档化',
        '✅ 性能可测量',
        '✅ 错误处理合理'
    ]
};

/**
 * 实用工具函数
 */

class CodeStandards {
    /**
     * 验证函数命名
     */
    static validateFunctionName(name) {
        const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(name);
        const isVerb = /^[a-z]+(Action|Handler|Manager|Builder|Validator)?$/.test(name);
        return isCamelCase && isVerb;
    }

    /**
     * 验证变量命名
     */
    static validateVariableName(name) {
        const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(name);
        const isNotVerb = !/^[a-z]+(Action|Handler|Manager|Builder|Validator)?$/.test(name);
        return isCamelCase && isNotVerb;
    }

    /**
     * 验证常量命名
     */
    static validateConstantName(name) {
        return /^[A-Z][A-Z0-9_]*$/.test(name);
    }

    /**
     * 检查函数复杂度
     */
    static checkFunctionComplexity(func) {
        const source = func.toString();
        const lines = source.split('\n').length;
        const nesting = (source.match(/if|for|while/g) || []).length;
        const cyclomaticComplexity = (source.match(/if|for|while|catch|\&\&|\|\|/g) || []).length + 1;

        return {
            lines,
            nesting,
            cyclomaticComplexity,
            isTooLong: lines > 30,
            isTooComplex: cyclomaticComplexity > 10,
            isTooNested: nesting > 3
        };
    }

    /**
     * 检查代码风格
     */
    static checkCodeStyle(code) {
        const issues = [];

        // 检查中文化注释
        if (/\/\/[\u4e00-\u9fa5]/.test(code)) {
            issues.push('发现中文化注释，请使用英文注释');
        }

        // 检查console.log
        if (/\bconsole\.log\b/.test(code)) {
            issues.push('发现console.log，生产环境请移除');
        }

        // 检查innerHTML
        if (/\.innerHTML\s*=/.test(code)) {
            issues.push('发现innerHTML赋值，请使用DOM构建器');
        }

        // 检查魔法数字
        if (/\b\d{2,}\b/.test(code) && !/\b(1000|60|24|365)\b/.test(code)) {
            issues.push('发现可能的魔法数字，请使用常量');
        }

        return issues;
    }
}

// 导出到全局
window.CodeStandards = CodeStandards;
window.NAMING_CONVENTIONS = NAMING_CONVENTIONS;
window.COMMENT_STANDARDS = COMMENT_STANDARDS;
window.STRUCTURE_STANDARDS = STRUCTURE_STANDARDS;
window.ERROR_HANDLING_STANDARDS = ERROR_HANDLING_STANDARDS;
window.PERFORMANCE_STANDARDS = PERFORMANCE_STANDARDS;
window.CODE_REVIEW_CHECKLIST = CODE_REVIEW_CHECKLIST;

console.log('[CodeStandards] 代码规范已加载，Linus式简洁标准生效');

// ===== js/main.js =====
// Main JavaScript logic for the application
// This file is the result of refactoring the inline script from improved-working-system.html

// ============================================================================
// Phase 2/3: 路径与状态由 ResourceCore / AppStateService 统一提供
// ============================================================================

// 其他全局变量保留在 main.js（暂未迁移）
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

// getLibraryManager - 保留在 main.js（依赖 browse-view 组加载后的全局对象）
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
    // 确保 browse-view 组加载（LibraryManager 在该组中）
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


const preferredFirstExamByCategory = {
    'P1_reading': { id: 'p1-09', title: 'Listening to the Ocean 海洋探测' },
    'P2_reading': { id: 'p2-high-12', title: 'The fascinating world of attine ants 切叶蚁' },
    'P3_reading': { id: 'p3-high-11', title: 'The Fruit Book 果实之书' },
    'P1_listening': { id: 'listening-p3-01', title: 'Julia and Bob’s science project is due' },
    'P3_listening': { id: 'listening-p3-02', title: 'Climate change and allergies' }
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

// --- UI Update Functions ---

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


function loadExamList() {
    if (window.ExamActions && typeof window.ExamActions.loadExamList === 'function') {
        return window.ExamActions.loadExamList();
    }
    console.warn('[main.js] ExamActions.loadExamList 未就绪，尝试加载 browse-view 组');
    if (window.AppLazyLoader && typeof window.AppLazyLoader.ensureGroup === 'function') {
        window.AppLazyLoader.ensureGroup('browse-view').then(function () {
            if (window.ExamActions && typeof window.ExamActions.loadExamList === 'function') {
                window.ExamActions.loadExamList();
            } else {
                // 最终降级：直接 DOM 渲染
                loadExamListFallback();
            }
        }).catch(function (err) {
            console.error('[main.js] browse-view 组加载失败:', err);
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
        window.AppLazyLoader.ensureGroup('browse-view').then(function () {
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
    const list = getExamIndexState();
    const exam = list.find(e => e.id === examId);
    if (!exam) return showMessage('未找到题目', 'error');
    if (!exam.hasHtml) return viewPDF(examId);

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
    const list = getExamIndexState();
    const exam = list.find(e => e.id === examId);
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

// --- Library Loader Modal and Index Management ---
// ... other utility and management functions can be moved here ...
// --- Functions Restored from Backup ---


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
async function switchLibraryConfig(configKey) {
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
async function deleteLibraryConfig(configKey) {
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
    window.switchLibraryConfig = switchLibraryConfig;
    window.deleteLibraryConfig = deleteLibraryConfig;
}


function showDeveloperTeam() {
    const modal = document.getElementById('developer-modal');
    if (modal) modal.classList.add('show');
}

function hideDeveloperTeam() {
    const modal = document.getElementById('developer-modal');
    if (modal) modal.classList.remove('show');
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

// Phase 4: 清理重复事件绑定
// setupExamActionHandlers 已在 examActions.js 的 displayExams 中调用，此处移除重复调用
ensurePracticeSessionSyncListener();

