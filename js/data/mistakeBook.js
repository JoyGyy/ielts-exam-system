'use strict';

const MistakeBook = (function () {
    const STORAGE_KEY = 'mistake_book';

    function readAll() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function writeAll(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function generateId() {
        return 'mistake_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    return {
        getMistakes: function () {
            return readAll();
        },

        getMistakesGroupedByExam: function () {
            var list = readAll();
            var groups = {};
            var order = [];
            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                var key = m.examId || 'unknown';
                if (!groups[key]) {
                    groups[key] = { examId: m.examId, title: m.title || '未知考试', mistakes: [] };
                    order.push(key);
                }
                groups[key].mistakes.push(m);
            }
            var result = [];
            for (var j = 0; j < order.length; j++) {
                result.push(groups[order[j]]);
            }
            return result;
        },

        getMistakesByExam: function (examId) {
            var list = readAll();
            var result = [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].examId === examId) {
                    result.push(list[i]);
                }
            }
            return result;
        },

        getMistakeStats: function () {
            var list = readAll();
            var total = list.length;
            var mastered = 0;
            var reading = 0;
            var listening = 0;
            var byExam = {};

            for (var i = 0; i < total; i++) {
                if (list[i].mastered) mastered++;
                if (list[i].type === 'reading') reading++;
                if (list[i].type === 'listening') listening++;
                var examKey = list[i].examId || 'unknown';
                if (!byExam[examKey]) {
                    byExam[examKey] = { examId: list[i].examId, title: list[i].title || '未知考试', count: 0 };
                }
                byExam[examKey].count++;
            }

            var byExamList = [];
            var examKeys = Object.keys(byExam);
            for (var j = 0; j < examKeys.length; j++) {
                byExamList.push(byExam[examKeys[j]]);
            }

            return {
                total: total,
                mastered: mastered,
                unmastered: total - mastered,
                reading: reading,
                listening: listening,
                byExam: byExamList
            };
        },

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

        batchToggleMastered: function (ids, mastered) {
            if (!Array.isArray(ids) || ids.length === 0) return 0;
            var list = readAll();
            var idSet = {};
            for (var i = 0; i < ids.length; i++) {
                idSet[ids[i]] = true;
            }
            var updated = 0;
            for (var j = 0; j < list.length; j++) {
                if (idSet[list[j].id] && list[j].mastered !== mastered) {
                    list[j].mastered = mastered;
                    list[j].updatedAt = new Date().toISOString();
                    updated++;
                }
            }
            if (updated > 0) writeAll(list);
            return updated;
        },

        batchRemove: function (ids) {
            if (!Array.isArray(ids) || ids.length === 0) return 0;
            var idSet = {};
            for (var i = 0; i < ids.length; i++) {
                idSet[ids[i]] = true;
            }
            var list = readAll();
            var before = list.length;
            var filtered = list.filter(function (m) { return !idSet[m.id]; });
            if (filtered.length < before) {
                writeAll(filtered);
                return before - filtered.length;
            }
            return 0;
        },

        exportMistakes: function () {
            return JSON.stringify(readAll(), null, 2);
        },

        addMistakesFromRecord: function (record) {
            if (!record) return 0;
            var list = readAll();
            var existingKeys = {};
            for (var i = 0; i < list.length; i++) {
                var key = list[i].examId + '|' + list[i].recordId + '|' + list[i].questionId;
                existingKeys[key] = true;
            }

            var newMistakes = [];
            var recordId = record.recordId || record.id || '';
            var comparison = record.answerComparison || {};
            var userAnswers = record.answers || {};

            var questionIds = Object.keys(comparison);
            for (var j = 0; j < questionIds.length; j++) {
                var qId = questionIds[j];
                var entry = comparison[qId];
                if (!entry || entry.isCorrect) continue;

                var dedupKey = record.examId + '|' + recordId + '|' + qId;
                if (existingKeys[dedupKey]) continue;

                var userAns = entry.userAnswer || userAnswers[qId] || '';
                var correctAns = entry.correctAnswer || '';

                var mistake = {
                    id: generateId(),
                    recordId: recordId,
                    examId: record.examId || '',
                    questionId: qId,
                    userAnswer: Array.isArray(userAns) ? userAns.join(', ') : String(userAns),
                    correctAnswer: Array.isArray(correctAns) ? correctAns.join(', ') : String(correctAns),
                    type: record.type || (record.metadata && record.metadata.type) || '',
                    title: record.title || (record.metadata && record.metadata.title) || '',
                    category: record.category || (record.metadata && record.metadata.category) || '',
                    frequency: record.frequency || (record.metadata && record.metadata.frequency) || '',
                    date: record.date || record.endTime || new Date().toISOString(),
                    mastered: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                newMistakes.push(mistake);
                existingKeys[dedupKey] = true;
            }

            if (newMistakes.length > 0) {
                list = list.concat(newMistakes);
                writeAll(list);
            }

            return newMistakes.length;
        },

        toggleMastered: function (id) {
            var list = readAll();
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) {
                    list[i].mastered = !list[i].mastered;
                    list[i].updatedAt = new Date().toISOString();
                    writeAll(list);
                    return list[i];
                }
            }
            return null;
        },

        removeMistake: function (id) {
            var list = readAll();
            var filtered = list.filter(function (m) { return m.id !== id; });
            if (filtered.length < list.length) {
                writeAll(filtered);
                return true;
            }
            return false;
        },

        clearAll: function () {
            writeAll([]);
        },

        getStats: function () {
            var list = readAll();
            var total = list.length;
            var mastered = 0;
            var reading = 0;
            var listening = 0;
            var redone = 0;

            for (var i = 0; i < total; i++) {
                if (list[i].mastered) mastered++;
                if (list[i].type === 'reading') reading++;
                if (list[i].type === 'listening') listening++;
                if (list[i].redoCount) redone++;
            }

            return {
                total: total,
                mastered: mastered,
                unmastered: total - mastered,
                reading: reading,
                listening: listening,
                redone: redone
            };
        }
    };
})();

window.MistakeBook = MistakeBook;
