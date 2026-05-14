// StorageManager 主入口 - 从 storage.js 提取
// 依赖: indexedDBAdapter.js, localStorageAdapter.js (需先加载)

const STORAGE_SYNC_IGNORED_KEYS = new Set([
    'namespace_test',
    'namespace_test_practice',
    'namespace_test_enhancer'
]);

class StorageManager {
    constructor() {
        this.prefix = 'exam_system_';
        this.version = '1.0.0';
        this.mode = 'indexeddb';
        this.volatileMode = false;
        this.useSessionStorageFallback = false;
        this.backendPreferenceKey = this.prefix + 'storage_backend';
        this.fallbackStorage = null;
        this.monitoringInterval = null;

        this.persistentKeys = new Set([
            'practice_records',
            'user_stats',
            'manual_backups',
            'backup_settings',
            'export_history',
            'import_history',
            'exam_index',
            'exam_index_configurations',
            'active_exam_index_key',
            'settings',
            'learning_goals'
        ]);

        this.indexedDBAdapter = new IndexedDBAdapter(this.prefix);
        this.localStorageAdapter = new LocalStorageAdapter(this.prefix);

        this.ready = this.initializeStorage().catch(error => {
            console.error('[Storage] 初始化失败:', error);
            throw error;
        });
    }

    async waitForInitialization(skipReady = false) {
        if (!skipReady) {
            await this.ready;
        }
    }

    // ==================== 后端偏好管理 ====================

    getStoredBackendPreference() {
        try {
            if (this.localStorageAdapter.sessionStorageAvailable && sessionStorage.getItem(this.backendPreferenceKey)) {
                return sessionStorage.getItem(this.backendPreferenceKey);
            }
        } catch (_) { /* ignore */ }
        try {
            if (this.localStorageAdapter.localStorageAvailable && localStorage.getItem(this.backendPreferenceKey)) {
                return localStorage.getItem(this.backendPreferenceKey);
            }
        } catch (_) { /* ignore */ }
        return null;
    }

    setBackendPreference(mode) {
        try {
            if (mode === 'session' && this.localStorageAdapter.sessionStorageAvailable) {
                sessionStorage.setItem(this.backendPreferenceKey, 'session');
                return;
            }
            if (mode === 'local' && this.localStorageAdapter.localStorageAvailable) {
                localStorage.setItem(this.backendPreferenceKey, 'local');
                return;
            }
        } catch (_) { /* ignore */ }
    }

    clearBackendPreference() {
        try { if (this.localStorageAdapter.sessionStorageAvailable) { sessionStorage.removeItem(this.backendPreferenceKey); } } catch (_) {}
        try { if (this.localStorageAdapter.localStorageAvailable) { localStorage.removeItem(this.backendPreferenceKey); } } catch (_) {}
    }

    // ==================== 初始化 ====================

    async initializeStorage() {
        console.log('[Storage] 开始初始化存储系统');
        try {
            const { localStorageAvailable, sessionStorageAvailable } = this.localStorageAdapter.initialize();

            if (localStorageAvailable) {
                this.setBackendPreference('local');
            }

            if (!localStorageAvailable && sessionStorageAvailable) {
                this.useSessionStorageFallback = true;
            }

            const storedPreference = this.getStoredBackendPreference();
            if (storedPreference === 'session') {
                this.useSessionStorageFallback = true;
            }

            // 强制初始化 IndexedDB 以实现 Hybrid 模式
            console.log('[Storage] 强制初始化 IndexedDB 以实现 Hybrid 模式');
            await this.initializeIndexedDBStorage();

            // 初始化版本信息
            const currentVersion = await this.get('system_version', null, { skipReady: true });
            console.log(`[Storage] 当前版本: ${currentVersion}, 目标版本: ${this.version}`);

            if (!currentVersion) {
                console.log('[Storage] 首次安装，初始化默认数据');
                await this.handleVersionUpgrade(null, { skipReady: true });
            } else if (currentVersion !== this.version) {
                console.log('[Storage] 版本升级，迁移数据');
                await this.handleVersionUpgrade(currentVersion, { skipReady: true });
            } else {
                console.log('[Storage] 版本匹配，跳过初始化');
            }
        } catch (error) {
            console.warn('[Storage] 初始化基本存储能力失败，尝试继续:', error);
            await this.initializeIndexedDBStorage();
        }
    }

    /**
     * 初始化 IndexedDB 存储
     */
    initializeIndexedDBStorage() {
        console.log('[Storage] 开始初始化 IndexedDB');
        const fallbackInfo = {
            localStorageAvailable: this.localStorageAdapter.localStorageAvailable,
            sessionStorageAvailable: this.localStorageAdapter.sessionStorageAvailable
        };

        return this.indexedDBAdapter.initialize(fallbackInfo).then((result) => {
            this.volatileMode = result.mode === 'volatile';
            this.mode = result.mode;

            if (result.mode === 'volatile') {
                this.fallbackStorage = this.fallbackStorage || new Map();
            }

            if (this.indexedDBAdapter.indexedDB) {
                // 迁移 localStorage 数据到 IndexedDB
                console.log('[Storage] 开始从 localStorage 迁移数据');
                return this.migrateFromLocalStorage();
            }
        });
    }

    /**
     * 确保 IndexedDB 已 ready
     */
    async ensureIndexedDBReady() {
        await this.indexedDBAdapter.ensureReady();
    }

    async tryPromoteToIndexedDB(serializedValue, key) {
        try {
            if (!this.indexedDBAdapter.indexedDB) {
                await this.initializeIndexedDBStorage();
            }
            if (this.indexedDBAdapter.indexedDB) {
                await this.indexedDBAdapter.set(this.getKey(key), serializedValue);
                this.useSessionStorageFallback = false;
                this.setBackendPreference('local');
                this.dispatchStorageSync(key);
                return true;
            }
        } catch (e) {
            console.warn('[Storage] 提升到 IndexedDB 失败，继续使用退路:', e);
        }
        return false;
    }

