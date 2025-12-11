import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Mail, MessageSquare, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'src/i18n';

interface DashboardProps {
    setActiveTab: (tab: string) => void;
}

const data = [
  { name: 'Mon', sent: 0, replies: 0 },
  { name: 'Tue', sent: 0, replies: 0 },
  { name: 'Wed', sent: 0, replies: 0 },
  { name: 'Thu', sent: 0, replies: 0 },
  { name: 'Fri', sent: 0, replies: 0 },
  { name: 'Sat', sent: 0, replies: 0 },
  { name: 'Sun', sent: 0, replies: 0 },
];

const StatCard: React.FC<{ title: string; value: string; sub: string; icon: React.ElementType; color: string }> = ({ title, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
        <p className={`text-xs mt-1 ${sub.includes('+') ? 'text-green-600' : 'text-slate-400'}`}>{sub}</p>
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const t = useTranslation();
  
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t.dashboard.totalOutreach} value="0" sub="No campaigns yet" icon={Mail} color="bg-blue-100 text-blue-600" />
        <StatCard title={t.dashboard.responseRate} value="0%" sub="No data available" icon={MessageSquare} color="bg-emerald-100 text-emerald-600" />
        <StatCard title={t.dashboard.pendingDrafts} value="0" sub="No pending drafts" icon={AlertCircle} color="bg-amber-100 text-amber-600" />
        <StatCard title={t.dashboard.activeLeads} value="0" sub="No active leads" icon={Users} color="bg-indigo-100 text-indigo-600" />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t.dashboard.weeklyPerformance}</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Bar dataKey="sent" name="Emails Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replies" name="Responses" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t.dashboard.quickActions}</h3>
          <div className="space-y-3">
            <button 
                onClick={() => setActiveTab('outbound')}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group text-left"
            >
              <div>
                <span className="font-semibold text-slate-700 block group-hover:text-blue-700">{t.dashboard.newCampaign}</span>
                <span className="text-sm text-slate-500">Upload CSV & Start Batch</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-blue-600" />
            </button>

            <button 
                onClick={() => setActiveTab('inbound')}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group text-left"
            >
              <div>
                <span className="font-semibold text-slate-700 block group-hover:text-emerald-700">{t.dashboard.reviewInbox}</span>
                <span className="text-sm text-slate-500">No pending emails</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-600" />
            </button>

             <button 
                onClick={() => setActiveTab('knowledge')}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group text-left"
            >
              <div>
                <span className="font-semibold text-slate-700 block group-hover:text-indigo-700">{t.dashboard.updateKnowledge}</span>
                <span className="text-sm text-slate-500">Upload documents to get started</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-indigo-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;