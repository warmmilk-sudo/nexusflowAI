import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Play, CheckCircle2, AlertCircle, RefreshCw, Eye, Send, Trash2 } from 'lucide-react';
import { Customer, CampaignFocus } from '../types';
import { generateOutboundDraft, sendEmail } from '../services/apiService';
import { useTranslation } from 'src/i18n';

const Outbound: React.FC = () => {
  const t = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [customers, setCustomers] = useState<Customer[]>(() => {
    // Load from localStorage on initialization
    const saved = localStorage.getItem('nexusflow_outbound_customers');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [campaignFocus, setCampaignFocus] = useState<CampaignFocus>(CampaignFocus.PRODUCT_INTRODUCTION);
  const [productContext, setProductContext] = useState("AI Epic™ Co-Ablation System is an advanced dual-modality cryoablation and thermal therapy system for minimally invasive tumor treatment. Key benefits include: precise CT/MRI guidance, dual freeze-heat cycles for complete tumor destruction, suitable for liver, kidney, lung, and prostate procedures, outpatient capability with faster recovery times.");
  const [selectedDraft, setSelectedDraft] = useState<{customer: Customer, draft: string} | null>(null);

  // Save customers to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('nexusflow_outbound_customers', JSON.stringify(customers));
  }, [customers]);

  const parseCSV = (text: string): Customer[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const customers: Customer[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length >= headers.length) {
        const customer: Customer = {
          id: i.toString(),
          name: '',
          email: '',
          position: '',
          company: '',
          status: 'pending'
        };
        
        headers.forEach((header, index) => {
          const value = values[index] || '';
          switch (header) {
            case 'name':
              customer.name = value;
              break;
            case 'email':
              customer.email = value;
              break;
            case 'position':
              customer.position = value;
              break;
            case 'company':
              customer.company = value;
              break;
            case 'painpoint':
            case 'pain_point':
              customer.painPoint = value;
              break;
          }
        });
        
        if (customer.name && customer.email) {
          customers.push(customer);
        }
      }
    }
    
    return customers;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsedCustomers = parseCSV(text);
        setCustomers(parsedCustomers);
        // Also save filename for reference
        localStorage.setItem('nexusflow_outbound_filename', selectedFile.name);
      };
      reader.readAsText(selectedFile);
    }
  };

  const startBatchProcessing = async () => {
    if (customers.length === 0) return;
    setIsProcessing(true);

    // Process sequentially to simulate a real queue and avoid rate limits
    const updatedCustomers = [...customers];
    
    for (let i = 0; i < updatedCustomers.length; i++) {
        // Update status to processing
        updatedCustomers[i] = { ...updatedCustomers[i], status: 'processing' };
        setCustomers([...updatedCustomers]);

        try {
          // Call Gemini Service
          const draft = await generateOutboundDraft(updatedCustomers[i], campaignFocus, productContext);
          
          // Update status to completed
          updatedCustomers[i] = { 
              ...updatedCustomers[i], 
              status: 'completed', 
              generatedDraft: draft 
          };
        } catch (error) {
          console.error(`Failed to generate draft for ${updatedCustomers[i].name}:`, error);
          updatedCustomers[i] = { 
              ...updatedCustomers[i], 
              status: 'failed'
          };
        }
        
        setCustomers([...updatedCustomers]);
    }
    
    setIsProcessing(false);
  };

  const handleSendEmail = async (customer: Customer, draft: string) => {
    if (!customer.email || !draft) return;
    
    try {
      const subject = `AI Epic™ Co-Ablation System - Advanced Solution for ${customer.position}`;
      const success = await sendEmail(customer.email, subject, draft);
      
      if (success) {
        // Update customer status to sent
        setCustomers(prev => prev.map(c => 
          c.id === customer.id 
            ? { ...c, status: 'sent' as any }
            : c
        ));
        setSelectedDraft(null);
        alert(`Email sent successfully to ${customer.name}!`);
      } else {
        alert(`Failed to send email to ${customer.name}. Please check email configuration.`);
      }
    } catch (error) {
      console.error('Send email error:', error);
      alert(`Error sending email to ${customer.name}`);
    }
  };

  const clearData = () => {
    if (confirm('Are you sure you want to clear all customer data? This action cannot be undone.')) {
      setCustomers([]);
      setFile(null);
      localStorage.removeItem('nexusflow_outbound_customers');
      localStorage.removeItem('nexusflow_outbound_filename');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Upload */}
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                {t.outbound.uploadTargetList}
            </h3>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative">
              <input type="file" onChange={handleFileUpload} accept=".csv,.xlsx" className="absolute inset-0 opacity-0 cursor-pointer" />
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
                {file ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
              </div>
              <p className="text-sm font-medium text-slate-700">{file ? file.name : t.outbound.dragDropCsv}</p>
              <p className="text-xs text-slate-400 mt-1">{t.outbound.csvFormat}</p>
            </div>
          </div>

          {/* Middle: Config */}
          <div className="flex-1">
             <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                {t.outbound.campaignConfig}
            </h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t.outbound.campaignFocus}</label>
                    <select 
                        value={campaignFocus} 
                        onChange={(e) => setCampaignFocus(e.target.value as CampaignFocus)}
                        className="w-full border-slate-200 rounded-lg text-sm p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value={CampaignFocus.PRODUCT_INTRODUCTION}>{t.outbound.productIntroduction}</option>
                        <option value={CampaignFocus.PARTNERSHIP}>{t.outbound.partnership}</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t.outbound.productContext}</label>
                    <textarea 
                        value={productContext}
                        onChange={(e) => setProductContext(e.target.value)}
                        className="w-full border-slate-200 rounded-lg text-sm p-2 h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Describe what you are selling..."
                    />
                </div>
            </div>
          </div>

           {/* Right: Actions */}
           <div className="flex-none flex items-end gap-2">
                {customers.length > 0 && (
                  <button 
                      onClick={clearData}
                      className="h-12 px-4 rounded-lg font-semibold flex items-center gap-2 transition-all bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
                  >
                      <Trash2 size={18} />
                      {t.outbound.clear}
                  </button>
                )}
                <button 
                    onClick={startBatchProcessing}
                    disabled={customers.length === 0 || isProcessing}
                    className={`h-12 px-6 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                        customers.length > 0 && !isProcessing
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                    {isProcessing ? t.outbound.generating : t.outbound.startGeneration}
                </button>
           </div>
        </div>
      </div>

      {/* Results Table */}
      {customers.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="p-4">{t.outbound.customer}</th>
                            <th className="p-4">{t.outbound.email}</th>
                            <th className="p-4">{t.outbound.roleCompany}</th>
                            <th className="p-4">{t.outbound.painPoint}</th>
                            <th className="p-4">{t.outbound.status}</th>
                            <th className="p-4 text-right">{t.outbound.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {customers.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-900">{c.name}</td>
                                <td className="p-4 text-sm text-slate-600">{c.email}</td>
                                <td className="p-4 text-slate-600 text-sm">
                                    <div className="font-medium text-slate-800">{c.company}</div>
                                    <div className="text-xs">{c.position}</div>
                                </td>
                                <td className="p-4 text-sm text-slate-500">{c.painPoint || '-'}</td>
                                <td className="p-4">
                                    {c.status === 'pending' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{t.outbound.pending}</span>}
                                    {c.status === 'processing' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">{t.outbound.thinking}</span>}
                                    {c.status === 'completed' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 gap-1"><CheckCircle2 size={12}/> {t.outbound.generated}</span>}
                                    {c.status === 'failed' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 gap-1"><AlertCircle size={12}/> {t.outbound.failed}</span>}
                                    {(c.status as any) === 'sent' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 gap-1"><Send size={12}/> Sent</span>}
                                </td>
                                <td className="p-4 text-right">
                                    {c.generatedDraft && (
                                        <button 
                                            onClick={() => setSelectedDraft({customer: c, draft: c.generatedDraft!})}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 ml-auto"
                                        >
                                            <Eye size={16} /> {t.outbound.preview}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
      )}

      {/* Draft Modal */}
      {selectedDraft && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-900">{t.outbound.draftFor} {selectedDraft.customer.name}</h3>
                      <button onClick={() => setSelectedDraft(null)} className="text-slate-400 hover:text-slate-600">×</button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                      <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                          {selectedDraft.draft}
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-xl">
                      <button onClick={() => setSelectedDraft(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">{t.outbound.close}</button>
                      <button 
                        onClick={() => handleSendEmail(selectedDraft.customer, selectedDraft.draft)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2"
                      >
                        <Send size={16} />
                        {t.outbound.approveAndSend}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Outbound;