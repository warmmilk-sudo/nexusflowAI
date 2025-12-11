const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const axios = require('axios');
const { MockEmailConnector } = require('./emailConnector');
const { createDefaultKnowledgeBase } = require('./ragEngine');
const EmailStats = require('./emailStats');

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
const PORT = process.env.PORT || 3001;

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

// 邮箱配置文件路径
const EMAIL_CONFIG_PATH = path.join(__dirname, 'config', 'emailConfig.json');

// 保存邮箱配置到磁盘
function saveEmailConfig(config) {
    try {
        // 确保config目录存在
        const configDir = path.dirname(EMAIL_CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // 保存配置（密码进行简单编码，不是加密，仅为了避免明文显示）
        const configToSave = {
            ...config,
            password: Buffer.from(config.password).toString('base64'),
            savedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(EMAIL_CONFIG_PATH, JSON.stringify(configToSave, null, 2));
        console.log('✅ 邮箱配置已保存到磁盘');
    } catch (error) {
        console.error('❌ 保存邮箱配置失败:', error);
    }
}

// 从磁盘加载邮箱配置
function loadEmailConfig() {
    try {
        if (fs.existsSync(EMAIL_CONFIG_PATH)) {
            const configData = fs.readFileSync(EMAIL_CONFIG_PATH, 'utf-8');
            const config = JSON.parse(configData);
            
            // 解码密码
            if (config.password) {
                config.password = Buffer.from(config.password, 'base64').toString();
            }
            
            console.log('✅ 从磁盘加载邮箱配置');
            return config;
        }
    } catch (error) {
        console.error('❌ 加载邮箱配置失败:', error);
    }
    return null;
}

// 初始化邮件连接器、RAG 引擎和邮件统计
let emailConnector = null;
let ragEngine = null;
let emailStats = null;

// 启动时初始化
(async () => {
    // 尝试加载保存的邮箱配置
    const savedEmailConfig = loadEmailConfig();
    
    if (savedEmailConfig) {
        // 如果有保存的配置，使用它初始化邮件连接器
        const { EmailConnector, MockEmailConnector } = require('./emailConnector');
        
        try {
            const newEmailConnector = new EmailConnector(savedEmailConfig);
            
            if (!newEmailConnector.mockMode) {
                newEmailConnector.initSMTP();
                emailConnector = newEmailConnector;
                console.log(`✅ 使用保存的邮箱配置初始化 (真实SMTP) - ${savedEmailConfig.email}`);
            } else {
                emailConnector = new MockEmailConnector(savedEmailConfig);
                console.log(`✅ 使用保存的邮箱配置初始化 (模拟模式) - ${savedEmailConfig.email}`);
            }
        } catch (error) {
            console.error('❌ 使用保存的邮箱配置失败:', error);
            emailConnector = new MockEmailConnector();
        }
    } else {
        // 没有保存的配置，使用默认的模拟连接器
        emailConnector = new MockEmailConnector();
        console.log('📧 未找到保存的邮箱配置，使用默认设置');
    }
    
    // 初始化 RAG 引擎
    ragEngine = await createDefaultKnowledgeBase();
    
    // 初始化邮件统计
    emailStats = new EmailStats();
    
    console.log('✅ 系统初始化完成');
})();

// 火山引擎批量推理API调用函数
async function callVolcengineBatchAPI(batchMessages, model = REASONING_MODEL) {
    if (!VOLCENGINE_API_KEY || !VOLCENGINE_API_BASE || !model) {
        throw new Error('Missing required environment variables: VOLCENGINE_API_KEY, VOLCENGINE_API_BASE, REASONING_MODEL');
    }
    
    try {
        const response = await axios.post(`${VOLCENGINE_API_BASE}/chat/completions`, {
            model,
            messages: batchMessages,
            temperature: 0.7,
            max_tokens: 2000,
            // 设置思考长度为最短
            thinking_length: 'short',
            // 批量推理参数
            batch_size: Math.min(batchMessages.length, 8), // 最大8个batch
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${VOLCENGINE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices || [];
    } catch (error) {
        console.error('火山引擎批量API调用错误:', error.response?.data || error.message);
        throw error;
    }
}

// API: Batch Generate Outbound Drafts
app.post('/api/outbound/batch-generate', async (req, res) => {
    try {
        const { customers, focus, productContext, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';

        if (!customers || !Array.isArray(customers) || customers.length === 0) {
            return res.status(400).json({ error: 'Invalid customers data' });
        }

        // 限制批量大小为8
        const batchSize = Math.min(customers.length, 8);
        const batchCustomers = customers.slice(0, batchSize);

        // 使用 RAG 引擎获取相关产品信息
        let knowledgeContext = 'No specific product information available.';
        if (ragEngine) {
            const searchQuery = `${focus} medical device cryoablation`;
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

        // 为每个客户构建消息
        const batchMessages = batchCustomers.map(customer => ({
            role: "user",
            content: `
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
            `
        }));

        // 由于批量推理可能不被支持，改为并发单个请求
        const results = await Promise.allSettled(
            batchMessages.map(async (message, index) => {
                try {
                    const response = await callVolcengineAPI([message]);
                    return {
                        customerId: batchCustomers[index].id,
                        draft: response,
                        success: true
                    };
                } catch (error) {
                    console.error(`Customer ${batchCustomers[index].name} generation failed:`, error.message);
                    return {
                        customerId: batchCustomers[index].id,
                        draft: 'Failed to generate draft',
                        success: false
                    };
                }
            })
        );
        
        // 构建响应
        const drafts = results.map(result => 
            result.status === 'fulfilled' ? result.value : {
                customerId: 'unknown',
                draft: 'Failed to generate draft',
                success: false
            }
        );

        res.json({ 
            success: true, 
            drafts,
            processed: batchSize,
            total: customers.length
        });
    } catch (error) {
        console.error("Batch Outbound Error:", error.message);
        res.status(500).json({ error: "Failed to generate batch drafts" });
    }
});

// API: Generate Outbound Draft (单个)
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
            ? `You are an intelligent customer service assistant for AI Epic™ Co-Ablation System.
            
            **CRITICAL: You must respond with ONLY valid JSON format. No additional text, explanations, or formatting.**
            
            **Task:**
            1. Analyze email intent (Sales/Technical/Support/Spam)
            2. Draft a professional, polite reply based on knowledge base content
            
            **Received Email:**
            From: ${email.fromName}
            Subject: ${email.subject}
            Content: ${email.content}

            **Knowledge Base Context:**
            ${knowledgeContext}

            **Response Requirements:**
            - Return ONLY valid JSON
            - No markdown formatting, no code blocks
            - Escape all special characters in strings
            - Keep draft content under 300 words
            
            **Required JSON Format:**
            {"intent":"Sales","draftReply":"Professional email reply content in English without line breaks or special characters","confidence":85,"sources":["document1.pdf","document2.pdf"]}`
            : `你是AI Epic™消融系统的智能客服助手。
            
            **重要：你必须只返回有效的JSON格式。不要添加任何额外的文本、解释或格式。**
            
            **任务:**
            1. 分析邮件意图（Sales/Technical/Support/Spam）
            2. 基于知识库内容草拟专业、礼貌的回复
            
            **收到的邮件:**
            发件人: ${email.fromName}
            主题: ${email.subject}
            内容: ${email.content}

            **知识库上下文:**
            ${knowledgeContext}

            **回复要求:**
            - 只返回有效的JSON
            - 不要使用markdown格式或代码块
            - 转义字符串中的所有特殊字符
            - 回复内容保持在300字以内
            
            **必需的JSON格式:**
            {"intent":"Sales","draftReply":"专业的中文邮件回复内容，不包含换行符或特殊字符","confidence":85,"sources":["文档1.pdf","文档2.pdf"]}`;

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
            // 清理响应文本，移除可能的控制字符和多余的格式
            let cleanResponse = response.trim();
            
            // 如果响应被包装在代码块中，提取JSON部分
            if (cleanResponse.includes('```json')) {
                const jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[1].trim();
                }
            } else if (cleanResponse.includes('```')) {
                const jsonMatch = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[1].trim();
                }
            }
            
            // 移除控制字符和不可见字符
            cleanResponse = cleanResponse
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 移除控制字符
                .replace(/\n\s*\n/g, '\n') // 移除多余的空行
                .trim();
            
            // 尝试找到JSON对象的开始和结束
            const jsonStart = cleanResponse.indexOf('{');
            const jsonEnd = cleanResponse.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
            }
            
            result = JSON.parse(cleanResponse);
            
            // 验证必需的字段
            if (!result.intent || !result.draftReply) {
                throw new Error('Missing required fields in JSON response');
            }
            
        } catch (parseError) {
            console.error('JSON解析失败，使用默认响应:', parseError);
            console.error('原始响应:', response);
            
            // 尝试从响应中提取有用信息
            let extractedDraft = response;
            let extractedIntent = "Technical";
            
            // 尝试提取意图
            const intentMatch = response.match(/(?:intent|意图)["']?\s*:\s*["']?(Sales|Technical|Support|Spam)["']?/i);
            if (intentMatch) {
                extractedIntent = intentMatch[1];
            }
            
            // 尝试提取草稿内容
            const draftMatch = response.match(/(?:draftReply|draft|草稿|回复)["']?\s*:\s*["']?([\s\S]*?)["']?(?:\s*[,}]|$)/i);
            if (draftMatch) {
                extractedDraft = draftMatch[1].trim();
            }
            
            // 如果提取失败，使用整个响应作为草稿
            if (!extractedDraft || extractedDraft.length < 10) {
                extractedDraft = response.length > 500 ? response.substring(0, 500) + '...' : response;
            }
            
            result = {
                intent: extractedIntent,
                draftReply: extractedDraft,
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
            draftReply: fallbackDraft,
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

// API: 生成邮件主题总结
app.post('/api/email/subject-summary', async (req, res) => {
    try {
        const { email, language } = req.body;
        const userLanguage = language || req.headers['x-language'] || 'zh';

        // 根据语言设置选择提示词
        const prompt = userLanguage === 'en'
            ? `
            Please create a concise one-sentence summary of the following email content as a subject line (no more than 50 characters):
            
            Original Subject: ${email.subject}
            Email Content: ${email.content}
            
            Generate a clear, professional subject line that summarizes the main request or topic. Return only the subject line text in English, nothing else.
            
            Examples:
            - "Request for Clinical Evidence and FDA Clearance Information"
            - "Inquiry about AI Epic System Specifications"
            - "Training Requirements and Certification Process"
            `
            : `
            请为以下邮件内容生成一个简洁的主题总结（不超过50字）：
            
            原始主题: ${email.subject}
            邮件内容: ${email.content}
            
            生成一个清晰、专业的主题行，总结主要请求或话题。只返回主题行文本，不要其他内容。
            
            示例：
            - "临床证据和FDA许可信息请求"
            - "AI Epic系统规格咨询"
            - "培训要求和认证流程"
            `;

        const messages = [
            {
                role: "user",
                content: prompt
            }
        ];

        const response = await callVolcengineAPI(messages);
        res.json({ subjectSummary: response.trim() });
    } catch (error) {
        console.error("Subject Summary Error:", error.message);
        const fallback = req.body.language === 'en' ? 'Unable to generate subject summary' : '无法生成主题总结';
        res.json({ subjectSummary: req.body.email?.subject || fallback });
    }
});

// API: 发送邮件
app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, content } = req.body;
        
        if (!emailConnector) {
            return res.status(503).json({ 
                success: false, 
                error: '邮件服务未初始化，请先在设置页面配置邮箱' 
            });
        }

        const result = await emailConnector.sendEmail({
            to,
            subject,
            text: content,
            html: content.replace(/\n/g, '<br>')
        });

        // 如果发送成功，更新统计数据
        if (result.success && emailStats) {
            emailStats.incrementOutreach(1);
            emailStats.addContactedEmail(to); // 记录已联系人
        }

        res.json(result);
    } catch (error) {
        console.error("Send Email Error:", error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message || '发送邮件失败' 
        });
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
        const { email, password, imapHost, imapPort, smtpHost, smtpPort, senderName } = req.body;
        
        const emailConfig = {
            email,
            password,
            imapHost: imapHost || 'imap.gmail.com',
            imapPort: imapPort || 993,
            smtpHost: smtpHost || 'smtp.gmail.com',
            smtpPort: smtpPort || 465,
            senderName: senderName || 'NexusFlow AI'
        };
        
        // 尝试创建真实的邮件连接器
        const { EmailConnector, MockEmailConnector } = require('./emailConnector');
        
        try {
            const newEmailConnector = new EmailConnector(emailConfig);
            
            // 如果EmailConnector可用，使用它
            if (!newEmailConnector.mockMode) {
                newEmailConnector.initSMTP();
                emailConnector = newEmailConnector;
                console.log(`✅ 邮箱配置已更新 (真实SMTP) - SMTP: ${emailConfig.smtpHost}:${emailConfig.smtpPort}`);
            } else {
                // 如果依赖不可用，使用MockEmailConnector但传入真实配置
                emailConnector = new MockEmailConnector(emailConfig);
                console.log('✅ 邮箱配置已更新 (模拟模式，但会尝试真实发送)');
            }
            
            // 保存配置到磁盘
            saveEmailConfig(emailConfig);
            
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

// API: 获取邮箱配置（不返回密码）
app.get('/api/email/config', (req, res) => {
    try {
        const config = loadEmailConfig();
        if (config) {
            // 返回配置但不包含密码
            const { password, ...configWithoutPassword } = config;
            res.json({ success: true, config: configWithoutPassword });
        } else {
            res.json({ success: false, message: '未找到邮箱配置' });
        }
    } catch (error) {
        console.error('获取邮箱配置错误:', error);
        res.status(500).json({ success: false, error: '获取邮箱配置失败' });
    }
});

// API: 获取邮件统计数据
app.get('/api/email/stats', (req, res) => {
    try {
        if (!emailStats) {
            return res.status(503).json({ error: '邮件统计服务未初始化' });
        }
        
        const stats = emailStats.getStats();
        res.json(stats);
    } catch (error) {
        console.error('获取邮件统计错误:', error);
        res.status(500).json({ error: '获取邮件统计失败' });
    }
});

// API: 获取收件箱邮件（真实IMAP）
app.get('/api/email/inbox', async (req, res) => {
    try {
        const { focusMode } = req.query; // 获取focus模式参数
        
        if (!emailConnector) {
            return res.status(503).json({ 
                error: '邮件服务未初始化，请先在设置页面配置邮箱' 
            });
        }

        // 如果是模拟模式或没有IMAP功能，返回空数组
        if (emailConnector.mockMode || !emailConnector.fetchRecentEmails) {
            return res.json({ emails: [] });
        }

        // 获取最近的邮件
        let emails = await emailConnector.fetchRecentEmails(20); // 获取最近20封邮件
        
        // 如果启用focus模式，只显示已联系人的回复
        if (focusMode === 'true' && emailStats) {
            const contactedEmails = emailStats.getContactedEmails();
            emails = emails.filter(email => 
                emailStats.isContactedEmail(email.fromEmail)
            );
            console.log(`📧 Focus模式: 过滤后显示 ${emails.length} 封已联系人邮件`);
        }
        
        res.json({ emails, focusMode: focusMode === 'true' });
    } catch (error) {
        console.error('获取收件箱邮件错误:', error);
        res.status(500).json({ error: '获取收件箱邮件失败' });
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