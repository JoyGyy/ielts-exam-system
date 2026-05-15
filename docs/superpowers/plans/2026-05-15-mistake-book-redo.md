# 错题本增强 — 看题+重做 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让错题本支持显示题目原文和弹窗单题重做，从"答案对比列表"升级为"复习工具"。

**Architecture:** 新建 `questionExtractor.js` 负责从考试注册表中提取单题 HTML 并处理答案收集/对比。错题本视图新增展开时异步加载题目原文、"重做"按钮触发全屏浮窗。数据层扩展重做记录字段。

**Tech Stack:** 原生 JS (IIFE 模式), localStorage, DOMParser, 现有考试注册表 API (`__READING_EXAM_DATA__`, `__LISTENING_EXAM_DATA__`)

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `js/utils/questionExtractor.js` | 新建 | 从考试数据提取单题 HTML、收集答案、对比答案 |
| `js/data/mistakeBook.js` | 修改 | 添加 `recordRedo(id, isCorrect)` API |
| `js/presentation/mistakeBookView.js` | 修改 | 展开详情显示原文、重做按钮、重做状态标记、浮窗逻辑 |
| `css/main.css` | 修改 | 浮窗样式、题目原文样式、重做结果标注 |
| `index.html` | 修改 | 添加 questionExtractor.js script 标签 |

---

## Task 1: 数据层 — 添加 recordRedo API

**Files:**
- Modify: `js/data/mistakeBook.js:96-113` (在 `batchToggleMastered` 之前插入)

- [ ] **Step 1: 在 mistakeBook.js 的 return 对象中添加 recordRedo 方法**

在 `batchToggleMastered` 方法之前插入以下代码：

```js
recordRedo: function (id, isCorrect) {
    var list = readAll();
    for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
            list[i].redoCount = (list[i].redoCount || 0) + 1;
            list[i].lastRedoResult = isCorrect ? 'correct' : 'incorrect';
            list[i].lastRedoDate = new Date().toISOString();
            list[i].updatedAt = new Date().toISOString();
            writeAll(list);
            return list[i];
        }
    }
    return null;
},
```

- [ ] **Step 2: 更新 getStats 方法，添加重做统计**

在 `getStats` 的返回对象中添加 `redone` 字段。找到 `getStats` 方法（约第 217 行），在 `listening++` 之后添加：

```js
var redone = 0;
```

在 for 循环内添加：

```js
if (list[i].redoCount) redone++;
```

在返回对象中添加：

```js
redone: redone,
```

- [ ] **Step 3: Commit**

```bash
git add js/data/mistakeBook.js
git commit -m "feat: mistakeBook 添加 recordRedo API 和重做统计"
```

---

## Task 2: 题目提取工具 — 新建 questionExtractor.js

**Files:**
- Create: `js/utils/questionExtractor.js`

- [ ] **Step 1: 创建 questionExtractor.js — 阅读题提取函数**

