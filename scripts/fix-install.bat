@echo off
echo 🚀 NexusFlow AI 快速修复安装脚本
echo.

echo 📋 检查 Node.js 版本...
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装或版本过低，请安装 Node.js 18+
    pause
    exit /b 1
)

echo.
echo 📦 安装前端依赖...
npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)

echo.
echo 📦 安装后端核心依赖...
cd server
npm run install-safe
if %errorlevel% neq 0 (
    echo ⚠️ 尝试手动安装核心依赖...
    npm install cors dotenv express @google/genai@^1.32.0
)

echo.
echo ✅ 安装完成！
echo.
echo 🚀 现在可以启动服务器：
echo    1. 打开终端1，运行: cd server && npm start
echo    2. 打开终端2，运行: npm run dev
echo    3. 访问: http://localhost:5173
echo.
pause