import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, updateData, deleteData } from '../services/firebase/db';
import { Network, Plus, Trash2, ArrowRight, Power } from 'lucide-react';

interface CommunicationRoute {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  channel: string;
  priority: 'alta' | 'normal' | 'baja';
  status: 'activa' | 'inactiva';
  createdAt: string;
}

export const CommunicationPage = () => {
  const [routes, setRoutes] = useState<CommunicationRoute[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [sourceAgent, setSourceAgent] = useState('');
  const [targetAgent, setTargetAgent] = useState('');
  const [channel, setChannel] = useState('Telegram');
  const [priority, setPriority] = useState<'alta' | 'normal' | 'baja'>('normal');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubRoutes = subscribeCollection('communicationRoutes', (data) => {
      setRoutes(data as CommunicationRoute[]);
      setLoading(false);
    });

    const unsubAgents = subscribeCollection('agents', (data) => {
      setAgents(data);
    });

    return () => {
      unsubRoutes();
      unsubAgents();
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAgent || !targetAgent) {
      setErrorMsg('Debes seleccionar un agente de origen y un agente de destino.');
      return;
    }
    if (sourceAgent === targetAgent) {
      setErrorMsg('El agente de origen y destino deben ser diferentes.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await addData('communicationRoutes', {
        sourceAgent,
        targetAgent,
        channel,
        priority,
        status: 'activa',
        createdAt: new Date().toISOString(),
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la ruta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta ruta de comunicación?')) {
      await deleteData('communicationRoutes', id);
    }
  };

  const toggleStatus = async (route: CommunicationRoute) => {
    const nextStatus = route.status === 'activa' ? 'inactiva' : 'activa';
    await updateData('communicationRoutes', route.id, { status: nextStatus });
  };

  const getAgentName = (id: string) => {
    const agent = agents.find(a => a.id === id);
    return agent ? agent.name : 'Agente Desconocido';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Network className="text-cyan-400" size={24} />
            Enrutamiento y Comunicación entre Agentes
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configura flujos de intercambio de información y derivación de tareas.</p>
        </div>
        <ActionButton label="Nueva Ruta" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando rutas desde Firestore...</div>
      ) : routes.length === 0 ? (
        <Card>
          <div className="p-8 text-center space-y-3">
            <Network size={40} className="mx-auto text-slate-600" />
            <h3 className="text-base font-medium text-slate-300">No hay reglas de enrutamiento activas</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Crea rutas para que las consultas de Telegram o los eventos de tu PC se distribuyan automáticamente entre agentes especializados.
            </p>
            <ActionButton label="Configurar primera ruta" onClick={() => setIsModalOpen(true)} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((r) => (
            <Card key={r.id} className="border-slate-800/80 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Canal: {r.channel}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    r.status === 'activa'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {r.status}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-center flex-1">
                    <span className="text-xs text-slate-500 block">Origen</span>
                    <span className="text-sm font-semibold text-slate-200">{getAgentName(r.sourceAgent)}</span>
                  </div>
                  <ArrowRight size={18} className="text-cyan-400 shrink-0 mx-2" />
                  <div className="text-center flex-1">
                    <span className="text-xs text-slate-500 block">Destino</span>
                    <span className="text-sm font-semibold text-slate-200">{getAgentName(r.targetAgent)}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400 flex justify-between">
                  <span>Prioridad: <strong className="text-slate-200 capitalize">{r.priority}</strong></span>
                  <span>Creado: {new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-4">
                <button
                  onClick={() => toggleStatus(r)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  <Power size={14} className={r.status === 'activa' ? 'text-emerald-400' : 'text-slate-500'} />
                  <span>{r.status === 'activa' ? 'Desactivar' : 'Activar'}</span>
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  title="Eliminar ruta"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nueva Ruta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">Nueva Regla de Comunicación</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-300 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Agente de Origen (Emisor)</label>
                <select
                  value={sourceAgent}
                  onChange={(e) => setSourceAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Selecciona emisor...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Agente de Destino (Receptor)</label>
                <select
                  value={targetAgent}
                  onChange={(e) => setTargetAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Selecciona receptor...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Canal</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="Web Chat">Web Chat</option>
                    <option value="API Interna">API Interna</option>
                    <option value="Cron / Tarea">Cron / Tarea</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="alta">Alta</option>
                    <option value="normal">Normal</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <ActionButton label={saving ? 'Creando...' : 'Crear Ruta'} onClick={() => {}} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
