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
