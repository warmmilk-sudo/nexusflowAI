// 国际化配置
export type Language = 'zh' | 'en';

export interface Translations {
  // 通用
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    loading: string;
    success: string;
    error: string;
    confirm: string;
  };
  
  // 导航
  nav: {
    dashboard: string;
    outbound: string;
    inbound: string;
    knowledge: string;
    settings: string;
  };
  
  // 页面标题
  pages: {
    dashboard: string;
    outbound: string;
    inbound: string;
    knowledge: string;
    settings: string;
    welcome: string;
    systemStatus: string;
  };
  
  // 仪表盘
  dashboard: {
    totalOutreach: string;
    responseRate: string;
    pendingDrafts: string;
    activeLeads: string;
    weeklyPerformance: string;
    quickActions: string;
    newCampaign: string;
    reviewInbox: string;
    updateKnowledge: string;
  };
  
  // 智能收件箱
  inbound: {
    inbox: string;
    pending: string;
    aiAnalysis: string;
    aiSuggestedReply: string;
    intent: string;
    confidence: string;
    knowledgeSources: string;
    editDraft: string;
    approveAndSend: string;
    replySent: string;
    selectEmail: string;
    analyzing: string;
    analysisComplete: string;
  };
  
  // 批量外发
  outbound: {
    uploadTargetList: string;
    campaignConfig: string;
    campaignFocus: string;
    productContext: string;
    startGeneration: string;
    generating: string;
    customer: string;
    email: string;
    roleCompany: string;
    painPoint: string;
    status: string;
    actions: string;
    preview: string;
    pending: string;
    thinking: string;
    generated: string;
    failed: string;
    draftFor: string;
    approveAndSend: string;
    close: string;
    clear: string;
    dragDropCsv: string;
    csvFormat: string;
    // Campaign Focus options
    productIntroduction: string;
    partnership: string;
  };
  
  // 知识库
  knowledge: {
    knowledgeBase: string;
    ragDescription: string;
    activeDocuments: string;
    uploadNew: string;
    indexStatus: string;
    vectorStorage: string;
    lastSync: string;
    systemOptimized: string;
    used: string;
    ago: string;
  };
  
  // 设置
  settings: {
    apiConfiguration: string;
    geminiApiKey: string;
    apiKeyDescription: string;
    saveConfiguration: string;
    saved: string;
    clearKey: string;
    emailConfiguration: string;
    emailAddress: string;
    emailPassword: string;
    imapHost: string;
    smtpHost: string;
    senderName: string;
    languageSettings: string;
    language: string;
    chinese: string;
    english: string;
    emailSettings: string;
  };
}

// 中文翻译
export const zhTranslations: Translations = {
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    loading: '加载中...',
    success: '成功',
    error: '错误',
    confirm: '确认',
  },
  
  nav: {
    dashboard: '仪表盘',
    outbound: '批量外发',
    inbound: '智能收件箱',
    knowledge: '知识库',
    settings: '设置',
  },
  
  pages: {
    dashboard: '仪表盘',
    outbound: '批量外发',
    inbound: '智能收件箱',
    knowledge: '知识库',
    settings: '设置',
    welcome: '欢迎回来，管理员',
    systemStatus: '系统运行正常',
  },
  
  dashboard: {
    totalOutreach: '总触达量',
    responseRate: '回复率',
    pendingDrafts: '待处理草稿',
    activeLeads: '活跃线索',
    weeklyPerformance: '每周外发表现',
    quickActions: '快捷操作',
    newCampaign: '新建活动',
    reviewInbox: '查看收件箱',
    updateKnowledge: '更新知识库',
  },
  
  inbound: {
    inbox: '收件箱',
    pending: '待处理',
    aiAnalysis: 'AI 分析与草拟',
    aiSuggestedReply: 'AI 建议回复',
    intent: '意图',
    confidence: '置信度',
    knowledgeSources: '引用知识库文档',
    editDraft: '编辑草稿',
    approveAndSend: '批准并发送',
    replySent: '回复已成功发送',
    selectEmail: '选择一封邮件查看详情',
    analyzing: '正在分析意图...',
    analysisComplete: '分析完成',
  },
  
  outbound: {
    uploadTargetList: '上传目标列表',
    campaignConfig: '活动配置',
    campaignFocus: '活动焦点',
    productContext: '产品上下文（系统提示）',
    startGeneration: '开始生成',
    generating: '生成中...',
    customer: '客户',
    email: '邮箱',
    roleCompany: '职位与公司',
    painPoint: '痛点',
    status: '状态',
    actions: '操作',
    preview: '预览',
    pending: '待处理',
    thinking: '思考中...',
    generated: '已生成',
    failed: '失败',
    draftFor: '草稿给',
    approveAndSend: '批准并发送',
    close: '关闭',
    clear: '清除',
    dragDropCsv: '拖放CSV或Excel文件',
    csvFormat: '必须包含：姓名、公司、邮箱、职位',
    // Campaign Focus options
    productIntroduction: '产品介绍',
    partnership: '合作机会',
  },
  
  knowledge: {
    knowledgeBase: '知识库 (RAG)',
    ragDescription: '上传您的产品手册、价格表和技术文档。AI 使用"检索增强生成"技术为入站邮件找到准确答案，为外发活动提供个性化上下文。',
    activeDocuments: '活跃文档',
    uploadNew: '上传新文档',
    indexStatus: '索引状态',
    vectorStorage: '向量存储',
    lastSync: '最后同步',
    systemOptimized: '系统已优化',
    used: '已使用',
    ago: '前',
  },
  
  settings: {
    apiConfiguration: 'API 配置',
    geminiApiKey: 'Google Gemini API Key',
    apiKeyDescription: '您的密钥存储在浏览器本地，通过安全方式发送到后端进行每次请求。它从不保存在数据库中。',
    saveConfiguration: '保存配置',
    saved: '已保存！',
    clearKey: '清除密钥',
    emailConfiguration: '邮箱配置',
    emailAddress: '邮箱地址',
    emailPassword: '邮箱密码/应用专用密码',
    imapHost: 'IMAP 服务器',
    smtpHost: 'SMTP 服务器',
    senderName: '发件人姓名',
    languageSettings: '语言设置',
    language: '界面语言',
    chinese: '中文',
    english: 'English',
    emailSettings: '邮箱设置',
  },
};

