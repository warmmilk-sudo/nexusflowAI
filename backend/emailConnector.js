/**
 * 邮件连接器模块
 * 负责通过 IMAP/SMTP 或 Gmail/Outlook API 连接邮箱
 */

// 尝试加载邮件相关依赖，如果失败则使用模拟模式
let ImapFlow, simpleParser, nodemailer;
let emailDependenciesAvailable = true;

try {
    const { ImapFlow: ImapFlowClass } = require('imapflow');
    ImapFlow = ImapFlowClass;
    const mailparser = require('mailparser');
    simpleParser = mailparser.simpleParser;
    nodemailer = require('nodemailer');
} catch (error) {
    console.warn('⚠️ 邮件依赖未安装，将使用模拟模式');
    emailDependenciesAvailable = false;
}

class EmailConnector {
    constructor(config) {
        this.config = config;
        this.imap = null;
        this.transporter = null;
        this.mockMode = !emailDependenciesAvailable;
        
        if (this.mockMode) {
            console.log('⚠️ 邮件依赖未安装，IMAP功能将被禁用，但SMTP发送将尝试使用内置方法');
        }
    }

    /**
     * 初始化 IMAP 连接（用于接收邮件）
     */
    async initIMAP() {
        this.imap = new ImapFlow({
            host: this.config.imapHost || 'imap.gmail.com',
            port: this.config.imapPort || 993,
            secure: true,
            auth: {
                user: this.config.email,
                pass: this.config.password
            },
            logger: false // 禁用详细日志
        });

        try {
            await this.imap.connect();
            console.log('✅ IMAP 连接成功 (ImapFlow)');
        } catch (error) {
            console.error('❌ IMAP 连接错误:', error.message);
            throw error;
        }
    }

