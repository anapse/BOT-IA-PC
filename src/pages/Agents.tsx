import { useState, useEffect } from 'react';
import { ActionButton } from '../components/ActionButton';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { subscribeCollection, addData, updateData, deleteData, getDocData } from '../services/firebase/db';
import { Bot, Plus, Trash2, Edit2, Play, Pause, Search, Send, MessageCircle } from 'lucide-react';
import { sendAgentChatMessage } from '../services/worker/client';

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  connectionType: 'cloud' | 'local';
  status: 'activo' | 'inactivo';
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  systemPrompt?: string;
  model?: string;
  status: 'activo' | 'inactivo' | 'pausado';
  createdAt: string;
}

export const AgentsPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<'activo' | 'inactivo' | 'pausado'>('activo');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeCollection('agents', (data) => {
      setAgents(data as Agent[]);
      setLoading(false);
    });
    const unsubscribeModels = subscribeCollection('modelConfigs', (data) => {
      setModels(data as ModelConfig[]);
    });
    return () => {
      unsubscribe();
      unsubscribeModels();
    };
  }, []);

  const openCreateModal = () => {
    setEditingAgent(null);
    setName('');
    setDescription('');
    setPersonality('Asistente profesional y analítico');
    setSystemPrompt('Eres un agente autónomo de Bot IA PC...');
    setModel(models.find((item) => item.status === 'activo')?.modelId || '');
    setStatus('activo');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setDescription(agent.description || '');
    setPersonality(agent.personality || '');
    setSystemPrompt(agent.systemPrompt || '');
    setModel(agent.model || models.find((item) => item.status === 'activo')?.modelId || '');
    setStatus(agent.status || 'activo');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      if (editingAgent) {
        await updateData('agents', editingAgent.id, {
          name: name.trim(),
          description: description.trim(),
          personality: personality.trim(),
          systemPrompt: systemPrompt.trim(),
          model,
          status,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addData('agents', {
          name: name.trim(),
          description: description.trim(),
          personality: personality.trim(),
          systemPrompt: systemPrompt.trim(),
          model,
          status,
          createdAt: new Date().toISOString(),
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el agente');
    } finally {
      setSaving(false);
    }
  };

  const handleTestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatAgent || !chatMessage.trim()) return;
    setChatLoading(true);
    setChatError('');
    setChatReply('');
    try {
      const saved = await getDocData('appSettings', 'workerConfig');
      const workerUrl = String(saved?.value || 'https://bot-ia-pc.elherreroanapse.workers.dev').replace(/\/$/, '');
      const result = await sendAgentChatMessage(workerUrl, chatAgent.id, chatMessage.trim());
      setChatReply(result.reply);
      setChatModel(result.model);
      setChatMessage('');
    } catch (err: any) {
      setChatError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este agente?')) {
      try {
        await deleteData('agents', id);
      } catch (err: any) {
        alert(err.message || 'Error al eliminar');
      }
    }
  };

  const toggleStatus = async (agent: Agent) => {
    const nextStatus = agent.status === 'activo' ? 'pausado' : 'activo';
    await updateData('agents', agent.id, { status: nextStatus });
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bot className="text-cyan-400" size={24} />
            Agentes de Inteligencia Artificial
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configura, entrena y gestiona los agentes autónomos del sistema.</p>
        </div>
        <ActionButton label="Nuevo Agente" onClick={openCreateModal} icon={<Plus size={16} />} />
      </div>

      <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 w-full max-w-md">
        <Search size={18} className="text-slate-500" />
        <input
          type="text"
          placeholder="Buscar agentes por nombre o función..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none text-sm text-slate-200 focus:outline-none w-full"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando agentes desde Firestore...</div>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <div className="p-8 text-center space-y-3">
            <Bot size={40} className="mx-auto text-slate-600" />
            <h3 className="text-base font-medium text-slate-300">No hay agentes configurados</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Crea tu primer agente para conectarlo con Telegram, modelos LLM y enrutamiento automatizado.
            </p>
            <ActionButton label="Crear primer agente" onClick={openCreateModal} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map(agent => (
            <Card key={agent.id} className="relative group border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                      <Bot size={20} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-100 text-base">{agent.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">{agent.model}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    agent.status === 'activo'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      : agent.status === 'pausado'
                      ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {agent.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                  {agent.description || 'Sin descripción asignada.'}
                </p>

                {agent.personality && (
                  <div className="bg-slate-900/40 rounded p-2 text-xs text-slate-400 mb-4 border border-slate-800/50">
                    <span className="text-slate-500 font-medium">Personalidad: </span>
                    {agent.personality}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-2">
                <button
                  onClick={() => toggleStatus(agent)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {agent.status === 'activo' ? <Pause size={14} /> : <Play size={14} />}
                  <span>{agent.status === 'activo' ? 'Pausar' : 'Activar'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setChatAgent(agent); setChatMessage(''); setChatReply(''); setChatError(''); setChatModel(''); }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                    title="Probar conversación con Gemini"
                  >
                    <MessageCircle size={15} />
                  </button>
                  <button
                    onClick={() => openEditModal(agent)}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                    title="Editar agente"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                    title="Eliminar agente"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para probar conversación con el agente */}
      {chatAgent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-100 text-lg">Probar agente: {chatAgent.name}</h3>
                <p className="text-xs text-slate-400 mt-1">La petición se procesa en el Worker; la API Key no se envía al navegador.</p>
              </div>
              <button type="button" onClick={() => setChatAgent(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {chatReply && <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4"><div className="text-xs text-emerald-300 mb-2">Respuesta de {chatModel || chatAgent.model}</div><p className="text-sm text-slate-200 whitespace-pre-wrap">{chatReply}</p></div>}
              {chatError && <div className="rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-300">{chatError}</div>}
              <form onSubmit={handleTestChat} className="space-y-3">
                <textarea value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Escribe un mensaje para probar este agente..." maxLength={12000} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-y" required />
                <div className="flex justify-between items-center gap-3">
                  <span className="text-xs text-slate-500">Usa la configuración sincronizada en Cloudflare KV.</span>
                  <button type="submit" disabled={chatLoading || !chatMessage.trim()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm"><Send size={14} /> {chatLoading ? 'Consultando Gemini...' : 'Enviar prueba'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">
                {editingAgent ? 'Editar Agente' : 'Nuevo Agente IA'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-300 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              <InputField
                label="Nombre del Agente"
                value={name}
                onChange={setName}
                placeholder="Ej. Asistente de Soporte PC"
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Propósito u objetivo de este agente..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Modelo IA</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  >
                    <option value="" disabled>
                      {models.filter((item) => item.status === 'activo').length
                        ? 'Selecciona un modelo activo'
                        : 'No hay modelos activos; configura uno en Modelos'}
                    </option>
                    {model && !models.some((item) => item.status === 'activo' && item.modelId === model) && (
                      <option value={model}>{model} (asignación anterior; elige un modelo activo)</option>
                    )}
                    {models.filter((item) => item.status === 'activo').map((item) => (
                      <option key={item.id} value={item.modelId}>
                        {item.name} — {item.modelId}
                      </option>
                    ))}
                  </select>
                  {models.filter((item) => item.status === 'activo').length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">
                      Primero registra y activa un modelo en la sección Modelos.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Estado inicial</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Personalidad / Tono</label>
                <input
                  type="text"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Ej. Técnico, cortés, resolutivo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">System Prompt (Instrucción Base)</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Instrucciones maestras del comportamiento..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 h-24 font-mono text-xs"
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
                <ActionButton
                  label={saving ? 'Guardando...' : editingAgent ? 'Actualizar' : 'Crear Agente'}
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
