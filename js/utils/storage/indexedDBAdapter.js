/**
 * IndexedDB 适配器 - 从 storage.js 提取
 * 负责 IndexedDB 初始化、读写、查询和使用量统计
 */
class IndexedDBAdapter {
    constructor(prefix = 'exam_system_') {
        this.prefix = prefix;
        this.indexedDB = null;
        this.indexedDBBlocked = false;
        this.dbName = 'ExamSystemDB';
        this.dbVersion = 1;
    }

    /**
     * 初始化 IndexedDB 存储
     * @param {object} fallbackInfo - { localStorageAvailable, sessionStorageAvailable }
     * @returns {Promise<{mode: string}>} 初始化后的模式信息
     */
    initialize(fallbackInfo = {}) {
        if (this.indexedDBBlocked) {
            return Promise.resolve({ mode: 'unknown' });
        }
        return new Promise((resolve, reject) => {
            try {
                if (!window.indexedDB) {
                    this.indexedDBBlocked = true;
                    this.indexedDB = null;
                    resolve({ mode: fallbackInfo.localStorageAvailable ? 'localStorage' : fallbackInfo.sessionStorageAvailable ? 'sessionStorage' : 'volatile' });
                    return;
                }

                console.log(`[Storage] 打开 IndexedDB 数据库: ${this.dbName}, 版本: ${this.dbVersion}`);
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.addEventListener('error', () => {
                    this.indexedDB = null;
                    resolve({ mode: fallbackInfo.localStorageAvailable ? 'localStorage' : fallbackInfo.sessionStorageAvailable ? 'sessionStorage' : 'volatile' });
                });

                request.addEventListener('success', () => {
                    resolve({ mode: 'indexeddb' });
                });

                request.onerror = (event) => {
                    console.error('[Storage] IndexedDB 打开失败:', event.target.error);
                    this.indexedDBBlocked = true;
                    if (fallbackInfo.localStorageAvailable || fallbackInfo.sessionStorageAvailable) {
                        console.warn('[Storage] 使用 local/sessionStorage 作为回退存储');
                        this.indexedDB = null;
                        resolve({ mode: fallbackInfo.localStorageAvailable ? 'localStorage' : 'sessionStorage' });
                        return;
                    }
                    resolve({ mode: 'volatile' });
                };

                request.onupgradeneeded = (event) => {
                    console.log('[Storage] IndexedDB 升级事件触发，旧版本:', event.oldVersion, '新版本:', event.newVersion);
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains('keyValueStore')) {
                        console.log('[Storage] 创建 objectStore: keyValueStore');
                        const store = db.createObjectStore('keyValueStore', { keyPath: 'key' });
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                        console.log('[Storage] objectStore 创建成功');
                    } else {
                        console.log('[Storage] objectStore 已存在，跳过创建');
                    }
                };

                request.onsuccess = (event) => {
                    this.indexedDB = event.target.result;
                    this.indexedDBBlocked = false;
                    console.log('[Storage] IndexedDB 初始化成功，数据库:', this.indexedDB.name, '版本:', this.indexedDB.version);
                };

            } catch (error) {
                console.error('[Storage] IndexedDB 初始化失败:', error);
                this.indexedDBBlocked = true;
                resolve({ mode: fallbackInfo.localStorageAvailable ? 'localStorage' : fallbackInfo.sessionStorageAvailable ? 'sessionStorage' : 'volatile' });
            }
        });
    }

    /**
     * 确保 IndexedDB 已 ready
     */
    async ensureReady() {
        if (this.indexedDBBlocked) {
            return;
        }
        if (!this.indexedDB) {
            try {
                await this.initialize();
            } catch (err) {
                this.indexedDBBlocked = true;
            }
        }
    }

    /**
     * 检测 IndexedDB 可用性
     */
    isAvailable() {
        try {
            if (!window.indexedDB) {
                console.log('[Storage] IndexedDB 不支持');
                return false;
            }
            if (this.indexedDB) {
                console.log('[Storage] IndexedDB 可用');
                return true;
            }
            console.log('[Storage] IndexedDB 未初始化');
            return false;
        } catch (error) {
            console.error('[Storage] IndexedDB 可用性检测失败:', error);
            return false;
        }
    }

    /**
     * 存储到 IndexedDB
     */
    set(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const transaction = this.indexedDB.transaction(['keyValueStore'], 'readwrite');
            const store = transaction.objectStore('keyValueStore');

            const data = {
                key: key,
                value: value,
                timestamp: Date.now()
            };

            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从 IndexedDB 获取数据
     */
    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const transaction = this.indexedDB.transaction(['keyValueStore'], 'readonly');
            const store = transaction.objectStore('keyValueStore');
            const request = store.get(key);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.value);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从 IndexedDB 删除数据
     */
    remove(key) {
        return new Promise((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const transaction = this.indexedDB.transaction(['keyValueStore'], 'readwrite');
            const store = transaction.objectStore('keyValueStore');
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从 IndexedDB 获取所有数据
     */
    getAll() {
        return new Promise((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const transaction = this.indexedDB.transaction(['keyValueStore'], 'readonly');
            const store = transaction.objectStore('keyValueStore');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清空 IndexedDB 存储
     */
    async clear() {
        if (!this.indexedDB) {
            return;
        }
        const transaction = this.indexedDB.transaction(['keyValueStore'], 'readwrite');
        const store = transaction.objectStore('keyValueStore');
        const request = store.clear();
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取 IndexedDB 使用情况
     */
    getUsage(prefix) {
        return new Promise((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            const transaction = this.indexedDB.transaction(['keyValueStore'], 'readonly');
            const store = transaction.objectStore('keyValueStore');
            const request = store.getAll();

            request.onsuccess = () => {
                const items = request.result;
                let totalSize = 0;

                items.forEach(item => {
                    if (item.key.startsWith(prefix) && item.value) {
                        totalSize += item.value.length;
                    }
                });

                resolve(totalSize);
            };

            request.onerror = () => reject(request.error);
        });
    }
}