```js
'use strict';

const QuestionExtractor = (function () {
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * 从阅读考试数据中提取单题内容
     * @param {string} examId
     * @param {string} questionId - 如 "q7"
     * @returns {{ passageHtml: string, questionHtml: string, kind: string, answer: string, questionIds: string[] } | null}
     */
    function extractReadingQuestion(examId, questionId) {
        if (!window.__READING_EXAM_DATA__ || !window.__READING_EXAM_DATA__.has(examId)) {
            return null;
        }
        var exam = window.__READING_EXAM_DATA__.get(examId);
        if (!exam) return null;

        // 提取文章段落
        var passageBlocks = (exam.passage && exam.passage.blocks) || [];
        var passageHtml = passageBlocks.map(function (b) { return b.bodyHtml || b.html || ''; }).join('\n');

        // 找到包含该 questionId 的 group
        var targetGroup = null;
        var groups = exam.questionGroups || [];
        for (var i = 0; i < groups.length; i++) {
            var ids = groups[i].questionIds || [];
            if (ids.indexOf(questionId) !== -1) {
                targetGroup = groups[i];
                break;
            }
        }
        if (!targetGroup) return null;

        // 解析 bodyHtml 提取该题
        var temp = document.createElement('div');
        temp.innerHTML = targetGroup.bodyHtml || '';

        var questionHtml = '';
        var qNum = questionId.replace(/^q/, '');

        // 尝试方式1: 查找 #qN-anchor
        var anchor = temp.querySelector('#' + questionId + '-anchor') || temp.querySelector('#q' + qNum + '-anchor');
        if (anchor) {
            questionHtml = anchor.outerHTML;
        }

        // 尝试方式2: 查找 [data-question="qN"] 的最近 .question-item 祖先
        if (!questionHtml) {
            var el = temp.querySelector('[data-question="' + questionId + '"]');
            if (el) {
                var parent = el.closest('.question-item');
                questionHtml = parent ? parent.outerHTML : el.outerHTML;
            }
        }

        // 尝试方式3: 查找 [name="qN"] 的 input
        if (!questionHtml) {
            var input = temp.querySelector('[name="' + questionId + '"]');
            if (input) {
                var parent2 = input.closest('.question-item') || input.closest('tr') || input.closest('li') || input.parentElement;
                questionHtml = parent2 ? parent2.outerHTML : input.outerHTML;
            }
        }

        // 尝试方式4: 查找包含题号文本的元素
        if (!questionHtml) {
            var items = temp.querySelectorAll('.question-item');
            for (var j = 0; j < items.length; j++) {
                if (items[j].id && items[j].id.indexOf(qNum) !== -1) {
                    questionHtml = items[j].outerHTML;
                    break;
                }
            }
        }

        // 最后兜底: 返回整个 bodyHtml
        if (!questionHtml) {
            questionHtml = targetGroup.bodyHtml || '';
        }

        var answer = (exam.answerKey && exam.answerKey[questionId]) || '';

        return {
            passageHtml: passageHtml,
            questionHtml: questionHtml,
            kind: targetGroup.kind || '',
            answer: String(answer),
            questionIds: targetGroup.questionIds || []
        };
    }

    /**
     * 从听力考试数据中提取单题内容
     * @param {string} examId
     * @param {string} questionId - 如 "q1"
     * @returns {{ questionHtml: string, audioSrc: string, kind: string, answer: string, questionIds: string[] } | null}
     */
    function extractListeningQuestion(examId, questionId) {
        if (!window.__LISTENING_EXAM_DATA__ || !window.__LISTENING_EXAM_DATA__.has(examId)) {
            return null;
        }
        var exam = window.__LISTENING_EXAM_DATA__.get(examId);
        if (!exam) return null;

        var temp = document.createElement('div');
        temp.innerHTML = exam.questionsPageHtml || '';

        var questionHtml = '';
        var qNum = questionId.replace(/^q/, '');

        // 尝试方式1: 查找 input[name="qN"] 的最近 group 祖先
        var input = temp.querySelector('[name="' + questionId + '"]');
        if (input) {
            // 找到包含该 input 的 section/group，截取相关部分
            var group = input.closest('.group') || input.closest('[data-section]') || input.parentElement;
            questionHtml = group ? group.outerHTML : input.outerHTML;
        }

        // 尝试方式2: 查找 data-q="N"
        if (!questionHtml) {
            var slot = temp.querySelector('[data-q="' + qNum + '"]');
            if (slot) {
                var group2 = slot.closest('.group') || slot.closest('[data-section]') || slot.parentElement;
                questionHtml = group2 ? group2.outerHTML : slot.outerHTML;
            }
        }

        if (!questionHtml) {
            questionHtml = exam.questionsPageHtml || '';
        }

        // 获取答案
        var answerKey = exam.answerKey || {};
        var answer = '';
        if (answerKey.text && answerKey.text[questionId] !== undefined) {
            answer = String(answerKey.text[questionId]);
        } else if (answerKey.single && answerKey.single[questionId] !== undefined) {
            answer = String(answerKey.single[questionId]);
        } else if (answerKey.multiple && answerKey.multiple[questionId] !== undefined) {
            answer = String(answerKey.multiple[questionId]);
        }

        // 获取音频地址
        var audioSrc = (exam.meta && exam.meta.audioSrc) || '';

        // 获取 questionIds
        var questionList = exam.questionList || [];
        var questionIds = questionList.map(function (n) { return 'q' + n; });

        // 获取 kind
        var kind = '';
        var qInfo = exam.questions && exam.questions[questionId];
        if (qInfo) kind = qInfo.kind || '';

        return {
            questionHtml: questionHtml,
            audioSrc: audioSrc,
            kind: kind,
            answer: answer,
            questionIds: questionIds
        };
    }

    /**
     * 在容器中渲染题目（可交互模式）
     */
    function renderQuestionInContainer(container, data, type) {
        if (!container || !data) return;
        var html = '';

        if (type === 'reading') {
            html += '<div class="redo-reading-layout">';
            html += '<div class="redo-passage">' + data.passageHtml + '</div>';
            html += '<div class="redo-question-area">' + data.questionHtml + '</div>';
            html += '</div>';
        } else {
            if (data.audioSrc) {
                html += '<div class="redo-audio-player">';
                html += '<audio controls src="' + escapeHtml(data.audioSrc) + '" preload="metadata"></audio>';
                html += '</div>';
            }
            html += '<div class="redo-question-area">' + data.questionHtml + '</div>';
        }

        container.innerHTML = html;

        // 启用所有 inputs
        container.querySelectorAll('input, textarea, select').forEach(function (el) {
            el.disabled = false;
            el.removeAttribute('readonly');
        });

        // 启用 dropzones
        container.querySelectorAll('.dropzone, .match-dropzone, .paragraph-dropzone').forEach(function (el) {
            el.classList.remove('drag-item-locked');
        });
    }

    /**
     * 从容器中收集用户答案
     */
    function collectUserAnswers(container, questionIds) {
        var answers = {};
        if (!container || !questionIds) return answers;

        questionIds.forEach(function (qId) {
            // Radio
            var radios = container.querySelectorAll('input[type="radio"][name="' + qId + '"]');
            if (radios.length) {
                var checked = null;
                radios.forEach(function (r) { if (r.checked) checked = r; });
                answers[qId] = checked ? String(checked.value).trim() : '';
                return;
            }

            // Checkbox
            var checkboxes = container.querySelectorAll('input[type="checkbox"][name="' + qId + '"]');
            if (checkboxes.length) {
                var checkedVals = [];
                checkboxes.forEach(function (c) { if (c.checked) checkedVals.push(c.value); });
                answers[qId] = checkedVals.sort().join(',');
                return;
            }

            // Text input
            var textInput = container.querySelector('input[type="text"][name="' + qId + '"]');
            if (textInput) {
                answers[qId] = textInput.value.trim();
                return;
            }

            // Select
            var select = container.querySelector('select[name="' + qId + '"]');
            if (select) {
                answers[qId] = select.value;
                return;
            }

            // Dropzone / match slot
            var slot = container.querySelector('.match-slot[data-q="' + qId.replace(/^q/, '') + '"]') ||
                       container.querySelector('.match-dropzone[data-question="' + qId + '"]');
            if (slot) {
                answers[qId] = slot.dataset.value || slot.textContent.trim() || '';
                return;
            }

            answers[qId] = '';
        });

        return answers;
    }

    /**
     * 对比用户答案和正确答案
     */
    function compareAnswers(userAnswers, correctAnswer, questionId) {
        var userAns = userAnswers[questionId] || '';
        var correct = String(correctAnswer || '').trim();

        // 忽略大小写和首尾空格对比
        var isCorrect = userAns.toLowerCase().trim() === correct.toLowerCase().trim();

        return {
            userAnswer: userAns,
            correctAnswer: correct,
            isCorrect: isCorrect
        };
    }

    /**
     * 在容器中标注答案对错
     */
    function markResults(container, questionIds, comparison) {
        if (!container) return;

        questionIds.forEach(function (qId) {
            var result = comparison[qId];
            if (!result) return;

            // 标注 radio
            var radios = container.querySelectorAll('input[type="radio"][name="' + qId + '"]');
            radios.forEach(function (r) {
                r.disabled = true;
                var label = r.closest('label') || r.parentElement;
                if (String(r.value).trim().toLowerCase() === result.correctAnswer.toLowerCase()) {
                    if (label) label.classList.add('redo-correct');
                } else if (r.checked) {
                    if (label) label.classList.add('redo-incorrect');
                }
            });

            // 标注 checkbox
            var checkboxes = container.querySelectorAll('input[type="checkbox"][name="' + qId + '"]');
            checkboxes.forEach(function (c) {
                c.disabled = true;
                var label = c.closest('label') || c.parentElement;
                var correctVals = result.correctAnswer.split(',').map(function (v) { return v.trim().toLowerCase(); });
                if (correctVals.indexOf(c.value.toLowerCase()) !== -1) {
                    if (label) label.classList.add('redo-correct');
                } else if (c.checked) {
                    if (label) label.classList.add('redo-incorrect');
                }
            });

            // 标注 text input
            var textInput = container.querySelector('input[type="text"][name="' + qId + '"]');
            if (textInput) {
                textInput.disabled = true;
                if (result.isCorrect) {
                    textInput.classList.add('input-correct');
                } else {
                    textInput.classList.add('input-incorrect');
                    // 显示正确答案
                    var hint = document.createElement('div');
                    hint.className = 'redo-answer-hint';
                    hint.textContent = '正确答案: ' + result.correctAnswer;
                    textInput.parentElement.appendChild(hint);
                }
            }

            // 标注 select
            var select = container.querySelector('select[name="' + qId + '"]');
            if (select) {
                select.disabled = true;
                if (result.isCorrect) {
                    select.classList.add('input-correct');
                } else {
                    select.classList.add('input-incorrect');
                }
            }
        });
    }

    return {
        extractReadingQuestion: extractReadingQuestion,
        extractListeningQuestion: extractListeningQuestion,
        renderQuestionInContainer: renderQuestionInContainer,
        collectUserAnswers: collectUserAnswers,
        compareAnswers: compareAnswers,
        markResults: markResults
    };
})();

window.QuestionExtractor = QuestionExtractor;
```

