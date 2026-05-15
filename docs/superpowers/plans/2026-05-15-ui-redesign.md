# UI 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 IELTS 练习系统 UI 重构为 Material 3 动态深色主题，实现毛玻璃卡片、丰富微交互和数据可视化

**Architecture:** 使用 CSS 变量实现设计系统，组件化样式结构，Chart.js 实现数据图表，原生 JS 实现动画效果

**Tech Stack:** HTML5 + CSS3 + ES6+ JavaScript + Chart.js

---

## 文件结构映射

```
css/
├── variables.css      # 新建 — 设计 tokens（颜色、字体、间距、圆角、阴影）
├── base.css          # 新建 — 重置和基础样式
├── components/       # 新建 — 组件样式目录
│   ├── card.css      # 卡片组件
│   ├── button.css    # 按钮组件
│   ├── navigation.css # 导航组件
│   ├── search.css    # 搜索框组件
│   ├── filter.css    # 筛选器组件
│   ├── toast.css     # Toast 提示
│   └── modal.css     # 弹窗组件
├── animations/       # 新建 — 动画定义目录
│   ├── transitions.css # 过渡动画
│   ├── keyframes.css  # 关键帧动画
│   └── ripple.css     # 涟漪动画
└── main.css          # 重构 — 主样式入口（精简为导入其他文件）

js/
├── charts/           # 新建 — 图表相关代码
│   ├── accuracy.js   # 环形正确率图
│   ├── practice.js   # 每日练习柱状图
│   └── trend.js      # 学习趋势折线图
├── animations/       # 新建 — 动画相关代码
│   ├── ripple.js     # 涟漪效果
│   └── toast.js      # Toast 提示
└── utils/            # 新建 — 工具函数
    └── dom.js        # DOM 操作工具
```

---

## Task 1: 设计系统基础 — CSS 变量和重置样式

**Files:**
- Create: `css/variables.css`
- Create: `css/base.css`

- [ ] **Step 1: 创建 CSS 变量文件**

```css
/* css/variables.css */
:root {
    /* 颜色系统 — 深色主题 */
    --color-bg-primary: #0f172a;
    --color-bg-secondary: #1e293b;
    --color-bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    
    /* 卡片背景 — 毛玻璃效果 */
    --color-card-bg: rgba(255, 255, 255, 0.05);
    --color-card-border: rgba(255, 255, 255, 0.1);
    --color-card-hover-border: rgba(99, 102, 241, 0.5);
    
    /* 主色调 — 靛蓝到紫色渐变 */
    --color-primary: #6366f1;
    --color-primary-light: #818cf8;
    --color-primary-dark: #4f46e5;
    --color-secondary: #8b5cf6;
    --color-gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    
    /* 语义颜色 */
    --color-success: #22c55e;
    --color-success-bg: rgba(34, 197, 94, 0.1);
    --color-error: #ef4444;
    --color-error-bg: rgba(239, 68, 68, 0.1);
    --color-warning: #f59e0b;
    --color-warning-bg: rgba(245, 158, 11, 0.1);
    --color-info: #3b82f6;
    --color-info-bg: rgba(59, 130, 246, 0.1);
    
    /* 文字颜色 */
    --color-text-primary: #e2e8f0;
    --color-text-secondary: #94a3b8;
    --color-text-tertiary: #64748b;
    --color-text-disabled: #475569;
    
    /* 间距系统 — 8px 网格 */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-6: 24px;
    --space-8: 32px;
    --space-12: 48px;
    --space-16: 64px;
    
    /* 圆角系统 */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --radius-full: 9999px;
    
    /* 阴影系统 */
    --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.4);
    --shadow-card-hover: 0 12px 40px rgba(99, 102, 241, 0.3);
    --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.5);
    --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.5);
    
    /* 字体系统 */
    --font-family-primary: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-family-mono: 'JetBrains Mono', 'SF Mono', 'Monaco', monospace;
    
    /* 字体大小 */
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
    
    /* 字体权重 */
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    
    /* 行高 */
    --line-height-tight: 1.25;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.625;
    
    /* 过渡动画 */
    --transition-fast: 150ms ease-out;
    --transition-normal: 200ms ease-out;
    --transition-slow: 300ms ease-out;
    
    /* 布局 */
    --container-max-width: 1200px;
    --container-padding: var(--space-6);
    --nav-height: 64px;
}
```

- [ ] **Step 2: 创建基础样式文件**

