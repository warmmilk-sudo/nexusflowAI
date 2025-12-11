# Volcengine API Key Setup Guide

## API Key配置指南

本指南将帮助你为NexusFlow AI配置火山引擎API密钥。

## 获取火山引擎API Key

### 1. 访问火山引擎控制台
- 打开 https://console.volcengine.com/
- 使用你的火山引擎账户登录（或创建新账户）

### 2. 进入ARK平台
- 导航到 "机器学习平台AI" > "ARK"
- 进入 "API管理" 部分

### 3. 创建API Key
- 点击 "创建API Key"
- 设置适当的权限（文本生成和向量化）
- 复制生成的API Key（格式：sk-...）

### 4. 配置模型端点
- 确保你有以下模型的访问权限：
  - **DeepSeek-v3.2** 用于文本生成
  - **Doubao** 用于向量化嵌入
- 记录你的具体端点ID（如使用自定义部署）

## 在NexusFlow中配置

### 1. 打开NexusFlow AI应用
- 进入设置页面
- 在 "Volcengine API Key" 字段中粘贴你的API Key
- 点击 "保存配置"

### 2. 测试配置
- 尝试生成外发邮件草稿
- 上传文档测试RAG功能
- 检查文本生成和嵌入功能是否正常工作

## 重要说明

- **保护API Key安全** - 不要公开分享或提交到版本控制
- **API使用限制** - 火山引擎对每个模型都有速率限制和配额
- **计费监控** - 在火山引擎控制台中监控使用情况以管理成本
- **模型可用性** - 确保DeepSeek-v3.2和Doubao在你的地区可用

## 故障排除

### "API key expired" 错误
- 你的API Key可能已过期或被撤销
- 从火山引擎控制台生成新的API Key
- 在NexusFlow设置中更新密钥

### "Invalid API key" 错误
- 检查是否复制了完整的API Key
- 确保没有多余的空格或字符
- 验证密钥在ARK服务中有适当的权限

### 模型访问错误
- 确保你有DeepSeek-v3.2模型的访问权限
- 验证Doubao嵌入模型可用
- 检查你账户在ARK控制台中的模型权限

### 速率限制错误
- 你可能发出了太多请求
- 等待几分钟后再试
- 考虑升级你的火山引擎计划以获得更高限制

## API Key安全最佳实践

1. **环境变量** - 尽可能将API Key存储在环境变量中
2. **定期轮换** - 定期生成新的API Key
3. **监控使用** - 在火山引擎控制台中监控API使用情况
4. **访问控制** - 使用适当的IAM策略限制密钥使用
5. **网络安全** - 生产环境考虑IP白名单

## 模型信息

### DeepSeek-v3.2
- **用途**: 邮件草稿和回复的文本生成
- **上下文长度**: 最多32K tokens
- **语言**: 支持中文和英文
- **使用场景**: 邮件撰写、内容分析、摘要生成

### Doubao嵌入
- **用途**: RAG（检索增强生成）的文档嵌入
- **维度**: 1024维向量
- **语言**: 针对中文和英文文本优化
- **使用场景**: 语义搜索、文档相似性、知识检索

## 测试API Key

可以使用以下命令测试API Key是否有效：

```bash
curl -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"model":"deepseek-v3.2","messages":[{"role":"user","content":"Hello"}]}' \
     -X POST "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
```

将 `YOUR_API_KEY` 替换为你的实际API Key。

## 联系支持

如果问题持续存在，可以：
- 查看火山引擎ARK文档：https://www.volcengine.com/docs/82379
- 访问火山引擎技术支持中心
- 检查服务状态页面

## 成本优化建议

1. **监控使用量** - 定期检查API调用统计
2. **缓存结果** - 对相似查询使用缓存
3. **批量处理** - 合并多个请求以减少API调用
4. **设置预算警报** - 在控制台中设置使用量警报