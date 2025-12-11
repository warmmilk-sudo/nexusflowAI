const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const axios = require('axios');
const { MockEmailConnector } = require('./emailConnector');
const { createDefaultKnowledgeBase } = require('./ragEngine');

// 加载活动提示词配置
let campaignPrompts = {};
try {
    const promptsPath = path.join(__dirname, 'config', 'campaignPrompts.json');
    campaignPrompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
} catch (error) {
    console.error('❌ 无法加载活动提示词配置:', error);
    campaignPrompts = { campaignFocus: {} };
}



const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// 火山引擎API配置 - 从环境变量读取
const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY;
const VOLCENGINE_API_BASE = process.env.VOLCENGINE_API_BASE;
const REASONING_MODEL = process.env.REASONING_MODEL;

// 火山引擎API调用函数
async function callVolcengineAPI(messages, model = REASONING_MODEL) {
    if (!VOLCENGINE_API_KEY || !VOLCENGINE_API_BASE || !model) {
        throw new Error('Missing required environment variables: VOLCENGINE_API_KEY, VOLCENGINE_API_BASE, REASONING_MODEL');
    }
    
    try {
        const response = await axios.post(`${VOLCENGINE_API_BASE}/chat/completions`, {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${VOLCENGINE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('火山引擎API调用错误:', error.response?.data || error.message);
        throw error;
    }
}



// 初始化邮件连接器和 RAG 引擎
let emailConnector = null;
let ragEngine = null;

// 启动时初始化
(async () => {
    // 初始化邮件连接器（支持后续配置真实邮箱）
    emailConnector = new MockEmailConnector();
    
    // 初始化 RAG 引擎
    ragEngine = await createDefaultKnowledgeBase();
    
    console.log('✅ 系统初始化完成');
})();



// API: Generate Outbound Draft
app.post('/api/outbound/generate', async (req, res) => {
    try {
        const { customer, focus, productContext, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';

        // 使用 RAG 引擎获取相关产品信息
        let knowledgeContext = 'No specific product information available.';
        if (ragEngine) {
            const searchQuery = `${focus} ${customer.position} ${customer.painPoint || ''} medical device cryoablation`;
            knowledgeContext = await ragEngine.getContextSummary(searchQuery, VOLCENGINE_API_KEY);
        }

        // 根据语言设置选择提示词
        const languageInstructions = userLanguage === 'en' 
            ? `Write the email in English. Keep it professional, concise, and personalized.`
            : `用中文写邮件。保持专业、简洁和个性化。`;

        // 从配置文件获取活动焦点的提示词
        let focusSpecificInstructions = '';
        const focusConfig = campaignPrompts.campaignFocus[focus];
        if (focusConfig) {
            focusSpecificInstructions = focusConfig[userLanguage] || focusConfig['en'] || '';
        } else {
            // 默认提示词
            focusSpecificInstructions = userLanguage === 'en'
                ? `Provide a comprehensive overview of all products in the knowledge base and their benefits for their medical specialty.`
                : `为其医疗专科提供知识库中所有产品的全面概述和优势。`;
        }

        const prompt = `
            You are an expert medical device sales copywriter specializing in the AI Epic™ Co-Ablation System.
            
            **Language Requirement:** ${languageInstructions}
            
            **Product Knowledge Base:**
            ${knowledgeContext}
            
            **Campaign Focus:** ${focus}
            ${focusSpecificInstructions}
            
            **Sender Context:**
            ${productContext}

            **Recipient:**
            Name: ${customer.name}
            Role: ${customer.position}
            Company: ${customer.company}
            Specific Pain Point (if known): ${customer.painPoint || 'General industry challenges'}

            **Email Structure:**
            1. Personalized greeting addressing their role and institution
            2. Brief context relevant to their specialty
            3. Main content following the campaign focus instructions above
            4. Clear call-to-action (schedule demo, request information, etc.)
            5. Professional closing

            **Important:**
            - Return ONLY the email body text. Do not include subject lines or signature placeholders.
            - Tone: Professional, knowledgeable, consultative (not pushy sales)
            - Length: 150-250 words (concise but informative)
            - Use the specified language (${userLanguage === 'en' ? 'English' : 'Chinese'}) throughout
            - Make it highly relevant to their specific role and institution
        `;

        const messages = [
            {
                role: "user",
                content: prompt
            }
        ];

        const response = await callVolcengineAPI(messages);
        res.json({ draft: response });
    } catch (error) {
        console.error("Outbound Error:", error.message);
        res.status(500).json({ error: "Failed to generate draft" });
    }
});

// API: Analyze & Draft Inbound (增强版 - 使用 RAG)
app.post('/api/inbound/analyze', async (req, res) => {
    try {
        const { email, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';

        // 使用 RAG 引擎检索相关知识
        let knowledgeContext = userLanguage === 'en' 
            ? 'No relevant information found in knowledge base.'
            : '知识库中暂无相关信息。';
        if (ragEngine) {
            knowledgeContext = await ragEngine.getContextSummary(email.content, VOLCENGINE_API_KEY);
        }

        // 根据语言设置选择提示词
        const systemPrompt = userLanguage === 'en' 
            ? `You are an intelligent customer service assistant.
            
            **Task:**
            1. Analyze email intent (Sales/Technical/Support/Spam)
            2. Draft a professional, polite reply based on knowledge base content
            
            **Received Email:**
            From: ${email.fromName}
            Subject: ${email.subject}
            Content: ${email.content}

            **Knowledge Base Context:**
            ${knowledgeContext}

            **Output Format:**
            Return JSON format:
            {
                "intent": "Sales" | "Technical" | "Support" | "Spam",
                "draft": "Email reply content in English...",
                "confidence": confidence score (0-100),
                "sources": ["Referenced knowledge base document names"]
            }`
            : `你是一个智能客服助手。
            
            **任务:**
            1. 分析邮件意图（Sales/Technical/Support/Spam）
            2. 基于知识库内容草拟专业、礼貌的回复
            
            **收到的邮件:**
            发件人: ${email.fromName}
            主题: ${email.subject}
            内容: ${email.content}

            **知识库上下文:**
            ${knowledgeContext}

            **输出格式:**
            返回 JSON 格式:
            {
                "intent": "Sales" | "Technical" | "Support" | "Spam",
                "draft": "邮件回复正文（用中文）...",
                "confidence": 置信度分数 (0-100),
                "sources": ["引用的知识库文档名称"]
            }`;

        const messages = [
            {
                role: "user",
                content: systemPrompt
            }
        ];

        const response = await callVolcengineAPI(messages);

        // 尝试解析JSON响应，如果失败则提供默认响应
        let result;
        try {
            result = JSON.parse(response);
        } catch (parseError) {
            console.error('JSON解析失败，使用默认响应:', parseError);
            result = {
                intent: "Technical",
                draft: response, // 使用原始文本作为草稿
                confidence: 75,
                sources: []
            };
        }
        
        res.json(result);
    } catch (error) {
        console.error("Inbound Error:", error.message);
        
        // 根据语言返回不同的fallback响应
        const userLanguage = req.body.language || req.headers['x-language'] || 'zh';
        const fallbackDraft = userLanguage === 'en'
            ? "Thank you for your email. We are reviewing your request and will respond shortly."
            : "感谢您的来信。我们正在审核您的请求，会尽快回复您。";
        
        res.json({
            intent: "Support",
            draft: fallbackDraft,
            confidence: 0,
            sources: []
        });
    }
});

// API: 生成邮件摘要
app.post('/api/email/summarize', async (req, res) => {
    try {
        const { email, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';

        // 根据语言设置选择提示词
        const prompt = userLanguage === 'en'
            ? `
            Please summarize the core content of the following email in one sentence (no more than 50 words):
            
            Subject: ${email.subject}
            Content: ${email.content}
            
            Return only the summary text in English, nothing else.
            `
            : `
            请用一句话（不超过50字）总结以下邮件的核心内容：
            
            主题: ${email.subject}
            内容: ${email.content}
            
            只返回摘要文本，不要其他内容。
            `;

        const messages = [
            {
                role: "user",
                content: prompt
            }
        ];

        const response = await callVolcengineAPI(messages);
        res.json({ summary: response.trim() });
    } catch (error) {
        console.error("Summarize Error:", error.message);
        const { email, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';
        const fallback = userLanguage === 'en' ? 'Unable to generate summary' : '无法生成摘要';
        res.json({ summary: email?.subject || fallback });
    }
});

// API: 发送邮件
app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, content } = req.body;
        
        if (!emailConnector) {
            return res.status(503).json({ error: '邮件服务未初始化' });
        }

        const result = await emailConnector.sendEmail({
            to,
            subject,
            text: content,
            html: content.replace(/\n/g, '<br>')
        });

        res.json(result);
    } catch (error) {
        console.error("Send Email Error:", error.message);
        res.status(500).json({ error: '发送邮件失败' });
    }
});

// API: 获取知识库统计
app.get('/api/knowledge/stats', (req, res) => {
    if (!ragEngine) {
        return res.status(503).json({ error: 'RAG 引擎未初始化' });
    }

    const stats = ragEngine.getStats();
    res.json(stats);
});

// API: 上传知识库文档
app.post('/api/knowledge/upload', async (req, res) => {
    try {
        const { filename, content } = req.body;
        
        if (!ragEngine) {
            return res.status(503).json({ error: 'RAG 引擎未初始化' });
        }

        const result = await ragEngine.addDocument(filename, content);
        res.json(result);
    } catch (error) {
        console.error("Upload Document Error:", error.message);
        res.status(500).json({ error: '上传文档失败' });
    }
});

// API: 删除知识库文档
app.delete('/api/knowledge/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        if (!ragEngine) {
            return res.status(503).json({ error: 'RAG 引擎未初始化' });
        }

        const result = await ragEngine.deleteDocument(filename);
        res.json(result);
    } catch (error) {
        console.error("Delete Document Error:", error.message);
        res.status(500).json({ error: '删除文档失败' });
    }
});