```css
/* css/base.css */

/* 重置样式 */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

body {
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-normal);
    color: var(--color-text-primary);
    background: var(--color-bg-gradient);
    min-height: 100vh;
    overflow-x: hidden;
}

/* 噪点纹理背景 */
body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: -1;
}

/* 视差滚动容器 */
.parallax-container {
    perspective: 1000px;
    overflow-y: auto;
    overflow-x: hidden;
}

.parallax-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: translateZ(-1px) scale(2);
    z-index: -1;
}

/* 容器 */
.container {
    max-width: var(--container-max-width);
    margin: 0 auto;
    padding: 0 var(--container-padding);
}

/* 链接 */
a {
    color: var(--color-primary);
    text-decoration: none;
    transition: color var(--transition-fast);
}

a:hover {
    color: var(--color-primary-light);
}

/* 图片 */
img {
    max-width: 100%;
    height: auto;
    display: block;
}

/* 列表 */
ul, ol {
    list-style: none;
}

/* 标题 */
h1, h2, h3, h4, h5, h6 {
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-tight);
    color: var(--color-text-primary);
}

h1 { font-size: var(--font-size-4xl); }
h2 { font-size: var(--font-size-3xl); }
h3 { font-size: var(--font-size-2xl); }
h4 { font-size: var(--font-size-xl); }
h5 { font-size: var(--font-size-lg); }
h6 { font-size: var(--font-size-base); }

/* 段落 */
p {
    margin-bottom: var(--space-4);
}

/* 代码 */
code {
    font-family: var(--font-family-mono);
    font-size: 0.9em;
    padding: 0.2em 0.4em;
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
}

pre {
    font-family: var(--font-family-mono);
    padding: var(--space-4);
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-md);
    overflow-x: auto;
}

pre code {
    padding: 0;
    background: none;
}

/* 表格 */
table {
    width: 100%;
    border-collapse: collapse;
}

th, td {
    padding: var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-card-border);
}

th {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
}

/* 表单元素基础 */
input, textarea, select, button {
    font-family: inherit;
    font-size: inherit;
}

/* 隐藏类 */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.hidden {
    display: none !important;
}
```

- [ ] **Step 3: 提交设计系统基础**

```bash
git add css/variables.css css/base.css
git commit -m "feat: 添加设计系统基础 — CSS 变量和重置样式"
```

---

## Task 2: 组件样式 — 卡片和按钮

**Files:**
- Create: `css/components/card.css`
- Create: `css/components/button.css`

- [ ] **Step 1: 创建卡片组件样式**

```css
/* css/components/card.css */

/* 基础卡片 */
.card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: transform var(--transition-normal),
                box-shadow var(--transition-normal),
                border-color var(--transition-normal);
}

/* 卡片悬浮效果 */
.card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-card-hover);
    border-color: var(--color-card-hover-border);
}

/* 考试卡片 */
.exam-card {
    position: relative;
    overflow: hidden;
    cursor: pointer;
}

.exam-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--color-gradient-primary);
    opacity: 0;
    transition: opacity var(--transition-normal);
}

.exam-card:hover::before {
    opacity: 1;
}

.exam-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
}

.exam-card-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
}

.exam-card-subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}

.exam-card-meta {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-4);
}

/* 标签 */
.tag {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    border-radius: var(--radius-full);
    background: rgba(99, 102, 241, 0.2);
    color: var(--color-primary-light);
}

.tag-success {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.tag-error {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.tag-warning {
    background: var(--color-warning-bg);
    color: var(--color-warning);
}

/* 错题卡片 */
.mistake-card {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
}

.mistake-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
}

.mistake-card-content {
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    line-height: var(--line-height-relaxed);
    margin-bottom: var(--space-4);
}

.mistake-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-4);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 答案对比 */
.answer-comparison {
    display: flex;
    gap: var(--space-6);
    margin-top: var(--space-4);
}

.answer-item {
    text-align: center;
}

.answer-label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-1);
}

.answer-value {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
}

.answer-correct {
    color: var(--color-success);
}

.answer-incorrect {
    color: var(--color-error);
}

/* 卡片网格 */
.card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-6);
}

@media (max-width: 1024px) {
    .card-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 640px) {
    .card-grid {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 2: 创建按钮组件样式**

```css
/* css/components/button.css */

/* 基础按钮 */
.btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    overflow: hidden;
    transition: all var(--transition-fast);
    user-select: none;
}

/* 主要按钮 */
.btn-primary {
    background: var(--color-gradient-primary);
    color: white;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.btn-primary:active {
    transform: translateY(0);
}

/* 次要按钮 */
.btn-secondary {
    background: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-card-border);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--color-primary);
}

/* 幽灵按钮 */
.btn-ghost {
    background: transparent;
    color: var(--color-text-secondary);
}

.btn-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
}

/* 危险按钮 */
.btn-danger {
    background: var(--color-error);
    color: white;
}

.btn-danger:hover {
    background: #dc2626;
}

/* 按钮尺寸 */
.btn-sm {
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
}

.btn-lg {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
}

/* 禁用状态 */
.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

/* 加载状态 */
.btn-loading {
    position: relative;
    color: transparent;
}

.btn-loading::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.btn-primary .btn-loading::after {
    border-top-color: white;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* 图标按钮 */
.btn-icon {
    padding: var(--space-3);
    border-radius: var(--radius-full);
}

/* 涟漪效果容器 */
.ripple-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
}

.ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-effect 600ms linear;
    pointer-events: none;
}

@keyframes ripple-effect {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
```

- [ ] **Step 3: 提交卡片和按钮样式**

```bash
mkdir -p css/components
git add css/components/card.css css/components/button.css
git commit -m "feat: 添加卡片和按钮组件样式"
```

---

## Task 3: 组件样式 — 导航、搜索和筛选

**Files:**
- Create: `css/components/navigation.css`
- Create: `css/components/search.css`
- Create: `css/components/filter.css`

- [ ] **Step 1: 创建导航组件样式**

```css
/* css/components/navigation.css */

/* 顶部导航 */
.main-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--nav-height);
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--color-card-border);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 导航内容 */
.nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: var(--container-max-width);
    width: 100%;
    padding: 0 var(--container-padding);
}

/* 导航标题 */
.nav-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.nav-title-icon {
    width: 32px;
    height: 32px;
    background: var(--color-gradient-primary);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
}

/* Tab 切换 */
.nav-tabs {
    display: flex;
    gap: var(--space-2);
    background: rgba(255, 255, 255, 0.05);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    position: relative;
}

.nav-tab {
    position: relative;
    padding: var(--space-2) var(--space-6);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: color var(--transition-fast);
    z-index: 1;
}

.nav-tab:hover {
    color: var(--color-text-primary);
}

.nav-tab.active {
    color: white;
}

/* Tab 滑动指示器 */
.nav-tab-indicator {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    height: calc(100% - var(--space-2));
    background: var(--color-gradient-primary);
    border-radius: var(--radius-full);
    transition: transform var(--transition-normal), width var(--transition-normal);
    box-shadow: var(--shadow-glow);
    z-index: 0;
}

/* 导航操作区 */
.nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

/* 主内容区偏移 */
.main-content {
    padding-top: calc(var(--nav-height) + var(--space-6));
    min-height: 100vh;
}
```

- [ ] **Step 2: 创建搜索框组件样式**

```css
/* css/components/search.css */

/* 搜索框容器 */
.search-container {
    position: relative;
    width: 100%;
    max-width: 400px;
}

/* 搜索输入框 */
.search-input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    padding-left: var(--space-12);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    outline: none;
    transition: all var(--transition-fast);
}

.search-input::placeholder {
    color: var(--color-text-tertiary);
}

.search-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

/* 搜索图标 */
.search-icon {
    position: absolute;
    left: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    color: var(--color-text-tertiary);
    pointer-events: none;
}

/* 清除按钮 */
.search-clear {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: all var(--transition-fast);
}

.search-input:not(:placeholder-shown) ~ .search-clear {
    opacity: 1;
}

.search-clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
}
```

- [ ] **Step 3: 创建筛选器组件样式**

```css
/* css/components/filter.css */

/* 筛选器容器 */
.filter-container {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
}

/* 分段控制器 */
.segmented-control {
    display: flex;
    gap: var(--space-1);
    background: rgba(255, 255, 255, 0.05);
    padding: var(--space-1);
    border-radius: var(--radius-full);
}

.segmented-btn {
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.segmented-btn:hover {
    color: var(--color-text-primary);
}

.segmented-btn.active {
    background: var(--color-gradient-primary);
    color: white;
    box-shadow: var(--shadow-glow);
}

/* 下拉选择器 */
.select-wrapper {
    position: relative;
    display: inline-flex;
}

.select-trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.select-trigger:hover {
    border-color: var(--color-primary);
}

.select-trigger::after {
    content: '';
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid currentColor;
    transition: transform var(--transition-fast);
}

.select-wrapper.open .select-trigger::after {
    transform: rotate(180deg);
}

.select-dropdown {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    min-width: 150px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-modal);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: all var(--transition-fast);
    z-index: 100;
}

.select-wrapper.open .select-dropdown {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.select-option {
    padding: var(--space-3) var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background var(--transition-fast);
}

.select-option:hover {
    background: rgba(255, 255, 255, 0.05);
}

.select-option.selected {
    background: rgba(99, 102, 241, 0.2);
    color: var(--color-primary-light);
}

/* 筛选标签 */
.filter-tags {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
}

.filter-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-full);
}

.filter-tag-remove {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
}

.filter-tag-remove:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 4: 提交导航、搜索和筛选样式**

```bash
git add css/components/navigation.css css/components/search.css css/components/filter.css
git commit -m "feat: 添加导航、搜索和筛选器组件样式"
```

---

## Task 4: 组件样式 — Toast、弹窗和动画

**Files:**
- Create: `css/components/toast.css`
- Create: `css/components/modal.css`
- Create: `css/animations/transitions.css`
- Create: `css/animations/keyframes.css`

- [ ] **Step 1: 创建 Toast 提示样式**

