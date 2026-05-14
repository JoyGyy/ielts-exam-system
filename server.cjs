#!/usr/bin/env node
/**
 * IELTS 练习平台 - 本地服务器
 * 双击启动脚本即可运行，自动打开浏览器
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - 文件未找到</h1>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  IELTS 练习平台已启动`);
  console.log(`  地址: ${url}`);
  console.log(`  按 Ctrl+C 停止\n`);

  // 自动打开浏览器
  const platform = process.platform;
  if (platform === 'darwin') exec(`open "${url}"`);
  else if (platform === 'win32') exec(`start "${url}"`);
  else exec(`xdg-open "${url}"`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  端口 ${PORT} 已被占用，请关闭其他程序后重试\n`);
  } else {
    console.error(`\n  启动失败: ${err.message}\n`);
  }
  process.exit(1);
});