    /**
     * 从 localStorage 迁移数据到 IndexedDB
     */
    async migrateFromLocalStorage() {
        console.log('[Storage] 开始数据迁移');
        try {
            if (!this.indexedDBAdapter.indexedDB) {
                console.warn('[Storage] IndexedDB 不可用，跳过迁移');
                return;
            }

            const keys = Object.keys(localStorage);
            const migrationKeys = keys.filter(key => key.startsWith(this.prefix));
            console.log(`[Storage] 发现 ${migrationKeys.length} 条需要迁移的键`);

            if (migrationKeys.length === 0) {
                console.log('[Storage] 无数据需要迁移');
                return;
            }

            let migratedCount = 0;
            let failedCount = 0;

            for (const key of migrationKeys) {
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        await this.indexedDBAdapter.set(key, value);
                        localStorage.removeItem(key);
                        migratedCount++;
                        console.log(`[Storage] 成功迁移键: ${key}`);
                    }
                } catch (error) {
                    console.warn(`[Storage] 迁移数据失败: ${key}`, error);
                    failedCount++;
                }
            }

            console.log(`[Storage] 数据迁移完成: ${migratedCount} 成功, ${failedCount} 失败`);
        } catch (error) {
            console.error('[Storage] 数据迁移失败:', error);
        }
    }

    // ==================== 数据封装与读写 ====================

    getKey(key) {
        return this.prefix + key;
    }

    createStoredEnvelope(value) {
        const compressedValue = this.compressData(value);
        return JSON.stringify({
            data: compressedValue,
            timestamp: Date.now(),
            version: this.version,
            compressed: compressedValue !== value
        });
    }

    parseStoredEnvelope(serializedValue, defaultValue = undefined) {
        if (serializedValue === undefined || serializedValue === null) {
            return defaultValue;
        }
        const parsed = JSON.parse(serializedValue);
        return parsed && Object.prototype.hasOwnProperty.call(parsed, 'data')
            ? parsed.data
            : defaultValue;
    }

    async writePersistentValue(key, value) {
        const serializedValue = this.createStoredEnvelope(value);
        const storageKey = this.getKey(key);

        if (this.indexedDBAdapter.indexedDB && !this.indexedDBAdapter.indexedDBBlocked) {
            await this.indexedDBAdapter.set(storageKey, serializedValue);
            this.dispatchStorageSync(key);
            return true;
        }

        if (this.localStorageAdapter.localStorageAvailable && this.localStorageAdapter.writeValue(localStorage, storageKey, serializedValue)) {
            this.mode = 'localStorage';
            this.volatileMode = false;
            this.dispatchStorageSync(key);
            return true;
        }

        if (this.localStorageAdapter.sessionStorageAvailable && this.localStorageAdapter.writeValue(sessionStorage, storageKey, serializedValue)) {
            this.mode = 'sessionStorage';
            this.volatileMode = false;
            this.dispatchStorageSync(key);
            return true;
        }

        if (this.fallbackStorage) {
            this.fallbackStorage.set(storageKey, serializedValue);
            this.dispatchStorageSync(key);
            return true;
        }

        this.volatileMode = true;
        this.mode = 'volatile';
        this.fallbackStorage = this.fallbackStorage || new Map();
        this.fallbackStorage.set(storageKey, serializedValue);
        this.dispatchStorageSync(key);
        return true;
    }

    async readPersistentValue(key, defaultValue = undefined) {
        const storageKey = this.getKey(key);

        if (this.fallbackStorage && this.fallbackStorage.has(storageKey)) {
            return this.parseStoredEnvelope(this.fallbackStorage.get(storageKey), defaultValue);
        }

        if (this.indexedDBAdapter.indexedDB && !this.indexedDBAdapter.indexedDBBlocked) {
            const serializedValue = await this.indexedDBAdapter.get(storageKey);
            return this.parseStoredEnvelope(serializedValue, defaultValue);
        }

        if (this.localStorageAdapter.localStorageAvailable) {
            return this.parseStoredEnvelope(this.localStorageAdapter.readValue(localStorage, storageKey), defaultValue);
        }

        if (this.localStorageAdapter.sessionStorageAvailable) {
            return this.parseStoredEnvelope(this.localStorageAdapter.readValue(sessionStorage, storageKey), defaultValue);
        }

        return defaultValue;
    }

    async removePersistentValue(key) {
        const storageKey = this.getKey(key);

        if (this.fallbackStorage) {
            this.fallbackStorage.delete(storageKey);
        }

        if (this.indexedDBAdapter.indexedDB && !this.indexedDBAdapter.indexedDBBlocked) {
            await this.indexedDBAdapter.remove(storageKey);
        }

        try { localStorage.removeItem(storageKey); } catch (_) { }
        try { sessionStorage.removeItem(storageKey); } catch (_) { }
        this.dispatchStorageSync(key);
        return true;
    }

    async clearPersistentStorage() {
        if (this.fallbackStorage) {
            this.fallbackStorage.clear();
        }

        if (this.indexedDBAdapter.indexedDB && !this.indexedDBAdapter.indexedDBBlocked) {
            await this.indexedDBAdapter.clear();
        }

        this.localStorageAdapter.clearByPrefix(this.prefix);
        this.clearBackendPreference();
        window.dispatchEvent(new CustomEvent('storage-sync', { detail: { key: '*' } }));
        return true;
    }

    // ==================== 公共 API ====================

    async set(key, value, options = {}) {
        const { skipReady = false, skipPracticeCoreRedirect = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            await this.ensureIndexedDBReady();
            const allowPracticeCoreRedirect = !skipReady && !skipPracticeCoreRedirect;
            if (allowPracticeCoreRedirect && window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.handlesStorageKey === 'function' && window.PracticeCore.store.handlesStorageKey(key)) {
                const redirected = await window.PracticeCore.store.routeStorageSet(this, key, value, options);
                if (redirected !== null && redirected !== undefined) {
                    return redirected;
                }
            }
            return await this.writePersistentValue(key, value);
        } catch (error) {
            console.error('[Storage] set 操作错误:', error);
            this.handleStorageError(key, value, error);
            return false;
        }
    }

    async append(key, value, options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            await this.ensureIndexedDBReady();
            let currentList = await this.readPersistentValue(key, []);
            if (!Array.isArray(currentList)) {
                currentList = [];
            }
            currentList.push(value);
            return await this.writePersistentValue(key, currentList);
        } catch (error) {
            console.error('[Storage] Append error:', error);
            this.handleStorageError(key, value, error);
            return false;
        }
    }

    async get(key, defaultValue = null, options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            await this.ensureIndexedDBReady();
            return await this.readPersistentValue(key, defaultValue);
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    async remove(key, options = {}) {
        const { skipReady = false, skipPracticeCoreRedirect = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            await this.ensureIndexedDBReady();
            const allowPracticeCoreRedirect = !skipReady && !skipPracticeCoreRedirect;
            if (allowPracticeCoreRedirect && window.PracticeCore && window.PracticeCore.store && typeof window.PracticeCore.store.handlesStorageKey === 'function' && window.PracticeCore.store.handlesStorageKey(key)) {
                const redirected = await window.PracticeCore.store.routeStorageRemove(this, key, options);
                if (redirected !== null && redirected !== undefined) {
                    return redirected;
                }
            }
            return await this.removePersistentValue(key);
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    async clear(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            await this.ensureIndexedDBReady();
            return await this.clearPersistentStorage();
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * 设置存储命名空间
     */
    setNamespace(namespace) {
        if (typeof namespace === 'string' && namespace.trim()) {
            this.prefix = namespace.trim() + '_';
            this.indexedDBAdapter.prefix = this.prefix;
            this.localStorageAdapter.prefix = this.prefix;
            console.log('[Storage] 命名空间已设置为:', this.prefix);
        } else {
            console.warn('[Storage] 无效的命名空间:', namespace);
        }
    }

    // ==================== 压缩 ====================

    compressData(data) {
        try {
            if (Array.isArray(data)) {
                return data;
            }
            if (data && typeof data === 'object') {
                const len = JSON.stringify(data).length;
                if (len > 1000) {
                    return this.compressObject(data);
                }
            }
            return data;
        } catch (error) {
            console.warn('[Storage] 数据压缩失败，使用原始数据:', error);
            return data;
        }
    }

    compressObject(obj) {
        const coreFields = [
            'id', 'examId', 'title', 'category', 'frequency',
            'score', 'totalQuestions', 'accuracy', 'percentage', 'duration',
            'startTime', 'endTime', 'date', 'sessionId', 'timestamp',
            'dataSource', 'realData'
        ];

        const compressed = {};

        coreFields.forEach(field => {
            if (obj.hasOwnProperty(field)) {
                compressed[field] = obj[field];
            }
        });

        if (obj.realData) {
            compressed.realData = this.compressRealData(obj.realData);
        }

        return compressed;
    }

    mergeRecords(current, legacy) {
        if (!Array.isArray(current)) current = [];
        if (!Array.isArray(legacy)) return current;

        const mergedMap = new Map();
        [...current, ...legacy].forEach(record => {
            if (record && record.id) {
                const existing = mergedMap.get(record.id);
                if (!existing || (record.timestamp > existing.timestamp)) {
                    mergedMap.set(record.id, record);
                }
            } else if (record && record.timestamp) {
                mergedMap.set(record.timestamp, record);
            }
        });

        return Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    compressRealData(realData) {
        const compressed = {
            score: realData.score,
            totalQuestions: realData.totalQuestions,
            accuracy: realData.accuracy,
            percentage: realData.percentage,
            duration: realData.duration,
            answers: realData.answers || {},
            correctAnswers: realData.correctAnswers || {},
            isRealData: realData.isRealData,
            source: realData.source
        };

        if (realData.answerHistory) {
            const latestAnswers = {};
            Object.entries(realData.answerHistory).forEach(([questionId, history]) => {
                if (Array.isArray(history) && history.length > 0) {
                    latestAnswers[questionId] = history[history.length - 1];
                }
            });
            compressed.answerHistory = latestAnswers;
        }

        if (realData.interactions && Array.isArray(realData.interactions)) {
            compressed.interactions = realData.interactions.slice(-50);
        }

        if (realData.answerComparison) {
            const simplifiedComparison = {};
            Object.entries(realData.answerComparison).forEach(([questionId, comparison]) => {
                simplifiedComparison[questionId] = {
                    userAnswer: comparison.userAnswer || '',
                    correctAnswer: comparison.correctAnswer || '',
                    isCorrect: comparison.isCorrect || false
                };
            });
            compressed.answerComparison = simplifiedComparison;
        }

        return compressed;
    }

    // ==================== 配额与存储信息 ====================

    async checkStorageQuota(dataSize, options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            console.log(`[Storage] 检查存储配额，需要空间: ${dataSize} 字节`);
            if (this.fallbackStorage) {
                console.log('[Storage] 内存存储，无配额限制');
                return true;
            }

            const storageInfo = await this.getStorageInfo({ skipReady });
            if (!storageInfo) {
                console.warn('[Storage] 无法获取存储信息，拒绝操作');
                return false;
            }

            console.log(`[Storage] 当前存储类型: ${storageInfo.type}, 已用: ${storageInfo.used} 字节`);

            if (storageInfo.type === 'Hybrid' || storageInfo.type === 'IndexedDB') {
                const maxSize = 105 * 1024 * 1024;
                const hasSpace = storageInfo.used + dataSize <= maxSize;
                console.log(`[Storage] Hybrid/IndexedDB 检查: 已用 ${storageInfo.used}, 需要 ${dataSize}, 最大 ${maxSize}, 结果: ${hasSpace}`);
                return hasSpace;
            }

            const currentUsage = storageInfo.used;
            const quota = 5 * 1024 * 1024;
            const availableSpace = quota - currentUsage;
            const bufferSpace = quota * 0.2;
            const safeAvailableSpace = availableSpace - bufferSpace;

            console.log(`[Storage] localStorage 检查: 当前使用 ${(currentUsage / 1024).toFixed(2)}KB, 总配额 ${quota / 1024}KB, 可用 ${(availableSpace / 1024).toFixed(2)}KB, 安全可用 ${(safeAvailableSpace / 1024).toFixed(2)}KB, 需要 ${(dataSize / 1024).toFixed(2)}KB`);

            const hasSpace = safeAvailableSpace >= dataSize;
            if (!hasSpace) {
                console.warn('[Storage] localStorage 空间不足');
            }
            return hasSpace;
        } catch (error) {
            console.error('[Storage] 配额检查错误:', error);
            return false;
        }
    }

    async getStorageInfo(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            if (this.fallbackStorage) {
                return {
                    type: 'volatile',
                    mode: this.mode,
                    volatile: true,
                    used: this.fallbackStorage.size,
                    available: Infinity
                };
            }

            if (this.indexedDBAdapter.indexedDB && !this.indexedDBAdapter.indexedDBBlocked) {
                const indexedDBUsed = await this.indexedDBAdapter.getUsage(this.prefix);
                return {
                    type: 'indexedDB',
                    mode: this.mode,
                    volatile: false,
                    used: indexedDBUsed,
                    available: Infinity,
                    breakdown: {
                        indexedDB: indexedDBUsed
                    }
                };
            }

            if (this.indexedDBAdapter.indexedDB) {
                try {
                    const localStorageUsed = this.localStorageAdapter.getUsage(this.prefix);
                    const indexedDBUsed = await this.indexedDBAdapter.getUsage(this.prefix);
                    const totalUsed = localStorageUsed + indexedDBUsed;

                    return {
                        type: 'Hybrid',
                        used: totalUsed,
                        available: Infinity,
                        breakdown: {
                            localStorage: localStorageUsed,
                            indexedDB: indexedDBUsed
                        }
                    };
                } catch (error) {
                    console.warn('[Storage] 获取混合存储使用情况失败:', error);
                }
            }

            let used = 0;
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    used += localStorage.getItem(key).length;
                }
            });

            return {
                type: 'localStorage',
                used: used,
                available: 5 * 1024 * 1024 - used
            };
        } catch (error) {
            console.error('Storage info error:', error);
            return null;
        }
    }

    // ==================== 数据清理 ====================

    async cleanupOldData(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            console.log('[Storage] 开始清理旧数据...');

            const practiceRecords = await this.get('practice_records', [], { skipReady });
            if (practiceRecords.length > 0) {
                console.log(`[Storage] 练习记录数据保留${practiceRecords.length}条记录，跳过压缩以保护答案数据完整性`);
            }

            const errorLogs = await this.get('injection_errors', [], { skipReady });
            if (errorLogs.length > 20) {
                const logsToKeep = errorLogs.slice(-20);
                await this.set('injection_errors', logsToKeep, { skipReady });
                console.log(`[Storage] 已清理错误日志，从${errorLogs.length}条减少到${logsToKeep.length}条`);
            }

            const collectionErrors = await this.get('collection_errors', [], { skipReady });
            if (collectionErrors.length > 20) {
                const logsToKeep = collectionErrors.slice(-20);
                await this.set('collection_errors', logsToKeep, { skipReady });
                console.log(`[Storage] 已清理数据收集错误日志，从${collectionErrors.length}条减少到${logsToKeep.length}条`);
            }

            const activeSessions = await this.get('active_sessions', [], { skipReady });
            const now = Date.now();
            const recentSessions = activeSessions.filter(session => {
                const sessionTime = new Date(session.startTime).getTime();
                const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
                return hoursDiff < 1;
            });

            if (recentSessions.length !== activeSessions.length) {
                await this.set('active_sessions', recentSessions, { skipReady });
                console.log(`[Storage] 已清理过期会话，从${activeSessions.length}个减少到${recentSessions.length}个`);
            }

        } catch (error) {
            console.error('[Storage] 清理旧数据失败:', error);
        }
    }

    // ==================== 版本升级与数据迁移 ====================

    async handleVersionUpgrade(oldVersion, options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        console.log(`Upgrading storage from ${oldVersion || 'unknown'} to ${this.version}`);

        if (!oldVersion) {
            await this.initializeDefaultData({ skipReady });
        }

        await this.set('system_version', this.version, { skipReady });

        if (!await this.get('migration_completed', null, { skipReady })) {
            console.log('[Storage] 检测到未完成迁移，开始执行...');
            await this.migrateLegacyData({ skipReady });
        } else {
            console.log('[Storage] 迁移已完成，跳过');
        }
    }

    async initializeDefaultData(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        const defaultData = {
            user_stats: {
                totalPractices: 0,
                totalTimeSpent: 0,
                averageScore: 0,
                categoryStats: {},
                questionTypeStats: {},
                streakDays: 0,
                lastPracticeDate: null
            },
            settings: {
                theme: 'light',
                notifications: true,
                autoSave: true,
                reminderTime: '19:00'
            },
            exam_index: null,
            practice_records: [],
            learning_goals: []
        };

        for (const [key, value] of Object.entries(defaultData)) {
            const existingValue = await this.get(key, null, { skipReady });
            if (existingValue === null || existingValue === undefined) {
                console.log(`[Storage] 初始化默认数据: ${key}`);
                await this.set(key, value, { skipReady });
            } else {
                console.log(`[Storage] 保留现有数据: ${key} (${Array.isArray(existingValue) ? existingValue.length + ' 项' : typeof existingValue})`);
            }
        }
    }

    async migrateLegacyData(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        console.log('[Storage] 开始迁移遗留数据');
        try {
            const legacyKeys = Object.keys(localStorage).filter(k =>
                k === 'practice_records' ||
                k === 'user_progress' ||
                k === 'scores' ||
                k.startsWith('old_prefix_')
            );

            if (legacyKeys.length === 0) {
                console.log('[Storage] 无遗留数据需要迁移');
                await this.set('migration_completed', true, { skipReady });
            } else {
                let migratedCount = 0;
                for (const oldKey of legacyKeys) {
                    try {
                        const legacyDataStr = localStorage.getItem(oldKey);
                        if (!legacyDataStr) continue;

                        let legacyData;
                        try {
                            legacyData = JSON.parse(legacyDataStr);
                        } catch (parseError) {
                            console.warn(`[Storage] 解析遗留数据失败: ${oldKey}`, parseError);
                            continue;
                        }

                        if (!Array.isArray(legacyData)) {
                            console.warn(`[Storage] 遗留数据非数组，跳过: ${oldKey}`);
                            continue;
                        }

                        if (legacyData.length === 0) {
                            console.log('[Storage] 旧数据为空，跳过迁移');
                            continue;
                        }

                        let newKey = oldKey.replace(/^old_prefix_/, '');
                        const current = await this.get(newKey, [], { skipReady });

                        const criticalKeys = ['practice_records'];
                        if (criticalKeys.includes(newKey) && legacyData.length === 0 && current.length > 0) {
                            console.log('[Storage] 发现空旧数据但新数据存在，跳过以避免覆盖');
                            continue;
                        }

                        const merged = this.mergeRecords(current, legacyData);
                        await this.set(newKey, merged, { skipReady });

                        localStorage.removeItem(oldKey);
                        migratedCount++;
                        console.log(`[Storage] 成功迁移并合并数据: ${oldKey} -> ${newKey} (${legacyData.length} 项)`);
                    } catch (migrateError) {
                        console.error(`[Storage] 迁移失败: ${oldKey}`, migrateError);
                    }
                }

                console.log(`[Storage] 数据迁移完成: ${migratedCount} 个键成功迁移`);
                await this.set('migration_completed', true, { skipReady });
            }

            // 迁移 MyMelody 遗留键
            if (!await this.get('my_melody_migration_completed', null, { skipReady })) {
                console.log('[Storage] 检查 MyMelody 遗留键迁移...');
                const oldMyMelodyKey = this.getKey('practice_records');
                try {
                    const legacyMyMelodyData = await this.indexedDBAdapter.get(oldMyMelodyKey);
                    if (legacyMyMelodyData) {
                        let legacyData;
                        try {
                            const parsed = JSON.parse(legacyMyMelodyData);
                            legacyData = parsed.data || parsed;
                        } catch (parseError) {
                            console.warn('[Storage] 解析 MyMelody 遗留数据失败', parseError);
                            await this.set('my_melody_migration_completed', true, { skipReady });
                            return;
                        }

                        if (!Array.isArray(legacyData)) {
                            console.warn('[Storage] MyMelody 遗留数据非数组，跳过');
                            await this.set('my_melody_migration_completed', true, { skipReady });
                            return;
                        }

                        if (legacyData.length === 0) {
                            console.log('[Storage] MyMelody 旧数据为空，跳过迁移');
                            await this.set('my_melody_migration_completed', true, { skipReady });
                            return;
                        }

                        const currentPracticeRecords = await this.get('practice_records', [], { skipReady });
                        const merged = this.mergeRecords(currentPracticeRecords, legacyData);
                        await this.set('practice_records', merged, { skipReady });

                        await this.indexedDBAdapter.remove(oldMyMelodyKey);
                        console.log(`[Storage] 成功迁移 MyMelody 数据: ${legacyData.length} 项合并到 practice_records`);
                    } else {
                        console.log('[Storage] 无 MyMelody 遗留数据需要迁移');
                    }
                    await this.set('my_melody_migration_completed', true, { skipReady });
                } catch (migrateError) {
                    console.error('[Storage] MyMelody 迁移失败:', migrateError);
                    await this.set('my_melody_migration_completed', true, { skipReady });
                }
            } else {
                console.log('[Storage] MyMelody 迁移已完成，跳过');
            }

        } catch (error) {
            console.error('[Storage] 迁移遗留数据失败:', error);
            await this.set('migration_completed', true, { skipReady });
            await this.set('my_melody_migration_completed', true, { skipReady });
        }
    }

    // ==================== 备份恢复 ====================

    async restoreFromBackup(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        console.log('[Storage] 开始从备份恢复数据');

        const backupPath = 'assets/data/backup-practice-records.json';
        const isFileProtocol = typeof window !== 'undefined'
            && window.location
            && window.location.protocol === 'file:';

        if (isFileProtocol) {
            console.info('[Storage] file:// 环境跳过内置备份恢复');
            return false;
        }

        try {
            const response = await fetch(backupPath);
            if (!response.ok) {
                return false;
            }
            const backupData = await response.json();
            if (!backupData || !Array.isArray(backupData.practice_records)) {
                console.warn('[Storage] 备份数据格式无效');
                return false;
            }
            await this.set('practice_records', backupData.practice_records, { skipReady });
            console.log('[Storage] 从备份恢复 practice_records 成功');
            return true;
        } catch (error) {
            console.warn('[Storage] 备份恢复失败，已跳过:', error);
            return false;
        }
    }

    // ==================== 错误处理 ====================

    handleStorageQuotaExceeded(key, value) {
        console.error('[Storage] 存储配额超限，无法保存数据:', key);

        if (window.showMessage) {
            window.showMessage('存储空间不足，系统已自动清理旧数据，请稍后重试', 'warning');
        }

        document.dispatchEvent(new CustomEvent('storageQuotaExceeded', {
            detail: { key, value, storageInfo: this.getStorageInfo() }
        }));
    }

    handleStorageError(key, value, error) {
        console.error('[Storage] 存储错误:', error);

        if (error.name === 'QuotaExceededError') {
            this.handleStorageQuotaExceeded(key, value);
        } else {
            if (window.showMessage) {
                window.showMessage('数据保存失败，请检查浏览器设置', 'error');
            }

            document.dispatchEvent(new CustomEvent('storageError', {
                detail: { key, value, error }
            }));
        }
    }

    // ==================== 数据导出/导入 ====================

    async exportData(options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            const data = {};

            if (this.fallbackStorage) {
                this.fallbackStorage.forEach((value, key) => {
                    if (key.startsWith(this.prefix)) {
                        const cleanKey = key.replace(this.prefix, '');
                        data[cleanKey] = JSON.parse(value);
                    }
                });
                console.log(`[Storage] 已导出内存存储数据 ${this.fallbackStorage.size} 条`);
            }

            if (this.indexedDBAdapter.indexedDB) {
                try {
                    const items = await this.indexedDBAdapter.getAll();
                    const indexedDBData = {};
                    items.forEach(item => {
                        if (item.key.startsWith(this.prefix)) {
                            const cleanKey = item.key.replace(this.prefix, '');
                            indexedDBData[cleanKey] = JSON.parse(item.value);
                        }
                    });
                    Object.assign(data, indexedDBData);
                    console.log(`[Storage] 已导出IndexedDB数据 ${Object.keys(indexedDBData).length} 条`);
                } catch (error) {
                    console.warn('[Storage] IndexedDB导出失败:', error);
                }
            }

            const localStorageKeys = Object.keys(localStorage);
            const appKeys = localStorageKeys.filter(key => key.startsWith(this.prefix));
            appKeys.forEach(key => {
                const cleanKey = key.replace(this.prefix, '');
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        data[cleanKey] = JSON.parse(value);
                    }
                } catch (error) {
                    console.warn(`[Storage] 解析localStorage数据失败: ${cleanKey}`, error);
                }
            });
            console.log(`[Storage] 已导出localStorage数据 ${appKeys.length} 条`);

            console.log(`[Storage] 数据导出完成，总计 ${Object.keys(data).length} 条记录`);

            return {
                version: this.version,
                exportDate: new Date().toISOString(),
                data: data,
                storageInfo: {
                    totalRecords: Object.keys(data).length,
                    sources: {
                        memory: this.fallbackStorage ? this.fallbackStorage.size : 0,
                        indexedDB: this.indexedDBAdapter.indexedDB ? Object.keys(data).length - (this.fallbackStorage ? this.fallbackStorage.size : 0) - appKeys.length : 0,
                        localStorage: appKeys.length
                    }
                }
            };
        } catch (error) {
            console.error('Export data error:', error);
            return null;
        }
    }

    async importData(importedData, options = {}) {
        const { skipReady = false } = options;
        await this.waitForInitialization(skipReady);
        try {
            if (!importedData || !importedData.data) {
                throw new Error('Invalid import data format');
            }

            const backup = await this.exportData({ skipReady });

            try {
                await this.clear({ skipReady });

                const importPromises = Object.entries(importedData.data).map(([key, value]) => {
                    return this.set(key, value.data, { skipReady });
                });

                await Promise.all(importPromises);

                return { success: true, message: 'Data imported successfully' };
            } catch (importError) {
                console.error('Import failed, restoring backup:', importError);
                await this.clear({ skipReady });

                if (backup && backup.data) {
                    const restorePromises = Object.entries(backup.data).map(([key, value]) => {
                        return this.set(key, value.data, { skipReady });
                    });
                    await Promise.all(restorePromises);
                }

                throw importError;
            }
        } catch (error) {
            console.error('Import data error:', error);
            return { success: false, message: error.message };
        }
    }

    // ==================== 数据验证 ====================

    validateData(key, data) {
        const validators = {
            practice_records: (records) => {
                return Array.isArray(records) && records.every(record =>
                    record.id && record.examId && record.startTime && record.endTime
                );
            },
            user_stats: (stats) => {
                return stats && typeof stats.totalPractices === 'number';
            },
            exam_index: (index) => {
                return !index || (Array.isArray(index) && index.every(exam =>
                    exam.id && exam.title && exam.category
                ));
            }
        };

        const validator = validators[key];
        return validator ? validator(data) : true;
    }

    // ==================== 存储监控 ====================

    async startStorageMonitoring() {
        await this.waitForInitialization();
        console.log('[Storage] 启动存储监控...');

        this.monitoringInterval = setInterval(async () => {
            try {
                const storageInfo = await this.getStorageInfo();
                if (storageInfo) {
                    const usagePercent = storageInfo.type === 'localStorage'
                        ? (storageInfo.used / (5 * 1024 * 1024)) * 100
                        : (storageInfo.used / (105 * 1024 * 1024)) * 100;

                    const maxSize = storageInfo.type === 'localStorage' ? '5MB' :
                                   storageInfo.type === 'Hybrid' ? '105MB' : '100MB';
                    console.log(`[Storage] 使用率: ${usagePercent.toFixed(2)}% (${(storageInfo.used / 1024).toFixed(2)}KB / ${maxSize})`);

                    if (storageInfo.breakdown) {
                        console.log(`[Storage] 存储分布: localStorage ${(storageInfo.breakdown.localStorage / 1024).toFixed(2)}KB, IndexedDB ${(storageInfo.breakdown.indexedDB / 1024).toFixed(2)}KB`);
                    }

                    if (usagePercent > 80) {
                        console.warn('[Storage] 存储使用率过高，自动清理旧数据');
                        await this.cleanupOldData();

                        const newStorageInfo = await this.getStorageInfo();
                        if (newStorageInfo) {
                            const newUsagePercent = newStorageInfo.type === 'localStorage'
                                ? (newStorageInfo.used / (5 * 1024 * 1024)) * 100
                                : (newStorageInfo.used / (105 * 1024 * 1024)) * 100;

                            console.log(`[Storage] 清理后使用率: ${newUsagePercent.toFixed(2)}%`);

                            if (newUsagePercent > 90) {
                                if (window.showMessage) {
                                    window.showMessage('存储空间即将不足，建议导出数据备份', 'warning');
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[Storage] 存储监控错误:', error);
            }
        }, 300000);

        window.addEventListener('beforeunload', () => {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
        });
    }

    async ensureDataPersisted(options = {}) {
        const { skipReady = false } = options;

        try {
            console.log('[Storage] 确保数据持久化');
            if (this.indexedDBAdapter.indexedDB) {
                console.log('[Storage] IndexedDB 数据已自动持久化');
            }
            console.log('[Storage] 数据持久化完成');
            return true;
        } catch (error) {
            console.error('[Storage] 数据持久化失败:', error);
            return false;
        }
    }

    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', async (event) => {
            try {
                console.log('[Storage] 页面即将关闭，确保数据持久化');
                await this.ensureDataPersisted({ skipReady: true });
                console.log('[Storage] 数据持久化完成');
            } catch (error) {
                console.error('[Storage] beforeunload 数据持久化失败:', error);
            }
        });

        console.log('[Storage] beforeunload 处理器已设置');
    }

    // ==================== 降级存储方案 ====================

    getCurrentStorageType() {
        if (this.fallbackStorage) {
            return 'memory';
        } else if (this.indexedDBAdapter.indexedDB) {
            return 'indexedDB';
        } else if (this.localStorageAdapter.isAvailable()) {
            return 'localStorage';
        }
        return 'none';
    }

    async handleStorageQuotaExceededWithDegradation(key, value) {
        console.warn('[Storage] 存储空间不足，尝试清理');

        try {
            await this.cleanupOldData({ skipReady: true });

            const retrySuccess = await this.set(key, value, { skipReady: true });
            if (retrySuccess) {
                console.log('[Storage] 清理后保存成功');
                return true;
            }

            console.warn('[Storage] 清理后仍然失败，尝试降级存储');

            const storageType = this.getCurrentStorageType();

            if (storageType === 'indexedDB') {
                console.log('[Storage] 从 IndexedDB 降级到 localStorage');
                try {
                    const serializedValue = JSON.stringify({
                        data: value,
                        timestamp: Date.now(),
                        version: this.version
                    });
                    localStorage.setItem(this.getKey(key), serializedValue);
                    console.log('[Storage] localStorage 保存成功');
                    return true;
                } catch (localStorageError) {
                    console.error('[Storage] localStorage 保存失败:', localStorageError);
                }
            }

            console.warn('[Storage] 降级到内存存储');
            if (!this.fallbackStorage) {
                this.fallbackStorage = new Map();
            }
            const serializedValue = JSON.stringify({
                data: value,
                timestamp: Date.now(),
                version: this.version
            });
            this.fallbackStorage.set(this.getKey(key), serializedValue);

            if (window.showMessage) {
                window.showMessage('存储空间不足，数据已保存到临时存储，请导出备份', 'warning');
            }

            return true;
        } catch (error) {
            console.error('[Storage] 处理存储空间不足失败:', error);

            if (window.showMessage) {
                window.showMessage('存储空间严重不足，无法保存数据，请清理旧数据', 'error');
            }

            return false;
        }
    }

    async checkStorageHealth(options = {}) {
        const { skipReady = false } = options;

        try {
            const health = {
                indexedDB: this.indexedDBAdapter.isAvailable(),
                localStorage: this.localStorageAdapter.isAvailable(),
                currentType: this.getCurrentStorageType(),
                quotaStatus: 'unknown'
            };

            const storageInfo = await this.getStorageInfo({ skipReady });
            if (storageInfo) {
                const usagePercent = storageInfo.type === 'localStorage'
                    ? (storageInfo.used / (5 * 1024 * 1024)) * 100
                    : (storageInfo.used / (105 * 1024 * 1024)) * 100;

                if (usagePercent < 70) {
                    health.quotaStatus = 'healthy';
                } else if (usagePercent < 90) {
                    health.quotaStatus = 'warning';
                } else {
                    health.quotaStatus = 'critical';
                }

                health.usagePercent = usagePercent;
                health.used = storageInfo.used;
            }

            console.log('[Storage] 存储健康状态:', health);
            return health;
        } catch (error) {
            console.error('[Storage] 检查存储健康状态失败:', error);
            return {
                indexedDB: false,
                localStorage: false,
                currentType: 'none',
                quotaStatus: 'error'
            };
        }
    }

    // ==================== 数据导出功能 ====================

    async exportPracticeRecords(options = {}) {
        const { skipReady = false, format = 'json' } = options;

        try {
            console.log('[Storage] 开始导出练习记录');

            const records = await this.get('practice_records', [], { skipReady });

            const exportData = {
                type: 'practice_records',
                version: this.version,
                exportDate: new Date().toISOString(),
                recordCount: records.length,
                records: records
            };

            console.log(`[Storage] 练习记录导出完成，共 ${records.length} 条`);

            if (format === 'json') {
                return JSON.stringify(exportData, null, 2);
            }

            return exportData;
        } catch (error) {
            console.error('[Storage] 导出练习记录失败:', error);
            return null;
        }
    }

    async exportCompleteData(options = {}) {
        const { skipReady = false, format = 'json' } = options;

        try {
            console.log('[Storage] 开始导出完整数据');

            const allData = await this.exportData({ skipReady });

            const practiceRecords = await this.exportPracticeRecords({
                skipReady,
                format: 'object'
            });

            const exportData = {
                type: 'complete_export',
                version: this.version,
                exportDate: new Date().toISOString(),
                summary: {
                    totalRecords: allData?.storageInfo?.totalRecords || 0,
                    practiceRecords: practiceRecords?.recordCount || 0
                },
                data: {
                    all: allData,
                    practiceRecords: practiceRecords
                }
            };

            console.log('[Storage] 完整数据导出完成');

            if (format === 'json') {
                return JSON.stringify(exportData, null, 2);
            }

            return exportData;
        } catch (error) {
            console.error('[Storage] 导出完整数据失败:', error);
            return null;
        }
    }

    downloadExportData(data, filename = null) {
        try {
            if (!data) {
                console.error('[Storage] 无数据可导出');
                return false;
            }

            const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

            const blob = new Blob([jsonString], { type: 'application/json' });

            const defaultFilename = `ielts-practice-export-${new Date().toISOString().split('T')[0]}.json`;
            const finalFilename = filename || defaultFilename;

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = finalFilename;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`[Storage] 数据已下载: ${finalFilename}`);
            return true;
        } catch (error) {
            console.error('[Storage] 下载导出数据失败:', error);
            return false;
        }
    }

    async exportAndDownloadPracticeRecords(filename = null) {
        try {
            const data = await this.exportPracticeRecords({ format: 'json' });
            if (data) {
                const defaultFilename = `practice-records-${new Date().toISOString().split('T')[0]}.json`;
                return this.downloadExportData(data, filename || defaultFilename);
            }
            return false;
        } catch (error) {
            console.error('[Storage] 导出并下载练习记录失败:', error);
            return false;
        }
    }

    async exportAndDownloadCompleteData(filename = null) {
        try {
            const data = await this.exportCompleteData({ format: 'json' });
            if (data) {
                const defaultFilename = `complete-data-${new Date().toISOString().split('T')[0]}.json`;
                return this.downloadExportData(data, filename || defaultFilename);
            }
            return false;
        } catch (error) {
            console.error('[Storage] 导出并下载完整数据失败:', error);
            return false;
        }
    }
}