```css
/* css/components/toast.css */

/* Toast 容器 */
.toast-container {
    position: fixed;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    z-index: 9999;
    pointer-events: none;
}

/* Toast 基础样式 */
.toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-modal);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    pointer-events: auto;
    animation: toast-slide-in 300ms ease-out;
}

.toast.hiding {
    animation: toast-slide-out 300ms ease-out forwards;
}

/* Toast 图标 */
.toast-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}

.toast-success .toast-icon { color: var(--color-success); }
.toast-error .toast-icon { color: var(--color-error); }
.toast-warning .toast-icon { color: var(--color-warning); }
.toast-info .toast-icon { color: var(--color-info); }

/* Toast 内容 */
.toast-content {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
}

/* Toast 关闭按钮 */
.toast-close {
    width: 20px;
    height: 20px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-tertiary);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity var(--transition-fast);
}

.toast-close:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
}

/* Toast 动画 */
@keyframes toast-slide-in {
    from {
        transform: translateY(100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes toast-slide-out {
    from {
        transform: translateY(0);
        opacity: 1;
    }
    to {
        transform: translateY(100%);
        opacity: 0;
    }
}
```

- [ ] **Step 2: 创建弹窗组件样式**

```css
/* css/components/modal.css */

/* 弹窗遮罩 */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    opacity: 0;
    visibility: hidden;
    transition: all var(--transition-normal);
}

.modal-overlay.active {
    opacity: 1;
    visibility: visible;
}

/* 弹窗容器 */
.modal {
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    transform: scale(0.9) translateY(20px);
    transition: transform var(--transition-normal);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-overlay.active .modal {
    transform: scale(1) translateY(0);
}

/* 弹窗头部 */
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-card-border);
}

.modal-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.modal-close {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.modal-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
}

/* 弹窗内容 */
.modal-body {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
}

/* 弹窗底部 */
.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-6);
    border-top: 1px solid var(--color-card-border);
}
```

- [ ] **Step 3: 创建过渡动画样式**

```css
/* css/animations/transitions.css */

/* 淡入淡出 */
.fade-enter {
    opacity: 0;
}

.fade-enter-active {
    opacity: 1;
    transition: opacity var(--transition-slow);
}

.fade-exit {
    opacity: 1;
}

.fade-exit-active {
    opacity: 0;
    transition: opacity var(--transition-slow);
}

/* 滑入滑出 */
.slide-up-enter {
    transform: translateY(20px);
    opacity: 0;
}

.slide-up-enter-active {
    transform: translateY(0);
    opacity: 1;
    transition: all var(--transition-slow);
}

.slide-up-exit {
    transform: translateY(0);
    opacity: 1;
}

.slide-up-exit-active {
    transform: translateY(20px);
    opacity: 0;
    transition: all var(--transition-slow);
}

/* 缩放 */
.scale-enter {
    transform: scale(0.9);
    opacity: 0;
}

.scale-enter-active {
    transform: scale(1);
    opacity: 1;
    transition: all var(--transition-normal);
}

.scale-exit {
    transform: scale(1);
    opacity: 1;
}

.scale-exit-active {
    transform: scale(0.9);
    opacity: 0;
    transition: all var(--transition-normal);
}

/* Stagger 动画容器 */
.stagger-container > * {
    opacity: 0;
    transform: translateY(20px);
    animation: stagger-fade-in 400ms ease-out forwards;
}

.stagger-container > *:nth-child(1) { animation-delay: 0ms; }
.stagger-container > *:nth-child(2) { animation-delay: 50ms; }
.stagger-container > *:nth-child(3) { animation-delay: 100ms; }
.stagger-container > *:nth-child(4) { animation-delay: 150ms; }
.stagger-container > *:nth-child(5) { animation-delay: 200ms; }
.stagger-container > *:nth-child(6) { animation-delay: 250ms; }
.stagger-container > *:nth-child(7) { animation-delay: 300ms; }
.stagger-container > *:nth-child(8) { animation-delay: 350ms; }
.stagger-container > *:nth-child(9) { animation-delay: 400ms; }

@keyframes stagger-fade-in {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

- [ ] **Step 4: 创建关键帧动画样式**

```css
/* css/animations/keyframes.css */

/* 骨架屏动画 */
@keyframes skeleton-pulse {
    0%, 100% {
        opacity: 0.4;
    }
    50% {
        opacity: 0.8;
    }
}

.skeleton {
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(255, 255, 255, 0.1) 50%,
        rgba(255, 255, 255, 0.05) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
    border-radius: var(--radius-sm);
}

@keyframes skeleton-shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

.skeleton-text {
    height: 1em;
    margin-bottom: 0.5em;
}

.skeleton-title {
    height: 1.5em;
    width: 60%;
    margin-bottom: 0.5em;
}

.skeleton-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
}

.skeleton-card {
    height: 200px;
}

/* 发光效果 */
@keyframes glow-pulse {
    0%, 100% {
        box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
    }
    50% {
        box-shadow: 0 0 40px rgba(99, 102, 241, 0.5);
    }
}

