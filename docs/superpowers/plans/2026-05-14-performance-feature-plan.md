# 性能优化 + 功能增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 IELTS 练习平台从全局变量 IIFE 架构迁移到 ES 模块化架构，引入 esbuild 构建工具，拆分超大文件，优化首屏加载，添加倒计时模考功能。

**Architecture:** 使用 esbuild 作为构建工具，将 72 个 IIFE 全局变量文件迁移到 ES 模块系统。5 个 3000+ 行的超大文件拆分为 <500 行的专注模块。添加独立的倒计时模考功能模块。

**Tech Stack:** esbuild, ES modules, npm

---

## Phase 1: 构建系统搭建

### Task 1: 初始化项目配置

**Files:**
- Create: `package.json`
- Create: `build.js`
- Create: `.gitignore` (更新)

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "ielts-practice",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node build.js --dev",
    "build": "node build.js --production",
    "check": "node build.js --check"
  },
  "devDependencies": {
    "esbuild": "^0.20.0"
  }
}
```

- [ ] **Step 2: 创建 build.js**

```javascript
#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT_DIR = join(ROOT, 'assets', 'dist');

const isDev = process.argv.includes('--dev');
const isCheck = process.argv.includes('--check');

async function build() {
  // Clean output directory
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const buildOptions = {
    entryPoints: [join(ROOT, 'js', 'app', 'app.js')],
    bundle: true,
    outfile: join(OUT_DIR, 'app.bundle.js'),
    format: 'iife',
    target: ['es2020'],
    sourcemap: true,
    minify: !isDev,
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    },
    // Don't externalize anything - bundle everything
    external: [],
    logLevel: 'info',
  };

  if (isCheck) {
    // Type-check mode: just verify it compiles
    buildOptions.write = false;
    const result = await esbuild.build(buildOptions);
    console.log(`[check] Build successful (${result.outputFiles?.length || 0} files)`);
    return;
  }

  if (isDev) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[dev] Watching for changes...');
    return;
  }

  await esbuild.build(buildOptions);
  console.log('[build] Production build complete');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: 更新 .gitignore**

在 `.gitignore` 末尾添加：
```
node_modules/
assets/dist/
```

- [ ] **Step 4: 安装依赖并验证构建**

Run: `npm install`
Run: `npm run check`
Expected: `[check] Build successful`

- [ ] **Step 5: Commit**

```bash
git add package.json build.js .gitignore package-lock.json
git commit -m "chore: add esbuild build system"
```

---

### Task 2: 验证构建输出

**Files:**
- Modify: `index.html` (临时添加 bundle 引用测试)

- [ ] **Step 1: 创建最小入口文件测试构建**

创建临时测试文件 `js/app/app.test-entry.js`:
```javascript
// Test entry - verifies build system works
console.log('[build] Entry point loaded successfully');
export const BUILD_VERSION = '2.0.0';
```

- [ ] **Step 2: 修改 build.js 临时使用测试入口**

将 `build.js` 中的 entryPoints 改为:
```javascript
entryPoints: [join(ROOT, 'js', 'app', 'app.test-entry.js')],
```

- [ ] **Step 3: 运行构建**

Run: `npm run build`
Expected: `[build] Production build complete`
验证: `ls -la assets/dist/app.bundle.js` 应存在

- [ ] **Step 4: 恢复 build.js 入口**

将 entryPoints 改回:
```javascript
entryPoints: [join(ROOT, 'js', 'app', 'app.js')],
```

- [ ] **Step 5: 删除测试文件**

Run: `rm js/app/app.test-entry.js`

- [ ] **Step 6: Commit**

```bash
git add build.js
git commit -m "chore: verify build system works with test entry"
```

---

## Phase 2: 性能清理

### Task 3: 移除 three.js 装饰背景

**Files:**
- Delete: `assets/vendor/three.min.js`
- Delete: `js/presentation/threeBackground.js`
- Modify: `index.html` (删除 script 标签和内联样式)
- Modify: `css/main.css` (添加纯 CSS 背景替代)