    /**
     * 根据邮箱域名自动配置SMTP设置
     */
    getSmtpConfig() {
        const emailDomain = this.config.email.split('@')[1].toLowerCase();
        
        // 常见邮件服务商配置
        const smtpConfigs = {
            'gmail.com': {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'outlook.com': {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'hotmail.com': {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'qq.com': {
                host: 'smtp.qq.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            '163.com': {
                host: 'smtp.163.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'hygeamed.com': {
                host: 'smtp.exmail.qq.com', // 企业邮箱通常使用腾讯企业邮
                port: 465,
                secure: false,
                requireTLS: true
            }
        };

        // 如果用户手动配置了SMTP，优先使用用户配置
        if (this.config.smtpHost) {
            return {
                host: this.config.smtpHost,
                port: this.config.smtpPort || 587,
                secure: this.config.smtpPort === 465,
                requireTLS: true
            };
        }

        // 否则根据域名自动配置
        return smtpConfigs[emailDomain] || {
            host: 'smtp.' + emailDomain,
            port: 587,
            secure: false,
            requireTLS: true
        };
    }

    /**
     * 初始化 SMTP 连接（用于发送邮件）
     */
    initSMTP() {
        // 直接使用用户配置，不依赖getSmtpConfig的自动配置
        const isSSL = this.config.smtpPort === 465;
        const smtpConfig = {
            host: this.config.smtpHost,
            port: this.config.smtpPort,
            secure: isSSL,
            requireTLS: !isSSL
        };
        
        this.transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: {
                user: this.config.email,
                pass: this.config.password
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log(`✅ SMTP 传输器已初始化 - ${smtpConfig.host}:${smtpConfig.port} (secure: ${smtpConfig.secure})`);
    }

    /**
     * 监听新邮件
     * @param {Function} callback - 收到新邮件时的回调函数
     */
    async listenForNewEmails(callback) {
        try {
            if (!this.imap) {
                await this.initIMAP();
            }

            // 确保连接是活跃的
            if (!this.imap.usable) {
                await this.imap.connect();
            }

            // 选择收件箱并监听新邮件
            const lock = await this.imap.getMailboxLock('INBOX');
            
            try {
                const status = await this.imap.status('INBOX', { messages: true });
                console.log(`📬 监听收件箱，当前邮件数: ${status.messages}`);

                // 监听新邮件事件
                this.imap.on('exists', async (data) => {
                    console.log(`📨 收到新邮件通知`);
                    try {
                        // 获取最新的邮件
                        const newEmails = await this.fetchRecentEmails(1);
                        newEmails.forEach(email => callback(email));
                    } catch (error) {
                        console.error('处理新邮件失败:', error.message);
                    }
                });

            } finally {
                lock.release();
            }

        } catch (error) {
            console.error('监听新邮件失败:', error.message);
        }
    }

    /**
     * 获取最近的邮件（用于收件箱显示）
     * @param {Number} count - 获取邮件数量
     * @returns {Promise<Array>} 邮件数组
     */
    async fetchRecentEmails(count = 20) {
        if (this.mockMode) {
            return []; // 模拟模式返回空数组
        }

        try {
            if (!this.imap) {
                await this.initIMAP();
            }

            // 确保连接是活跃的
            if (!this.imap.usable) {
                await this.imap.connect();
            }

            // 选择收件箱
            const lock = await this.imap.getMailboxLock('INBOX');
            
            try {
                // 获取邮箱状态
                const status = await this.imap.status('INBOX', { messages: true });
                const totalMessages = status.messages;

                if (totalMessages === 0) {
                    return [];
                }

                // 计算要获取的邮件范围
                const startSeq = Math.max(1, totalMessages - count + 1);
                const endSeq = totalMessages;

                // 获取邮件
                const messages = [];
                for await (let message of this.imap.fetch(`${startSeq}:${endSeq}`, {
                    envelope: true,
                    bodyStructure: true,
                    source: true
                })) {
                    try {
                        // 先创建基本邮件对象
                        const email = {
                            id: `email-${message.uid}-${Date.now()}`,
                            fromName: message.envelope.from?.[0]?.name || message.envelope.from?.[0]?.address || 'Unknown',
                            fromEmail: message.envelope.from?.[0]?.address || 'unknown@example.com',
                            subject: message.envelope.subject || 'No Subject',
                            content: '',
                            receivedAt: this.formatDate(message.envelope.date),
                            status: 'unread',
                            attachments: []
                        };
                        
                        // 简单的相关性检查（基于主题和发件人）
                        if (this.isRelevantEmailSimple(email)) {
                            // 提取邮件内容 - 使用更稳定的方法
                            try {
                                let content = '';
                                
                                // 直接从source提取文本，避免simpleParser兼容性问题
                                if (message.source) {
                                    content = this.extractTextFromSource(message.source);
                                }
                                
                                // 如果没有获取到内容，使用基于主题的摘要
                                if (!content.trim()) {
                                    content = `来自 ${email.fromName} 的邮件：${email.subject}`;
                                }
                                
                                email.content = content;
                            } catch (contentError) {
                                console.error('邮件内容提取失败:', contentError.message);
                                email.content = `来自 ${email.fromName} 的邮件：${email.subject}`;
                            }
                            
                            messages.push(email);
                        }
                    } catch (parseError) {
                        console.error('邮件处理错误:', parseError.message);
                    }
                }

                // 按时间倒序排列
                messages.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
                return messages;

            } finally {
                lock.release();
            }

        } catch (error) {
            console.error('获取邮件失败:', error.message);
            return [];
        }
    }

    /**
     * 从邮件源码中提取文本内容（改进版 - 避免simpleParser兼容性问题）
     * @param {Buffer|String} source - 邮件源码
     * @returns {String} 提取的文本内容
     */
    extractTextFromSource(source) {
        try {
            const sourceStr = Buffer.isBuffer(source) ? source.toString('utf8') : source.toString();
            
            // 多种策略提取文本内容
            let content = '';
            
            // 策略1: 查找纯文本部分
            content = this.extractPlainTextPart(sourceStr);
            
            // 策略2: 如果没有找到纯文本，尝试从HTML中提取
            if (!content.trim()) {
                content = this.extractFromHtmlPart(sourceStr);
            }
            
            // 策略3: 如果还是没有，尝试简单的文本提取
            if (!content.trim()) {
                content = this.extractSimpleText(sourceStr);
            }
            
            // 策略4: 最后的备用方案 - 基于主题的内容
            if (!content.trim()) {
                content = this.extractBasicInfo(sourceStr);
            }
            
            // 清理和格式化内容
            if (content.trim()) {
                content = content
                    .replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/^\s+|\s+$/gm, '') // 清理每行的前后空格
                    .trim();
                
                // 限制长度
                if (content.length > 800) {
                    content = content.substring(0, 800) + '...';
                }
            }
            
            return content || '';
            
        } catch (error) {
            console.error('文本提取错误:', error.message);
            return '';
        }
    }

    /**
     * 提取纯文本部分
     */
    extractPlainTextPart(sourceStr) {
        const lines = sourceStr.split('\n');
        let inTextPart = false;
        let isBase64 = false;
        let isQuotedPrintable = false;
        let textLines = [];
        let foundTextType = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查内容类型
            if (line.toLowerCase().includes('content-type: text/plain')) {
                foundTextType = true;
                inTextPart = false; // 等待空行
                continue;
            }
            
            // 检查编码
            if (foundTextType && line.toLowerCase().includes('content-transfer-encoding: base64')) {
                isBase64 = true;
                continue;
            }
            
            if (foundTextType && line.toLowerCase().includes('content-transfer-encoding: quoted-printable')) {
                isQuotedPrintable = true;
                continue;
            }
            
            // 空行表示头部结束，开始内容
            if (foundTextType && line.trim() === '' && !inTextPart) {
                inTextPart = true;
                continue;
            }
            
            // 边界线表示部分结束
            if (line.startsWith('--') && textLines.length > 0) {
                break;
            }
            
            // 收集文本内容
            if (inTextPart && !line.startsWith('--')) {
                textLines.push(line);
            }
        }
        
        let content = textLines.join('\n');
        
        // 解码内容
        if (isBase64 && content.trim()) {
            try {
                content = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf8');
            } catch (e) {
                // Base64解码失败，保持原内容
            }
        }
        
        if (isQuotedPrintable && content.trim()) {
            content = content
                .replace(/=\r?\n/g, '')
                .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        
        return content;
    }

    /**
     * 从HTML部分提取文本
     */
    extractFromHtmlPart(sourceStr) {
        const htmlMatch = sourceStr.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]*?)(?=\n--|\n\r\n--|\r\n--|\Z)/i);
        if (htmlMatch) {
            let htmlContent = htmlMatch[1];
            // 简单的HTML标签清理
            return htmlContent
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
        }
        return '';
    }

