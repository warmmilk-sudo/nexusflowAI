#!/usr/bin/env node

/**
 * 智能安装脚本
 * 自动处理依赖安装问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始安装 NexusFlow AI 后端依赖...\n');

// 基础依赖（必需）
const coreDependencies = [
    'cors@^2.8.5',
    'dotenv@^16.4.5', 
    'express@^4.19.2',
    '@google/genai@^1.32.0'
];

// 邮件依赖（可选）
const emailDependencies = [
    'imap@^0.8.19',
    'mailparser@^3.6.5',
    'nodemailer@^6.9.7'
];

function installDependencies(deps, label) {
    console.log(`📦 安装 ${label}...`);
    
    for (const dep of deps) {
        try {
            console.log(`   安装 ${dep}...`);
            execSync(`npm install ${dep}`, { stdio: 'pipe' });
            console.log(`   ✅ ${dep} 安装成功`);
        } catch (error) {
            console.log(`   ❌ ${dep} 安装失败: ${error.message}`);
            if (label === '核心依赖') {
                console.error(`\n💥 核心依赖安装失败，无法继续！`);
                process.exit(1);
            }
        }
    }
}

async function main() {
    try {
        // 检查 Node.js 版本
        const nodeVersion = process.version;
        console.log(`📋 Node.js 版本: ${nodeVersion}`);
        
        if (parseInt(nodeVersion.slice(1)) < 18) {
            console.warn('⚠️ 建议使用 Node.js 18 或更高版本');
        }

        // 安装核心依赖
        installDependencies(coreDependencies, '核心依赖');
        
        console.log('\n🎯 核心依赖安装完成！');
        
        // 尝试安装邮件依赖
        console.log('\n📧 尝试安装邮件依赖（可选）...');
        installDependencies(emailDependencies, '邮件依赖');
        
        console.log('\n✅ 安装完成！');
        console.log('\n🚀 现在可以运行: npm start');
        console.log('📡 健康检查: http://localhost:3001/api/health');
        
    } catch (error) {
        console.error('\n💥 安装过程中出现错误:', error.message);
        console.log('\n🔧 请尝试手动安装:');
        console.log('   npm install cors dotenv express @google/genai');
        process.exit(1);
    }
}

main();