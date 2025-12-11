import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Database, RefreshCw, Settings, Zap } from 'lucide-react';
import { DocumentFile } from '../types';
import { useTranslation } from 'src/i18n';

const KnowledgeBase: React.FC = () => {
  const t = useTranslation();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState({ totalDocuments: 0, totalChunks: 0, documents: [] });
  const [ragConfig, setRagConfig] = useState({ embeddingModel: '', vectorStoreSize: 0, totalChunks: 0, vectorCoverage: '0%' });
  const [isRegeneratingVectors, setIsRegeneratingVectors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载知识库统计信息
  const loadStats = async () => {
    try {
      const [statsResponse, configResponse] = await Promise.all([
        fetch('http://localhost:3001/api/knowledge/stats'),
        fetch('http://localhost:3001/api/knowledge/config')
      ]);
      
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
        
        // 转换为DocumentFile格式
        const docs: DocumentFile[] = data.documents.map((doc: any, index: number) => ({
          id: index.toString(),
          name: doc.name,
          size: `${(doc.size / 1024).toFixed(1)} KB`,
          uploadDate: 'Recently',
          type: doc.name.endsWith('.pdf') ? 'PDF' : doc.name.endsWith('.docx') ? 'DOCX' : 'TXT'
        }));
        setDocuments(docs);
      }

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setRagConfig(configData);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    for (const file of files) {
      try {
        const content = await readFileContent(file);
        
        const response = await fetch('http://localhost:3001/api/knowledge/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.name,
            content: content
          })
        });

        if (response.ok) {
          console.log(`✅ ${file.name} uploaded successfully`);
        } else {
          console.error(`❌ Failed to upload ${file.name}`);
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }

    setIsUploading(false);
    // 重新加载统计信息
    await loadStats();
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 读取文件内容
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 删除文档
  const handleDeleteDocument = async (filename: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/knowledge/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log(`✅ ${filename} deleted successfully`);
        await loadStats();
      } else {
        console.error(`❌ Failed to delete ${filename}`);
      }
    } catch (error) {
      console.error(`Error deleting ${filename}:`, error);
    }
  };

  // 触发文件选择
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // 重新生成向量
  const regenerateVectors = async () => {
    setIsRegeneratingVectors(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/knowledge/regenerate-vectors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Vector regeneration started:', result);
        alert('开始重新生成缺失的向量，请稍后刷新查看进度...');
        
        // 延迟重新加载状态，给向量生成一些时间
        setTimeout(() => {
          loadStats();
        }, 2000);
      } else {
        const error = await response.json();
        alert(`重新生成向量失败: ${error.error}`);
      }
    } catch (error) {
      console.error('Regenerate vectors error:', error);
      alert('重新生成向量失败');
    } finally {
      setIsRegeneratingVectors(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="bg-blue-600 rounded-xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
            <Database className="absolute right-[-20px] bottom-[-20px] text-blue-500 opacity-20 w-48 h-48" />
            <h2 className="text-2xl font-bold mb-2">{t.knowledge.knowledgeBase}</h2>
            <p className="text-blue-100 max-w-xl">
                {t.knowledge.ragDescription}
            </p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Upload Zone */}
           <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">{t.knowledge.activeDocuments}</h3>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={loadStats}
                            className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button 
                            onClick={triggerFileUpload}
                            disabled={isUploading}
                            className={`text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                                isUploading 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                            }`}
                        >
                            <Upload size={16} /> 
                            {isUploading ? t.knowledge.uploading : t.knowledge.uploadNew}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".txt,.md,.pdf,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                </div>
                <div className="space-y-3">
                    {documents.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <FileText size={48} className="mx-auto mb-4 text-slate-200" />
                            <p className="text-sm">{t.knowledge.noDocuments}</p>
                            <p className="text-xs mt-2">{t.knowledge.uploadFirst}</p>
                        </div>
                    ) : (
                        documents.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.type === 'PDF' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                                        <p className="text-xs text-slate-400">{doc.size} • {doc.uploadDate}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteDocument(doc.name)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
           </div>

           {/* Status & Configuration */}
           <div className="space-y-4">
               {/* RAG Configuration */}
               <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
                   <div className="flex items-center justify-between mb-4">
                       <h3 className="font-bold text-slate-800 flex items-center gap-2">
                           <Settings size={18} />
                           {t.knowledge.vectorConfig}
                       </h3>
                       <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                           {t.knowledge.vectorMode}
                       </div>
                   </div>
                   
                   <div className="space-y-3">
                       <div className="text-sm text-slate-600">
                           <p className="mb-2">
                               <strong>{t.knowledge.searchMode}:</strong> {t.knowledge.semanticSearch}
                           </p>
                           <p className="mb-2">
                               <strong>{t.knowledge.vectorStorage}:</strong> {ragConfig.vectorStoreSize} {t.common.loading === '加载中...' ? '个向量已缓存' : 'vectors cached'}
                           </p>
                           <p>
                               <strong>{t.knowledge.vectorCoverage}:</strong> {ragConfig.vectorCoverage || '100%'}
                           </p>
                       </div>

                       {stats.totalDocuments > 0 && ragConfig.vectorCoverage !== '100%' && (
                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                               <p className="text-xs text-amber-700 mb-2">
                                   <strong>{t.knowledge.missingVectors}</strong>
                               </p>
                               <button
                                   onClick={regenerateVectors}
                                   disabled={isRegeneratingVectors}
                                   className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                       isRegeneratingVectors
                                           ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                           : 'bg-amber-600 text-white hover:bg-amber-700'
                                   }`}
                               >
                                   <Zap size={12} className="inline mr-1" />
                                   {isRegeneratingVectors ? t.knowledge.generating : t.knowledge.regenerateVectors}
                               </button>
                           </div>
                       )}

                       {stats.totalDocuments > 0 && ragConfig.vectorCoverage === '100%' && (
                           <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                               <p className="text-xs text-green-700 flex items-center gap-1">
                                   <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                   {t.knowledge.allVectorized}
                               </p>
                           </div>
                       )}
                   </div>
               </div>

               {/* Index Status */}
               <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
                   <h3 className="font-bold text-slate-800 mb-4">{t.knowledge.indexStatus}</h3>
                   <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">{t.knowledge.vectorProgress}</span>
                                <span className="font-medium text-slate-900">{ragConfig.vectorCoverage || '0%'}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: ragConfig.vectorCoverage || '0%' }}
                                ></div>
                            </div>
                            <p className="text-xs mt-1 text-slate-500">
                                {ragConfig.vectorStoreSize} / {ragConfig.totalChunks || stats.totalChunks} {t.knowledge.chunksVectorized}
                            </p>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">{t.knowledge.documentCount}</span>
                                <span className="font-medium text-slate-900">{stats.totalDocuments}</span>
                            </div>
                            <p className="text-xs mt-1 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${stats.totalDocuments > 0 ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                {stats.totalDocuments > 0 ? `${stats.totalChunks} ${t.common.loading === '加载中...' ? '个文档块已索引' : 'document chunks indexed'}` : t.knowledge.noDocuments}
                            </p>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">{t.knowledge.storageStatus}</span>
                                <span className="font-medium text-slate-900">{t.knowledge.localDisk}</span>
                            </div>
                            <p className="text-xs mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {t.knowledge.persistentStorage}
                            </p>
                        </div>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

export default KnowledgeBase;