    /**
     * 简单文本提取（备用方案）
     */
    extractSimpleText(sourceStr) {
        const lines = sourceStr.split('\n');
        let textLines = [];
        let skipHeaders = true;
        
        for (let line of lines) {
            // 跳过邮件头部
            if (skipHeaders) {
                if (line.trim() === '') {
                    skipHeaders = false;
                }
                continue;
            }
            
            // 跳过MIME边界和头部信息
            if (line.startsWith('--') || 
                line.startsWith('Content-') || 
                line.startsWith('MIME-Version')) {
                continue;
            }
            
            // 收集看起来像正文的内容
            if (line.trim() && 
                !line.includes('boundary=') && 
                !line.includes('charset=')) {
                textLines.push(line.trim());
            }
        }
        
        return textLines.join('\n');
    }

    /**
     * 提取基本信息（最后的备用方案）
     */
    extractBasicInfo(sourceStr) {
        try {
            // 尝试从邮件头部提取基本信息
            const subjectMatch = sourceStr.match(/^Subject:\s*(.+)$/m);
            const fromMatch = sourceStr.match(/^From:\s*(.+)$/m);
            
            let content = '';
            if (subjectMatch) {
                content += `主题: ${subjectMatch[1].trim()}\n`;
            }
            if (fromMatch) {
                content += `发件人: ${fromMatch[1].trim()}\n`;
            }
            
            // 尝试找到邮件正文的开始位置
            const bodyStartIndex = sourceStr.indexOf('\n\n');
            if (bodyStartIndex > 0) {
                const bodyPart = sourceStr.substring(bodyStartIndex + 2);
                const lines = bodyPart.split('\n').slice(0, 10); // 取前10行
                const bodyText = lines
                    .filter(line => line.trim() && !line.startsWith('--'))
                    .join('\n')
                    .substring(0, 200);
                
                if (bodyText.trim()) {
                    content += `\n内容摘要: ${bodyText.trim()}`;
                }
            }
            
            return content || '邮件内容解析中...';
        } catch (error) {
            console.error('基本信息提取错误:', error.message);
            return '邮件内容解析中...';
        }
    }

