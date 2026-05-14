// main.js - 入口文件，导入所有子模块
// 从 main.js 拆分出来的 4 个模块在此加载
// 子模块通过 IIFE 模式注册函数到全局作用域

// ============================================================================
// 子模块加载
// 注意：这些文件通过 build-bundles.js 拼接为 browse-runtime.bundle.js
// 在 bundle 中，文件按以下顺序拼接：
//   1. viewHelpers.js (辅助函数)
//   2. globalShims.js (全局变量和 shim 层)
//   3. practiceView.js (练习视图和记录管理)
//   4. examListManager.js (题库列表管理)
//   5. main.js (入口，最后加载)
//
// 当以独立文件加载时（fallback），按以下顺序加载：
//   js/main/viewHelpers.js
//   js/main/globalShims.js
//   js/main/practiceView.js
//   js/main/examListManager.js
//   js/main.js
// ============================================================================

// --- Initialization Entry Point ---

// Phase 4: 清理重复事件绑定
// setupExamActionHandlers 已在 examActions.js 的 displayExams 中调用，此处移除重复调用
ensurePracticeSessionSyncListener();