- [ ] **Step 1: 删除 three.js 文件**

Run: `rm assets/vendor/three.min.js js/presentation/threeBackground.js`

- [ ] **Step 2: 从 index.html 删除 script 标签**

删除这两行:
```html
<script src="assets/vendor/three.min.js"></script>
<script src="js/presentation/threeBackground.js"></script>
```

- [ ] **Step 3: 从 index.html 删除 body 的背景相关内联样式**

检查 `<body>` 标签，删除与 three.js 背景相关的内联 style（如 canvas 定位等）。

- [ ] **Step 4: 在 main.css 添加纯 CSS 渐变背景**

在 `css/main.css` 的 `:root` 或 `body` 规则中添加:
```css
body {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
}
```

- [ ] **Step 5: 删除 assets/vendor/ 目录（如果为空）**

Run: `rmdir assets/vendor 2>/dev/null || true`

- [ ] **Step 6: 验证页面加载**

Run: `npm run build` 然后在浏览器打开 index.html，确认背景正常显示

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "perf: remove three.js decorative background (saves 656KB)"
```

---

### Task 4: 删除重复 bundle 和清理死代码

**Files:**
- Delete: `assets/bundles/browse-view.bundle.js`
- Modify: `js/runtime/lazyLoader.js` (删除 browse-view 别名)
- Modify: `tools/build-bundles.js` (删除 browse-view 构建)

- [ ] **Step 1: 删除重复 bundle**

Run: `rm assets/bundles/browse-view.bundle.js`

- [ ] **Step 2: 从 lazyLoader.js 删除 browse-view 别名**

删除这行:
```javascript
manifest['browse-view'] = manifest['browse-runtime'].slice();
```

- [ ] **Step 3: 从 build-bundles.js 删除 browse-view**

检查 build-bundles.js 是否有 browse-view 相关配置，删除。

- [ ] **Step 4: 搜索并清理其他 browse-view 引用**

Run: `grep -rn "browse-view" js/ index.html tools/ --include="*.js" --include="*.html"`
如果有引用，改为 `browse-runtime`。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "perf: remove duplicate browse-view bundle (saves 606KB)"
```

---

### Task 5: 提取重复代码

**Files:**
- Create: `js/shared/normalizePracticeType.js`
- Create: `js/shared/constants.js`
- Modify: 4 files that duplicate `normalizePracticeType`
- Modify: 2 files that duplicate `preferredFirstExamByCategory`

- [ ] **Step 1: 创建共享工具模块**

创建 `js/shared/normalizePracticeType.js`:
```javascript
/**
 * 标准化练习类型名称
 * @param {string} type - 原始类型
 * @returns {string} 标准化后的类型
 */
export function normalizePracticeType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'listening' || normalized === 'listen') return 'listening';
  if (normalized === 'reading' || normalized === 'read') return 'reading';
  return 'unknown';
}
```

- [ ] **Step 2: 创建共享常量模块**

创建 `js/shared/constants.js`:
```javascript
/**
 * 每个分类的首选题目 ID
 */
export const PREFERRED_FIRST_EXAM_BY_CATEGORY = {
  'P1': 'p1-high-01',
  'P2': 'p2-high-01',
  'P3': 'p3-high-01',
  'P4': 'p4-high-01',
  'P5': 'p5-high-01',
  'P6': 'p6-high-01',
  'P7': 'p7-high-01',
};
```

- [ ] **Step 3: 更新 practiceCore.js**

在 `js/core/practiceCore.js` 中:
1. 删除 `normalizePracticeType` 函数定义（~行94-99）
2. 在文件顶部添加: `import { normalizePracticeType } from '../shared/normalizePracticeType.js';`
3. 如果有导出 `PracticeCore.contracts.normalizePracticeType`，改为引用共享版本

- [ ] **Step 4: 更新 practiceRecorder.js**

