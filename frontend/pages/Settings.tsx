import React, { useState, useEffect } from 'react';
import { Save, Mail, Globe, Server } from 'lucide-react';
import { useTranslation, getCurrentLanguage, setLanguage, Language } from 'src/i18n';
import { configureEmail } from '../services/apiService';

const Settings: React.FC = () => {
    const t = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState<Language>(getCurrentLanguage());
    
    // 邮箱配置状态
    const [emailConfig, setEmailConfig] = useState({
        email: '',
        password: '',
        imapHost: 'imap.gmail.com',
        smtpHost: 'smtp.gmail.com',
        senderName: ''
    });
    const [emailSaved, setEmailSaved] = useState(false);
    const [emailTesting, setEmailTesting] = useState(false);

    useEffect(() => {
        // 加载邮箱配置
        const storedEmailConfig = localStorage.getItem('nexusflow_email_config');
        if (storedEmailConfig) {
            setEmailConfig(JSON.parse(storedEmailConfig));
        }
    }, []);

    const handleEmailSave = async () => {
        // 保存到本地存储
        localStorage.setItem('nexusflow_email_config', JSON.stringify(emailConfig));
        
        // 测试邮箱配置
        setEmailTesting(true);
        try {
            const success = await configureEmail(emailConfig);
            if (success) {
                setEmailSaved(true);
                setTimeout(() => setEmailSaved(false), 3000);
            } else {
                alert('邮箱配置测试失败，请检查设置');
            }
        } catch (error) {
            alert('邮箱配置失败：' + error);
        } finally {
            setEmailTesting(false);
        }
    };

    const handleLanguageChange = (lang: Language) => {
        setCurrentLanguage(lang);
        setLanguage(lang);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* 语言设置 */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{t.settings.languageSettings}</h2>
                        <p className="text-slate-500 text-sm">{t.settings.language}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">{t.settings.language}</label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleLanguageChange('zh')}
                                className={`px-4 py-2 rounded-lg border transition-all ${
                                    currentLanguage === 'zh'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                }`}
                            >
                                {t.settings.chinese}
                            </button>
                            <button
                                onClick={() => handleLanguageChange('en')}
                                className={`px-4 py-2 rounded-lg border transition-all ${
                                    currentLanguage === 'en'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                }`}
                            >
                                {t.settings.english}
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* 邮箱配置 */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <Mail size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{t.settings.emailConfiguration}</h2>
                        <p className="text-slate-500 text-sm">{t.settings.emailSettings}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.emailAddress}</label>
                        <input
                            type="email"
                            value={emailConfig.email}
                            onChange={(e) => setEmailConfig({...emailConfig, email: e.target.value})}
                            placeholder="your-email@gmail.com"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.emailPassword}</label>
                        <input
                            type="password"
                            value={emailConfig.password}
                            onChange={(e) => setEmailConfig({...emailConfig, password: e.target.value})}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.imapHost}</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={emailConfig.imapHost}
                                onChange={(e) => setEmailConfig({...emailConfig, imapHost: e.target.value})}
                                placeholder="imap.gmail.com"
                                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                            />
                            <div className="absolute left-3 top-2.5 text-slate-400">
                                <Server size={16} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.smtpHost}</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={emailConfig.smtpHost}
                                onChange={(e) => setEmailConfig({...emailConfig, smtpHost: e.target.value})}
                                placeholder="smtp.gmail.com"
                                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                            />
                            <div className="absolute left-3 top-2.5 text-slate-400">
                                <Server size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.senderName}</label>
                        <input
                            type="text"
                            value={emailConfig.senderName}
                            onChange={(e) => setEmailConfig({...emailConfig, senderName: e.target.value})}
                            placeholder="Your Name"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-6">
                    <button
                        onClick={handleEmailSave}
                        disabled={emailTesting}
                        className={`px-6 py-2.5 text-white font-medium rounded-lg flex items-center gap-2 transition-colors ${
                            emailTesting 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                    >
                        <Save size={18} />
                        {emailTesting ? 'Test...' : emailSaved ? t.settings.saved : 'Save and Test'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Settings;
