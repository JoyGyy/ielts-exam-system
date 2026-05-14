#!/usr/bin/env node
/**
 * build-bundles.js — 合并 JS 分组为 bundle，减少 HTTP 请求
 * 用法: node tools/build-bundles.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'bundles');

// 从 lazyLoader 提取的分组定义
const GROUPS = {
    'state-core': [
        'js/core/practiceCore.js',
        'js/core/resourceCore.js',
        'js/app/state-service.js',
        'js/services/libraryManager.js'
    ],
    'practice-suite': [
        'js/app/spellingErrorCollector.js',
        'js/utils/markdownExporter.js',
        'js/components/practiceRecordModal.js',
        'js/components/practiceHistoryEnhancer.js',
        'js/core/scoreStorage.js',
        'js/utils/answerSanitizer.js',
        'js/core/practiceRecorder.js'
    ],
    'browse-runtime': [
        'js/views/legacyViewBundle.js',
        'js/app/examActions.js',
        'js/app/readingLaunchMixin.js',
        'js/app/listeningLaunchMixin.js',
        'js/app/examSessionMixin.js',
        'js/app/browseController.js',
        'js/presentation/message-center.js',
        'js/components/PDFHandler.js',
        'js/components/SystemDiagnostics.js',
        'js/components/PerformanceOptimizer.js',
        'js/components/BrowseStateManager.js',
        'js/utils/dataConsistencyManager.js',
        'js/utils/answerMatchCore.js',
        'js/utils/answerComparisonUtils.js',
        'js/utils/BrowsePreferencesUtils.js',
        'js/utils/performance.js',
        'js/utils/typeChecker.js',
        'js/utils/codeStandards.js',
        // main.js 子模块（按依赖顺序加载）
        'js/main/viewHelpers.js',
        'js/main/globalShims.js',
        'js/main/practiceView.js',
        'js/main/examListManager.js',
        'js/main.js'
    ],
    'more-tools': [
        'js/presentation/moreView.js'
    ]
};

function bundleGroup(name, files) {
    const parts = [];
    let totalLines = 0;

    for (const file of files) {
        const filePath = path.join(ROOT, file);
        if (!fs.existsSync(filePath)) {
            console.warn('  [WARN] 文件不存在: ' + file);
            continue;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        parts.push('// ===== ' + file + ' =====');
        parts.push(content);
        parts.push('');
        totalLines += content.split('\n').length;
    }

    const bundle = parts.join('\n');
    const outPath = path.join(OUT_DIR, name + '.bundle.js');
    fs.writeFileSync(outPath, bundle);
    return { lines: totalLines, size: Buffer.byteLength(bundle) };
}

// === Main ===

console.log('=== JS Bundle 构建 ===\n');

if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

let totalSaved = 0;
let totalFiles = 0;

for (const [name, files] of Object.entries(GROUPS)) {
    const result = bundleGroup(name, files);
    const sizeKB = (result.size / 1024).toFixed(1);
    console.log(name + ': ' + files.length + ' 文件 → bundle.js (' + sizeKB + ' KB, ' + result.lines + ' 行)');
    totalSaved += files.length - 1; // 每个 bundle 节省 N-1 个请求
    totalFiles += files.length;
}

console.log('\n总计: ' + totalFiles + ' 文件 → ' + Object.keys(GROUPS).length + ' 个 bundle');
console.log('减少 HTTP 请求: ~' + totalSaved + ' 个');
console.log('输出目录: assets/bundles/');