在 `js/core/practiceRecorder.js` 中:
1. 删除 `normalizePracticeType` 函数定义（~行38-48）
2. 在文件顶部添加: `import { normalizePracticeType } from '../shared/normalizePracticeType.js';`

- [ ] **Step 5: 更新 scoreStorage.js**

在 `js/core/scoreStorage.js` 中:
1. 删除 `normalizePracticeType` 函数定义（~行51-60）
2. 在文件顶部添加: `import { normalizePracticeType } from '../shared/normalizePracticeType.js';`

- [ ] **Step 6: 更新 legacyViewBundle.js**

在 `js/views/legacyViewBundle.js` 中:
1. 删除 `normalizePracticeType` 函数定义（~行11-21）
2. 在文件顶部添加: `import { normalizePracticeType } from '../shared/normalizePracticeType.js';`

- [ ] **Step 7: 更新 main.js 和 examActions.js 的重复常量**

在 `js/main.js` 和 `js/app/examActions.js` 中:
1. 删除各自的 `preferredFirstExamByCategory` 定义
2. 添加: `import { PREFERRED_FIRST_EXAM_BY_CATEGORY } from '../shared/constants.js';`

- [ ] **Step 8: 验证无语法错误**

Run: `find js -name "*.js" -exec node --check {} \;`

- [ ] **Step 9: Commit**

```bash
git add js/shared/
git add js/core/practiceCore.js js/core/practiceRecorder.js js/core/scoreStorage.js js/views/legacyViewBundle.js js/main.js js/app/examActions.js
git commit -m "refactor: extract duplicated normalizePracticeType and constants to shared modules"
```

---

## Phase 3: 大文件拆分

### Task 6: 拆分 storage.js

**Files:**
- Create: `js/utils/storage/indexedDBAdapter.js`
- Create: `js/utils/storage/localStorageAdapter.js`
- Create: `js/utils/storage/storageManager.js`
- Modify: `js/utils/storage.js` (改为 re-export 入口)

- [ ] **Step 1: 创建 indexedDBAdapter.js**

从 `storage.js` 中提取 IndexedDB 相关代码（~行100-400），创建:
```javascript
// IndexedDB 适配器 - 从 storage.js 提取
export class IndexedDBAdapter {
  constructor(dbName = 'exam_system') {
    this.dbName = dbName;
    this.db = null;
  }
  // ... 从 storage.js 搬运 IndexedDB 相关方法
}
```

- [ ] **Step 2: 创建 localStorageAdapter.js**

从 `storage.js` 中提取 localStorage 相关代码（~行400-600），创建:
```javascript
// localStorage 适配器 - 从 storage.js 提取
export class LocalStorageAdapter {
  constructor(namespace = 'exam_system_') {
    this.namespace = namespace;
  }
  // ... 从 storage.js 搬运 localStorage 相关方法
}
```

- [ ] **Step 3: 创建 storageManager.js 主入口**

```javascript
// StorageManager 主入口 - 从 storage.js 提取
import { IndexedDBAdapter } from './indexedDBAdapter.js';
import { LocalStorageAdapter } from './localStorageAdapter.js';

export class StorageManager {
  // ... 从 storage.js 搬运核心逻辑
}
```

- [ ] **Step 4: 将 storage.js 改为 re-export 入口**

将 `storage.js` 替换为:
```javascript
// storage.js - 向后兼容入口
// 新代码应直接 import storageManager.js
export { StorageManager } from './storage/storageManager.js';

// 全局导出（兼容层）
if (typeof window !== 'undefined') {
  window.StorageManager = window.StorageManager || (await import('./storage/storageManager.js')).StorageManager;
}
```

- [ ] **Step 5: 验证**

Run: `node --check js/utils/storage/storageManager.js`
Run: `node --check js/utils/storage/indexedDBAdapter.js`
Run: `node --check js/utils/storage/localStorageAdapter.js`

- [ ] **Step 6: Commit**

```bash
git add js/utils/storage/
git commit -m "refactor: split storage.js into IndexedDB adapter, localStorage adapter, and manager"
```