// 英文翻译
export const enTranslations: Translations = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    confirm: 'Confirm',
  },
  
  nav: {
    dashboard: 'Dashboard',
    outbound: 'Batch Outbound',
    inbound: 'Smart Inbox',
    knowledge: 'Knowledge Base',
    settings: 'Settings',
  },
  
  pages: {
    dashboard: 'Dashboard',
    outbound: 'Batch Outbound',
    inbound: 'Smart Inbox',
    knowledge: 'Knowledge Base',
    settings: 'Settings',
    welcome: 'Welcome back, Administrator',
    systemStatus: 'System Operational',
  },
  
  dashboard: {
    totalOutreach: 'Total Outreach',
    responseRate: 'Response Rate',
    pendingDrafts: 'Pending Drafts',
    activeLeads: 'Active Leads',
    weeklyPerformance: 'Weekly Outreach Performance',
    quickActions: 'Quick Actions',
    newCampaign: 'New Campaign',
    reviewInbox: 'Review Inbox',
    updateKnowledge: 'Update Knowledge',
  },
  
  inbound: {
    inbox: 'Inbox',
    pending: 'Pending',
    aiAnalysis: 'AI Analysis & Draft',
    aiSuggestedReply: 'AI Suggested Reply',
    intent: 'Intent',
    confidence: 'Confidence',
    knowledgeSources: 'Referenced Knowledge Documents',
    editDraft: 'Edit Draft',
    approveAndSend: 'Approve & Send',
    replySent: 'Reply sent successfully',
    selectEmail: 'Select an email to view details',
    analyzing: 'Analyzing Intent...',
    analysisComplete: 'Analysis Complete',
  },
  
  outbound: {
    uploadTargetList: 'Upload Target List',
    campaignConfig: 'Campaign Configuration',
    campaignFocus: 'Campaign Focus',
    productContext: 'Product Context (System Prompt)',
    startGeneration: 'Start Generation',
    generating: 'Generating...',
    customer: 'Customer',
    email: 'Email',
    roleCompany: 'Role & Company',
    painPoint: 'Pain Point',
    status: 'Status',
    actions: 'Actions',
    preview: 'Preview',
    pending: 'Pending',
    thinking: 'Thinking...',
    generated: 'Generated',
    failed: 'Failed',
    draftFor: 'Draft for',
    approveAndSend: 'Approve & Send',
    close: 'Close',
    clear: 'Clear',
    dragDropCsv: 'Drag & drop CSV or Excel',
    csvFormat: 'Must contain: Name, Company, Email, Position',
    // Campaign Focus options
    productIntroduction: 'Product Introduction',
    partnership: 'Partnership Opportunity',
  },
  
  knowledge: {
    knowledgeBase: 'Knowledge Base (RAG)',
    ragDescription: 'Upload your product manuals, pricing sheets, and technical docs here. The AI uses "Retrieval-Augmented Generation" to find accurate answers for Inbound emails and personalized context for Outbound campaigns.',
    activeDocuments: 'Active Documents',
    uploadNew: 'Upload New',
    indexStatus: 'Index Status',
    vectorStorage: 'Vector Storage',
    lastSync: 'Last Sync',
    systemOptimized: 'System Optimized',
    used: 'Used',
    ago: 'ago',
  },
  
  settings: {
    apiConfiguration: 'API Configuration',
    geminiApiKey: 'Google Gemini API Key',
    apiKeyDescription: 'Your key is stored locally in your browser and sent securely to the backend for each request. It is never saved in a database.',
    saveConfiguration: 'Save Configuration',
    saved: 'Saved!',
    clearKey: 'Clear Key',
    emailConfiguration: 'Email Configuration',
    emailAddress: 'Email Address',
    emailPassword: 'Email Password/App Password',
    imapHost: 'IMAP Server',
    smtpHost: 'SMTP Server',
    senderName: 'Sender Name',
    languageSettings: 'Language Settings',
    language: 'Interface Language',
    chinese: '中文',
    english: 'English',
    emailSettings: 'Email Settings',
  },
};

// 翻译映射
const translations = {
  zh: zhTranslations,
  en: enTranslations,
};

// 获取当前语言
export const getCurrentLanguage = (): Language => {
  const saved = localStorage.getItem('nexusflow_language');
  return (saved as Language) || 'en';
};

// 设置语言
export const setLanguage = (lang: Language) => {
  localStorage.setItem('nexusflow_language', lang);
  window.location.reload(); // 重新加载页面以应用语言
};

// 获取翻译
export const useTranslation = () => {
  const currentLang = getCurrentLanguage();
  return translations[currentLang];
};

// 翻译函数
export const t = (key: string): string => {
  const translation = useTranslation();
  const keys = key.split('.');
  let result: any = translation;
  
  for (const k of keys) {
    result = result?.[k];
  }
  
  return result || key;
};