- [ ] **Step 2: 在 index.html 中添加 script 标签**

在 `index.html` 中找到 `<script src="js/data/mistakeBook.js"></script>`（约第 309 行），在其后面添加：

```html
<script src="js/utils/questionExtractor.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add js/utils/questionExtractor.js index.html
git commit -m "feat: 添加 questionExtractor 题目提取和答案对比工具"
```

---

## Task 3: 错题本视图 — 展开详情显示题目原文 + 重做按钮

**Files:**
- Modify: `js/presentation/mistakeBookView.js:169-179` (展开详情区域)

- [ ] **Step 1: 在展开详情中添加题目原文容器和重做按钮**

找到 `mistakeBookView.js` 中 `if (isExpanded)` 块（约第 169 行），替换整个展开详情区域：

将原来的：
```js
                    if (isExpanded) {
                        html += '<div class="mistake-detail">';
                        if (item.category) html += '<div class="mistake-detail-row"><span class="label">类别:</span> ' + escapeHtml(item.category) + '</div>';
                        if (item.frequency) html += '<div class="mistake-detail-row"><span class="label">频率:</span> ' + escapeHtml(item.frequency) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">做题时间:</span> ' + formatDate(item.date) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">收录时间:</span> ' + formatDate(item.createdAt) + '</div>';
                        html += '<div class="mistake-detail-actions">';
                        html += '<button class="mistake-action-btn master-btn" onclick="window.toggleMistakeMastered(\'' + safeId + '\')">' + (item.mastered ? '取消掌握' : '标记已掌握') + '</button>';
                        html += '<button class="mistake-action-btn delete-btn" onclick="window.removeMistake(\'' + safeId + '\')">删除</button>';
                        html += '</div>';
                        html += '</div>';
                    }
```