---

### Task 7: 拆分 main.js

**Files:**
- Create: `js/main/globalShims.js`
- Create: `js/main/examListManager.js`
- Create: `js/main/practiceView.js`
- Create: `js/main/viewHelpers.js`
- Modify: `js/main.js` (改为入口文件)

- [ ] **Step 1: 分析 main.js 结构**

Run: `grep -n "function\|class\|window\.\|global\." js/main.js | head -40`
识别主要函数分组。

- [ ] **Step 2: 创建 globalShims.js**

从 `main.js` 提取全局 shim 代码（前 ~200 行的变量声明和 shim 函数）:
```javascript
// globalShims.js - 全局变量和兼容层
// 从 main.js 提取
```

- [ ] **Step 3: 创建 examListManager.js**

从 `main.js` 提取题库列表管理相关函数:
```javascript
// examListManager.js - 题库列表管理
// 从 main.js 提取 loadExamList, renderExamList 等函数
```

- [ ] **Step 4: 创建 practiceView.js**

从 `main.js` 提取练习视图相关函数:
```javascript
// practiceView.js - 练习视图
// 从 main.js 提取 updatePracticeView, renderPracticeRecords 等
```

- [ ] **Step 5: 创建 viewHelpers.js**

从 `main.js` 提取辅助函数:
```javascript
// viewHelpers.js - 视图辅助函数
// 从 main.js 提取 showView, showMessage 等通用函数
```

- [ ] **Step 6: 将 main.js 改为入口文件**

```javascript
// main.js - 入口文件，导入所有子模块
import * as globalShims from './main/globalShims.js';
import * as examListManager from './main/examListManager.js';
import * as practiceView from './main/practiceView.js';
import * as viewHelpers from './main/viewHelpers.js';

// 导出到全局（兼容层）
Object.assign(window, globalShims, examListManager, practiceView, viewHelpers);
```

- [ ] **Step 7: 验证**

Run: `find js/main -name "*.js" -exec node --check {} \;`
Run: `node --check js/main.js`

- [ ] **Step 8: Commit**

```bash
git add js/main/ js/main.js
git commit -m "refactor: split main.js (3343 lines) into 4 focused modules"
```

---

### Task 8: 拆分 examSessionMixin.js

**Files:**
- Create: `js/app/examSession/windowManager.js`
- Create: `js/app/examSession/dataInjector.js`
- Create: `js/app/examSession/sessionTracker.js`
- Create: `js/app/examSession/urlBuilder.js`
- Modify: `js/app/examSessionMixin.js` (改为入口文件)

- [ ] **Step 1: 分析 examSessionMixin.js 结构**

Run: `grep -n "function\|class\|window\.\|global\." js/app/examSessionMixin.js | head -50`
识别主要函数分组。

- [ ] **Step 2: 创建 windowManager.js**

提取窗口管理相关函数（打开/关闭/守卫练习窗口）:
```javascript
// windowManager.js - 练习窗口管理
// 从 examSessionMixin.js 提取
```

- [ ] **Step 3: 创建 dataInjector.js**

提取数据注入相关函数（向练习窗口注入脚本）:
```javascript
// dataInjector.js - 数据注入
// 从 examSessionMixin.js 提取
```

- [ ] **Step 4: 创建 sessionTracker.js**

提取会话跟踪相关函数:
```javascript
// sessionTracker.js - 练习会话跟踪
// 从 examSessionMixin.js 提取
```

- [ ] **Step 5: 创建 urlBuilder.js**

提取 URL 构建相关函数:
```javascript
// urlBuilder.js - 练习 URL 构建
// 从 examSessionMixin.js 提取
```

- [ ] **Step 6: 将 examSessionMixin.js 改为入口文件**

```javascript
// examSessionMixin.js - 入口文件
import { WindowManager } from './examSession/windowManager.js';
import { DataInjector } from './examSession/dataInjector.js';
import { SessionTracker } from './examSession/sessionTracker.js';
import { UrlBuilder } from './examSession/urlBuilder.js';

// 组合并导出到全局
```

