'use strict';

const MistakeBookView = (function () {
    var currentFilter = 'all';
    var currentSearch = '';

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
        return m + '/' + day;
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
                       (m.questionId && m.questionId.toLowerCase().indexOf(q) !== -1);
            });
        }
        return result;
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

        if (filtered.length === 0) {
            var emptyMsg = mistakes.length === 0
                ? '暂无错题'
                : '没有匹配的错题';
            var emptyHint = mistakes.length === 0
                ? '完成练习后，答错的题目会自动收录到这里'
                : '试试调整筛选条件或搜索关键词';
            container.innerHTML =
                '<div class="mistake-empty">' +
                    '<div class="mistake-empty-icon">📝</div>' +
                    '<p>' + escapeHtml(emptyMsg) + '</p>' +
                    '<p class="mistake-empty-hint">' + escapeHtml(emptyHint) + '</p>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var m = filtered[i];
            var masteredClass = m.mastered ? ' mastered' : '';
            var typeClass = m.type === 'reading' ? ' type-reading' : ' type-listening';

            html += '<div class="mistake-item' + masteredClass + '" data-mistake-id="' + escapeHtml(m.id) + '">';
            html += '<div class="mistake-header">';
            html += '<span class="mistake-type-badge' + typeClass + '">' + getTypeLabel(m.type) + '</span>';
            html += '<span class="mistake-title">' + escapeHtml(m.title) + '</span>';
            html += '<span class="mistake-date">' + formatDate(m.date) + '</span>';
            html += '</div>';
            html += '<div class="mistake-body">';
            html += '<div class="mistake-question-label">题号: ' + escapeHtml(m.questionId) + '</div>';
            html += '<div class="mistake-answers">';
            html += '<div class="mistake-answer wrong">你的答案: <strong>' + escapeHtml(m.userAnswer || '(无)') + '</strong></div>';
            html += '<div class="mistake-answer correct">正确答案: <strong>' + escapeHtml(m.correctAnswer) + '</strong></div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="mistake-footer">';
            if (m.category) {
                html += '<span class="mistake-meta">' + escapeHtml(m.category) + '</span>';
            }
            if (m.frequency) {
                html += '<span class="mistake-meta">' + escapeHtml(m.frequency) + '</span>';
            }
            html += '<div class="mistake-actions">';
            var masterLabel = m.mastered ? '取消掌握' : '已掌握';
            var safeId = m.id.replace(/'/g, "\\'");
            html += '<button class="mistake-action-btn master-btn" onclick="window.toggleMistakeMastered(\'' + safeId + '\')">' + masterLabel + '</button>';
            html += '<button class="mistake-action-btn delete-btn" onclick="window.removeMistake(\'' + safeId + '\')">删除</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }

        container.innerHTML = html;
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

        init: function () {
            currentFilter = 'all';
            currentSearch = '';

            var searchInput = document.getElementById('mistake-search-input');
            if (searchInput) {
                searchInput.value = '';
            }

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
