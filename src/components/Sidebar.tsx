import { navigation } from '../constants';
import { LogOut } from 'lucide-react';
import { useAuth } from '../services/firebase/auth';

export const Sidebar = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => {
  const { logout } = useAuth();
  
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 h-screen flex flex-col">
      <div className="p-6 text-xl font-bold tracking-tight text-cyan-500">BOT IA PC</div>
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navigation.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-all duration-200 ${activeTab === item.id ? 'bg-slate-900 text-cyan-400 border-l-2 border-cyan-500' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'}`}
          >
            <item.icon size={18} />
            {item.name}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-all rounded-md w-full">
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