- [ ] **Step 7: 验证**

Run: `find js/app/examSession -name "*.js" -exec node --check {} \;`
Run: `node --check js/app/examSessionMixin.js`

- [ ] **Step 8: Commit**

```bash
git add js/app/examSession/ js/app/examSessionMixin.js
git commit -m "refactor: split examSessionMixin.js (3272 lines) into 4 focused modules"
```

---

## Phase 4: 模块迁移（渐进式）

### Task 9: 迁移底层工具模块

**Files:**
- Modify: `js/utils/logger.js` (IIFE → ES module)
- Modify: `js/utils/environmentDetector.js` (IIFE → ES module)
- Modify: `js/utils/dom.js` (IIFE → ES module)

- [ ] **Step 1: 迁移 logger.js**

将 `(function(window) { ... })(window)` 改为 ES 模块:
```javascript
// logger.js - ES module
const logger = {
  log: (...args) => console.log('[IELTS]', ...args),
  warn: (...args) => console.warn('[IELTS]', ...args),
  error: (...args) => console.error('[IELTS]', ...args),
};

export default logger;

// 兼容层
if (typeof window !== 'undefined') {
  window.logger = logger;
}
```

- [ ] **Step 2: 迁移 environmentDetector.js**

同样模式改为 ES 模块。

- [ ] **Step 3: 迁移 dom.js**

同样模式改为 ES 模块。

- [ ] **Step 4: 验证**

Run: `node --check js/utils/logger.js`
Run: `node --check js/utils/environmentDetector.js`
Run: `node --check js/utils/dom.js`

- [ ] **Step 5: Commit**

```bash
git add js/utils/logger.js js/utils/environmentDetector.js js/utils/dom.js
git commit -m "refactor: migrate logger, environmentDetector, dom to ES modules"
```

---

### Task 10: 迁移核心逻辑模块

**Files:**
- Modify: `js/core/practiceCore.js` (IIFE → ES module)
- Modify: `js/core/scoreStorage.js` (IIFE → ES module)
- Modify: `js/core/practiceRecorder.js` (IIFE → ES module)

- [ ] **Step 1: 迁移 practiceCore.js**

将 IIFE 改为 ES 模块，保留 `window.PracticeCore` 兼容导出。

- [ ] **Step 2: 迁移 scoreStorage.js**

同样模式迁移。

- [ ] **Step 3: 迁移 practiceRecorder.js**

同样模式迁移。

- [ ] **Step 4: 验证**

Run: `node --check js/core/practiceCore.js`
Run: `node --check js/core/scoreStorage.js`
Run: `node --check js/core/practiceRecorder.js`

- [ ] **Step 5: Commit**

```bash
git add js/core/practiceCore.js js/core/scoreStorage.js js/core/practiceRecorder.js
git commit -m "refactor: migrate practiceCore, scoreStorage, practiceRecorder to ES modules"
```

---

### Task 11: 迁移剩余模块

**Files:**
- Modify: `js/services/libraryManager.js`
- Modify: `js/services/overviewStats.js`
- Modify: `js/runtime/lazyLoader.js`
- Modify: `js/app/app.js`
- Modify: `js/app/mixins/*.js`

- [ ] **Step 1: 迁移 services 层**

迁移 `libraryManager.js` 和 `overviewStats.js`。

- [ ] **Step 2: 迁移 runtime 层**

迁移 `lazyLoader.js`。

- [ ] **Step 3: 迁移 app 层**

迁移 `app.js` 和所有 mixin 文件。

- [ ] **Step 4: 更新 index.html**