替换为：
```js
                    if (isExpanded) {
                        html += '<div class="mistake-detail">';
                        if (item.category) html += '<div class="mistake-detail-row"><span class="label">类别:</span> ' + escapeHtml(item.category) + '</div>';
                        if (item.frequency) html += '<div class="mistake-detail-row"><span class="label">频率:</span> ' + escapeHtml(item.frequency) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">做题时间:</span> ' + formatDate(item.date) + '</div>';
                        html += '<div class="mistake-detail-row"><span class="label">收录时间:</span> ' + formatDate(item.createdAt) + '</div>';

                        // 重做状态
                        if (item.redoCount) {
                            var redoIcon = item.lastRedoResult === 'correct' ? '&#10003;' : '&#10007;';
                            var redoClass = item.lastRedoResult === 'correct' ? 'redo-success' : 'redo-fail';
                            html += '<div class="mistake-detail-row"><span class="label">重做:</span> <span class="mistake-redo-status ' + redoClass + '">重做 ' + item.redoCount + '次 ' + redoIcon + '</span></div>';
                        }

                        // 题目原文区域
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
```

- [ ] **Step 2: 添加异步加载题目原文的逻辑**

在 `renderList` 函数的 `container.innerHTML = html;` 之后，添加异步加载逻辑：

```js
        container.innerHTML = html;

        // 异步加载展开的题目原文
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
```

