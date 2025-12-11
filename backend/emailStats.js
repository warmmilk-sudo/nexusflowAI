/**
 * 邮件统计模块
 * 负责跟踪和管理邮件统计数据
 */

const fs = require('fs');
const path = require('path');

class EmailStats {
    constructor() {
        this.statsFile = path.join(__dirname, 'config', 'emailStats.json');
        this.stats = this.loadStats();
    }

    // 加载统计数据
    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = fs.readFileSync(this.statsFile, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('加载邮件统计失败:', error);
        }
        
        // 默认统计数据
        return {
            totalOutreach: 0,      // 总外发数
            totalReplies: 0,       // 总回复数
            pendingDrafts: 0,      // 待处理草稿数
            activeLeads: 0,        // 活跃线索数
            responseRate: 0,       // 回复率
            lastUpdated: new Date().toISOString(),
            weeklyData: [],        // 每周数据
            contactedEmails: []    // 已联系人邮箱白名单
        };
    }

    // 保存统计数据
    saveStats() {
        try {
            // 确保config目录存在
            const configDir = path.dirname(this.statsFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            this.stats.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
            console.log('✅ 邮件统计已保存');
        } catch (error) {
            console.error('❌ 保存邮件统计失败:', error);
        }
    }

    // 增加外发邮件数
    incrementOutreach(count = 1) {
        this.stats.totalOutreach += count;
        this.updateResponseRate();
        
        // 同时更新今天的每周数据
        this.addWeeklyData(count, 0);
        
        console.log(`📊 外发邮件数 +${count}, 总计: ${this.stats.totalOutreach}`);
    }

    // 增加回复邮件数
    incrementReplies(count = 1) {
        this.stats.totalReplies += count;
        this.updateResponseRate();
        
        // 同时更新今天的每周数据
        this.addWeeklyData(0, count);
        
        console.log(`📊 回复邮件数 +${count}, 总计: ${this.stats.totalReplies}`);
    }

    // 设置待处理草稿数
    setPendingDrafts(count) {
        this.stats.pendingDrafts = count;
        this.saveStats();
        console.log(`📊 待处理草稿数: ${count}`);
    }

    // 设置活跃线索数
    setActiveLeads(count) {
        this.stats.activeLeads = count;
        this.saveStats();
        console.log(`📊 活跃线索数: ${count}`);
    }

    // 更新回复率
    updateResponseRate() {
        if (this.stats.totalOutreach > 0) {
            this.stats.responseRate = Math.round((this.stats.totalReplies / this.stats.totalOutreach) * 100);
        } else {
            this.stats.responseRate = 0;
        }
    }

    // 添加每周数据点
    addWeeklyData(sent, replies) {
        const today = new Date();
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
        const dateStr = today.toISOString().split('T')[0];
        
        // 检查今天是否已有数据
        const existingIndex = this.stats.weeklyData.findIndex(item => item.date === dateStr);
        
        if (existingIndex >= 0) {
            // 更新今天的数据
            this.stats.weeklyData[existingIndex].sent += sent;
            this.stats.weeklyData[existingIndex].replies += replies;
        } else {
            // 添加新的一天数据
            this.stats.weeklyData.push({
                name: dayName,
                sent: sent,
                replies: replies,
                date: dateStr
            });
            
            // 保持最近7天的数据
            if (this.stats.weeklyData.length > 7) {
                this.stats.weeklyData.shift();
            }
        }
        
        this.saveStats();
    }

    // 初始化每周数据（如果为空）
    initializeWeeklyData() {
        if (!this.stats.weeklyData || this.stats.weeklyData.length === 0) {
            const today = new Date();
            const weekData = [];
            
            // 生成过去7天的数据
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                const dateStr = date.toISOString().split('T')[0];
                
                weekData.push({
                    name: dayName,
                    sent: i === 0 ? this.stats.totalOutreach : Math.floor(Math.random() * 3), // 今天显示实际数据，其他天模拟数据
                    replies: i === 0 ? this.stats.totalReplies : Math.floor(Math.random() * 2),
                    date: dateStr
                });
            }
            
            this.stats.weeklyData = weekData;
            this.saveStats();
            console.log('📊 已初始化每周数据');
        }
    }

    // 获取统计数据
    getStats() {
        // 确保每周数据已初始化
        this.initializeWeeklyData();
        
        return {
            ...this.stats,
            responseRateText: `${this.stats.responseRate}%`
        };
    }

    // 添加已联系人邮箱
    addContactedEmail(email) {
        if (!email || typeof email !== 'string') return;
        
        if (!this.stats.contactedEmails) {
            this.stats.contactedEmails = [];
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        if (!this.stats.contactedEmails.includes(normalizedEmail)) {
            this.stats.contactedEmails.push(normalizedEmail);
            this.saveStats();
            console.log(`📊 已添加联系人: ${normalizedEmail}`);
        }
    }

    // 检查是否为已联系人
    isContactedEmail(email) {
        if (!email || typeof email !== 'string') return false;
        if (!this.stats.contactedEmails) {
            this.stats.contactedEmails = [];
        }
        const normalizedEmail = email.toLowerCase().trim();
        return this.stats.contactedEmails.includes(normalizedEmail);
    }

    // 获取已联系人列表
    getContactedEmails() {
        if (!this.stats.contactedEmails) {
            this.stats.contactedEmails = [];
        }
        return [...this.stats.contactedEmails];
    }

    // 重置统计数据
    resetStats() {
        this.stats = {
            totalOutreach: 0,
            totalReplies: 0,
            pendingDrafts: 0,
            activeLeads: 0,
            responseRate: 0,
            lastUpdated: new Date().toISOString(),
            weeklyData: [],
            contactedEmails: []
        };
        this.saveStats();
        console.log('📊 邮件统计已重置');
    }
}

module.exports = EmailStats;