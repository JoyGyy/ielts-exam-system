'use strict';

const QuestionExtractor = (function () {
    var scriptCache = {};

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function loadScript(url) {
        if (!url) return Promise.reject(new Error('script_url_missing'));
        if (scriptCache[url]) return scriptCache[url];
        var promise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = url;
            script.onload = function () { resolve(true); };
            script.onerror = function () { reject(new Error('script_load_failed:' + url)); };
            document.head.appendChild(script);
        });
        scriptCache[url] = promise;
        return promise;
    }

    function getRelativePath(examId, isReading) {
        if (isReading) {
            return 'assets/generated/reading-exams/';
        }
        return 'assets/generated/listening-exams/';
    }

    function ensureReadingExamData(examId) {
        if (window.__READING_EXAM_DATA__ && window.__READING_EXAM_DATA__.has(examId)) {
            return Promise.resolve(true);
        }
        return loadScript('assets/generated/reading-exams/manifest.js').then(function () {
            var manifest = window.__READING_EXAM_MANIFEST__;
            var entry = manifest && manifest[examId];
            if (!entry || !entry.script) {
                return Promise.reject(new Error('reading_exam_entry_missing:' + examId));
            }
            return loadScript('assets/generated/reading-exams/' + entry.script);
        });
    }

    function ensureListeningExamData(examId) {
        if (window.__LISTENING_EXAM_DATA__ && window.__LISTENING_EXAM_DATA__.has(examId)) {
            return Promise.resolve(true);
        }
        return loadScript('assets/generated/listening-exams/manifest.js').then(function () {
            var manifest = window.__LISTENING_EXAM_MANIFEST__;
            var entry = manifest && manifest[examId];
            if (!entry || !entry.script) {
                return Promise.reject(new Error('listening_exam_entry_missing:' + examId));
            }
            return loadScript('assets/generated/listening-exams/' + entry.script);
        });
    }

    function extractReadingQuestion(examId, questionId) {
        if (!window.__READING_EXAM_DATA__ || !window.__READING_EXAM_DATA__.has(examId)) {
            return null;
        }
        var exam = window.__READING_EXAM_DATA__.get(examId);
        if (!exam) return null;

        var passageBlocks = (exam.passage && exam.passage.blocks) || [];
        var passageHtml = passageBlocks.map(function (b) { return b.bodyHtml || b.html || ''; }).join('\n');

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

        var temp = document.createElement('div');
        temp.innerHTML = targetGroup.bodyHtml || '';

        var questionHtml = '';
        var qNum = questionId.replace(/^q/, '');

        var anchor = temp.querySelector('#' + questionId + '-anchor') || temp.querySelector('#q' + qNum + '-anchor');
        if (anchor) {
            questionHtml = anchor.outerHTML;
        }

        if (!questionHtml) {
            var el = temp.querySelector('[data-question="' + questionId + '"]');
            if (el) {
                var parent = el.closest('.question-item');
                questionHtml = parent ? parent.outerHTML : el.outerHTML;
            }
        }

        if (!questionHtml) {
            var input = temp.querySelector('[name="' + questionId + '"]');
            if (input) {
                var parent2 = input.closest('.question-item') || input.closest('tr') || input.closest('li') || input.parentElement;
                questionHtml = parent2 ? parent2.outerHTML : input.outerHTML;
            }
        }

        if (!questionHtml) {
            var items = temp.querySelectorAll('.question-item');
            for (var j = 0; j < items.length; j++) {
                if (items[j].id && items[j].id.indexOf(qNum) !== -1) {
                    questionHtml = items[j].outerHTML;
                    break;
                }
            }
        }

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

        var input = temp.querySelector('[name="' + questionId + '"]');
        if (input) {
            var group = input.closest('.group') || input.closest('[data-section]') || input.parentElement;
            questionHtml = group ? group.outerHTML : input.outerHTML;
        }

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

        var answerKey = exam.answerKey || {};
        var answer = '';
        if (answerKey.text && answerKey.text[questionId] !== undefined) {
            answer = String(answerKey.text[questionId]);
        } else if (answerKey.single && answerKey.single[questionId] !== undefined) {
            answer = String(answerKey.single[questionId]);
        } else if (answerKey.multiple && answerKey.multiple[questionId] !== undefined) {
            answer = String(answerKey.multiple[questionId]);
        }

        var audioSrc = (exam.meta && exam.meta.audioSrc) || '';

        var questionList = exam.questionList || [];
        var questionIds = questionList.map(function (n) { return 'q' + n; });

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

        container.querySelectorAll('input, textarea, select').forEach(function (el) {
            el.disabled = false;
            el.removeAttribute('readonly');
        });

        container.querySelectorAll('.dropzone, .match-dropzone, .paragraph-dropzone').forEach(function (el) {
            el.classList.remove('drag-item-locked');
        });
    }

    function collectUserAnswers(container, questionIds) {
        var answers = {};
        if (!container || !questionIds) return answers;

        questionIds.forEach(function (qId) {
            var radios = container.querySelectorAll('input[type="radio"][name="' + qId + '"]');
            if (radios.length) {
                var checked = null;
                radios.forEach(function (r) { if (r.checked) checked = r; });
                answers[qId] = checked ? String(checked.value).trim() : '';
                return;
            }

            var checkboxes = container.querySelectorAll('input[type="checkbox"][name="' + qId + '"]');
            if (checkboxes.length) {
                var checkedVals = [];
                checkboxes.forEach(function (c) { if (c.checked) checkedVals.push(c.value); });
                answers[qId] = checkedVals.sort().join(',');
                return;
            }

            var textInput = container.querySelector('input[type="text"][name="' + qId + '"]');
            if (textInput) {
                answers[qId] = textInput.value.trim();
                return;
            }

            var select = container.querySelector('select[name="' + qId + '"]');
            if (select) {
                answers[qId] = select.value;
                return;
            }

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

    function compareAnswers(userAnswers, correctAnswer, questionId) {
        var userAns = userAnswers[questionId] || '';
        var correct = String(correctAnswer || '').trim();
        var isCorrect = userAns.toLowerCase().trim() === correct.toLowerCase().trim();

        return {
            userAnswer: userAns,
            correctAnswer: correct,
            isCorrect: isCorrect
        };
    }

    function markResults(container, questionIds, comparison) {
        if (!container) return;

        questionIds.forEach(function (qId) {
            var result = comparison[qId];
            if (!result) return;

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

            var textInput = container.querySelector('input[type="text"][name="' + qId + '"]');
            if (textInput) {
                textInput.disabled = true;
                if (result.isCorrect) {
                    textInput.classList.add('input-correct');
                } else {
                    textInput.classList.add('input-incorrect');
                    var hint = document.createElement('div');
                    hint.className = 'redo-answer-hint';
                    hint.textContent = '正确答案: ' + result.correctAnswer;
                    textInput.parentElement.appendChild(hint);
                }
            }

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

    function extractReadingQuestionAsync(examId, questionId) {
        return ensureReadingExamData(examId).then(function () {
            return extractReadingQuestion(examId, questionId);
        });
    }

    function extractListeningQuestionAsync(examId, questionId) {
        return ensureListeningExamData(examId).then(function () {
            return extractListeningQuestion(examId, questionId);
        });
    }

    return {
        extractReadingQuestion: extractReadingQuestion,
        extractListeningQuestion: extractListeningQuestion,
        extractReadingQuestionAsync: extractReadingQuestionAsync,
        extractListeningQuestionAsync: extractListeningQuestionAsync,
        renderQuestionInContainer: renderQuestionInContainer,
        collectUserAnswers: collectUserAnswers,
        compareAnswers: compareAnswers,
        markResults: markResults
    };
})();

window.QuestionExtractor = QuestionExtractor;
