/**
 * urlBuilder.js - 练习 URL 构建
 * 从 examSessionMixin.js 提取
 *
 * 职责：构造练习页面URL、占位页URL、URL规范化
 */
(function (global) {
    const urlBuilderMethods = {

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
    };

    global.__examSessionModules = global.__examSessionModules || {};
    global.__examSessionModules.urlBuilder = urlBuilderMethods;
})(typeof window !== "undefined" ? window : globalThis);