将所有同步 script 标签改为 `defer` 或移除（因为 bundle 会处理）:
```html
<!-- 移除所有单独的 script 标签，改为: -->
<script src="assets/dist/app.bundle.js" defer></script>
```

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Run: 在浏览器测试所有功能

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: migrate all modules to ES modules, update index.html to use bundle"
```

---

## Phase 5: 倒计时模考功能

### Task 12: 开发 countdownTimer 模块

**Files:**
- Create: `js/features/countdownTimer.js`
- Create: `css/countdown-timer.css`
- Modify: `js/main/examListManager.js` (添加模考按钮)

- [ ] **Step 1: 创建倒计时器核心模块**

创建 `js/features/countdownTimer.js`:
```javascript
/**
 * 倒计时模考计时器
 * 阅读：60分钟，听力：30分钟
 */
export class CountdownTimer {
  constructor(options = {}) {
    this.duration = options.duration || 3600; // 默认60分钟
    this.remaining = this.duration;
    this.isRunning = false;
    this.onTick = options.onTick || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onWarning = options.onWarning || (() => {});
    this.intervalId = null;
    this.warningThreshold = 300; // 最后5分钟警告
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  tick() {
    this.remaining--;
    this.onTick(this.remaining);

    if (this.remaining <= this.warningThreshold && this.remaining > 0) {
      this.onWarning(this.remaining);
    }

    if (this.remaining <= 0) {
      this.stop();
      this.onComplete();
    }
  }

  reset(duration) {
    this.stop();
    this.duration = duration || this.duration;
    this.remaining = this.duration;
  }

  getDisplayTime() {
    const minutes = Math.floor(this.remaining / 60);
    const seconds = this.remaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
```

- [ ] **Step 2: 创建倒计时器 UI 组件**

在 `countdownTimer.js` 中添加 UI 渲染:
```javascript
export function createCountdownUI(timer) {
  const container = document.createElement('div');
  container.className = 'countdown-timer';
  container.innerHTML = `
    <div class="countdown-timer__display">
      <span class="countdown-timer__time">${timer.getDisplayTime()}</span>
      <span class="countdown-timer__label">剩余时间</span>
    </div>
    <button class="countdown-timer__submit">提前提交</button>
  `;

  timer.onTick = (remaining) => {
    container.querySelector('.countdown-timer__time').textContent = timer.getDisplayTime();
    if (remaining <= timer.warningThreshold) {
      container.classList.add('countdown-timer--warning');
    }
  };

  container.querySelector('.countdown-timer__submit').addEventListener('click', () => {
    if (confirm('确定要提前提交吗？')) {
      timer.stop();
      timer.onComplete();
    }
  });

  return container;
}
```

- [ ] **Step 3: 创建倒计时器 CSS**

创建 `css/countdown-timer.css`:
```css
.countdown-timer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 10000;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.countdown-timer__display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.countdown-timer__time {
  font-size: 24px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.countdown-timer__label {
  font-size: 14px;
  opacity: 0.7;
}

.countdown-timer__submit {
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.countdown-timer__submit:hover {
  background: #dc2626;
}

.countdown-timer--warning .countdown-timer__time {
  color: #ef4444;
  animation: countdown-pulse 1s ease-in-out infinite;
}

@keyframes countdown-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 4: 在 index.html 引入 CSS**

在 `<head>` 中添加:
```html
<link rel="stylesheet" href="css/countdown-timer.css" />
```

- [ ] **Step 5: 在题库浏览页添加模考按钮**

在 `js/main/examListManager.js` 中，为每套题的卡片添加"模考"按钮:
```javascript
// 在渲染题库卡片时添加模考按钮
function addExamCardActions(card, exam) {
  // ... 现有代码 ...
  
  // 添加模考按钮
  const mockBtn = document.createElement('button');
  mockBtn.className = 'exam-card__mock-btn';
  mockBtn.textContent = '模考';
  mockBtn.addEventListener('click', () => startMockExam(exam));
  card.appendChild(mockBtn);
}
```

- [ ] **Step 6: 实现模考启动逻辑**

```javascript
import { CountdownTimer, createCountdownUI } from '../features/countdownTimer.js';

function startMockExam(exam) {
  const duration = exam.type === 'listening' ? 1800 : 3600; // 听力30分钟，阅读60分钟
  const typeLabel = exam.type === 'listening' ? '听力' : '阅读';
  
  if (!confirm(`开始${typeLabel}模考\n时间限制：${duration / 60}分钟\n确定开始吗？`)) {
    return;
  }

  // 打开练习窗口
  // ... 现有的 openExam 逻辑 ...
  
  // 在练习窗口中注入倒计时器
  const timer = new CountdownTimer({
    duration,
    onComplete: () => {
      // 自动提交答案
      submitExamAnswers();
    }
  });

  const ui = createCountdownUI(timer);
  document.body.prepend(ui);
  timer.start();
}
```

- [ ] **Step 7: 验证**

Run: `npm run build`
在浏览器中测试模考功能

- [ ] **Step 8: Commit**

```bash
git add js/features/countdownTimer.js css/countdown-timer.css
git add js/main/examListManager.js index.html
git commit -m "feat: add countdown timer mock exam mode (reading 60min, listening 30min)"
```

---

## Phase 6: 数据优化

### Task 13: 题库索引改为 Map

**Files:**
- Modify: `js/app/examSessionMixin.js` (或拆分后的 windowManager.js)
- Modify: `js/core/practiceCore.js`

- [ ] **Step 1: 创建题库索引 Map**

在合适的位置（如 `practiceCore.js` 或新的 `examIndex.js`）添加:
```javascript
// examIndex.js - 题库索引
let examIndexMap = new Map();

export function buildExamIndex(exams) {
  examIndexMap.clear();
  for (const exam of exams) {
    examIndexMap.set(exam.id, exam);
  }
}

export function getExamById(id) {
  return examIndexMap.get(id) || null;
}

export function hasExam(id) {
  return examIndexMap.has(id);
}
```

- [ ] **Step 2: 在应用初始化时构建索引**

在 `app.js` 或 `main-entry.js` 的初始化流程中调用:
```javascript
import { buildExamIndex } from './examIndex.js';

// 当题库加载完成后构建索引
function onExamIndexLoaded() {
  const exams = window.completeExamIndex || [];
  buildExamIndex(exams);
}
```

- [ ] **Step 3: 替换线性搜索**

将代码中的 `list.find(e => e.id === examId)` 替换为:
```javascript
import { getExamById } from './examIndex.js';
const exam = getExamById(examId);
```

- [ ] **Step 4: 搜索并替换所有 find 调用**

Run: `grep -rn "\.find(e => e.id ===" js/ --include="*.js"`
逐个替换。

- [ ] **Step 5: 验证**

Run: `npm run build`
在浏览器测试题库浏览和练习功能

- [ ] **Step 6: Commit**

```bash
git add js/shared/examIndex.js js/app/examSessionMixin.js js/core/practiceCore.js
git commit -m "perf: replace linear exam search with Map-based O(1) lookup"
```

---

### Task 14: 最终验证和清理

**Files:**
- Modify: `index.html` (最终清理)
- Modify: `build.js` (添加清理任务)

- [ ] **Step 1: 运行完整构建**

Run: `npm run build`

- [ ] **Step 2: 验证所有 JS 文件语法**

Run: `find js -name "*.js" -exec node --check {} \;`

- [ ] **Step 3: 验证无残留引用**

Run: `grep -rn "three\.min\|threeBackground\|browse-view\.bundle" js/ index.html css/ tools/ --include="*.js" --include="*.html" --include="*.css"`

- [ ] **Step 4: 统计最终结果**

Run: `find js -name "*.js" | xargs wc -l | tail -1`
Run: `ls -la assets/dist/app.bundle.js`
Run: `du -sh .`

- [ ] **Step 5: 在浏览器完整测试**

测试清单：
- [ ] 首页加载速度
- [ ] 题库浏览
- [ ] 搜索功能
- [ ] 阅读练习
- [ ] 听力练习
- [ ] 模考倒计时
- [ ] 练习记录
- [ ] 统计数据

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