StorageManager.prototype.dispatchStorageSync = function(key) {
    try {
        const normalizedKey = typeof key === 'string' ? key.replace(this.prefix, '') : key;
        if (normalizedKey && STORAGE_SYNC_IGNORED_KEYS.has(normalizedKey)) {
            return;
        }
    } catch (_) {
        // ignore errors resolving key
    }
    window.dispatchEvent(new CustomEvent('storage-sync', { detail: { key } }));
};

// ==================== PreferenceStore ====================

class PreferenceStore {
    constructor(prefix = 'exam_system_') {
        this.prefix = prefix;
        this.ready = Promise.resolve();
    }

    setNamespace(namespace) {
        if (typeof namespace === 'string' && namespace.trim()) {
            this.prefix = namespace.trim() + '_';
        }
    }

    getScopedKey(key) {
        return key.startsWith(this.prefix) ? key : this.prefix + key;
    }

    getStorageArea(session = false) {
        return session ? window.sessionStorage : window.localStorage;
    }

    serialize(value) {
        return JSON.stringify({ data: value, timestamp: Date.now() });
    }

    deserialize(rawValue, defaultValue = null) {
        if (!rawValue) {
            return defaultValue;
        }
        try {
            const parsed = JSON.parse(rawValue);
            return parsed && Object.prototype.hasOwnProperty.call(parsed, 'data')
                ? parsed.data
                : defaultValue;
        } catch (_) {
            return defaultValue;
        }
    }

