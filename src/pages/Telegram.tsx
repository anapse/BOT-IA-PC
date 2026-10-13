import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, updateData, deleteData, getDocData, getCollectionDataStrict } from '../services/firebase/db';
import { syncWorkerConfig } from '../services/worker/client';
import { MessageSquare, Plus, Trash2, Power, ShieldCheck, Pencil, X } from 'lucide-react';

interface TelegramConnection {
  id: string;
  name: string;
  botUsername?: string;
  botToken: string;
  agentId?: string;
  agentIds?: string[];
  allowedUsers?: string[];
  webhookUrl?: string;
  status: 'activo' | 'inactivo';
  createdAt: string;
}

export const TelegramPage = () => {
  const [connections, setConnections] = useState<TelegramConnection[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<TelegramConnection | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [botToken, setBotToken] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [allowedUsersText, setAllowedUsersText] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncError, setSyncError] = useState('');

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

  const syncCurrentConfig = async () => {
    const workerSettings = await getDocData('appSettings', 'workerConfig');
    const workerUrl = String(workerSettings?.value || 'https://bot-ia-pc.elherreroanapse.workers.dev').trim().replace(/\/$/, '');
    if (!workerUrl) throw new Error('No hay una URL de Worker configurada.');
    const [currentAgents, currentModels, currentConnections] = await Promise.all([
      getCollectionDataStrict('agents'),
      getCollectionDataStrict('modelConfigs'),
      getCollectionDataStrict('telegramConnections'),
    ]);
    return syncWorkerConfig(workerUrl, {
      agents: currentAgents || [],
      models: currentModels || [],
      connections: currentConnections || [],
      syncedAt: new Date().toISOString(),
    });
  };

  const syncAfterChange = async () => {
    try {
      await syncCurrentConfig();
      setSyncError('');
      return true;
    } catch (err: any) {
      const message = err?.message || 'No se pudo sincronizar la configuración con el Worker.';
      setSyncError(`Telegram se guardó en Firebase, pero el Worker no se actualizó: ${message}`);
      return false;
    }
  };

  const resetForm = () => {
    setName('');
    setBotUsername('');
    setBotToken('');
    setAgentId('');
    setAgentIds([]);
    setAllowedUsersText('');
    setEditingConnection(null);
    setErrorMsg('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (conn: TelegramConnection) => {
    setEditingConnection(conn);
    setName(conn.name || '');
    setBotUsername(conn.botUsername || '');
    setBotToken('');
    setAgentId(conn.agentId || '');
    setAgentIds(Array.isArray(conn.agentIds) ? conn.agentIds : (conn.agentId ? [conn.agentId] : []));
    setAllowedUsersText(Array.isArray(conn.allowedUsers) ? conn.allowedUsers.join(', ') : '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const parseAllowedUsers = (value: string) => [...new Set(value.split(/[\\n,;]+/).map((user) => user.trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];

  const toggleAgent = (id: string) => {
    setAgentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!editingConnection && !botToken.trim()) || agentIds.length === 0) {
      setErrorMsg(agentIds.length === 0 ? 'Selecciona al menos un agente para este bot.' : editingConnection ? 'El nombre del bot es obligatorio.' : 'Nombre y Token del bot son obligatorios.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      if (editingConnection) {
        const changes: Partial<TelegramConnection> = {
          name: name.trim(),
          botUsername: botUsername.trim(),
          agentId: agentIds[0],
          agentIds,
          allowedUsers: parseAllowedUsers(allowedUsersText),
        };
        if (botToken.trim()) changes.botToken = botToken.trim();
        await updateData('telegramConnections', editingConnection.id, changes);
      } else {
        await addData('telegramConnections', {
          name: name.trim(),
          botUsername: botUsername.trim(),
          botToken: botToken.trim(),
          agentId: agentIds[0],
          agentIds,
          allowedUsers: parseAllowedUsers(allowedUsersText),
          status: 'activo',
          createdAt: new Date().toISOString(),
        });
      }
      await syncAfterChange();
      resetForm();
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta conexión de Telegram?')) {
      try {
        await deleteData('telegramConnections', id);
        await syncAfterChange();
      } catch (err: any) {
        setSyncError(err?.message || 'No se pudo eliminar la conexión de Telegram.');
      }
    }
  };

  const toggleStatus = async (conn: TelegramConnection) => {
    const nextStatus = conn.status === 'activo' ? 'inactivo' : 'activo';
    try {
      await updateData('telegramConnections', conn.id, { status: nextStatus });
      await syncAfterChange();
    } catch (err: any) {
      setSyncError(err?.message || 'No se pudo cambiar el estado del bot.');
    }
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
        <ActionButton label="Conectar Bot" onClick={openCreateModal} icon={<Plus size={16} />} />
      </div>

      {syncError && (
        <div className="p-3 rounded-lg border border-amber-800/60 bg-amber-950/30 text-amber-200 text-sm">
          {syncError}
          <button onClick={() => void syncAfterChange()} className="ml-3 underline underline-offset-2 hover:text-white">Reintentar sincronización</button>
        </div>
      )}

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
            <ActionButton label="Registrar primer bot" onClick={openCreateModal} />
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
                      <span className="text-slate-300 font-medium">{Array.isArray(conn.agentIds) && conn.agentIds.length > 1 ? `${conn.agentIds.length} agentes` : assignedAgent?.name || 'Sin agente'}</span>
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
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(conn)}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                    title="Editar bot"
                    aria-label={`Editar ${conn.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                    title="Eliminar bot"
                  >
                    <Trash2 size={15} />
                  </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal crear o editar Bot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">{editingConnection ? "Editar Bot de Telegram" : "Vincular Bot de Telegram"}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
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
                placeholder={editingConnection ? "Deja vacío para conservar el token actual" : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
                isSecret
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-slate-300">Agentes disponibles para este bot</label>
                  <span className="text-xs text-cyan-300">{agentIds.length} seleccionados</span>
                </div>
                <p className="text-xs text-slate-500">Selecciona uno o varios agentes. En Telegram podrán elegirse con $agente list.</p>
                {agents.length === 0 ? (
                  <p className="text-xs text-amber-300 rounded-lg border border-amber-900/60 p-3">Primero crea agentes en la sección Agentes.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    {agents.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-900 cursor-pointer">
                        <input type="checkbox" checked={agentIds.includes(a.id)} onChange={() => toggleAgent(a.id)} className="accent-cyan-500" />
                        <span className="text-sm text-slate-200">{a.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{a.model || ""}</span>
                      </label>
                    ))}
                  </div>
                )}
                {agentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {agentIds.map((id) => {
                      const selected = agents.find((a) => a.id === id);
                      return selected ? <span key={id} className="inline-flex items-center gap-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 px-2 py-1 text-xs text-cyan-200">{selected.name}<button type="button" onClick={() => toggleAgent(id)} aria-label={"Quitar " + selected.name}><X size={12} /></button></span> : null;
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Usuarios permitidos (opcional)</label>
                <textarea value={allowedUsersText} onChange={(e) => setAllowedUsersText(e.target.value)} rows={3} placeholder={"Ej. @usuario1, 123456789\nPuedes separar usuarios por comas o líneas"} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500" />
                <p className="text-xs text-slate-500">Déjalo vacío para que cualquiera pueda usar el bot. Admite nombres de usuario de Telegram (@usuario) o IDs numéricos.</p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <ActionButton
                  label={saving ? 'Guardando...' : editingConnection ? 'Guardar Cambios' : 'Guardar Conexión'}
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
