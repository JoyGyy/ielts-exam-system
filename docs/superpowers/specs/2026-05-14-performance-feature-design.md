# 性能优化 + 功能增强设计文档

## 目标

将 IELTS 练习平台从全局变量 IIFE 架构迁移到 ES 模块化架构，引入构建工具，拆分超大文件，优化首屏加载，并添加倒计时模考功能。

## 当前状态

- 72 个 JS 文件，46,788 行代码
- 全部通过 `window.*` 全局变量通信
- 25+ 个同步 script 标签阻塞渲染
- 5 个超大文件（3000+ 行）
- 无构建工具，无模块系统
- 总大小 387MB（含音频和 PDF）

## 技术方案

### 1. 构建系统：esbuild

**配置：**
- 入口：`js/app/app.js`
- 输出：`assets/dist/app.bundle.js` + source map
- 开发模式：`esbuild --serve` 本地开发服务器
- 命令：
  - `npm run dev` — 开发服务器
  - `npm run build` — 生产构建（压缩）

**构建流程：**
```
源代码 (ES模块) → esbuild → assets/dist/app.bundle.js
                           → assets/dist/app.bundle.js.map
```

### 2. 模块迁移策略

**迁移方式：** 渐进式，从 IIFE 全局变量改为 ES 模块

**迁移顺序：**
1. 底层工具：`storage.js`, `logger.js`, `environmentDetector.js`
2. 核心逻辑：`practiceCore.js`, `scoreStorage.js`, `practiceRecorder.js`
3. 服务层：`libraryManager.js`, `overviewStats.js`
4. 运行时：`lazyLoader.js`, `examPages/`, `practice-page-enhancer.js`
5. 应用层：`examSessionMixin.js`, `browseController.js`, mixins
6. UI 层：`app-actions.js`, `navigation-controller.js`, `indexInteractions.js`

**兼容层：** 关键全局变量（`window.app`, `window.storage`）在入口处统一导出

### 3. 大文件拆分方案

| 原文件 | 行数 | 拆分为 |
|--------|------|--------|
| `main.js` | 3,343 | `globalShims.js` + `examListManager.js` + `practiceView.js` + `viewHelpers.js` |
| `examSessionMixin.js` | 3,272 | `windowManager.js` + `dataInjector.js` + `sessionTracker.js` + `urlBuilder.js` |
| `practice-page-enhancer.js` | 3,196 | `domObserver.js` + `answerCollector.js` + `sessionCommunicator.js` |
| `practiceRecorder.js` | 2,568 | `sessionManager.js` + `recordPersistence.js` + `recoveryHandler.js` |
| `storage.js` | 2,083 | `indexedDBAdapter.js` + `localStorageAdapter.js` + `storageManager.js` |

**拆分原则：**
- 每个新文件不超过 500 行
- 每个文件只有一个核心职责
- 通过 import/export 明确依赖关系

### 4. 倒计时模考功能

**模块：** `js/features/countdownTimer.js`

**功能：**
- 阅读模考：60 分钟倒计时
- 听力模考：30 分钟倒计时
- 顶部固定倒计时器显示
- 最后 5 分钟变红警告
- 到时间自动提交答案
- 用户可提前手动提交

**交互流程：**
1. 浏览页点击"模考"按钮
2. 确认框显示考试类型和时间
3. 进入练习页面，顶部显示倒计时
4. 倒计时结束自动提交
5. 显示成绩结果

### 5. 性能优化

**首屏加载：**
- 移除 `three.min.js` (656KB) — 用纯 CSS 渐变替代装饰背景
- 移除 `threeBackground.js`
- `manifest.js` (22KB) 改为懒加载
- 同步 script 标签改为 `defer`

**代码瘦身：**
- 删除重复的 `browse-view.bundle.js` (606KB)
- 提取重复的 `normalizePracticeType` 函数
- 提取重复的 `preferredFirstExamByCategory` 常量
- 清理死代码

**数据架构：**
- 题库索引从数组改为 Map（O(n) → O(1) 查找）
- 练习记录存储优化

## 预期效果

| 指标 | 当前 | 目标 |
|------|------|------|
| 首屏加载大小 | ~1.2MB JS | ~500KB JS |
| 同步 script 数量 | 25+ | <5 |
| 最大单文件行数 | 3,343 | <500 |
| 代码重复率 | ~15% | <3% |
| 题库查找复杂度 | O(n) | O(1) |

## 实施顺序

1. **Phase 1：构建系统搭建** — 安装 esbuild，创建 build 配置，验证构建流程
2. **Phase 2：性能清理** — 移除 three.js，删除重复 bundle，清理死代码
3. **Phase 3：大文件拆分** — 将 5 个超大文件拆分为小模块
4. **Phase 4：模块迁移** — 逐步将 IIFE 改为 ES 模块
5. **Phase 5：倒计时功能** — 开发 countdownTimer 模块
6. **Phase 6：数据优化** — 题库索引改为 Map，存储优化