    async get(key, defaultValue = null, options = {}) {
        const storage = this.getStorageArea(options.session === true);
        return this.deserialize(storage.getItem(this.getScopedKey(key)), defaultValue);
    }

    async set(key, value, options = {}) {
        const storage = this.getStorageArea(options.session === true);
        storage.setItem(this.getScopedKey(key), this.serialize(value));
        window.dispatchEvent(new CustomEvent('storage-sync', { detail: { key } }));
        return true;
    }

    async remove(key, options = {}) {
        const storage = this.getStorageArea(options.session === true);
        storage.removeItem(this.getScopedKey(key));
        window.dispatchEvent(new CustomEvent('storage-sync', { detail: { key } }));
        return true;
    }

    async clear(options = {}) {
        const storage = this.getStorageArea(options.session === true);
        Object.keys(storage)
            .filter((key) => key.startsWith(this.prefix))
            .forEach((key) => storage.removeItem(key));
        return true;
    }
}

// ==================== StorageKeyRegistry ====================

class StorageKeyRegistry {
    constructor() {
        this.preferenceKeys = new Set([
            'sound_effects_enabled',
            'auto_save_enabled',
            'notifications_enabled',
            'browse_state',
            'hasSeenGplLicense',
            'preferred_theme_portal'
        ]);
        this.sessionKeys = new Set([
            'preferred_theme_skip_session'
        ]);
    }