- [ ] **Step 3: 添加 loadQuestionPreview 函数**

在 `renderList` 函数之后、`updateFilterButtons` 函数之前添加：

```js
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

            // 只读展示：渲染后禁用所有 inputs
            if (type === 'reading') {
                container.innerHTML = '<div class="redo-reading-layout readonly">' +
                    '<div class="redo-passage">' + data.passageHtml + '</div>' +
                    '<div class="redo-question-area">' + data.questionHtml + '</div>' +
                    '</div>';
            } else {
                var audioHtml = data.audioSrc ? '<div class="redo-audio-player"><audio controls src="' + escapeHtml(data.audioSrc) + '" preload="metadata"></audio></div>' : '';
                container.innerHTML = audioHtml + '<div class="redo-question-area">' + data.questionHtml + '</div>';
            }

            // 禁用所有 inputs (只读)
            container.querySelectorAll('input, textarea, select').forEach(function (el) {
                el.disabled = true;
            });
        } catch (e) {
            container.innerHTML = '<div class="mistake-question-unavailable">加载题目时出错</div>';
        }
    }
```

- [ ] **Step 4: Commit**

```bash
git add js/presentation/mistakeBookView.js
git commit -m "feat: 错题本展开详情显示题目原文和重做按钮"
```

---

## Task 4: 重做浮窗 — 全屏 overlay + 交互 + 提交判对错

**Files:**
- Modify: `js/presentation/mistakeBookView.js` (在全局函数区域添加浮窗逻辑)

- [ ] **Step 1: 添加浮窗 DOM 创建和打开逻辑**

在 `window.clearMistakeSelection` 函数之后添加：

```js
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

    // 获取考试标题
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

    // 创建浮窗
    var overlay = document.createElement('div');
    overlay.className = 'redo-modal-overlay';
    overlay.id = 'redo-modal';

    var modal = document.createElement('div');
    modal.className = 'redo-modal';

    // 头部
    var header = document.createElement('div');
    header.className = 'redo-modal-header';
    header.innerHTML = '<span class="redo-modal-title">' + escapeHtml(title) + ' &middot; ' + escapeHtml(questionId) + '</span>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'redo-modal-close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.onclick = function () { closeModal(); };
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // 内容区
    var body = document.createElement('div');
    body.className = 'redo-modal-body';
    QuestionExtractor.renderQuestionInContainer(body, data, type);
    modal.appendChild(body);

    // 底部
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

        // 记录重做结果
        if (window.MistakeBook && window.MistakeBook.recordRedo) {
            window.MistakeBook.recordRedo(mistakeId, allCorrect);
        }

        // 按钮变为关闭
        submitBtn.textContent = '关闭';
        submitBtn.onclick = function () { closeModal(); };
    };
    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 点击遮罩不关闭（防误触）

    function closeModal() {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        MistakeBookView.render();
    }

    // ESC 关闭
    function onEsc(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', onEsc);
        }
    }
    document.addEventListener('keydown', onEsc);
};
```

- [ ] **Step 2: Commit**

```bash
git add js/presentation/mistakeBookView.js
git commit -m "feat: 错题本重做浮窗 — 全屏 overlay + 答案对比"
```

---

## Task 5: CSS 样式 — 浮窗 + 题目原文 + 重做结果

**Files:**
- Modify: `css/main.css` (在 mistake book 样式区域末尾添加)

- [ ] **Step 1: 在 main.css 的 mistake book 样式末尾（`@media` 之前）添加新样式**

找到 `css/main.css` 中的 `@media (max-width: 768px)` 块（在 mistake 样式之后），在其之前插入以下样式：

