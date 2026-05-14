/**
 * localStorage 适配器 - 从 storage.js 提取
 * 负责 localStorage/sessionStorage 读写和使用量统计
 */
class LocalStorageAdapter {
    constructor(prefix = 'exam_system_') {
        this.prefix = prefix;
        this.localStorageAvailable = false;
        this.sessionStorageAvailable = false;
    }

    /**
     * 检测存储可用性
     */
    checkStorageAvailability(getter) {
        try {
            const store = getter();
            if (!store || typeof store.setItem !== 'function') {
                return false;
            }
            const testKey = this.prefix + 'storage_test_' + Math.random().toString(36).slice(2);
            store.setItem(testKey, '1');
            store.removeItem(testKey);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * 初始化存储可用性检测
     */
    initialize() {
        this.localStorageAvailable = this.checkStorageAvailability(() => localStorage);
        this.sessionStorageAvailable = this.checkStorageAvailability(() => sessionStorage);

        if (this.localStorageAvailable) {
            console.log('[Storage] localStorage 可用');
        } else {
            console.warn('[Storage] localStorage 不可用');
        }
        if (this.sessionStorageAvailable) {
            console.log('[Storage] sessionStorage 可用');
        } else {
            console.warn('[Storage] sessionStorage 不可用');
        }

        return {
            localStorageAvailable: this.localStorageAvailable,
            sessionStorageAvailable: this.sessionStorageAvailable
        };
    }

    /**
     * 读取 Web Storage 中的值
     */
    readValue(storage, storageKey) {
        if (!storage || typeof storage.getItem !== 'function') {
            return null;
        }
        try {
            return storage.getItem(storageKey);
        } catch (_) {
            return null;
        }
    }

    /**
     * 写入 Web Storage 中的值
     */
    writeValue(storage, storageKey, serializedValue) {
        if (!storage || typeof storage.setItem !== 'function') {
            return false;
        }
        try {
            storage.setItem(storageKey, serializedValue);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * 检测 localStorage 可用性
     */
    isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            console.log('[Storage] localStorage 可用');
            return true;
        } catch (error) {
            console.error('[Storage] localStorage 不可用:', error);
            return false;
        }
    }

    /**
     * 获取 localStorage 使用情况
     */
    getUsage(prefix) {
        try {
            let used = 0;
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    used += localStorage.getItem(key).length;
                }
            });
            return used;
        } catch (error) {
            console.error('Get localStorage usage error:', error);
            return 0;
        }
    }

    /**
     * 清理 localStorage 中指定前缀的键
     */
    clearByPrefix(prefix) {
        try {
            Object.keys(localStorage)
                .filter((key) => key.startsWith(prefix))
                .forEach((key) => localStorage.removeItem(key));
        } catch (_) { }
        try {
            Object.keys(sessionStorage)
                .filter((key) => key.startsWith(prefix))
                .forEach((key) => sessionStorage.removeItem(key));
        } catch (_) { }
    }
}
