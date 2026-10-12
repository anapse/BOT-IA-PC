import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { navigation } from '../constants';

export const Layout = ({ activeTab, onTabChange, children }: { activeTab: string, onTabChange: (tab: string) => void, children: ReactNode }) => {
  const currentTab = navigation.find(item => item.id === activeTab);
  return (
    <div className="flex min-h-screen">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex-1 flex flex-col bg-slate-950">
        <header className="bg-slate-950/50 backdrop-blur-sm border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-100">{currentTab?.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
             <span>Sistema: <span className="text-cyan-500">Operativo</span></span>
             <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700" />
          </div>
        </header>
        <main className="p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