// API: 搜索知识库
app.post('/api/knowledge/search', async (req, res) => {
    try {
        const { query, topK = 3 } = req.body;
        
        if (!ragEngine) {
            return res.status(503).json({ error: 'RAG 引擎未初始化' });
        }

        const results = await ragEngine.search(query, topK, VOLCENGINE_API_KEY);
        res.json({ results });
    } catch (error) {
        console.error("Search Error:", error.message);
        res.status(500).json({ error: '搜索失败' });
    }
});

// API: 重新生成缺失的向量
app.post('/api/knowledge/regenerate-vectors', async (req, res) => {
    try {
        if (!ragEngine) {
            return res.status(503).json({ error: 'RAG 引擎未初始化' });
        }

        // 异步执行向量生成，不阻塞响应
        ragEngine.generateMissingEmbeddings().catch(error => {
            console.error('重新生成向量失败:', error);
        });

        res.json({ 
            success: true, 
            message: '开始重新生成缺失的向量',
            model: ragEngine.embeddingModel
        });
    } catch (error) {
        console.error("Regenerate Vectors Error:", error.message);
        res.status(500).json({ error: '重新生成向量失败' });
    }
});

// API: 获取RAG配置状态
app.get('/api/knowledge/config', (req, res) => {
    if (!ragEngine) {
        return res.status(503).json({ error: 'RAG 引擎未初始化' });
    }

    const stats = ragEngine.getStats();
    res.json({
        embeddingModel: ragEngine.embeddingModel,
        vectorStoreSize: ragEngine.vectorStore.size,
        documentsCount: ragEngine.documents.length,
        totalChunks: stats.totalChunks,
        vectorCoverage: stats.vectorCoverage
    });
});

