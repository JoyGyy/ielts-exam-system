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

            for (var i = 0; i < total; i++) {
                if (list[i].mastered) mastered++;
                if (list[i].type === 'reading') reading++;
                if (list[i].type === 'listening') listening++;
            }

            return {
                total: total,
                mastered: mastered,
                unmastered: total - mastered,
                reading: reading,
                listening: listening
            };
        }
    };
})();

window.MistakeBook = MistakeBook;