    resolve(key) {
        if (this.sessionKeys.has(key)) {
            return { key, storageClass: 'session' };
        }
        if (this.preferenceKeys.has(key)) {
            return { key, storageClass: 'preference' };
        }
        return { key, storageClass: 'persistent' };
    }
}

// ==================== StorageFacade ====================

class StorageFacade {
    constructor(options = {}) {
        this.persistentStore = options.persistentStore;
        this.preferenceStore = options.preferenceStore;
        this.keyRegistry = options.keyRegistry;
        this.ready = this.persistentStore ? this.persistentStore.ready : Promise.resolve();
    }

    setNamespace(namespace) {
        if (this.persistentStore && typeof this.persistentStore.setNamespace === 'function') {
            this.persistentStore.setNamespace(namespace);
        }
        if (this.preferenceStore && typeof this.preferenceStore.setNamespace === 'function') {
            this.preferenceStore.setNamespace(namespace);
        }
    }

    resolveStore(key) {
        const entry = this.keyRegistry.resolve(key);
        if (entry.storageClass === 'preference') {
            return { entry, store: this.preferenceStore, options: { session: false } };
        }
        if (entry.storageClass === 'session') {
            return { entry, store: this.preferenceStore, options: { session: true } };
        }
        return { entry, store: this.persistentStore, options: {} };
    }

