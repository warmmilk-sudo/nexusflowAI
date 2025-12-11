import React from 'react';
import { LayoutDashboard, Send, Inbox, Database, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'src/i18n';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const t = useTranslation();
  
  const menuItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'outbound', label: t.nav.outbound, icon: Send },
    { id: 'inbound', label: t.nav.inbound, icon: Inbox },
    { id: 'knowledge', label: t.nav.knowledge, icon: Database },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 text-white mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">N</div>
          <span className="text-xl font-bold tracking-tight">NexusFlow</span>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800">
        <button
          onClick={() => setActiveTab('settings')}
          className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white w-full transition-colors"
        >
          <Settings size={18} />
          <span>{t.nav.settings}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;