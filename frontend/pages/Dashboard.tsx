import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Mail, MessageSquare, AlertCircle, ArrowRight, BarChart3 } from 'lucide-react';
import { useTranslation } from 'src/i18n';
import { getEmailStats } from '../services/apiService';

interface DashboardProps {
    setActiveTab: (tab: string) => void;
}

interface EmailStats {
    totalOutreach: number;
    totalReplies: number;
    pendingDrafts: number;
    activeLeads: number;
    responseRate: number;
    responseRateText: string;
    weeklyData: Array<{
        name: string;
        sent: number;
        replies: number;
        date: string;
    }>;
}

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
  const [stats, setStats] = useState<EmailStats>({
    totalOutreach: 0,
    totalReplies: 0,
    pendingDrafts: 0,
    activeLeads: 0,
    responseRate: 0,
    responseRateText: '0%',
    weeklyData: [
      { name: 'Mon', sent: 0, replies: 0, date: '' },
      { name: 'Tue', sent: 0, replies: 0, date: '' },
      { name: 'Wed', sent: 0, replies: 0, date: '' },
      { name: 'Thu', sent: 0, replies: 0, date: '' },
      { name: 'Fri', sent: 0, replies: 0, date: '' },
      { name: 'Sat', sent: 0, replies: 0, date: '' },
      { name: 'Sun', sent: 0, replies: 0, date: '' },
    ]
  });
  const [isLoading, setIsLoading] = useState(true);

  // 加载邮件统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        const emailStats = await getEmailStats();
        setStats(emailStats);
      } catch (error) {
        console.error('Failed to load email stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
    
    // 每10秒刷新一次统计数据以实现实时更新
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // 监听页面可见性变化，页面重新可见时立即刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const loadStats = async () => {
          try {
            const emailStats = await getEmailStats();
            setStats(emailStats);
          } catch (error) {
            console.error('Failed to load email stats:', error);
          }
        };
        loadStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t.dashboard.totalOutreach} 
          value={isLoading ? '...' : stats.totalOutreach.toString()} 
          sub={stats.totalOutreach === 0 ? (t.common.loading === '加载中...' ? '暂无活动' : 'No campaigns yet') : (t.common.loading === '加载中...' ? '本月发送' : 'This month')} 
          icon={Mail} 
          color="bg-blue-100 text-blue-600" 
        />
        <StatCard 
          title={t.dashboard.responseRate} 
          value={isLoading ? '...' : stats.responseRateText} 
          sub={stats.totalOutreach === 0 ? (t.common.loading === '加载中...' ? '暂无数据' : 'No data available') : `${stats.totalReplies} ${t.common.loading === '加载中...' ? '回复' : 'replies'}`} 
          icon={MessageSquare} 
          color="bg-emerald-100 text-emerald-600" 
        />
        <StatCard 
          title={t.dashboard.pendingDrafts} 
          value={isLoading ? '...' : stats.pendingDrafts.toString()} 
          sub={stats.pendingDrafts === 0 ? (t.common.loading === '加载中...' ? '无待处理草稿' : 'No pending drafts') : (t.common.loading === '加载中...' ? '需要处理' : 'Need attention')} 
          icon={AlertCircle} 
          color="bg-amber-100 text-amber-600" 
        />
        <StatCard 
          title={t.dashboard.activeLeads} 
          value={isLoading ? '...' : stats.activeLeads.toString()} 
          sub={stats.activeLeads === 0 ? (t.common.loading === '加载中...' ? '无活跃线索' : 'No active leads') : (t.common.loading === '加载中...' ? '潜在客户' : 'Potential customers')} 
          icon={Users} 
          color="bg-indigo-100 text-indigo-600" 
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">{t.dashboard.weeklyPerformance}</h3>
            <div className="text-xs text-slate-500">
              {t.common.loading === '加载中...' ? '最近7天活动' : 'Last 7 days activity'}
            </div>
          </div>
          <div className="h-80 w-full">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-pulse flex space-x-4 w-full">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-32 bg-slate-200 rounded"></div>
                      <div className="h-32 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : stats.weeklyData && stats.weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 12}} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 12}} 
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      backgroundColor: 'white'
                    }}
                    cursor={{fill: '#f1f5f9'}}
                    labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                  />
                  <Bar 
                    dataKey="sent" 
                    name={t.common.loading === '加载中...' ? '已发送邮件' : 'Emails Sent'} 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                  <Bar 
                    dataKey="replies" 
                    name={t.common.loading === '加载中...' ? '回复数量' : 'Responses'} 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 size={48} className="mb-4 text-slate-200" />
                <p className="text-center">
                  {t.common.loading === '加载中...' ? '暂无活动数据' : 'No activity data yet'}
                </p>
                <p className="text-xs text-center mt-2">
                  {t.common.loading === '加载中...' ? '发送邮件后数据将显示在这里' : 'Data will appear here after sending emails'}
                </p>
              </div>
            )}
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
                <span className="text-sm text-slate-500">{t.common.loading === '加载中...' ? '上传CSV并开始批量处理' : 'Upload CSV & Start Batch'}</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-blue-600" />
            </button>

            <button 
                onClick={() => setActiveTab('inbound')}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group text-left"
            >
              <div>
                <span className="font-semibold text-slate-700 block group-hover:text-emerald-700">{t.dashboard.reviewInbox}</span>
                <span className="text-sm text-slate-500">{t.common.loading === '加载中...' ? '无待处理邮件' : 'No pending emails'}</span>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-600" />
            </button>

             <button 
                onClick={() => setActiveTab('knowledge')}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group text-left"
            >
              <div>
                <span className="font-semibold text-slate-700 block group-hover:text-indigo-700">{t.dashboard.updateKnowledge}</span>
                <span className="text-sm text-slate-500">{t.common.loading === '加载中...' ? '上传文档开始使用' : 'Upload documents to get started'}</span>
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