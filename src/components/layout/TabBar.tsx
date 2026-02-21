import { Settings, LayoutDashboard, Box, GitCompare, BookOpen } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import type { TabId } from '../../types';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'configure', label: 'Configure', icon: <Settings className="w-4 h-4" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'container', label: 'Container Layout', icon: <Box className="w-4 h-4" /> },
  { id: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
  { id: 'sources', label: 'Data Sources', icon: <BookOpen className="w-4 h-4" /> },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useUiStore();

  return (
    <nav className="bg-slate-800/50 border-b border-slate-700 px-6 flex gap-1 shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
