import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, deleteData } from '../services/firebase/db';
import { FileText, Plus, Trash2, Filter, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

interface LogItem {
  id: string;
  level: 'info' | 'warning' | 'error';
  source: string;
  message: string;
  createdAt: string;
}

export const LogsPage = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New log form
  const [source, setSource] = useState('Sistema');
  const [level, setLevel] = useState<'info' | 'warning' | 'error'>('info');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeCollection('logs', (data) => {
      const sorted = (data as LogItem[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLogs(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      await addData('logs', {
        level,
        source: source.trim(),
        message: message.trim(),
        createdAt: new Date().toISOString(),
      });
      setMessage('');
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    await deleteData('logs', id);
  };

  const handleClearAll = async () => {
    if (confirm('¿Deseas purgar los registros de eventos visibles?')) {
      for (const log of logs) {
        await deleteData('logs', log.id);
      }
    }
  };

  const filteredLogs = selectedLevel === 'all'
    ? logs
    : logs.filter(l => l.level === selectedLevel);

  const getLevelBadge = (lvl: string) => {
    switch (lvl) {
      case 'error':
        return (
          <span className="flex items-center gap-1 text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded text-xs">
            <AlertOctagon size={12} /> Error
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-xs">
            <AlertTriangle size={12} /> Aviso
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded text-xs">
            <Info size={12} /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="text-cyan-400" size={24} />
            Registros Técnicos y Auditoría
          </h2>
          <p className="text-sm text-slate-400 mt-1">Historial de eventos del sistema almacenados persistentemente en Firestore.</p>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800/50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} /> Purgar
            </button>
          )}
          <ActionButton label="Registrar Evento" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-xs text-slate-400">
        <Filter size={14} className="text-slate-500 ml-1" />
        <span>Filtrar por nivel:</span>
        <button
          onClick={() => setSelectedLevel('all')}
          className={`px-2 py-1 rounded transition-colors ${selectedLevel === 'all' ? 'bg-slate-800 text-slate-100' : 'hover:text-slate-200'}`}
        >
          Todos ({logs.length})
        </button>
        <button
          onClick={() => setSelectedLevel('info')}
          className={`px-2 py-1 rounded transition-colors ${selectedLevel === 'info' ? 'bg-slate-800 text-cyan-400' : 'hover:text-slate-200'}`}
        >
          Info ({logs.filter(l => l.level === 'info').length})
        </button>
        <button
          onClick={() => setSelectedLevel('warning')}
          className={`px-2 py-1 rounded transition-colors ${selectedLevel === 'warning' ? 'bg-slate-800 text-amber-400' : 'hover:text-slate-200'}`}
        >
          Avisos ({logs.filter(l => l.level === 'warning').length})
        </button>
        <button
          onClick={() => setSelectedLevel('error')}
          className={`px-2 py-1 rounded transition-colors ${selectedLevel === 'error' ? 'bg-slate-800 text-red-400' : 'hover:text-slate-200'}`}
        >
          Errores ({logs.filter(l => l.level === 'error').length})
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando registros...</div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <div className="p-8 text-center space-y-3">
            <FileText size={40} className="mx-auto text-slate-600" />
            <h3 className="text-base font-medium text-slate-300">No hay registros para mostrar</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Los eventos de interacción de agentes, Telegram y el Worker se almacenarán automáticamente aquí.
            </p>
            <ActionButton label="Añadir evento manual" onClick={() => setIsModalOpen(true)} />
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-800">
          <div className="divide-y divide-slate-800/80 font-mono text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-slate-900/40 flex items-start justify-between gap-4 transition-colors">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="shrink-0 mt-0.5">{getLevelBadge(log.level)}</span>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-semibold">{log.source}</span>
                      <span className="text-slate-500 text-[11px] font-sans">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-300 break-words font-sans text-xs">{log.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteLog(log.id)}
                  className="p-1 text-slate-500 hover:text-red-400 rounded shrink-0 transition-colors"
                  title="Eliminar registro"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal Añadir Log */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">Registrar Evento Técnico</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleAddLog} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Origen / Módulo</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Sistema">Sistema</option>
                    <option value="Agente IA">Agente IA</option>
                    <option value="Telegram">Telegram</option>
                    <option value="Worker">Worker</option>
                    <option value="Firebase">Firebase</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Nivel</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="info">Información</option>
                    <option value="warning">Aviso</option>
                    <option value="error">Error Crítico</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Mensaje del Evento</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detalles del suceso, código de respuesta o advertencia..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 h-24 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <ActionButton label={saving ? 'Guardando...' : 'Registrar'} onClick={() => {}} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