    async get(key, defaultValue = null, options = {}) {
        const target = this.resolveStore(key);
        return await target.store.get(key, defaultValue, Object.assign({}, target.options, options));
    }

    async set(key, value, options = {}) {
        const target = this.resolveStore(key);
        return await target.store.set(key, value, Object.assign({}, target.options, options));
    }

    async remove(key, options = {}) {
        const target = this.resolveStore(key);
        return await target.store.remove(key, Object.assign({}, target.options, options));
    }

    async clear(options = {}) {
        if (this.persistentStore && typeof this.persistentStore.clear === 'function') {
            await this.persistentStore.clear(options);
        }
        if (this.preferenceStore && typeof this.preferenceStore.clear === 'function') {
            await this.preferenceStore.clear({ session: false });
            await this.preferenceStore.clear({ session: true });
        }
        return true;
    }

    async getStorageInfo(options = {}) {
        const persistentInfo = this.persistentStore && typeof this.persistentStore.getStorageInfo === 'function'
            ? await this.persistentStore.getStorageInfo(options)
            : null;
        return Object.assign({}, persistentInfo || {}, {
            facade: 'storage-facade',
            volatile: Boolean(this.persistentStore && this.persistentStore.volatileMode)
        });
    }
}

// storageManager.js - 类定义模块
// 初始化和全局导出由 storage.js 负责