.glow {
    animation: glow-pulse 2s ease-in-out infinite;
}

/* 旋转 */
@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.rotate {
    animation: rotate 1s linear infinite;
}

/* 弹跳 */
@keyframes bounce {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-10px);
    }
}

.bounce {
    animation: bounce 1s ease-in-out infinite;
}

/* 脉冲 */
@keyframes pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

.pulse {
    animation: pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 5: 提交 Toast、弹窗和动画样式**

```bash
git add css/components/toast.css css/components/modal.css css/animations/transitions.css css/animations/keyframes.css
git commit -m "feat: 添加 Toast、弹窗和动画样式"
```

---

## Task 5: 主样式入口 — 整合所有样式

**Files:**
- Modify: `css/main.css`

- [ ] **Step 1: 重构 main.css 为导入文件**

```css
/* css/main.css */

/* 设计系统 */
@import url('variables.css');
@import url('base.css');

/* 组件样式 */
@import url('components/card.css');
@import url('components/button.css');
@import url('components/navigation.css');
@import url('components/search.css');
@import url('components/filter.css');
@import url('components/toast.css');
@import url('components/modal.css');

/* 动画样式 */
@import url('animations/transitions.css');
@import url('animations/keyframes.css');

/* 保留原有样式中未被覆盖的部分 */
/* 注意：原有的大部分样式已被新的组件样式覆盖 */
/* 如果发现遗漏的样式，可以在这里补充 */

/* 响应式调整 */
@media (max-width: 768px) {
    :root {
        --container-padding: var(--space-4);
        --nav-height: 56px;
    }
    
    .card-grid {
        grid-template-columns: 1fr;
    }
    
    .nav-content {
        padding: 0 var(--space-4);
    }
    
    .filter-container {
        flex-direction: column;
        align-items: stretch;
    }
    
    .segmented-control {
        width: 100%;
        justify-content: stretch;
    }
    
    .segmented-btn {
        flex: 1;
    }
}
```

- [ ] **Step 2: 提交主样式入口**

```bash
git add css/main.css
git commit -m "refactor: 重构 main.css 为样式导入入口"
```

---

## Task 6: HTML 结构重构

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 更新 HTML 头部和导航结构**

```html
<!-- 更新 index.html 头部 -->
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IELTS 练习系统</title>
    
    <!-- 字体 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    
    <!-- 样式 -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/countdown-timer.css">
    <link rel="stylesheet" href="css/heroui-bridge.css">
</head>

<!-- 更新导航结构 -->
<nav class="main-nav">
    <div class="nav-content">
        <div class="nav-title">
            <div class="nav-title-icon">📚</div>
            <span>IELTS 练习系统</span>
        </div>
        
        <div class="nav-tabs">
            <button class="nav-tab active" data-view="browse">题库</button>
            <button class="nav-tab" data-view="mistakes">错题本</button>
            <div class="nav-tab-indicator"></div>
        </div>
        
        <div class="nav-actions">
            <!-- 导航操作按钮 -->
        </div>
    </div>
</nav>

<!-- 主内容区 -->
<main class="main-content">
    <!-- 页面内容 -->
</main>

<!-- Toast 容器 -->
<div class="toast-container" id="toast-container"></div>
```

- [ ] **Step 2: 更新题库页面结构**

```html
<!-- 题库页面 -->
<section id="browse-view" class="view active">
    <div class="container">
        <!-- 页面头部 -->
        <div class="page-header">
            <h1 class="page-title">题库</h1>
            
            <!-- 搜索和筛选 -->
            <div class="filter-container">
                <div class="search-container">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" class="search-input" placeholder="搜索题目..." id="exam-search-input">
                    <button class="search-clear" id="search-clear-btn" type="button">×</button>
                </div>
                
                <div class="segmented-control">
                    <button class="segmented-btn active" data-filter-type="all">全部</button>
                    <button class="segmented-btn" data-filter-type="reading">阅读</button>
                    <button class="segmented-btn" data-filter-type="listening">听力</button>
                </div>
            </div>
        </div>
        
        <!-- 统计区域 -->
        <div class="stats-section" id="stats-section">
            <!-- 图表将在这里渲染 -->
        </div>
        
        <!-- 卡片网格 -->
        <div class="card-grid stagger-container" id="exam-grid">
            <!-- 考试卡片将在这里动态生成 -->
        </div>
    </div>
</section>
```

- [ ] **Step 3: 更新错题本页面结构**

```html
<!-- 错题本页面 -->
<section id="mistakes-view" class="view">
    <div class="container">
        <!-- 页面头部 -->
        <div class="page-header">
            <h1 class="page-title">错题本</h1>
            
            <!-- 筛选和操作 -->
            <div class="filter-container">
                <div class="segmented-control">
                    <button class="segmented-btn active" data-filter-type="all">全部</button>
                    <button class="segmented-btn" data-filter-type="reading">阅读</button>
                    <button class="segmented-btn" data-filter-type="listening">听力</button>
                </div>
                
                <div class="filter-actions">
                    <button class="btn btn-secondary btn-sm" id="select-all-btn">全选</button>
                    <button class="btn btn-secondary btn-sm" id="batch-mastered-btn">批量掌握</button>
                    <button class="btn btn-danger btn-sm" id="batch-delete-btn">批量删除</button>
                    <button class="btn btn-ghost btn-sm" id="export-btn">导出</button>
                </div>
            </div>
        </div>
        
        <!-- 统计区域 -->
        <div class="stats-section" id="mistake-stats">
            <!-- 统计卡片和图表 -->
        </div>
        
        <!-- 错题列表 -->
        <div class="mistake-list stagger-container" id="mistake-list">
            <!-- 错题卡片将在这里动态生成 -->
        </div>
    </div>
</section>
```

- [ ] **Step 4: 提交 HTML 结构重构**

```bash
git add index.html
git commit -m "refactor: 重构 HTML 结构 — 导航、题库和错题本页面"
```

---

## Task 7: JavaScript 工具函数 — DOM 操作和涟漪效果

**Files:**
- Create: `js/utils/dom.js`
- Create: `js/animations/ripple.js`

- [ ] **Step 1: 创建 DOM 工具函数**

```javascript
// js/utils/dom.js

'use strict';

const DOM = {
    /**
     * 查询单个元素
     */
    query(selector, parent = document) {
        return parent.querySelector(selector);
    },

    /**
     * 查询多个元素
     */
    queryAll(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    },

    /**
     * 创建元素
     */
    create(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'innerHTML') {
                el.innerHTML = value;
            } else if (key === 'textContent') {
                el.textContent = value;
            } else {
                el.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        });
        
        return el;
    },

    /**
     * 添加事件监听
     */
    on(element, event, handler, options) {
        if (typeof element === 'string') {
            element = this.query(element);
        }
        if (element) {
            element.addEventListener(event, handler, options);
        }
        return element;
    },

    /**
     * 移除事件监听
     */
    off(element, event, handler, options) {
        if (typeof element === 'string') {
            element = this.query(element);
        }
        if (element) {
            element.removeEventListener(event, handler, options);
        }
        return element;
    },

    /**
     * 切换类名
     */
    toggleClass(element, className, force) {
        if (typeof element === 'string') {
            element = this.query(element);
        }
        if (element) {
            element.classList.toggle(className, force);
        }
        return element;
    },

    /**
     * 添加类名
     */
    addClass(element, className) {
        if (typeof element === 'string') {
            element = this.query(element);
        }
        if (element) {
            element.classList.add(className);
        }
        return element;
    },

    /**
     * 移除类名
     */
    removeClass(element, className) {
        if (typeof element === 'string') {
            element = this.query(element);
        }
        if (element) {
            element.classList.remove(className);
        }
        return element;
    },

    /**
     * 延迟执行
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 节流
     */
    throttle(fn, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    },

    /**
     * 防抖
     */
    debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }
};

window.DOM = DOM;
```

- [ ] **Step 2: 创建涟漪效果**

```javascript
// js/animations/ripple.js

'use strict';

const Ripple = {
    /**
     * 初始化涟漪效果
     */
    init(selector = '.btn, .card, .nav-tab') {
        const elements = DOM.queryAll(selector);
        elements.forEach(el => this.attach(el));
    },

    /**
     * 为元素添加涟漪效果
     */
    attach(element) {
        if (element.dataset.rippleAttached) return;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.dataset.rippleAttached = 'true';
        
        element.addEventListener('click', (e) => {
            this.create(e);
        });
    },

    /**
     * 创建涟漪动画
     */
    create(event) {
        const element = event.currentTarget;
        const rect = element.getBoundingClientRect();
        
        // 计算涟漪位置
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 计算涟漪大小
        const size = Math.max(rect.width, rect.height) * 2;
        
        // 创建涟漪元素
        const ripple = DOM.create('span', {
            className: 'ripple',
            style: {
                width: size + 'px',
                height: size + 'px',
                left: x - size / 2 + 'px',
                top: y - size / 2 + 'px'
            }
        });
        
        // 确保有涟漪容器
        let container = element.querySelector('.ripple-container');
        if (!container) {
            container = DOM.create('div', { className: 'ripple-container' });
            element.appendChild(container);
        }
        
        container.appendChild(ripple);
        
        // 动画结束后移除
        ripple.addEventListener('animationend', () => {
            ripple.remove();
        });
    },

    /**
     * 手动触发涟漪
     */
    trigger(element, x, y) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        
        const ripple = DOM.create('span', {
            className: 'ripple',
            style: {
                width: size + 'px',
                height: size + 'px',
                left: x - size / 2 + 'px',
                top: y - size / 2 + 'px'
            }
        });
        
        let container = element.querySelector('.ripple-container');
        if (!container) {
            container = DOM.create('div', { className: 'ripple-container' });
            element.appendChild(container);
        }
        
        container.appendChild(ripple);
        
        ripple.addEventListener('animationend', () => {
            ripple.remove();
        });
    }
};

window.Ripple = Ripple;
```

- [ ] **Step 3: 提交工具函数和涟漪效果**

```bash
mkdir -p js/utils js/animations
git add js/utils/dom.js js/animations/ripple.js
git commit -m "feat: 添加 DOM 工具函数和涟漪效果"
```

---

## Task 8: JavaScript 工具函数 — Toast 提示

**Files:**
- Create: `js/animations/toast.js`

- [ ] **Step 1: 创建 Toast 提示功能**

```javascript
// js/animations/toast.js

'use strict';

const Toast = {
    container: null,
    toasts: [],
    maxToasts: 5,
    defaultDuration: 3000,

    /**
     * 初始化 Toast 容器
     */
    init() {
        this.container = DOM.query('#toast-container');
        if (!this.container) {
            this.container = DOM.create('div', {
                id: 'toast-container',
                className: 'toast-container'
            });
            document.body.appendChild(this.container);
        }
    },

    /**
     * 显示 Toast
     */
    show(options) {
        if (!this.container) {
            this.init();
        }

        const {
            type = 'info',
            message,
            duration = this.defaultDuration,
            closable = true
        } = options;

        // 限制最大数量
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }

        // 创建 Toast 元素
        const toast = DOM.create('div', {
            className: `toast toast-${type}`,
            innerHTML: `
                <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${this.getIconPath(type)}
                </svg>
                <span class="toast-content">${message}</span>
                ${closable ? '<button class="toast-close" type="button">×</button>' : ''}
            `
        });

        // 添加关闭事件
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => this.remove(toast));
        }

        // 添加到容器
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // 自动消失
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    },

    /**
     * 移除 Toast
     */
    remove(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.add('hiding');
        
        toast.addEventListener('animationend', () => {
            toast.remove();
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        });
    },

    /**
     * 获取图标路径
     */
    getIconPath(type) {
        const icons = {
            success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
        };
        return icons[type] || icons.info;
    },

    /**
     * 快捷方法
     */
    success(message, options = {}) {
        return this.show({ type: 'success', message, ...options });
    },

    error(message, options = {}) {
        return this.show({ type: 'error', message, ...options });
    },

    warning(message, options = {}) {
        return this.show({ type: 'warning', message, ...options });
    },

    info(message, options = {}) {
        return this.show({ type: 'info', message, ...options });
    },

    /**
     * 清除所有 Toast
     */
    clear() {
        this.toasts.forEach(toast => this.remove(toast));
    }
};

window.Toast = Toast;
```

- [ ] **Step 2: 提交 Toast 提示功能**

```bash
git add js/animations/toast.js
git commit -m "feat: 添加 Toast 提示功能"
```

---

## Task 9: 数据可视化 — Chart.js 集成和图表组件

**Files:**
- Create: `js/charts/accuracy.js`
- Create: `js/charts/practice.js`
- Create: `js/charts/trend.js`

- [ ] **Step 1: 创建环形正确率图**

```javascript
// js/charts/accuracy.js

'use strict';

const AccuracyChart = {
    chart: null,
    
    /**
     * 初始化图表
     */
    init(containerId, data) {
        const container = DOM.query('#' + containerId);
        if (!container) return;
        
        // 检查 Chart.js 是否已加载
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js 未加载');
            return;
        }
        
        // 创建 canvas
        const canvas = DOM.create('canvas', { id: containerId + '-canvas' });
        container.appendChild(canvas);
        
        // 配置图表
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['正确', '错误'],
                datasets: [{
                    data: [data.correct || 0, data.incorrect || 0],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgba(34, 197, 94, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.parsed;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    const { width, height, ctx } = chart;
                    ctx.restore();
                    
                    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const correct = chart.data.datasets[0].data[0];
                    const percentage = total > 0 ? ((correct / total) * 100).toFixed(0) : 0;
                    
                    // 绘制百分比
                    ctx.font = 'bold 24px Inter, sans-serif';
                    ctx.fillStyle = '#e2e8f0';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(percentage + '%', width / 2, height / 2 - 8);
                    
                    // 绘制标签
                    ctx.font = '12px Inter, sans-serif';
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText('正确率', width / 2, height / 2 + 16);
                    
                    ctx.save();
                }
            }]
        });
    },
    
    /**
     * 更新图表数据
     */
    update(data) {
        if (!this.chart) return;
        
        this.chart.data.datasets[0].data = [data.correct || 0, data.incorrect || 0];
        this.chart.update();
    },
    
    /**
     * 销毁图表
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.AccuracyChart = AccuracyChart;
```

- [ ] **Step 2: 创建每日练习柱状图**

```javascript
// js/charts/practice.js

'use strict';

const PracticeChart = {
    chart: null,
    
    /**
     * 初始化图表
     */
    init(containerId, data) {
        const container = DOM.query('#' + containerId);
        if (!container) return;
        
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js 未加载');
            return;
        }
        
        const canvas = DOM.create('canvas', { id: containerId + '-canvas' });
        container.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        // 创建渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.4)');
        
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels || ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                datasets: [{
                    label: '练习次数',
                    data: data.values || [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: gradient,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `练习 ${context.parsed.y} 次`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1
                        }
                    }
                },
                animation: {
                    easing: 'easeOutQuart',
                    duration: 1000
                }
            }
        });
    },
    
    /**
     * 更新图表数据
     */
    update(data) {
        if (!this.chart) return;
        
        this.chart.data.labels = data.labels;
        this.chart.data.datasets[0].data = data.values;
        this.chart.update();
    },
    
    /**
     * 销毁图表
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.PracticeChart = PracticeChart;
```

- [ ] **Step 3: 创建学习趋势折线图**

```javascript
// js/charts/trend.js

'use strict';

const TrendChart = {
    chart: null,
    
    /**
     * 初始化图表
     */
    init(containerId, data) {
        const container = DOM.query('#' + containerId);
        if (!container) return;
        
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js 未加载');
            return;
        }
        
        const canvas = DOM.create('canvas', { id: containerId + '-canvas' });
        container.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        // 创建渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: '正确率',
                    data: data.values || [],
                    fill: true,
                    backgroundColor: gradient,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `正确率: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                animation: {
                    easing: 'easeOutQuart',
                    duration: 1500
                }
            }
        });
    },
    
    /**
     * 更新图表数据
     */
    update(data) {
        if (!this.chart) return;
        
        this.chart.data.labels = data.labels;
        this.chart.data.datasets[0].data = data.values;
        this.chart.update();
    },
    
    /**
     * 销毁图表
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.TrendChart = TrendChart;
```

- [ ] **Step 4: 提交图表组件**

```bash
mkdir -p js/charts
git add js/charts/accuracy.js js/charts/practice.js js/charts/trend.js
git commit -m "feat: 添加数据可视化图表组件"
```

---

## Task 10: 整合测试和最终提交

**Files:**
- Modify: `index.html` (添加 Chart.js CDN 和脚本引用)

- [ ] **Step 1: 在 index.html 中添加 Chart.js CDN**

```html
<!-- 在 </head> 之前添加 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
```

- [ ] **Step 2: 在 </body> 之前添加脚本引用**

```html
<!-- 工具函数和动画 -->
<script src="js/utils/dom.js"></script>
<script src="js/animations/ripple.js"></script>
<script src="js/animations/toast.js"></script>

<!-- 图表组件 -->
<script src="js/charts/accuracy.js"></script>
<script src="js/charts/practice.js"></script>
<script src="js/charts/trend.js"></script>

<!-- 初始化脚本 -->
<script>
    document.addEventListener('DOMContentLoaded', function() {
        // 初始化涟漪效果
        Ripple.init();
        
        // 初始化 Toast
        Toast.init();
        
        // 初始化图表（需要根据实际数据调整）
        // AccuracyChart.init('accuracy-chart', { correct: 75, incorrect: 25 });
        // PracticeChart.init('practice-chart', { labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], values: [5, 3, 8, 2, 6, 4, 7] });
        // TrendChart.init('trend-chart', { labels: ['4/1', '4/2', '4/3', '4/4', '4/5'], values: [60, 65, 70, 72, 75] });
    });
</script>
```

- [ ] **Step 3: 提交最终整合**

```bash
git add index.html
git commit -m "feat: 整合 Chart.js 和初始化脚本"
```

---

## 验证清单

完成所有 Task 后，手动验证以下内容：

1. **视觉效果**
   - [ ] 深色主题正确显示
   - [ ] 毛玻璃卡片效果正常
   - [ ] 渐变背景和噪点纹理显示
   - [ ] 发光边框效果正常

2. **交互效果**
   - [ ] 卡片悬浮上浮和发光
   - [ ] 按钮涟漪效果
   - [ ] Tab 切换滑动指示器
   - [ ] Toast 提示显示和消失

3. **响应式设计**
   - [ ] 桌面端 3 列卡片网格
   - [ ] 平板端 2 列卡片网格
   - [ ] 手机端 1 列卡片网格
   - [ ] 导航和筛选器适配

4. **数据可视化**
   - [ ] Chart.js 正确加载
   - [ ] 图表正确渲染
   - [ ] 图表交互正常（悬浮提示）
   - [ ] 图表动画正常

5. **性能**
   - [ ] 动画流畅无卡顿
   - [ ] 页面加载正常
   - [ ] 无控制台错误

---

## 不做的事

- 不做移动端优先设计（用户选择优化桌面端）
- 不做 IE 兼容
- 不做自动化测试（用户选择手动测试）
- 不做详细文档（用户选择无需文档）
- 不修改业务逻辑（只改 UI 和交互）
