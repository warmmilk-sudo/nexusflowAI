/**
 * RAG 检索增强引擎
 * 负责文档向量化、语义检索和上下文提取
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class RAGEngine {
    constructor() {
        this.documents = [];
        this.vectorStore = new Map(); // 向量存储：chunk_id -> embedding
        this.documentsPath = path.join(__dirname, 'knowledge_base');
        this.vectorStorePath = path.join(__dirname, 'knowledge_base', 'vectors.json'); // 向量存储文件
        this.apiKey = process.env.VOLCENGINE_API_KEY;
        this.embeddingModel = process.env.EMBEDDING_MODEL;
        this.volcengineApiBase = process.env.VOLCENGINE_API_BASE;
        
        // 验证必要的环境变量
        if (!this.apiKey || !this.embeddingModel || !this.volcengineApiBase) {
            throw new Error('Missing required environment variables: VOLCENGINE_API_KEY, EMBEDDING_MODEL, VOLCENGINE_API_BASE');
        }
    }

    /**
     * 初始化知识库
     */
    async initialize() {
        try {
            await fs.mkdir(this.documentsPath, { recursive: true });
            await this.loadVectorStore(); // 加载已保存的向量
            await this.loadDocuments();
            console.log('✅ RAG 引擎初始化成功');
        } catch (error) {
            console.error('❌ RAG 引擎初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载向量存储
     */
    async loadVectorStore() {
        try {
            const vectorData = await fs.readFile(this.vectorStorePath, 'utf-8');
            const vectors = JSON.parse(vectorData);
            
            // 将数组转换回Map
            this.vectorStore = new Map(vectors);
            console.log(`📦 已加载 ${this.vectorStore.size} 个向量`);
        } catch (error) {
            // 文件不存在或解析失败，使用空的向量存储
            console.log('📦 向量存储文件不存在，将创建新的向量存储');
            this.vectorStore = new Map();
        }
    }

    /**
     * 保存向量存储到磁盘
     */
    async saveVectorStore() {
        try {
            // 将Map转换为数组以便JSON序列化
            const vectorArray = Array.from(this.vectorStore.entries());
            await fs.writeFile(this.vectorStorePath, JSON.stringify(vectorArray, null, 2), 'utf-8');
            console.log(`💾 已保存 ${this.vectorStore.size} 个向量到磁盘`);
        } catch (error) {
            console.error('保存向量存储失败:', error);
        }
    }

    /**
     * 加载所有文档
     */
    async loadDocuments() {
        try {
            const files = await fs.readdir(this.documentsPath);
            
            for (const file of files) {
                if (file.endsWith('.txt') || file.endsWith('.md')) {
                    const content = await fs.readFile(
                        path.join(this.documentsPath, file),
                        'utf-8'
                    );
                    
                    this.documents.push({
                        id: file,
                        name: file,
                        content: content,
                        chunks: this.chunkDocument(content)
                    });
                }
            }

            console.log(`📚 已加载 ${this.documents.length} 个文档`);
            
            // 检查是否需要生成缺失的向量
            await this.ensureAllEmbeddings();
        } catch (error) {
            console.error('加载文档错误:', error);
        }
    }

    /**
     * 将文档分块（简化版）
     * @param {String} content - 文档内容
     * @returns {Array} 文档块数组
     */
    chunkDocument(content, chunkSize = 500) {
        const chunks = [];
        const sentences = content.split(/[。！？\n]+/);
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '。';
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * 确保所有文档块都有对应的向量
     */
    async ensureAllEmbeddings() {
        let missingCount = 0;
        let totalChunks = 0;

        for (const doc of this.documents) {
            for (let i = 0; i < doc.chunks.length; i++) {
                totalChunks++;
                const chunkId = `${doc.id}_${i}`;
                if (!this.vectorStore.has(chunkId)) {
                    missingCount++;
                }
            }
        }

        if (missingCount > 0) {
            console.log(`🔄 检测到 ${missingCount}/${totalChunks} 个文档块缺少向量，开始生成...`);
            await this.generateMissingEmbeddings();
        } else {
            console.log(`✅ 所有 ${totalChunks} 个文档块都已有向量`);
        }
    }

    /**
     * 生成缺失的向量
     */
    async generateMissingEmbeddings() {
        let generated = 0;
        
        for (const doc of this.documents) {
            for (let i = 0; i < doc.chunks.length; i++) {
                const chunkId = `${doc.id}_${i}`;
                
                if (!this.vectorStore.has(chunkId)) {
                    try {
                        const embedding = await this.generateEmbedding(doc.chunks[i], this.apiKey);
                        if (embedding) {
                            this.vectorStore.set(chunkId, embedding);
                            generated++;
                            
                            // 每生成10个向量就保存一次，避免丢失
                            if (generated % 10 === 0) {
                                await this.saveVectorStore();
                                console.log(`📦 已生成并保存 ${generated} 个向量...`);
                            }
                        }
                        
                        // 添加延迟避免API限流
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error(`生成向量失败 ${chunkId}:`, error);
                    }
                }
            }
        }

        // 最终保存
        if (generated > 0) {
            await this.saveVectorStore();
            console.log(`✅ 完成生成 ${generated} 个向量`);
        }
    }

    /**
     * 生成文本的embedding向量
     * @param {String} text - 文本内容
     * @param {String} apiKey - API密钥
     * @returns {Array} embedding向量
     */
    async generateEmbedding(text, apiKey) {
        if (!apiKey) {
            throw new Error('API Key is required for generating embeddings');
        }

        try {
            const response = await axios.post(`${this.volcengineApiBase}/embeddings`, {
                model: this.embeddingModel,
                input: text
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data.data[0].embedding;
        } catch (error) {
            console.error('生成embedding错误:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * 计算两个向量的余弦相似度
     * @param {Array} vecA - 向量A
     * @param {Array} vecB - 向量B
     * @returns {Number} 相似度分数 (0-1)
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 语义检索 - 使用向量化搜索
     * @param {String} query - 查询文本
     * @param {Number} topK - 返回前 K 个结果
     * @param {String} apiKey - API key用于embedding
     * @returns {Array} 相关文档片段
     */
    async search(query, topK = 3, apiKey = null) {
        return await this.searchWithEmbeddings(query, topK, apiKey || this.apiKey);
    }

    /**
     * 使用embedding进行语义检索
     */
    async searchWithEmbeddings(query, topK, apiKey) {
        if (!apiKey) {
            throw new Error('API Key is required for embedding search');
        }

        try {
            // 生成查询的embedding
            const queryEmbedding = await this.generateEmbedding(query, apiKey);
            if (!queryEmbedding) {
                throw new Error('Failed to generate query embedding');
            }

            const results = [];

            // 计算与所有文档块的相似度
            for (const doc of this.documents) {
                for (let i = 0; i < doc.chunks.length; i++) {
                    const chunkId = `${doc.id}_${i}`;
                    let chunkEmbedding = this.vectorStore.get(chunkId);

                    // 如果没有缓存的embedding，生成一个并保存
                    if (!chunkEmbedding) {
                        chunkEmbedding = await this.generateEmbedding(doc.chunks[i], apiKey);
                        if (chunkEmbedding) {
                            this.vectorStore.set(chunkId, chunkEmbedding);
                            await this.saveVectorStore(); // 立即保存新生成的向量
                        }
                    }

                    if (chunkEmbedding) {
                        // 计算相似度
                        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);

                        if (similarity > 0.1) { // 设置最小相似度阈值
                            results.push({
                                document: doc.name,
                                content: doc.chunks[i],
                                score: similarity
                            });
                        }
                    }
                }
            }

            // 按相似度排序并返回前K个
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);

        } catch (error) {
            console.error('Embedding检索错误:', error);
            throw error;
        }
    }



    /**
     * 添加新文档
     * @param {String} filename - 文件名
     * @param {String} content - 文档内容
     */
    async addDocument(filename, content) {
        try {
            const filePath = path.join(this.documentsPath, filename);
            await fs.writeFile(filePath, content, 'utf-8');
            
            const chunks = this.chunkDocument(content);
            this.documents.push({
                id: filename,
                name: filename,
                content: content,
                chunks: chunks
            });

            // 为新文档生成向量
            console.log(`🔄 为新文档 ${filename} 生成向量...`);
            for (let i = 0; i < chunks.length; i++) {
                const chunkId = `${filename}_${i}`;
                try {
                    const embedding = await this.generateEmbedding(chunks[i], this.apiKey);
                    if (embedding) {
                        this.vectorStore.set(chunkId, embedding);
                    }
                    // 添加延迟避免API限流
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`生成向量失败 ${chunkId}:`, error);
                }
            }

            // 保存向量到磁盘
            await this.saveVectorStore();

            console.log(`✅ 文档已添加并完成向量化: ${filename}`);
            return { success: true };
        } catch (error) {
            console.error('添加文档错误:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 删除文档
     * @param {String} filename - 文件名
     */
    async deleteDocument(filename) {
        try {
            const filePath = path.join(this.documentsPath, filename);
            await fs.unlink(filePath);
            
            // 删除文档记录
            const doc = this.documents.find(d => d.id === filename);
            if (doc) {
                // 删除相关的向量
                for (let i = 0; i < doc.chunks.length; i++) {
                    const chunkId = `${filename}_${i}`;
                    this.vectorStore.delete(chunkId);
                }
            }
            
            this.documents = this.documents.filter(doc => doc.id !== filename);
            
            // 保存更新后的向量存储
            await this.saveVectorStore();
            
            console.log(`🗑️ 文档及其向量已删除: ${filename}`);
            return { success: true };
        } catch (error) {
            console.error('删除文档错误:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取知识库摘要
     * @param {String} query - 查询上下文
     * @param {String} apiKey - 可选的API key用于embedding
     * @returns {String} 知识库摘要
     */
    async getContextSummary(query, apiKey = null) {
        try {
            const results = await this.search(query, 3, apiKey || this.apiKey);
            
            if (results.length === 0) {
                return '知识库中暂无相关信息。';
            }

            let summary = '知识库相关内容：\n\n';
            results.forEach((result) => {
                summary += `[来源: ${result.document}]\n${result.content}\n\n`;
            });

            return summary;
        } catch (error) {
            console.error('获取知识库摘要失败:', error);
            return '知识库查询失败。';
        }
    }



    /**
     * 获取统计信息
     */
    getStats() {
        const totalChunks = this.documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
        
        return {
            totalDocuments: this.documents.length,
            totalChunks: totalChunks,
            totalVectors: this.vectorStore.size,
            vectorCoverage: totalChunks > 0 ? (this.vectorStore.size / totalChunks * 100).toFixed(1) + '%' : '0%',
            documents: this.documents.map(doc => ({
                name: doc.name,
                size: doc.content.length,
                chunks: doc.chunks.length
            }))
        };
    }
}

// 创建知识库
async function createDefaultKnowledgeBase() {
    try {
        const ragEngine = new RAGEngine();
        await ragEngine.initialize();
        
        console.log('✅ 知识库已初始化，向量化模式已启用');
        return ragEngine;
    } catch (error) {
        console.error('❌ 知识库初始化失败:', error);
        throw error;
    }
}

module.exports = { RAGEngine, createDefaultKnowledgeBase };