    /**
     * 解析MIME内容
     * @param {String} mimeContent - MIME格式的邮件内容
     * @returns {String} 解析后的文本内容
     */
    parseMimeContent(mimeContent) {
        try {
            // 查找文本内容部分
            const lines = mimeContent.split('\n');
            let content = '';
            let inTextPart = false;
            let isBase64 = false;
            let isQuotedPrintable = false;
            
            for (let line of lines) {
                // 检查是否是文本内容类型
                if (line.includes('Content-Type: text/plain')) {
                    inTextPart = true;
                    continue;
                }
                
                // 检查编码类型
                if (line.includes('Content-Transfer-Encoding: base64')) {
                    isBase64 = true;
                    continue;
                }
                
                if (line.includes('Content-Transfer-Encoding: quoted-printable')) {
                    isQuotedPrintable = true;
                    continue;
                }
                
                // 跳过头部信息
                if (line.startsWith('Content-') || line.startsWith('MIME-Version') || line.trim() === '') {
                    continue;
                }
                
                // 如果遇到边界，停止或重置
                if (line.startsWith('--')) {
                    if (content.trim()) {
                        break; // 已经有内容了，停止
                    }
                    inTextPart = false;
                    isBase64 = false;
                    isQuotedPrintable = false;
                    continue;
                }
                
                // 收集文本内容
                if (inTextPart || (!line.startsWith('Content-') && !line.startsWith('MIME-'))) {
                    content += line + '\n';
                }
            }
            
            // 解码内容
            if (isBase64 && content.trim()) {
                try {
                    content = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
                } catch (e) {
                    // Base64解码失败，使用原始内容
                }
            }
            
            if (isQuotedPrintable && content.trim()) {
                // 简单的quoted-printable解码
                content = content
                    .replace(/=\r?\n/g, '')
                    .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
            }
            
            // 清理内容
            content = content
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            
            // 限制长度
            if (content.length > 500) {
                content = content.substring(0, 500) + '...';
            }
            
            return content || '邮件内容为空';
            
        } catch (error) {
            console.error('MIME解析错误:', error.message);
            return '邮件内容解析失败';
        }
    }

    /**
     * 提取邮件内容
     * @param {Object} parsed - 解析后的邮件对象
     * @returns {String} 邮件内容
     */
    extractEmailContent(parsed) {
        let content = '';
        
        // 优先使用纯文本内容
        if (parsed.text) {
            content = parsed.text.trim();
        } 
        // 如果没有纯文本，尝试从HTML中提取
        else if (parsed.html) {
            // 简单的HTML标签清理
            content = parsed.html
                .replace(/<[^>]*>/g, '') // 移除HTML标签
                .replace(/&nbsp;/g, ' ') // 替换HTML空格
                .replace(/&lt;/g, '<')   // 替换HTML实体
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')    // 合并多个空格
                .trim();
        }
        
        // 如果内容太长，截取前500个字符
        if (content.length > 500) {
            content = content.substring(0, 500) + '...';
        }
        
        return content || '邮件内容为空';
    }

    /**
     * 简化的邮件相关性检查（基于envelope信息）
     * @param {Object} email - 邮件对象
     * @returns {Boolean} 是否相关
     */
    isRelevantEmailSimple(email) {
        const subject = (email.subject || '').toLowerCase();
        const fromEmail = (email.fromEmail || '').toLowerCase();

        // 垃圾邮件关键词（排除）
        const spamKeywords = [
            'unsubscribe', 'marketing', 'promotion', 'advertisement', 
            'casino', 'lottery', 'winner', 'congratulations',
            '退订', '营销', '推广', '广告', '中奖', '恭喜'
        ];

        // 相关关键词（包含）
        const relevantKeywords = [
            'medical', 'device', 'hospital', 'doctor', 'patient', 'treatment',
            'ablation', 'cryoablation', 'probe', 'needle', 'surgery', 'procedure',
            'inquiry', 'question', 'specification', 'training', 'demo', 'meeting',
            '医疗', '设备', '医院', '医生', '患者', '治疗', '消融', '探针', '手术',
            '咨询', '问题', '规格', '培训', '演示', '会议', '合作', '产品', 'epic', 'ai'
        ];

        // 检查是否包含垃圾邮件关键词
        const hasSpamKeywords = spamKeywords.some(keyword => 
            subject.includes(keyword)
        );

        if (hasSpamKeywords) {
            return false;
        }

        // 检查是否包含相关关键词
        const hasRelevantKeywords = relevantKeywords.some(keyword => 
            subject.includes(keyword)
        );

        // 如果来自已知的医疗机构域名，也认为相关
        const medicalDomains = [
            'hospital.com', 'clinic.com', 'medical.com', 'mayo.edu', 'jhmi.edu',
            'stanford.edu', 'harvard.edu', 'ucsf.edu', 'med.', '.hospital',
            '.clinic', '.medical', 'hygeamed.com', 'gmail.com' // 临时包含gmail用于测试
        ];

        const isFromMedicalDomain = medicalDomains.some(domain => 
            fromEmail.includes(domain)
        );

        return hasRelevantKeywords || isFromMedicalDomain;
    }

