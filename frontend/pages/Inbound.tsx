import React, { useState } from 'react';
import { Inbox, Star, Clock, AlertTriangle, Send, CheckCircle, RefreshCcw, BookOpen } from 'lucide-react';
import { InboundEmail } from '../types';
import { analyzeAndDraftInbound, generateEmailSummary } from '../services/apiService';

const MOCK_INBOX: InboundEmail[] = [
  {
    id: 'inbound_001',
    fromName: 'Dr. Sarah Williams',
    fromEmail: 'swilliams@mayoclinic.org',
    subject: 'AI Epic Probe Specifications Inquiry',
    content: `Dear Hygea Medical Team,

I'm an interventional radiologist at Mayo Clinic evaluating your AI Epic Co-Ablation System for liver tumor ablation procedures.

Could you please provide detailed specifications about your probe/needle system:

1. What probe diameters are available (I see 1.7mm, 2.4mm, 3.0mm mentioned)?
2. How do the cryoprobes differ from thermal probes in terms of needle design?
3. What is the maximum ice ball diameter achievable?
4. Are the probes compatible with CT-guided procedures?
5. What makes your needle design superior to traditional cryoablation probes?

We perform about 100 liver ablation procedures annually and are particularly interested in the dual-modality approach for complete tumor destruction.

Thank you for your assistance.

Best regards,
Dr. Sarah Williams, MD
Interventional Radiology
Mayo Clinic`,
    receivedAt: '2:30 PM',
    status: 'unread'
  },
  {
    id: 'inbound_002',
    fromName: 'Dr. Michael Chen',
    fromEmail: 'mchen@jhmi.edu',
    subject: 'Training Program and Clinical Support',
    content: `Hello,

I'm the Chief of Urology at Johns Hopkins Hospital. We're considering the AI Epic Co-Ablation System for our prostate cancer focal therapy program.

I have a few questions about your training and support:

1. What does the 2-day training workshop cover?
2. Do you provide on-site proctoring for our first cases?
3. What kind of ongoing clinical support is available?
4. Are there any case studies or videos of prostate procedures we could review?
5. How long does it typically take for a physician to become proficient?

We want to ensure our team is fully prepared before implementing this technology.

Thank you,
Dr. Michael Chen
Chief of Urology
Johns Hopkins Hospital`,
    receivedAt: 'Yesterday',
    status: 'unread'
  }
];

const Inbound: React.FC = () => {
  const [emails, setEmails] = useState<InboundEmail[]>(MOCK_INBOX);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSelectEmail = (id: string) => {
    setSelectedEmailId(id);
  };

  const handleAnalyze = async () => {
    if (!selectedEmailId) return;
    setIsAnalyzing(true);
    
    const email = emails.find(e => e.id === selectedEmailId);
    if (!email) return;

    // 同时生成摘要和分析
    const [result, summary] = await Promise.all([
      analyzeAndDraftInbound(email),
      email.summary ? Promise.resolve(email.summary) : generateEmailSummary(email)
    ]);

    setEmails(prev => prev.map(e => {
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
    setIsAnalyzing(false);
  };

  const handleSendReply = () => {
     setEmails(prev => prev.map(e => {
        if (e.id === selectedEmailId) {
            return { ...e, status: 'replied' };
        }
        return e;
    }));
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId);

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* Email List */}
      <div className="w-1/3 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Inbox</h3>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{emails.filter(e => e.status !== 'replied').length} Pending</span>
        </div>
        <div className="overflow-y-auto flex-1">
            {emails.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <Inbox size={48} className="mb-4 text-slate-200" />
                    <p className="text-center">No emails in inbox</p>
                    <p className="text-xs text-center mt-2">Configure your email settings to start receiving emails</p>
                </div>
            ) : (
                emails.map(email => (
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
                        <div className="mt-2 flex gap-2">
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
                            {email.status === 'replied' && <span className="text-[10px] flex items-center gap-1 text-slate-400"><CheckCircle size={10}/> Replied</span>}
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
                                <span>From: <strong className="text-slate-700">{selectedEmail.fromName}</strong> &lt;{selectedEmail.fromEmail}&gt;</span>
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
                                {isAnalyzing ? 'Analyzing Intent...' : selectedEmail.status === 'drafted' ? 'Analysis Complete' : 'AI Analysis & Draft'}
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
                            <p>Click "AI Analysis" to detect intent and generate a reply from the Knowledge Base.</p>
                        </div>
                    )}

                    {isAnalyzing && (
                         <div className="h-full flex flex-col items-center justify-center text-indigo-600">
                            <div className="animate-pulse flex flex-col items-center">
                                <div className="h-4 w-48 bg-indigo-200 rounded mb-2"></div>
                                <div className="h-4 w-32 bg-indigo-200 rounded"></div>
                                <p className="mt-4 text-sm font-medium">Consulting Knowledge Base...</p>
                            </div>
                        </div>
                    )}

                    {(selectedEmail.status === 'drafted' || selectedEmail.status === 'replied') && selectedEmail.draftReply && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    AI 建议回复
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">意图: <strong>{selectedEmail.intent}</strong></span>
                                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">置信度: {selectedEmail.confidence}%</span>
                                </div>
                            </div>

                            {/* 知识库来源引用 */}
                            {selectedEmail.sources && selectedEmail.sources.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-2">
                                        <BookOpen size={14} />
                                        引用知识库文档
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEmail.sources.map((source, idx) => (
                                            <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-600">
                                                📄 {source}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <textarea 
                                readOnly={selectedEmail.status === 'replied'}
                                defaultValue={selectedEmail.draftReply}
                                className={`w-full h-64 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm leading-relaxed ${selectedEmail.status === 'replied' ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
                            />

                            {selectedEmail.status !== 'replied' && (
                                <div className="flex justify-end gap-3">
                                    <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">编辑草稿</button>
                                    <button onClick={handleSendReply} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200">
                                        <Send size={16} />
                                        批准并发送
                                    </button>
                                </div>
                            )}
                             {selectedEmail.status === 'replied' && (
                                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center justify-center gap-2 border border-green-100">
                                    <CheckCircle size={16} /> 回复已成功发送
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>
        ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Inbox size={64} className="mb-4 text-slate-200" />
                <p>Select an email to view details</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Inbound;