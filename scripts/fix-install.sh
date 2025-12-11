#!/bin/bash

echo "🚀 NexusFlow AI 快速修复安装脚本"
echo

echo "📋 检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️ Node.js 版本过低 ($NODE_VERSION)，建议升级到 18+"
fi

echo "✅ Node.js 版本: $(node --version)"
echo

echo "📦 安装前端依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi

echo
echo "📦 安装后端核心依赖..."
cd server

# 尝试安全安装
npm run install-safe
if [ $? -ne 0 ]; then
    echo "⚠️ 尝试手动安装核心依赖..."
    npm install cors dotenv express @google/genai@^1.32.0
fi

echo
echo "✅ 安装完成！"
echo
echo "🚀 现在可以启动服务器："
echo "   1. 打开终端1，运行: cd server && npm start"
echo "   2. 打开终端2，运行: npm run dev"
echo "   3. 访问: http://localhost:5173"
echo