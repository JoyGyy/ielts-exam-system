# 错题本增强设计 — 看题 + 重做

## 目标

让错题本从"答案对比列表"升级为"复习工具"：用户能看到完整题目原文，并在弹窗中重新作答验证掌握程度。

## 功能一：显示题目原文

### 行为

- 在错题展开详情区域，异步加载并渲染该题的完整内容
- 阅读题：显示文章段落 + 题目（双栏或单栏取决于屏幕宽度）
- 听力题：显示题目页面 + 音频播放器
- 加载失败时（考试数据未注册或网络错误）显示"无法加载题目原文"提示，不阻塞其他功能
- 题目内容为只读展示，不可交互作答

### 数据来源

通过考试注册表 API 获取考试数据：
- 阅读：`__READING_EXAM_DATA__.get(examId)` → `questionGroups[].bodyHtml` → DOM 解析提取对应题目
- 听力：`__LISTENING_EXAM_DATA__.get(examId)` → `questionsPageHtml` → DOM 解析提取对应题目

### 提取逻辑

**阅读题提取函数** `extractReadingQuestion(examId, questionId)`：
1. 从注册表获取 exam 对象
2. 在 `questionGroups` 中找到包含该 `questionId` 的 group
3. 创建临时 DOM 容器，解析 `group.bodyHtml`
4. 查找 `#q{N}-anchor` 或与 questionId 对应的输入元素的父级 `.question-item`
5. 提取该元素的 outerHTML
6. 同时提取 `passage.blocks[].html` 作为文章内容
7. 返回 `{ passageHtml, questionHtml, kind }`

**听力题提取函数** `extractListeningQuestion(examId, questionId)`：
1. 从注册表获取 exam 对象
2. 创建临时 DOM 容器，解析 `questionsPageHtml`
3. 查找 `input[name="q{N}"]` 或相关题号的父级容器
4. 提取该元素的 outerHTML
5. 返回 `{ questionHtml, audioSrc, kind }`

## 功能二：弹窗单题重做

### 行为

- 每条错题的展开详情中新增"重做"按钮
- 点击后打开全屏浮窗（overlay），加载并显示题目
- 用户在浮窗中作答，点击提交后立即判对错
- 结果高亮显示：正确答案绿色，错误答案红色
- 关闭浮窗后错题列表刷新

### 浮窗结构

```
┌─────────────────────────────────────────┐
│ [← 返回]  考试标题 · 题号 q7      [✕]  │
├─────────────────────────────────────────┤
│                                         │
│  阅读题:                                │
│  ┌──────────────┬──────────────────┐    │
│  │  文章段落     │  题目内容         │    │
│  │  (可滚动)    │  (可交互作答)     │    │
│  └──────────────┴──────────────────┘    │
│                                         │
│  听力题:                                │
│  ┌──────────────────────────────────┐   │
│  │  [▶ 音频播放器]                  │   │
│  │  题目内容 (可交互作答)            │   │
│  └──────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│           [提交答案]                    │
└─────────────────────────────────────────┘
```

### 交互流程

1. 用户点击"重做" → 弹出浮窗
2. 异步加载考试数据，渲染题目（只读模式关闭，inputs 可交互）
3. 用户作答（radio、text、checkbox、dropzone 等）
4. 点击"提交答案"：
   - 收集用户答案
   - 与 `answerKey` 对比
   - 在题目上标注正确/错误
   - 显示正确答案
5. 提交按钮变为"关闭"
6. 关闭浮窗 → 更新错题条目的重做记录

### 答案对比逻辑

复用现有的答案对比模式：
- 阅读题：`exam.answerKey[questionId]` 直接对比
- 听力题：根据 `kind` 类型分别处理
  - `fill-in-blank`：精确匹配（忽略大小写和首尾空格）
  - `single_choice`：选项字母对比
  - `multi_choice`：集合对比
  - `matching`：配对对比

### 结果标注

提交后在题目 UI 上：
- 正确的输入框/选项：绿色边框 + 绿色背景
- 错误的输入框/选项：红色边框 + 红色背景 + 显示正确答案
- 每个输入旁边显示 ✓ 或 ✗ 图标

## 数据模型扩展

### 错题条目新增字段

```js
{
  ...existing,
  redoCount: 0,              // 累计重做次数
  lastRedoResult: null,      // 'correct' | 'incorrect' | null
  lastRedoDate: null          // 最近重做时间 ISO 8601
}
```

### 数据层新增 API

**文件：** `js/data/mistakeBook.js`

- `recordRedo(id, isCorrect)` — 记录重做结果：increment redoCount, set lastRedoResult, set lastRedoDate

### 题目提取工具

**文件：** `js/utils/questionExtractor.js`（新建）

```js
const QuestionExtractor = {
  async extractReadingQuestion(examId, questionId) → { passageHtml, questionHtml, kind, answerKey }
  async extractListeningQuestion(examId, questionId) → { questionHtml, audioSrc, kind, answerKey }
  renderQuestionInContainer(container, data, options) — 渲染题目到指定容器
  collectUserAnswers(container, questionIds) → { q1: 'value', ... }
  compareAnswers(userAnswers, answerKey) → { q1: { userAnswer, correctAnswer, isCorrect }, ... }
}
```

## UI 变化

### 错题列表行

每行新增重做状态标记：
- 未重做过：不显示
- 重做过：显示 "重做 N次 ✓" 或 "重做 N次 ✗"（绿色/红色小标签）

### 错题展开详情

新增区域（在现有元数据之后）：
1. **题目原文区域** — 异步加载的题目 HTML（只读展示）
2. **操作按钮行** — "重做此题" 按钮（主要按钮） + 现有的"标记已掌握"/"删除"

### 浮窗

- 全屏 overlay，z-index 高于所有内容
- 移动端：文章和题目上下排列（非双栏）
- 桌面端：阅读题双栏，听力题单栏
- 背景半透明黑色遮罩，点击遮罩不关闭（防止误触丢失作答）

## 关键文件

| 文件 | 操作 |
|------|------|
| `js/utils/questionExtractor.js` | 新建 — 题目提取和渲染工具 |
| `js/data/mistakeBook.js` | 修改 — 添加 `recordRedo` API，扩展数据模型 |
| `js/presentation/mistakeBookView.js` | 修改 — 展开详情显示原文、重做按钮、重做标记 |
| `css/main.css` | 修改 — 浮窗样式、题目原文样式、重做结果标注 |

## 不做的事

- 不做错题统计图表（用户未要求）
- 不做智能复习提醒（用户未要求）
- 不做错题本数据同步/云端存储
- 不修改考试页面本身的逻辑
