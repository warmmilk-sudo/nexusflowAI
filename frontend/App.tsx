import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Outbound from './pages/Outbound';
import Inbound from './pages/Inbound';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import { useTranslation } from 'src/i18n';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const t = useTranslation();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'outbound':
        return <Outbound />;
      case 'inbound':
        return <Inbound />;
      case 'knowledge':
        return <KnowledgeBase />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard' && t.pages.dashboard}
              {activeTab === 'outbound' && t.pages.outbound}
              {activeTab === 'inbound' && t.pages.inbound}
              {activeTab === 'knowledge' && t.pages.knowledge}
              {activeTab === 'settings' && t.pages.settings}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {t.pages.welcome}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              {t.pages.systemStatus}
            </div>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;