// API: 配置邮箱设置
app.post('/api/email/configure', async (req, res) => {
    try {
        const { email, password, imapHost, smtpHost, senderName } = req.body;
        
        // 尝试创建真实的邮件连接器
        const { EmailConnector, MockEmailConnector } = require('./emailConnector');
        
        try {
            const newEmailConnector = new EmailConnector({
                email,
                password,
                imapHost: imapHost || 'imap.gmail.com',
                smtpHost: smtpHost || 'smtp.gmail.com',
                senderName: senderName || 'NexusFlow AI'
            });
            
            // 如果EmailConnector可用，使用它
            if (!newEmailConnector.mockMode) {
                newEmailConnector.initSMTP();
                emailConnector = newEmailConnector;
                console.log('✅ 邮箱配置已更新 (真实SMTP)');
            } else {
                // 如果依赖不可用，使用MockEmailConnector但传入真实配置
                emailConnector = new MockEmailConnector({
                    email,
                    password,
                    imapHost: imapHost || 'imap.gmail.com',
                    smtpHost: smtpHost || 'smtp.gmail.com',
                    senderName: senderName || 'NexusFlow AI'
                });
                console.log('✅ 邮箱配置已更新 (模拟模式，但会尝试真实发送)');
            }
            
            res.json({ success: true, message: '邮箱配置成功' });
            
        } catch (error) {
            console.error('❌ 邮箱配置失败:', error);
            res.status(400).json({ success: false, error: '邮箱配置失败: ' + error.message });
        }
        
    } catch (error) {
        console.error('邮箱配置错误:', error);
        res.status(500).json({ success: false, error: '配置邮箱失败' });
    }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'operational',
        services: {
            emailConnector: emailConnector ? 'ready' : 'not initialized',
            ragEngine: ragEngine ? 'ready' : 'not initialized'
        },
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
});