```css
/* Mistake redo button */
.mistake-action-btn.redo-btn {
    border-color: var(--color-brand-primary, #2563eb);
    color: var(--color-brand-primary, #2563eb);
    font-weight: 600;
}

.mistake-action-btn.redo-btn:hover {
    background: var(--color-brand-primary, #2563eb);
    color: #fff;
}

/* Redo status in detail */
.mistake-redo-status {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
}

.mistake-redo-status.redo-success {
    color: #15803d;
    background: #dcfce7;
}

.mistake-redo-status.redo-fail {
    color: #b91c1c;
    background: #fee2e2;
}

/* Question preview in expanded detail */
.mistake-question-preview {
    margin-top: var(--space-sm);
    padding: var(--space-md);
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: var(--border-radius-lg);
    max-height: 300px;
    overflow-y: auto;
    font-size: 0.88rem;
    line-height: 1.6;
}

.mistake-question-loading {
    text-align: center;
    color: var(--color-gray-400, #9ca3af);
    padding: 12px;
    font-size: 0.82rem;
}

.mistake-question-unavailable {
    text-align: center;
    color: var(--color-gray-400, #9ca3af);
    padding: 12px;
    font-size: 0.82rem;
    font-style: italic;
}

.mistake-question-preview input,
.mistake-question-preview select,
.mistake-question-preview textarea {
    pointer-events: none;
}

/* Redo modal */
.redo-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}

.redo-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
}

.redo-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
}

.redo-modal-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: #111827;
}

.redo-modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.redo-modal-close:hover {
    background: #f3f4f6;
    color: #111827;
}

.redo-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.redo-modal-footer {
    padding: 14px 20px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
}

.redo-modal-submit {
    padding: 10px 32px;
    background: var(--color-brand-primary, #2563eb);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
}

.redo-modal-submit:hover {
    opacity: 0.9;
}

/* Reading layout in modal */
.redo-reading-layout {
    display: flex;
    gap: 20px;
}

.redo-reading-layout .redo-passage {
    flex: 1;
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 16px;
    border-right: 1px solid #e5e7eb;
    font-size: 0.9rem;
    line-height: 1.7;
}

.redo-reading-layout .redo-question-area {
    flex: 1;
    max-height: 60vh;
    overflow-y: auto;
}

.redo-audio-player {
    margin-bottom: 16px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
}

.redo-audio-player audio {
    width: 100%;
}

/* Answer result marks */
.redo-correct {
    background: #dcfce7 !important;
    border-color: #15803d !important;
}

.redo-incorrect {
    background: #fee2e2 !important;
    border-color: #b91c1c !important;
}

.redo-answer-hint {
    font-size: 0.8rem;
    color: #15803d;
    font-weight: 600;
    margin-top: 4px;
}

.redo-reading-layout.readonly .redo-passage {
    border-right: none;
}

.redo-reading-layout.readonly {
    flex-direction: column;
}

@media (max-width: 768px) {
    .redo-reading-layout {
        flex-direction: column;
    }

    .redo-reading-layout .redo-passage {
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
        padding-right: 0;
        padding-bottom: 16px;
        max-height: 40vh;
    }

    .redo-reading-layout .redo-question-area {
        max-height: 40vh;
    }

    .redo-modal {
        max-width: 100%;
        max-height: 100vh;
        border-radius: 0;
        height: 100%;
    }
}
```

- [ ] **Step 2: 在现有 `@media (max-width: 768px)` 的 mistake 相关样式中添加移动端适配**

在已有的 `@media (max-width: 768px)` 块中的 `.mistake-batch-bar` 样式之后添加：

```css
    .mistake-question-preview {
        max-height: 200px;
    }
```

- [ ] **Step 3: Commit**

```bash
git add css/main.css
git commit -m "style: 错题本重做浮窗和题目原文样式"
```

---

## Verification

1. 在题库中做一次阅读练习，提交后切到错题本
2. 展开一条阅读错题 → 确认显示文章+题目原文（只读）
3. 展开一条听力错题 → 确认显示题目+音频播放器（只读）
4. 点击"重做此题" → 确认弹出全屏浮窗，题目可交互作答
5. 在浮窗中作答并提交 → 确认正确/错误标注显示
6. 关闭浮窗 → 确认错题列表显示重做次数标记
7. 再次展开同一条错题 → 确认重做次数已更新
8. 测试 ESC 键关闭浮窗
9. 测试移动端响应式（浮窗全屏、阅读题上下排列）
