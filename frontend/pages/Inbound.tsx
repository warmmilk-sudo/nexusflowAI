import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, Star, Send, CheckCircle, RefreshCcw, BookOpen, Eye, Edit3 } from 'lucide-react';
import { InboundEmail } from '../types';
import { analyzeAndDraftInbound, generateEmailSummary, generateSubjectSummary, getInboxEmails } from '../services/apiService';
import { useTranslation } from 'src/i18n';

const Inbound: React.FC = () => {
  const t = useTranslation();
  const [emails, setEmails] = useState<InboundEmail[]>(() => {
    // 从localStorage加载缓存的邮件
    const cached = localStorage.getItem('nexusflow_inbox_emails');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [focusMode, setFocusMode] = useState(() => {
    // 从localStorage加载Focus模式状态，默认为true
    const saved = localStorage.getItem('nexusflow_focus_mode');
    return saved ? JSON.parse(saved) : true;
  });
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(() => {
    // 从localStorage加载选中的邮件ID
    return localStorage.getItem('nexusflow_selected_email_id');
  });
  
  // 使用ref来保持选中邮件的引用，避免因为emails数组更新导致的重新计算
  const selectedEmailRef = React.useRef<InboundEmail | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedReply, setSelectedReply] = useState<{email: InboundEmail, reply: string} | null>(null);
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [editedReply, setEditedReply] = useState('');
  const [isRegeneratingReply, setIsRegeneratingReply] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [subjectSummary, setSubjectSummary] = useState<string>('');

  // 保存Focus模式状态到localStorage
  useEffect(() => {
    localStorage.setItem('nexusflow_focus_mode', JSON.stringify(focusMode));
  }, [focusMode]);

  // 保存邮件到localStorage
  useEffect(() => {
    if (emails.length > 0) {
      localStorage.setItem('nexusflow_inbox_emails', JSON.stringify(emails));
    }
  }, [emails]);

  // 加载收件箱邮件
  const loadEmails = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const inboxEmails = await getInboxEmails(focusMode);
      setEmails(prevEmails => {
        // 合并新邮件和已有邮件，保持已分析邮件的状态
        const mergedEmails = inboxEmails.map(newEmail => {
          const existingEmail = prevEmails.find(prevEmail => prevEmail.id === newEmail.id);
          if (existingEmail && (existingEmail.status === 'drafted' || existingEmail.status === 'replied')) {
            // 保持已分析邮件的状态和AI结果
            return {
              ...newEmail,
              status: existingEmail.status,
              intent: existingEmail.intent,
              draftReply: existingEmail.draftReply,
              confidence: existingEmail.confidence,
              summary: existingEmail.summary,
              sources: existingEmail.sources,
              subjectSummary: existingEmail.subjectSummary
            };
          }
          return newEmail;
        });
        
        // 如果有选中的邮件ID，确保它在新列表中仍然有效
        if (selectedEmailId) {
          const selectedEmailExists = mergedEmails.find(email => email.id === selectedEmailId);
          if (selectedEmailExists) {
            // 更新selectedEmailRef以确保右侧显示正确
            selectedEmailRef.current = selectedEmailExists;
            console.log('🔄 loadEmails 中已更新 selectedEmailRef:', {
              id: selectedEmailExists.id,
              status: selectedEmailExists.status,
              hasDraftReply: !!selectedEmailExists.draftReply
            });
          }
        }
        
        return mergedEmails;
      });
    } catch (error) {
      console.error('Failed to load inbox emails:', error);
    } finally {
      setIsLoadingEmails(false);
      if (showLoading) setIsRefreshing(false);
    }
  }, [focusMode]);

  // 检查选中邮件是否存在的独立effect
  useEffect(() => {
    if (selectedEmailId && emails.length > 0) {
      const emailExists = emails.find(email => email.id === selectedEmailId);
      if (!emailExists) {
        setSelectedEmailId(null);
        localStorage.removeItem('nexusflow_selected_email_id');
      } else {
        // 确保selectedEmailRef指向正确的邮件对象
        selectedEmailRef.current = emailExists;
        console.log('🔄 useEffect 中已更新 selectedEmailRef:', {
          id: emailExists.id,
          status: emailExists.status,
          hasDraftReply: !!emailExists.draftReply
        });
      }
    }
  }, [emails, selectedEmailId]);

  useEffect(() => {
    loadEmails();
    
    // 每60秒刷新一次邮件
    const interval = setInterval(() => loadEmails(), 60000);
    return () => clearInterval(interval);
  }, [loadEmails]);

  // 手动刷新邮件
  const handleRefresh = () => {
    loadEmails(true);
  };

  const handleSelectEmail = (id: string) => {
    setSelectedEmailId(id);
    // 保存选中的邮件ID到localStorage
    localStorage.setItem('nexusflow_selected_email_id', id);
  };

  const handleAnalyze = async () => {
    if (!selectedEmailId) return;
    setIsAnalyzing(true);
    
    const email = emails.find(e => e.id === selectedEmailId);
    if (!email) {
      setIsAnalyzing(false);
      return;
    }

    try {
      // 同时生成摘要、分析和主题总结
      const [result, summary, subjectSummaryResult] = await Promise.all([
        analyzeAndDraftInbound(email),
        email.summary ? Promise.resolve(email.summary) : generateEmailSummary(email),
        generateSubjectSummary(email)
      ]);

      console.log('🔍 AI 分析结果:', result);
      console.log('📝 DraftReply 字段:', result.draftReply);

      // 确保 draftReply 字段存在
      if (!result.draftReply) {
        console.error('❌ 警告: API 返回的数据中没有 draftReply 字段！');
        alert('AI 生成的回复为空，请重试');
        setIsAnalyzing(false);
        return;
      }

      // 设置主题总结
      setSubjectSummary(subjectSummaryResult);

      setEmails((prev: InboundEmail[]) => {
        const updatedEmails = prev.map((e: InboundEmail) => {
          if (e.id === selectedEmailId) {
              const updatedEmail = {
                  ...e,
                  status: 'drafted' as const,
                  intent: result.intent as any,
                  draftReply: result.draftReply,
                  confidence: result.confidence,
                  summary: summary,
                  sources: result.sources || [],
                  subjectSummary: subjectSummaryResult
              };
              console.log('✅ 更新后的邮件对象:', updatedEmail);
              
              // 立即更新 selectedEmailRef 以确保 UI 同步
              selectedEmailRef.current = updatedEmail;
              console.log('🔄 已同步更新 selectedEmailRef');
              
              return updatedEmail;
          }
          return e;
        });
        
        // 立即保存到localStorage
        localStorage.setItem('nexusflow_inbox_emails', JSON.stringify(updatedEmails));
        console.log('💾 已保存到 localStorage');
        
        return updatedEmails;
      });
    } catch (error) {
      console.error('❌ AI分析失败:', error);
      alert('AI分析失败，请稍后重试。错误: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegenerateReply = async (email: InboundEmail) => {
    if (!email) return;
    
    setIsRegeneratingReply(true);
    try {
      const [result, summary] = await Promise.all([
        analyzeAndDraftInbound(email),
        email.summary ? Promise.resolve(email.summary) : generateEmailSummary(email)
      ]);

      console.log('重新生成回复结果:', result); // 调试日志

      // 更新邮件的回复
      setEmails((prev: InboundEmail[]) => prev.map((e: InboundEmail) => {
        if (e.id === email.id) {
          const updatedEmail = {
            ...e,
            intent: result.intent as any,
            draftReply: result.draftReply,
            confidence: result.confidence,
            summary: summary,
            sources: result.sources || []
            // 保持原有的subjectSummary，不重新生成
          };
          
          // 如果这是当前选中的邮件，立即更新 selectedEmailRef
          if (selectedEmailId === email.id) {
            selectedEmailRef.current = updatedEmail;
            console.log('🔄 重新生成时已同步更新 selectedEmailRef');
          }
          
          return updatedEmail;
        }
        return e;
      }));
      
      // 更新当前选中的回复
      setSelectedReply(prev => prev ? { ...prev, reply: result.draftReply } : null);
      setEditedReply(result.draftReply);
      
    } catch (error) {
      console.error('Regenerate reply error:', error);
      alert('重新生成回复失败，请稍后重试');
    } finally {
      setIsRegeneratingReply(false);
    }
  };

  const handleSaveEditedReply = () => {
    if (!selectedReply) return;
    
    // 更新邮件的回复
    setEmails((prev: InboundEmail[]) => prev.map((e: InboundEmail) => 
      e.id === selectedReply.email.id 
        ? { ...e, draftReply: editedReply }
        : e
    ));
    
    // 更新当前选中的回复
    setSelectedReply(prev => prev ? { ...prev, reply: editedReply } : null);
    setIsEditingReply(false);
  };

  const handleSendReply = (email: InboundEmail, reply: string) => {
     setEmails((prev: InboundEmail[]) => prev.map((e: InboundEmail) => {
        if (e.id === email.id) {
            return { ...e, status: 'replied' };
        }
        return e;
    }));
    setSelectedReply(null);
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId);
  
  // 更新selectedEmailRef
  React.useEffect(() => {
    if (selectedEmail) {
      selectedEmailRef.current = selectedEmail;
    }
  }, [selectedEmail]);

  // 获取当前选中邮件的辅助函数
  const getCurrentEmail = () => {
    const current = selectedEmail || selectedEmailRef.current;
    console.log('🔍 getCurrentEmail 调试:', {
      selectedEmailId,
      selectedEmail: selectedEmail ? { id: selectedEmail.id, status: selectedEmail.status, hasDraftReply: !!selectedEmail.draftReply } : null,
      selectedEmailRef: selectedEmailRef.current ? { id: selectedEmailRef.current.id, status: selectedEmailRef.current.status, hasDraftReply: !!selectedEmailRef.current.draftReply } : null,
      current: current ? { id: current.id, status: current.status, hasDraftReply: !!current.draftReply } : null
    });
    return current;
  };



  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* Email List */}
      <div className="w-1/3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-slate-700">{focusMode ? 'Focus Box' : t.inbound.inbox}</h3>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{emails.filter(e => e.status !== 'replied').length} {t.inbound.pending}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={focusMode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setFocusMode(e.target.checked);
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>{t.common.loading === '加载中...' ? '仅显示已联系人回复' : 'Show contacted replies only'}</span>
                </label>
                <div className="flex gap-1">
                    <button
                        onClick={() => {
                            if (confirm('确定要清除缓存吗？这将删除所有已分析的邮件数据。')) {
                                localStorage.removeItem('nexusflow_inbox_emails');
                                localStorage.removeItem('nexusflow_selected_email_id');
                                window.location.reload();
                            }
                        }}
                        className="p-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors"
                        title="清除缓存"
                    >
                        🗑️
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`p-1.5 rounded-lg text-sm transition-colors ${
                            isRefreshing 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                        title={t.common.loading === '加载中...' ? '刷新邮件' : 'Refresh emails'}
                    >
                        <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
        </div>
        <div className="overflow-y-auto flex-1">
            {isLoadingEmails ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
                        <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        <p className="mt-4 text-sm">{t.common.loading}</p>
                    </div>
                </div>
            ) : emails.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <Inbox size={48} className="mb-4 text-slate-200" />
                    <p className="text-center">{t.inbound.noEmails}</p>
                    <p className="text-xs text-center mt-2">{t.inbound.configureEmail}</p>
                </div>
            ) : (
                emails.map((email: InboundEmail) => (
                    <div 
                        key={email.id}
                        onClick={() => handleSelectEmail(email.id)}
                        className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${selectedEmailId === email.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                    >
                        <div className="flex justify-between mb-1">
                            <span className={`font-semibold text-sm ${email.status === 'unread' ? 'text-slate-900' : 'text-slate-600'}`}>{email.fromName}</span>
                            <span className="text-xs text-slate-400">{email.receivedAt}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-800 mb-1 truncate">{email.subject}</div>
                        <div className="text-xs text-slate-500 truncate">
                            {email.summary || email.content}
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                            <div className="flex gap-2">
                                {email.intent && (
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                                        email.intent === 'Sales' ? 'border-green-200 text-green-700 bg-green-50' :
                                        email.intent === 'Technical' ? 'border-purple-200 text-purple-700 bg-purple-50' :
                                        email.intent === 'Spam' ? 'border-red-200 text-red-700 bg-red-50' :
                                        'border-slate-200 text-slate-700 bg-slate-50'
                                    }`}>
                                        {email.intent}
                                    </span>
                                )}
                                {email.status === 'replied' && <span className="text-[10px] flex items-center gap-1 text-slate-400"><CheckCircle size={10}/> {t.inbound.replied}</span>}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {(selectedEmail || selectedEmailRef.current) ? (
            <>
                {/* Email Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{(selectedEmail || selectedEmailRef.current)?.fromName}</h2>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                <span>fromEmail: <strong className="text-slate-700">&lt;{(selectedEmail || selectedEmailRef.current)?.fromEmail}&gt;</strong></span>
                            </div>
                        </div>
                        {(selectedEmail || selectedEmailRef.current)?.status !== 'replied' && (
                             <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className={`w-48 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                                    isAnalyzing 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'
                                }`}
                            >
                                {isAnalyzing ? <RefreshCcw className="animate-spin" size={16}/> : <Star size={16}/>}
                                <span className="truncate">
                                    {isAnalyzing ? t.inbound.analyzing : t.inbound.aiAnalysis}
                                </span>
                            </button>
                        )}
                    </div>
                    {/* 邮件内容 */}
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed border border-slate-100 max-h-32 overflow-y-auto">
                        <div className="whitespace-pre-wrap break-words">
                            {getCurrentEmail()?.content?.replace(/\\n/g, '\n').replace(/\\r/g, '') || ''}
                        </div>
                    </div>
                </div>

                {/* AI Workspace */}
                <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto min-h-0">
                    {getCurrentEmail()?.status === 'unread' && !isAnalyzing && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Star size={48} className="mb-4 text-slate-200" />
                            <p>{t.inbound.selectEmail}</p>
                        </div>
                    )}

                    {isAnalyzing && (
                         <div className="h-full flex flex-col items-center justify-center text-indigo-600">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="h-4 w-48 bg-indigo-200 rounded mb-2"></div>
                                <div className="h-4 w-32 bg-indigo-200 rounded"></div>
                                <p className="mt-4 text-sm font-medium">{t.inbound.consultingKnowledge}</p>
                            </div>
                        </div>
                    )}

                    {getCurrentEmail()?.draftReply && (
                        <div className="space-y-4 h-full flex flex-col">
                            {/* 1. Subject - 主题总结 */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold mb-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Subject
                                </div>
                                <div className="text-sm text-blue-800 leading-relaxed">
                                    {getCurrentEmail()?.subjectSummary || subjectSummary || getCurrentEmail()?.subject}
                                </div>
                            </div>

                            {/* 2. Reply Draft - AI草稿回复 */}
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            Reply Draft
                                        </h4>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <button 
                                            onClick={() => {
                                                const currentEmail = getCurrentEmail();
                                                if (currentEmail) {
                                                    setSelectedReply({email: currentEmail, reply: currentEmail.draftReply!});
                                                    setEditedReply(currentEmail.draftReply!);
                                                    setIsEditingReply(false);
                                                }
                                            }}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 px-3 py-1 rounded-md hover:bg-blue-50"
                                        >
                                            <Eye size={16} /> {t.outbound.preview}
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 overflow-y-auto">
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                                        {getCurrentEmail()?.draftReply?.replace(/\\n/g, '\n').replace(/\\r/g, '') || ''}
                                    </div>
                                </div>
                            </div>

                            {/* 3. Referenced Knowledge Documents - 知识库来源引用 */}
                            {getCurrentEmail()?.sources && getCurrentEmail()?.sources.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-3">
                                        <BookOpen size={16} />
                                        Referenced Knowledge Documents
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {getCurrentEmail()?.sources?.map((source: string, idx: number) => (
                                            <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-slate-300 text-slate-600">
                                                📄 {source}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 分析信息和状态 */}
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-4">
                                    <span>Intent: <strong>{getCurrentEmail()?.intent}</strong></span>
                                    <span>Confidence: <strong>{getCurrentEmail()?.confidence}%</strong></span>
                                </div>
                                {getCurrentEmail()?.status === 'replied' && (
                                    <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle size={12} /> {t.inbound.replySent}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </>
        ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Inbox size={64} className="mb-4 text-slate-200" />
                <p>{t.inbound.selectEmail}</p>
            </div>
        )}
      </div>

      {/* Reply Preview Modal */}
      {selectedReply && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-900">{t.inbound.aiSuggestedReply} - {selectedReply.email.fromName}</h3>
                      <div className="flex items-center gap-2">
                          <button 
                              onClick={() => handleRegenerateReply(selectedReply.email)}
                              disabled={isRegeneratingReply}
                              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-colors ${
                                  isRegeneratingReply 
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                          >
                              <RefreshCcw size={14} className={isRegeneratingReply ? 'animate-spin' : ''} />
                              {isRegeneratingReply ? t.outbound.regenerating : t.outbound.regenerate}
                          </button>
                          <button onClick={() => setSelectedReply(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                      </div>
                  </div>
                  
                  {/* 原邮件信息 */}
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                      <div className="text-sm text-slate-600">
                          <strong>{t.inbound.from}:</strong> {selectedReply.email.fromName} &lt;{selectedReply.email.fromEmail}&gt;
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                          <strong>subject:</strong> {selectedReply.email.subject}
                      </div>
                      {selectedReply.email.intent && (
                          <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-500">{t.inbound.intent}: <strong>{selectedReply.email.intent}</strong></span>
                              <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{t.inbound.confidence}: {selectedReply.email.confidence}%</span>
                          </div>
                      )}
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                      {isEditingReply ? (
                          <textarea
                              value={editedReply}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedReply(e.target.value)}
                              className="w-full h-full min-h-[300px] p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm leading-relaxed resize-none"
                              placeholder="编辑回复内容..."
                          />
                      ) : (
                          <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 break-words">
                              {selectedReply.reply?.replace(/\\n/g, '\n').replace(/\\r/g, '') || ''}
                          </div>
                      )}
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 flex justify-between bg-white rounded-b-xl">
                      <div className="flex gap-2">
                          {isEditingReply ? (
                              <>
                                  <button 
                                      onClick={() => {
                                          setIsEditingReply(false);
                                          setEditedReply(selectedReply.reply);
                                      }}
                                      className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                  >
                                      {t.common.cancel}
                                  </button>
                                  <button 
                                      onClick={handleSaveEditedReply}
                                      className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg flex items-center gap-2"
                                  >
                                      <CheckCircle size={16} />
                                      {t.outbound.saveChanges}
                                  </button>
                              </>
                          ) : (
                              <button 
                                  onClick={() => setIsEditingReply(true)}
                                  className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                              >
                                  <Edit3 size={16} />
                                  {t.outbound.editDraft}
                              </button>
                          )}
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setSelectedReply(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t.outbound.close}</button>
                          <button 
                            onClick={() => handleSendReply(selectedReply.email, isEditingReply ? editedReply : selectedReply.reply)}
                            disabled={isEditingReply}
                            className={`px-4 py-2 text-sm rounded-lg shadow-sm flex items-center gap-2 ${
                                isEditingReply 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            <Send size={16} />
                            {t.inbound.approveAndSend}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inbound;