    /**
     * 判断邮件是否相关（过滤垃圾邮件和无关邮件）
     * @param {Object} parsed - 解析后的邮件对象
     * @returns {Boolean} 是否相关
     */
    isRelevantEmail(parsed) {
        const subject = (parsed.subject || '').toLowerCase();
        const content = (parsed.text || parsed.html || '').toLowerCase();
        const fromEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();

        // 垃圾邮件关键词（排除）
        const spamKeywords = [
            'unsubscribe', 'marketing', 'promotion', 'advertisement', 
            'casino', 'lottery', 'winner', 'congratulations',
            '退订', '营销', '推广', '广告', '中奖', '恭喜'
        ];

        // 相关关键词（包含）
        const relevantKeywords = [
            'medical', 'device', 'hospital', 'doctor', 'patient', 'treatment',
            'ablation', 'cryoablation', 'probe', 'needle', 'surgery', 'procedure',
            'inquiry', 'question', 'specification', 'training', 'demo', 'meeting',
            '医疗', '设备', '医院', '医生', '患者', '治疗', '消融', '探针', '手术',
            '咨询', '问题', '规格', '培训', '演示', '会议', '合作', '产品'
        ];

        // 检查是否包含垃圾邮件关键词
        const hasSpamKeywords = spamKeywords.some(keyword => 
            subject.includes(keyword) || content.includes(keyword)
        );

        if (hasSpamKeywords) {
            return false;
        }

        // 检查是否包含相关关键词
        const hasRelevantKeywords = relevantKeywords.some(keyword => 
            subject.includes(keyword) || content.includes(keyword)
        );

        // 如果来自已知的医疗机构域名，也认为相关
        const medicalDomains = [
            'hospital.com', 'clinic.com', 'medical.com', 'mayo.edu', 'jhmi.edu',
            'stanford.edu', 'harvard.edu', 'ucsf.edu', 'med.', '.hospital',
            '.clinic', '.medical'
        ];

        const isFromMedicalDomain = medicalDomains.some(domain => 
            fromEmail.includes(domain)
        );

        return hasRelevantKeywords || isFromMedicalDomain;
    }

    /**
     * 格式化日期显示
     * @param {Date} date - 日期对象
     * @returns {String} 格式化后的日期字符串
     */
    formatDate(date) {
        if (!date) return 'Unknown';
        
        const now = new Date();
        const emailDate = new Date(date);
        const diffMs = now - emailDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) {
            return 'Just now';
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return emailDate.toLocaleDateString();
        }
    }

    /**
     * 获取最新的邮件（回调版本，用于实时监听）
     * @param {Number} count - 获取邮件数量
     * @param {Function} callback - 处理邮件的回调函数
     */
    async fetchLatestEmails(count, callback) {
        try {
            // 使用新的fetchRecentEmails方法
            const emails = await this.fetchRecentEmails(count);
            emails.forEach(email => {
                console.log(`📧 解析邮件: ${email.subject}`);
                callback(email);
            });
        } catch (error) {
            console.error('获取最新邮件失败:', error.message);
        }
    }

    /**
     * 发送邮件
     * @param {Object} mailOptions - 邮件选项
     * @returns {Promise}
     */
    async sendEmail(mailOptions) {
        // 如果邮件依赖不可用，直接抛出错误
        if (this.mockMode) {
            throw new Error('邮件依赖包未安装，无法发送邮件。请运行: npm install nodemailer imap mailparser');
        }

        if (!this.transporter) {
            this.initSMTP();
        }

        try {
            const info = await this.transporter.sendMail({
                from: `"${this.config.senderName || 'NexusFlow AI'}" <${this.config.email}>`,
                to: mailOptions.to,
                subject: mailOptions.subject,
                text: mailOptions.text,
                html: mailOptions.html
            });

            console.log('✅ 邮件发送成功:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ 邮件发送失败:', error);
            throw new Error(`邮件发送失败: ${error.message}`);
        }
    }



    /**
     * 关闭连接
     */
    async disconnect() {
        if (this.imap && this.imap.usable) {
            try {
                await this.imap.logout();
                console.log('📪 IMAP 连接已关闭');
            } catch (error) {
                console.error('关闭IMAP连接时出错:', error.message);
            }
        }
    }
}

