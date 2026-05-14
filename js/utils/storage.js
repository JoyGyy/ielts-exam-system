// storage.js - 向后兼容入口 (初始化与全局导出)
// 类定义已拆分到: storage/indexedDBAdapter.js, storage/localStorageAdapter.js, storage/storageManager.js
// 新代码应直接引用上述模块中的类

const storageManager = new StorageManager();
const preferenceStore = new PreferenceStore(storageManager.prefix);
const storageKeyRegistry = new StorageKeyRegistry();
const storageFacade = new StorageFacade({
    persistentStore: storageManager,
    preferenceStore,
    keyRegistry: storageKeyRegistry
});

window.persistentStore = storageManager;
window.preferenceStore = preferenceStore;
window.storageKeyRegistry = storageKeyRegistry;
window.storage = storageFacade;

// 启动存储监控和数据同步
storageManager.ready
    .then(() => {
        storageManager.startStorageMonitoring();
        storageManager.setupBeforeUnloadHandler();
    })
    .catch(error => {
        console.error('[Storage] 存储初始化失败，监控未启动:', error);
    });
