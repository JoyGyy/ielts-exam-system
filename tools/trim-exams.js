#!/usr/bin/env node
/**
 * trim-exams.js — 裁剪题库，只保留高频和次高频题目
 * 删除低频听力数据文件、MP3音频、阅读数据文件
 * 重新生成索引和 manifest
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadIndex(filePath) {
    const ctx = vm.createContext({ console });
    vm.runInContext('var window = {};\n' + fs.readFileSync(filePath, 'utf8'), ctx);
    return ctx.window;
}

function deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

function generateManifest(entries, type) {
    const lines = [];
    if (type === 'listening') {
        lines.push('// 自动生成 - 仅包含高频和次高频听力题目');
        lines.push("globalThis.__LISTENING_EXAM_MANIFEST__ = {");
    } else {
        lines.push('// 自动生成 - 仅包含高频和次高频阅读题目');
        lines.push("globalThis.__READING_EXAM_MANIFEST__ = {");
    }

    for (const entry of entries) {
        const meta = { examId: entry.id, dataKey: entry.id };
        if (type === 'listening') {
            meta.script = './' + entry.id + '.js';
        } else {
            meta.script = './' + entry.id + '.js';
        }
        meta.title = entry.title;
        meta.category = entry.category;
        lines.push('  "' + entry.id + '": ' + JSON.stringify(meta) + ',');
    }

    lines.push('};');
    return lines.join('\n');
}

function generateListeningIndex(entries) {
    const lines = [
        '// 听力题库索引（已裁剪 - 仅高频和次高频）',
        'window.listeningExamIndex = [',
    ];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const comma = i < entries.length - 1 ? ',' : '';
        lines.push('    ' + JSON.stringify(entry, null, 8).replace(/\n/g, '\n    ') + comma);
    }

    lines.push('];');
    return lines.join('\n');
}

function generateReadingIndex(entries) {
    const lines = [
        '// 阅读题库索引（已裁剪 - 仅高频和次高频）',
        'window.completeExamIndex = [',
    ];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const comma = i < entries.length - 1 ? ',' : '';
        lines.push('    ' + JSON.stringify(entry, null, 8).replace(/\n/g, '\n    ') + comma);
    }

    lines.push('];');
    return lines.join('\n');
}

// === Main ===

console.log('=== 题库裁剪脚本 ===\n');

// --- Listening ---
console.log('--- 听力题库 ---');
const listeningCtx = loadIndex(path.join(ROOT, 'assets/scripts/listening-exam-data.js'));
const listeningIndex = listeningCtx.listeningExamIndex;
console.log('原始数量: ' + listeningIndex.length);

const listeningKeep = [];
const listeningDelete = [];
for (const entry of listeningIndex) {
    if (entry.frequency === '高频' || entry.frequency === '次高频') {
        listeningKeep.push(entry);
    } else {
        listeningDelete.push(entry);
    }
}

console.log('保留: ' + listeningKeep.length + ' (高频+次高频)');
console.log('删除: ' + listeningDelete.length + ' (非高频)');

let listeningFilesDeleted = 0;
let audioFilesDeleted = 0;
let audioBytesSaved = 0;

for (const entry of listeningDelete) {
    // Delete data JS file
    const dataFile = path.join(ROOT, 'assets/generated/listening-exams', entry.id + '.js');
    if (deleteFile(dataFile)) listeningFilesDeleted++;

    // Delete MP3
    const mp3File = path.join(ROOT, 'ListeningPractice/audio', entry.id + '.mp3');
    if (fs.existsSync(mp3File)) {
        const stat = fs.statSync(mp3File);
        audioBytesSaved += stat.size;
        deleteFile(mp3File);
        audioFilesDeleted++;
    }
}

console.log('删除数据文件: ' + listeningFilesDeleted);
console.log('删除音频文件: ' + audioFilesDeleted + ' (' + (audioBytesSaved / 1024 / 1024).toFixed(1) + ' MB)');

// Regenerate listening index
const listeningIndexContent = generateListeningIndex(listeningKeep);
fs.writeFileSync(path.join(ROOT, 'assets/scripts/listening-exam-data.js'), listeningIndexContent);
console.log('已更新 listening-exam-data.js');

// Regenerate listening manifest
const listeningManifest = generateManifest(listeningKeep, 'listening');
fs.writeFileSync(path.join(ROOT, 'assets/generated/listening-exams/manifest.js'), listeningManifest);
console.log('已更新 listening manifest');

// --- Reading ---
console.log('\n--- 阅读题库 ---');
const readingCtx = loadIndex(path.join(ROOT, 'assets/scripts/complete-exam-data.js'));
const readingIndex = readingCtx.completeExamIndex || readingCtx.readingExamIndex;
console.log('原始数量: ' + readingIndex.length);

const readingKeep = [];
const readingDelete = [];
for (const entry of readingIndex) {
    if (entry.frequency === '高频' || entry.frequency === '次高频') {
        readingKeep.push(entry);
    } else {
        readingDelete.push(entry);
    }
}

console.log('保留: ' + readingKeep.length + ' (高频+次高频)');
console.log('删除: ' + readingDelete.length + ' (非高频)');

let readingFilesDeleted = 0;

for (const entry of readingDelete) {
    const dataFile = path.join(ROOT, 'assets/generated/reading-exams', entry.id + '.js');
    if (deleteFile(dataFile)) readingFilesDeleted++;
}

console.log('删除数据文件: ' + readingFilesDeleted);

// Regenerate reading index
const readingIndexContent = generateReadingIndex(readingKeep);
fs.writeFileSync(path.join(ROOT, 'assets/scripts/complete-exam-data.js'), readingIndexContent);
console.log('已更新 complete-exam-data.js');

// Regenerate reading manifest
const readingManifest = generateManifest(readingKeep, 'reading');
fs.writeFileSync(path.join(ROOT, 'assets/generated/reading-exams/manifest.js'), readingManifest);
console.log('已更新 reading manifest');

// --- Summary ---
console.log('\n=== 裁剪完成 ===');
console.log('听力: ' + listeningIndex.length + ' → ' + listeningKeep.length);
console.log('阅读: ' + readingIndex.length + ' → ' + readingKeep.length);
console.log('音频节省: ' + (audioBytesSaved / 1024 / 1024).toFixed(1) + ' MB');
console.log('总删除文件: ' + (listeningFilesDeleted + audioFilesDeleted + readingFilesDeleted));
