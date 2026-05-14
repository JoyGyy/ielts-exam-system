#!/usr/bin/env node
/**
 * minify-exam-html.js — 压缩考试数据文件中的 HTML 题面内容
 * 删除多余空白、注释、可选属性，保留结构完整性
 * 用法: node tools/minify-exam-html.js [--dry-run]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function minifyHtml(html) {
    if (!html || typeof html !== 'string') return html;

    let result = html;

    // 1. 删除 HTML 注释
    result = result.replace(/<!--[\s\S]*?-->/g, '');

    // 2. 删除 script 和 style 标签内容（题面不需要）
    result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
    result = result.replace(/<style[\s\S]*?<\/style>/gi, '');

    // 3. 删除可选属性（保留 class, id, href, src, type, value, placeholder, name, for, action）
    result = result.replace(/\s+(?:title|alt|lang|dir|hidden|disabled|readonly|required|data-\w+)="[^"]*"/gi, '');

    // 4. 合并多余空白
    result = result.replace(/\s+/g, ' ');

    // 5. 删除标签间空白
    result = result.replace(/>\s+</g, '><');

    // 6. 删除多余引号
    result = result.replace(/\s*\/>/g, '/>');

    return result.trim();
}

function processExamFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalSize = Buffer.byteLength(content);

    // 匹配 questionsPageHtml 的值（双引号或单引号）
    const htmlRegex = /("questionsPageHtml"\s*:\s*")((?:[^"\\]|\\.)*)(?=")/g;
    let match;
    let totalSaved = 0;
    let count = 0;

    content = content.replace(htmlRegex, (full, prefix, html) => {
        const minified = minifyHtml(html);
        if (minified.length < html.length) {
            totalSaved += html.length - minified.length;
            count++;
        }
        return prefix + minified;
    });

    // 也处理单引号版本
    const htmlRegexSingle = /('questionsPageHtml'\s*:\s*')((?:[^'\\]|\\.)*)(?=')/g;
    content = content.replace(htmlRegexSingle, (full, prefix, html) => {
        const minified = minifyHtml(html);
        if (minified.length < html.length) {
            totalSaved += html.length - minified.length;
            count++;
        }
        return prefix + minified;
    });

    const newSize = Buffer.byteLength(content);

    if (!DRY_RUN && newSize < originalSize) {
        fs.writeFileSync(filePath, content);
    }

    return { original: originalSize, minified: newSize, saved: originalSize - newSize, fields: count };
}

// === Main ===

console.log('=== 题面 HTML 压缩 ===');
if (DRY_RUN) console.log('(dry-run 模式，不修改文件)\n');

const dirs = [
    { name: '听力', dir: 'assets/generated/listening-exams' },
    { name: '阅读', dir: 'assets/generated/reading-exams' }
];

let totalOriginal = 0;
let totalMinified = 0;
let totalFiles = 0;

for (const { name, dir } of dirs) {
    const fullDir = path.join(ROOT, dir);
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.js') && f !== 'manifest.js');

    console.log(name + ': ' + files.length + ' 文件');

    for (const file of files) {
        const result = processExamFile(path.join(fullDir, file));
        totalOriginal += result.original;
        totalMinified += result.minified;
        totalFiles++;
    }

    const saved = files.reduce((sum, f) => {
        const r = processExamFile(path.join(fullDir, f));
        return sum + r.saved;
    }, 0);
}

const totalSaved = totalOriginal - totalMinified;
console.log('\n总计: ' + totalFiles + ' 文件');
console.log('原始: ' + (totalOriginal / 1024).toFixed(0) + ' KB');
console.log('压缩后: ' + (totalMinified / 1024).toFixed(0) + ' KB');
console.log('节省: ' + (totalSaved / 1024).toFixed(0) + ' KB (' + (totalSaved / totalOriginal * 100).toFixed(1) + '%)');
