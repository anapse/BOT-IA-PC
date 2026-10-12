import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, updateData, deleteData } from '../services/firebase/db';
import { MessageSquare, Plus, Trash2, Power, ShieldCheck, ExternalLink } from 'lucide-react';

interface TelegramConnection {
  id: string;
  name: string;
  botUsername?: string;
  botToken: string;
  agentId?: string;
  webhookUrl?: string;
  status: 'activo' | 'inactivo';
  createdAt: string;
}

export const TelegramPage = () => {
  const [connections, setConnections] = useState<TelegramConnection[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [botToken, setBotToken] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubConns = subscribeCollection('telegramConnections', (data) => {
      setConnections(data as TelegramConnection[]);
      setLoading(false);
    });

    const unsubAgents = subscribeCollection('agents', (data) => {
      setAgents(data);
    });

    return () => {
      unsubConns();
      unsubAgents();
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !botToken.trim()) {
      setErrorMsg('Nombre y Token del bot son obligatorios.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await addData('telegramConnections', {
        name: name.trim(),
        botUsername: botUsername.trim(),
        botToken: botToken.trim(),
        agentId: agentId || (agents[0]?.id || ''),
        status: 'activo',
        createdAt: new Date().toISOString(),
      });
      setName('');
      setBotUsername('');
      setBotToken('');
      setAgentId('');
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta conexión de Telegram?')) {
      await deleteData('telegramConnections', id);
    }
  };

  const toggleStatus = async (conn: TelegramConnection) => {
    const nextStatus = conn.status === 'activo' ? 'inactivo' : 'activo';
    await updateData('telegramConnections', conn.id, { status: nextStatus });
  };

  const maskToken = (token: string) => {
    if (token.length <= 10) return '••••••••';
    return `${token.slice(0, 6)}••••••••${token.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <MessageSquare className="text-blue-400" size={24} />
            Conexiones de Telegram
          </h2>
          <p className="text-sm text-slate-400 mt-1">Conecta tus bots de Telegram con agentes de IA autónomos.</p>
        </div>
        <ActionButton label="Conectar Bot" onClick={() => setIsModalOpen(true)} icon={<Plus size={16} />} />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando conexiones desde Firestore...</div>
      ) : connections.length === 0 ? (
        <Card>
          <div className="p-8 text-center space-y-3">
            <MessageSquare size={40} className="mx-auto text-slate-600" />
            <h3 className="text-base font-medium text-slate-300">No hay bots de Telegram vinculados</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Registra un bot creado con @BotFather en Telegram para permitir que los usuarios interactúen con tus agentes de IA.
            </p>
            <ActionButton label="Registrar primer bot" onClick={() => setIsModalOpen(true)} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((conn) => {
            const assignedAgent = agents.find(a => a.id === conn.agentId);
            return (
              <Card key={conn.id} className="border-slate-800/80 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-slate-100 text-base">{conn.name}</h3>
                      {conn.botUsername && (
                        <p className="text-xs text-blue-400 font-mono mt-0.5">{conn.botUsername}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      conn.status === 'activo'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}>
                      {conn.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-500">Agente asignado:</span>
                      <span className="text-slate-300 font-medium">{assignedAgent?.name || 'Cualquiera'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-500">Token:</span>
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        {maskToken(conn.botToken)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Creado:</span>
                      <span className="text-slate-400">{new Date(conn.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-4">
                  <button
                    onClick={() => toggleStatus(conn)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    <Power size={14} className={conn.status === 'activo' ? 'text-emerald-400' : 'text-slate-500'} />
                    <span>{conn.status === 'activo' ? 'Desconectar' : 'Conectar'}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                    title="Eliminar bot"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Conectar Bot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">Vincular Bot de Telegram</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-300 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              <InputField
                label="Nombre del Bot"
                value={name}
                onChange={setName}
                placeholder="Ej. Asistente Telegram 24/7"
              />

              <InputField
                label="Usuario de Telegram (opcional)"
                value={botUsername}
                onChange={setBotUsername}
                placeholder="@MiBotEjemplo_bot"
              />

              <InputField
                label="Bot Token (@BotFather)"
                value={botToken}
                onChange={setBotToken}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                isSecret
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Asignar a Agente</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Selecciona un agente...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.model})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <ActionButton
                  label={saving ? 'Vinculando...' : 'Guardar Conexión'}
                  onClick={() => {}}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
