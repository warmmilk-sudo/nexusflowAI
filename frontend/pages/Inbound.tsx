import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, Star, Send, CheckCircle, RefreshCcw, BookOpen, Eye, Edit3 } from 'lucide-react';
import { InboundEmail } from '../types';
import { analyzeAndDraftInbound, generateEmailSummary, getInboxEmails } from '../services/apiService';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedReply, setSelectedReply] = useState<{email: InboundEmail, reply: string} | null>(null);
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [editedReply, setEditedReply] = useState('');
  const [isRegeneratingReply, setIsRegeneratingReply] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      setEmails(inboxEmails);
      
      // 检查当前选中的邮件是否还存在，如果不存在则清除选择
      if (selectedEmailId && !inboxEmails.find(email => email.id === selectedEmailId)) {
        setSelectedEmailId(null);
        localStorage.removeItem('nexusflow_selected_email_id');
      }
    } catch (error) {
      console.error('Failed to load inbox emails:', error);
    } finally {
      setIsLoadingEmails(false);
      if (showLoading) setIsRefreshing(false);
    }
  }, [focusMode, selectedEmailId]);

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

  // 保存选中邮件ID的变化
  useEffect(() => {
    if (selectedEmailId) {
      localStorage.setItem('nexusflow_selected_email_id', selectedEmailId);
    }
  }, [selectedEmailId]);

  const handleAnalyze = async () => {
    if (!selectedEmailId) return;
    setIsAnalyzing(true);
    
    const email = emails.find(e => e.id === selectedEmailId);
    if (!email) {
      setIsAnalyzing(false);
      return;
    }

    try {
      // 同时生成摘要和分析
      const [result, summary] = await Promise.all([
        analyzeAndDraftInbound(email),
        email.summary ? Promise.resolve(email.summary) : generateEmailSummary(email)
      ]);

      setEmails((prev: InboundEmail[]) => prev.map((e: InboundEmail) => {
          if (e.id === selectedEmailId) {
              return {
                  ...e,
                  status: 'drafted',
                  intent: result.intent as any,
                  draftReply: result.draft,
                  confidence: result.confidence,
                  summary: summary,
                  sources: result.sources || []
              };
          }
          return e;
      }));
    } catch (error) {
      console.error('AI分析失败:', error);
      alert('AI分析失败，请稍后重试');
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

      // 更新邮件的回复
      setEmails((prev: InboundEmail[]) => prev.map((e: InboundEmail) => {
        if (e.id === email.id) {
          return {
            ...e,
            intent: result.intent as any,
            draftReply: result.draft,
            confidence: result.confidence,
            summary: summary,
            sources: result.sources || []
          };
        }
        return e;
      }));
      
      // 更新当前选中的回复
      setSelectedReply(prev => prev ? { ...prev, reply: result.draft } : null);
      setEditedReply(result.draft);
      
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
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFocusMode(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>{t.common.loading === '加载中...' ? '仅显示已联系人回复' : 'Show contacted replies only'}</span>
                </label>
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
                            {email.draftReply && email.status === 'drafted' && (
                                <button 
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedReply({email, reply: email.draftReply!});
                                        setEditedReply(email.draftReply!);
                                        setIsEditingReply(false);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 text-[10px] font-medium flex items-center gap-1"
                                >
                                    <Eye size={10} /> {t.outbound.preview}
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {selectedEmail ? (
            <>
                {/* Email Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{selectedEmail.subject}</h2>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                <span>{t.inbound.from}: <strong className="text-slate-700">{selectedEmail.fromName}</strong> &lt;{selectedEmail.fromEmail}&gt;</span>
                            </div>
                        </div>
                        {selectedEmail.status !== 'replied' && (
                             <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || selectedEmail.status === 'drafted'}
                                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                                    selectedEmail.status === 'drafted' 
                                    ? 'bg-slate-100 text-slate-400 cursor-default'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'
                                }`}
                            >
                                {isAnalyzing ? <RefreshCcw className="animate-spin" size={16}/> : <Star size={16}/>}
                                {isAnalyzing ? t.inbound.analyzing : selectedEmail.status === 'drafted' ? t.inbound.analysisComplete : t.inbound.aiAnalysis}
                            </button>
                        )}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 leading-relaxed border border-slate-100">
                        {selectedEmail.content}
                    </div>
                </div>

                {/* AI Workspace */}
                <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
                    {selectedEmail.status === 'unread' && !isAnalyzing && (
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

                    {(selectedEmail.status === 'drafted' || selectedEmail.status === 'replied') && selectedEmail.draftReply && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    {t.inbound.analysisComplete}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{t.inbound.intent}: <strong>{selectedEmail.intent}</strong></span>
                                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">{t.inbound.confidence}: {selectedEmail.confidence}%</span>
                                </div>
                            </div>

                            {/* 知识库来源引用 */}
                            {selectedEmail.sources && selectedEmail.sources.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-2">
                                        <BookOpen size={14} />
                                        {t.inbound.referencedDocs}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEmail.sources.map((source: string, idx: number) => (
                                            <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-600">
                                                📄 {source}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* 回复预览卡片 */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-slate-700">{t.inbound.aiSuggestedReply}</h4>
                                    <button 
                                        onClick={() => {
                                            setSelectedReply({email: selectedEmail, reply: selectedEmail.draftReply!});
                                            setEditedReply(selectedEmail.draftReply!);
                                            setIsEditingReply(false);
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                    >
                                        <Eye size={16} /> {t.outbound.preview}
                                    </button>
                                </div>
                                <div className="text-sm text-slate-600 line-clamp-3">
                                    {selectedEmail.draftReply.substring(0, 150)}...
                                </div>
                            </div>

                            {selectedEmail.status === 'replied' && (
                                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center justify-center gap-2 border border-green-100">
                                    <CheckCircle size={16} /> {t.inbound.replySent}
                                </div>
                            )}
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
                          <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                              {selectedReply.reply}
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