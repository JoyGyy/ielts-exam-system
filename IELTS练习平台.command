#!/bin/bash
# IELTS 练习平台 - 双击启动
cd "$(dirname "$0")"

# 检查 Node.js 是否安装
if ! command -v node &>/dev/null; then
  echo ""
  echo "========================================="
  echo "  需要先安装 Node.js"
  echo "  请访问: https://nodejs.org"
  echo "  下载 LTS 版本并安装"
  echo "  安装完成后重新双击此文件"
  echo "========================================="
  echo ""
  read -p "按回车键退出..."
  exit 1
fi

# 首次运行时安装依赖
if [ ! -d "node_modules" ]; then
  echo "首次运行，正在安装依赖..."
  npm install --production 2>/dev/null
fi

# 启动服务器
echo "正在启动 IELTS 练习平台..."
node server.cjs
read -p "按回车键退出..."
