'use strict';

const MistakeBookView = (function () {
    var currentFilter = 'all';
    var currentSearch = '';
    var currentSort = 'date-desc';

    function getExpandedGroups() { return window._mistakeExpandedGroups || (window._mistakeExpandedGroups = {}); }
    function getExpandedMistakes() { return window._mistakeExpandedMistakes || (window._mistakeExpandedMistakes = {}); }
    function getSelectedMistakes() { return window._mistakeSelected || (window._mistakeSelected = {}); }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        var m = d.getMonth() + 1;
        var day = d.getDate();
        var h = d.getHours();
        var min = d.getMinutes();
        return m + '/' + day + ' ' + String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    }

    function getTypeLabel(type) {
        if (type === 'reading') return '阅读';
        if (type === 'listening') return '听力';
        return type || '未知';
    }

    function filterMistakes(mistakes) {
        var result = mistakes;
        if (currentFilter !== 'all') {
            result = result.filter(function (m) { return m.type === currentFilter; });
        }
        if (currentSearch) {
            var q = currentSearch.toLowerCase();
            result = result.filter(function (m) {
                return (m.title && m.title.toLowerCase().indexOf(q) !== -1) ||
                       (m.questionId && m.questionId.toLowerCase().indexOf(q) !== -1) ||
                       (m.userAnswer && m.userAnswer.toLowerCase().indexOf(q) !== -1) ||
                       (m.correctAnswer && m.correctAnswer.toLowerCase().indexOf(q) !== -1);
            });
        }
        return result;
    }

    function sortMistakes(mistakes) {
        var sorted = mistakes.slice();
        if (currentSort === 'date-desc') {
            sorted.sort(function (a, b) { return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt); });
        } else if (currentSort === 'date-asc') {
            sorted.sort(function (a, b) { return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt); });
        }
        return sorted;
    }

    function renderStats() {
        var stats = MistakeBook.getStats();
        var totalEl = document.getElementById('mistake-total');
        var masteredEl = document.getElementById('mistake-mastered');
        var unmasteredEl = document.getElementById('mistake-unmastered');
        if (totalEl) totalEl.textContent = stats.total;
        if (masteredEl) masteredEl.textContent = stats.mastered;
        if (unmasteredEl) unmasteredEl.textContent = stats.unmastered;
    }

    function renderList() {
        var container = document.getElementById('mistake-list');
        if (!container) return;

        var mistakes = MistakeBook.getMistakes();
        var filtered = filterMistakes(mistakes);
        filtered = sortMistakes(filtered);

        if (filtered.length === 0) {
            var emptyMsg = mistakes.length === 0 ? '暂无错题' : '没有匹配的错题';
            var emptyHint = mistakes.length === 0
                ? '完成练习后，答错的题目会自动收录到这里'
                : '试试调整筛选条件或搜索关键词';
            var browseLink = mistakes.length === 0
                ? '<a href="javascript:void(0)" onclick="window.AppActions && window.AppActions.navigateBrowse && window.AppActions.navigateBrowse()" class="mistake-empty-link">去题库练习</a>'
                : '';
            container.innerHTML =
                '<div class="mistake-empty">' +
                    '<div class="mistake-empty-icon">&#128221;</div>' +
                    '<p>' + escapeHtml(emptyMsg) + '</p>' +
                    '<p class="mistake-empty-hint">' + escapeHtml(emptyHint) + '</p>' +
                    browseLink +
                '</div>';
            return;
        }

        var groups = MistakeBook.getMistakesGroupedByExam();
        var filteredGroups = [];
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var groupFiltered = group.mistakes.filter(function (m) {
                if (currentFilter !== 'all' && m.type !== currentFilter) return false;
                if (currentSearch) {
                    var q = currentSearch.toLowerCase();
                    if ((m.title && m.title.toLowerCase().indexOf(q) !== -1) ||
                        (m.questionId && m.questionId.toLowerCase().indexOf(q) !== -1) ||
                        (m.userAnswer && m.userAnswer.toLowerCase().indexOf(q) !== -1) ||
                        (m.correctAnswer && m.correctAnswer.toLowerCase().indexOf(q) !== -1)) return true;
                    return false;
                }
                return true;
            });
            if (groupFiltered.length > 0) {
                filteredGroups.push({ examId: group.examId, title: group.title, mistakes: sortMistakes(groupFiltered) });
            }
        }

        var html = '';
        var selectedCount = Object.keys(getSelectedMistakes()).length;

        for (var i = 0; i < filteredGroups.length; i++) {
            var fg = filteredGroups[i];
            var safeExamId = escapeHtml(fg.examId || 'unknown');
            var groupExpanded = getExpandedGroups()[fg.examId] !== false;
            var groupMasteredCount = 0;
            for (var m = 0; m < fg.mistakes.length; m++) {
                if (fg.mistakes[m].mastered) groupMasteredCount++;
            }

            html += '<div class="mistake-group" data-exam-id="' + safeExamId + '">';
            html += '<div class="mistake-group-header" onclick="window.toggleMistakeGroup(\'' + safeExamId + '\')">';
            html += '<span class="mistake-group-arrow' + (groupExpanded ? ' expanded' : '') + '">&#9660;</span>';
            html += '<label class="mistake-group-select" onclick="event.stopPropagation()">';
            html += '<input type="checkbox" onchange="window.toggleGroupSelect(\'' + safeExamId + '\', this.checked)" />';
            html += '</label>';
            html += '<span class="mistake-group-title">' + escapeHtml(fg.title) + '</span>';
            html += '<span class="mistake-group-count">' + fg.mistakes.length + '题 &middot; ' + groupMasteredCount + '已掌握</span>';
            html += '</div>';

            if (groupExpanded) {
                html += '<div class="mistake-group-body">';
                for (var j = 0; j < fg.mistakes.length; j++) {
                    var item = fg.mistakes[j];
                    var masteredClass = item.mastered ? ' mastered' : '';
                    var typeClass = item.type === 'reading' ? ' type-reading' : ' type-listening';
                    var safeId = item.id.replace(/'/g, "\\'");
                    var isSelected = getSelectedMistakes()[item.id];
                    var isExpanded = getExpandedMistakes()[item.id];

                    html += '<div class="mistake-item' + masteredClass + (isSelected ? ' selected' : '') + '" data-mistake-id="' + escapeHtml(item.id) + '">';
                    html += '<div class="mistake-item-row" onclick="window.toggleMistakeExpand(\'' + safeId + '\')">';
                    html += '<label class="mistake-item-select" onclick="event.stopPropagation()">';
                    html += '<input type="checkbox"' + (isSelected ? ' checked' : '') + ' onchange="window.toggleMistakeSelect(\'' + safeId + '\', this.checked)" />';
                    html += '</label>';
                    html += '<span class="mistake-type-badge' + typeClass + '">' + getTypeLabel(item.type) + '</span>';
                    html += '<span class="mistake-question-id">' + escapeHtml(item.questionId) + '</span>';
                    html += '<span class="mistake-answers-inline">';
                    html += '<span class="wrong">' + escapeHtml(item.userAnswer || '(无)') + '</span>';
                    html += ' &rarr; ';
                    html += '<span class="correct">' + escapeHtml(item.correctAnswer) + '</span>';
                    html += '</span>';
                    html += '<span class="mistake-date">' + formatDate(item.date) + '</span>';
                    html += '<span class="mistake-expand-arrow' + (isExpanded ? ' expanded' : '') + '">&#9660;</span>';
                    html += '</div>';

                    if (isExpanded) {
                        html += '<div class="mistake-detail">';
                        if (item.category) html += '<div class="mistake-detail-row"><span class="label">类别:</span> ' + escapeHtml(item.category) + '</div>';
                        if (item.frequency) html += '<div class="mistake-detail-row"><span class="label">频率:</span> ' + escapeHtml(item.frequency) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">做题时间:</span> ' + formatDate(item.date) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">收录时间:</span> ' + formatDate(item.createdAt) + '</div>';
                        if (item.redoCount) {
                            var redoIcon = item.lastRedoResult === 'correct' ? '&#10003;' : '&#10007;';
                            var redoClass = item.lastRedoResult === 'correct' ? 'redo-success' : 'redo-fail';
                            html += '<div class="mistake-detail-row"><span class="label">重做:</span> <span class="mistake-redo-status ' + redoClass + '">重做 ' + item.redoCount + '次 ' + redoIcon + '</span></div>';
                        }
                        html += '<div class="mistake-question-preview" id="question-preview-' + safeId + '">';
                        html += '<div class="mistake-question-loading">加载题目中...</div>';
                        html += '</div>';
                        html += '<div class="mistake-detail-actions">';
                        html += '<button class="mistake-action-btn redo-btn" onclick="window.openRedoModal(\'' + safeId + '\', \'' + escapeHtml(item.examId) + '\', \'' + escapeHtml(item.questionId) + '\', \'' + escapeHtml(item.type) + '\')">重做此题</button>';
                        html += '<button class="mistake-action-btn master-btn" onclick="window.toggleMistakeMastered(\'' + safeId + '\')">' + (item.mastered ? '取消掌握' : '标记已掌握') + '</button>';
                        html += '<button class="mistake-action-btn delete-btn" onclick="window.removeMistake(\'' + safeId + '\')">删除</button>';
                        html += '</div>';
                        html += '</div>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '</div>';
        }

        if (selectedCount > 0) {
            html += '<div class="mistake-batch-bar">';
            html += '<span class="mistake-batch-count">已选 ' + selectedCount + ' 项</span>';
            html += '<button class="mistake-action-btn master-btn" onclick="window.batchMarkMastered(true)">批量标记已掌握</button>';
            html += '<button class="mistake-action-btn master-btn" onclick="window.batchMarkMastered(false)">批量取消掌握</button>';
            html += '<button class="mistake-action-btn delete-btn" onclick="window.batchDeleteMistakes()">批量删除</button>';
            html += '<button class="mistake-action-btn" onclick="window.clearMistakeSelection()">取消选择</button>';
            html += '</div>';
        }

        container.innerHTML = html;

        var previewIds = [];
        for (var pi = 0; pi < filteredGroups.length; pi++) {
            var pg = filteredGroups[pi];
            var pgExpanded = getExpandedGroups()[pg.examId] !== false;
            if (!pgExpanded) continue;
            for (var pj = 0; pj < pg.mistakes.length; pj++) {
                var pm = pg.mistakes[pj];
                if (getExpandedMistakes()[pm.id]) {
                    previewIds.push({ id: pm.id, examId: pm.examId, questionId: pm.questionId, type: pm.type });
                }
            }
        }
        previewIds.forEach(function (item) {
            loadQuestionPreview(item.id, item.examId, item.questionId, item.type);
        });
    }

    function loadQuestionPreview(mistakeId, examId, questionId, type) {
        var containerId = 'question-preview-' + mistakeId.replace(/'/g, "\\'");
        var container = document.getElementById(containerId);
        if (!container) return;

        try {
            var data = null;
            if (type === 'reading') {
                data = QuestionExtractor.extractReadingQuestion(examId, questionId);
            } else {
                data = QuestionExtractor.extractListeningQuestion(examId, questionId);
            }

            if (!data) {
                container.innerHTML = '<div class="mistake-question-unavailable">无法加载题目原文（考试数据未注册）</div>';
                return;
            }

            if (type === 'reading') {
                container.innerHTML = '<div class="redo-reading-layout readonly">' +
                    '<div class="redo-passage">' + data.passageHtml + '</div>' +
                    '<div class="redo-question-area">' + data.questionHtml + '</div>' +
                    '</div>';
            } else {
                var audioHtml = data.audioSrc ? '<div class="redo-audio-player"><audio controls src="' + escapeHtml(data.audioSrc) + '" preload="metadata"></audio></div>' : '';
                container.innerHTML = audioHtml + '<div class="redo-question-area">' + data.questionHtml + '</div>';
            }

            container.querySelectorAll('input, textarea, select').forEach(function (el) {
                el.disabled = true;
            });
        } catch (e) {
            container.innerHTML = '<div class="mistake-question-unavailable">加载题目时出错</div>';
        }
    }

    function updateFilterButtons(activeType) {
        var btns = document.querySelectorAll('#mistakes-type-filter .shui-segmented-btn');
        btns.forEach(function (btn) {
            var isActive = btn.getAttribute('data-filter-type') === activeType;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    return {
        render: function () {
            renderStats();
            renderList();
        },

        setFilter: function (type) {
            currentFilter = type;
            updateFilterButtons(type);
            renderList();
        },

        setSearch: function (query) {
            currentSearch = query;
            renderList();
        },

        setSort: function (sort) {
            currentSort = sort;
            renderList();
        },

        init: function () {
            currentFilter = 'all';
            currentSearch = '';
            currentSort = 'date-desc';
            window._mistakeExpandedGroups = {};
            window._mistakeExpandedMistakes = {};
            window._mistakeSelected = {};

            var searchInput = document.getElementById('mistake-search-input');
            if (searchInput) searchInput.value = '';
            var sortSelect = document.getElementById('mistake-sort-select');
            if (sortSelect) sortSelect.value = 'date-desc';

            this.render();
        }
    };
})();

window.MistakeBookView = MistakeBookView;

window.toggleMistakeMastered = function (id) {
    MistakeBook.toggleMastered(id);
    MistakeBookView.render();
};

window.removeMistake = function (id) {
    MistakeBook.removeMistake(id);
    MistakeBookView.render();
};

window.clearMistakeBook = function () {
    if (confirm('确定要清空所有错题记录吗？此操作不可撤销。')) {
        MistakeBook.clearAll();
        MistakeBookView.render();
    }
};

window.filterMistakesByType = function (type) {
    MistakeBookView.setFilter(type);
};

window.searchMistakes = function (query) {
    MistakeBookView.setSearch(query);
};

window.clearMistakeSearch = function () {
    MistakeBookView.setSearch('');
    var input = document.getElementById('mistake-search-input');
    if (input) input.value = '';
};

window.sortMistakes = function (sort) {
    MistakeBookView.setSort(sort);
};

window.toggleMistakeGroup = function (examId) {
    var expanded = window._mistakeExpandedGroups || (window._mistakeExpandedGroups = {});
    expanded[examId] = expanded[examId] === false ? true : false;
    MistakeBookView.render();
};

window.toggleGroupSelect = function (examId, checked) {
    var group = MistakeBook.getMistakesByExam(examId);
    var selected = window._mistakeSelected || (window._mistakeSelected = {});
    for (var i = 0; i < group.length; i++) {
        if (checked) {
            selected[group[i].id] = true;
        } else {
            delete selected[group[i].id];
        }
    }
    MistakeBookView.render();
};

window.toggleMistakeExpand = function (id) {
    var expanded = window._mistakeExpandedMistakes || (window._mistakeExpandedMistakes = {});
    expanded[id] = !expanded[id];
    MistakeBookView.render();
};

window.toggleMistakeSelect = function (id, checked) {
    var selected = window._mistakeSelected || (window._mistakeSelected = {});
    if (checked) {
        selected[id] = true;
    } else {
        delete selected[id];
    }
    MistakeBookView.render();
};

window.batchMarkMastered = function (mastered) {
    var selected = window._mistakeSelected || {};
    var ids = Object.keys(selected);
    if (ids.length === 0) return;
    MistakeBook.batchToggleMastered(ids, mastered);
    window._mistakeSelected = {};
    MistakeBookView.render();
};

window.batchDeleteMistakes = function () {
    var selected = window._mistakeSelected || {};
    var ids = Object.keys(selected);
    if (ids.length === 0) return;
    if (!confirm('确定要删除选中的 ' + ids.length + ' 条错题吗？')) return;
    MistakeBook.batchRemove(ids);
    window._mistakeSelected = {};
    MistakeBookView.render();
};

window.clearMistakeSelection = function () {
    window._mistakeSelected = {};
    MistakeBookView.render();
};

window.openRedoModal = function (mistakeId, examId, questionId, type) {
    var data = null;
    if (type === 'reading') {
        data = QuestionExtractor.extractReadingQuestion(examId, questionId);
    } else {
        data = QuestionExtractor.extractListeningQuestion(examId, questionId);
    }

    if (!data) {
        alert('无法加载题目数据');
        return;
    }

    var title = '';
    try {
        if (type === 'reading' && window.__READING_EXAM_DATA__ && window.__READING_EXAM_DATA__.has(examId)) {
            var exam = window.__READING_EXAM_DATA__.get(examId);
            title = (exam.meta && exam.meta.title) || examId;
        } else if (type === 'listening' && window.__LISTENING_EXAM_DATA__ && window.__LISTENING_EXAM_DATA__.has(examId)) {
            var exam2 = window.__LISTENING_EXAM_DATA__.get(examId);
            title = (exam2.meta && exam2.meta.title) || examId;
        }
    } catch (_) {}

    var overlay = document.createElement('div');
    overlay.className = 'redo-modal-overlay';
    overlay.id = 'redo-modal';

    var modal = document.createElement('div');
    modal.className = 'redo-modal';

    var header = document.createElement('div');
    header.className = 'redo-modal-header';
    header.innerHTML = '<span class="redo-modal-title">' + escapeHtml(title) + ' &middot; ' + escapeHtml(questionId) + '</span>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'redo-modal-close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.onclick = function () { closeModal(); };
    header.appendChild(closeBtn);
    modal.appendChild(header);

    var body = document.createElement('div');
    body.className = 'redo-modal-body';
    QuestionExtractor.renderQuestionInContainer(body, data, type);
    modal.appendChild(body);

    var footer = document.createElement('div');
    footer.className = 'redo-modal-footer';
    var submitBtn = document.createElement('button');
    submitBtn.className = 'redo-modal-submit';
    submitBtn.textContent = '提交答案';
    submitBtn.onclick = function () {
        var userAnswers = QuestionExtractor.collectUserAnswers(body, data.questionIds);
        var comparison = {};
        var allCorrect = true;
        data.questionIds.forEach(function (qId) {
            var correctAnswer = '';
            if (type === 'listening') {
                try {
                    var examData = window.__LISTENING_EXAM_DATA__.get(examId);
                    if (examData && examData.answerKey) {
                        if (examData.answerKey.text && examData.answerKey.text[qId] !== undefined) {
                            correctAnswer = String(examData.answerKey.text[qId]);
                        } else if (examData.answerKey.single && examData.answerKey.single[qId] !== undefined) {
                            correctAnswer = String(examData.answerKey.single[qId]);
                        } else if (examData.answerKey.multiple && examData.answerKey.multiple[qId] !== undefined) {
                            correctAnswer = String(examData.answerKey.multiple[qId]);
                        }
                    }
                } catch (_) {}
            } else {
                try {
                    var examData2 = window.__READING_EXAM_DATA__.get(examId);
                    if (examData2 && examData2.answerKey && examData2.answerKey[qId] !== undefined) {
                        correctAnswer = String(examData2.answerKey[qId]);
                    }
                } catch (_) {}
            }
            var result = QuestionExtractor.compareAnswers(userAnswers, correctAnswer, qId);
            comparison[qId] = result;
            if (!result.isCorrect) allCorrect = false;
        });

        QuestionExtractor.markResults(body, data.questionIds, comparison);

        if (window.MistakeBook && window.MistakeBook.recordRedo) {
            window.MistakeBook.recordRedo(mistakeId, allCorrect);
        }

        submitBtn.textContent = '关闭';
        submitBtn.onclick = function () { closeModal(); };
    };
    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function closeModal() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        MistakeBookView.render();
    }

    function onEsc(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', onEsc);
        }
    }
    document.addEventListener('keydown', onEsc);
};

window.exportMistakeBook = function () {
    var data = MistakeBook.exportMistakes();
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mistake-book-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