// 模拟邮件连接器（用于开发测试）
class MockEmailConnector {
    constructor(config = {}) {
        this.config = config;
        this.mockEmails = [
            {
                id: 'mock-1',
                fromName: 'Dr. Zhang Wei',
                fromEmail: 'zhang.wei@hospital.com',
                subject: '术后发烧咨询',
                content: '您好，我是上周做了消融手术的患者，现在体温37.8度，请问这正常吗？需要来医院复查吗？',
                receivedAt: new Date(),
                attachments: []
            },
            {
                id: 'mock-2',
                fromName: 'Patient Li Ming',
                fromEmail: 'liming@email.com',
                subject: '预约复查时间',
                content: '医生您好，我想预约下周三的复查，请问有空位吗？',
                receivedAt: new Date(),
                attachments: []
            }
        ];
    }

    listenForNewEmails(callback) {
        console.log('🔧 使用模拟邮件连接器（开发模式）');
        
        // 模拟每30秒收到一封新邮件
        setInterval(() => {
            const randomEmail = this.mockEmails[Math.floor(Math.random() * this.mockEmails.length)];
            const email = {
                ...randomEmail,
                id: `mock-${Date.now()}`,
                receivedAt: new Date()
            };
            console.log(`📨 模拟收到新邮件: ${email.subject}`);
            callback(email);
        }, 30000);
    }

    async sendEmail(mailOptions) {
        // 如果有真实的邮件配置，尝试真实发送
        if (this.config && this.config.email && this.config.password) {
            return await this.sendRealEmail(mailOptions);
        }
        
        // 否则抛出错误，要求配置邮箱
        throw new Error('邮箱未配置，请在设置页面配置邮箱信息后再发送邮件');
    }

    /**
     * 根据邮箱域名自动配置SMTP设置
     */
    getSmtpConfig() {
        const emailDomain = this.config.email.split('@')[1].toLowerCase();
        
        // 常见邮件服务商配置
        const smtpConfigs = {
            'gmail.com': {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'outlook.com': {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'hotmail.com': {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'qq.com': {
                host: 'smtp.qq.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            '163.com': {
                host: 'smtp.163.com',
                port: 587,
                secure: false,
                requireTLS: true
            },
            'hygeamed.com': {
                host: 'smtp.exmail.qq.com', // 企业邮箱通常使用腾讯企业邮
                port: 587,
                secure: false,
                requireTLS: true
            }
        };

        // 如果用户手动配置了SMTP，优先使用用户配置
        if (this.config.smtpHost) {
            return {
                host: this.config.smtpHost,
                port: this.config.smtpPort || 587,
                secure: this.config.smtpPort === 465,
                requireTLS: true
            };
        }

        // 否则根据域名自动配置
        return smtpConfigs[emailDomain] || {
            host: 'smtp.' + emailDomain,
            port: 587,
            secure: false,
            requireTLS: true
        };
    }

    /**
     * 真实邮件发送（使用nodemailer）
     */
    async sendRealEmail(mailOptions) {
        // 检查是否有nodemailer依赖
        let nodemailer;
        try {
            nodemailer = require('nodemailer');
        } catch (error) {
            throw new Error('nodemailer依赖包未安装，无法发送邮件。请运行: npm install nodemailer');
        }
        
        console.log('📤 使用真实SMTP发送邮件:');
        console.log(`  发件人: ${this.config.email}`);
        console.log(`  收件人: ${mailOptions.to}`);
        console.log(`  主题: ${mailOptions.subject}`);
        
        // 获取SMTP配置
        const smtpConfig = this.getSmtpConfig();
        console.log(`  SMTP服务器: ${smtpConfig.host}:${smtpConfig.port}`);
        
        // 创建SMTP传输器
        const transporter = nodemailer.createTransport({
            ...smtpConfig,
            auth: {
                user: this.config.email,
                pass: this.config.password
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        try {
            const info = await transporter.sendMail({
                from: `"${this.config.senderName || 'NexusFlow AI'}" <${this.config.email}>`,
                to: mailOptions.to,
                subject: mailOptions.subject,
                text: mailOptions.text,
                html: mailOptions.html
            });

            console.log('✅ 邮件真实发送成功:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ 真实邮件发送失败:', error.message);
            throw new Error(`邮件发送失败: ${error.message}`);
        }
    }

    disconnect() {
        console.log('🔌 模拟连接器已断开');
    }
}

module.exports = { EmailConnector, MockEmailConnector };
