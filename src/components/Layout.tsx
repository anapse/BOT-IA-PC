import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { navigation } from '../constants';

export const Layout = ({ activeTab, onTabChange, children }: { activeTab: string, onTabChange: (tab: string) => void, children: ReactNode }) => {
  const currentTab = navigation.find(item => item.id === activeTab);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-main-header sticky top-0 z-20 flex items-center justify-between gap-4 px-8 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Espacio de trabajo</p>
            <h1 className="truncate text-lg font-semibold text-slate-100">{currentTab?.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-slate-400">
            <span className="system-status inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Sistema operativo
            </span>
            <div aria-label="Sistema activo" title="Sistema activo" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-violet-300">
              IA
            </div>
          </div>
        </header>
        <main className="app-content flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
