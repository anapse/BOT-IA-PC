import { navigation } from '../constants';
import { LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../services/firebase/auth';

export const Sidebar = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => {
  const { logout } = useAuth();

  return (
    <aside className="flex h-auto w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950/95 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 md:px-6 md:py-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-950/40">
          <Sparkles size={21} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight text-slate-100">BOT IA <span className="text-sky-400">PC</span></div>
          <div className="text-[10px] font-medium uppercase tracking-[0.17em] text-slate-500">Control center</div>
        </div>
      </div>
      <nav aria-label="Navegación principal" className="flex min-w-0 flex-row gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-3 md:py-5">
        {navigation.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
            title={item.name}
            className={`flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 md:w-full md:px-3.5 ${activeTab === item.id ? 'nav-item-active' : 'text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100'}`}
          >
            <item.icon size={17} strokeWidth={1.9} className="shrink-0" />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3 md:p-4">
        <button onClick={logout} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 md:justify-start md:px-4">
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
