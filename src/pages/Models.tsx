import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, updateData, deleteData } from '../services/firebase/db';
import { BrainCircuit, Plus, Trash2, Cpu, Globe, Pencil } from 'lucide-react';

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  connectionType: 'cloud' | 'local';
  endpoint?: string;
  apiKey?: string;
  status: 'activo' | 'inactivo';
  createdAt: string;
}

export const ModelsPage = () => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('Google Gemini');
  const [modelId, setModelId] = useState('gemini-1.5-pro');
  const [connectionType, setConnectionType] = useState<'cloud' | 'local'>('cloud');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [catalogModels, setCatalogModels] = useState<{ id: string; name: string; contextLength?: number | null }[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const filteredCatalogModels = catalogModels.filter((item) => {
    const search = catalogSearch.trim().toLowerCase();
    return !search || `${item.name} ${item.id}`.toLowerCase().includes(search);
  });

  useEffect(() => {
    const unsub = subscribeCollection('modelConfigs', (data) => {
      setModels(data as ModelConfig[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loadModelCatalog = async () => {
    if (!apiKey.trim()) { setErrorMsg('Introduce la API Key antes de cargar el catálogo.'); return; }
    setLoadingCatalog(true); setErrorMsg('');
    try {
      const response = await fetch('https://bot-ia-pc.elherreroanapse.workers.dev/models/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, apiKey: apiKey.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el catálogo.');
      const items = Array.isArray(result.models) ? result.models : [];
      if (items.length === 0) throw new Error('La API no devolvió modelos disponibles para esta clave.');
      setCatalogModels(items);
      setCatalogSearch(provider === 'OpenRouter' ? 'free' : '');
      const selected = items.find((item: any) => item.id === modelId);
      if (!selected) { setModelId(items[0].id); if (!name.trim()) setName(items[0].name); }
    } catch (err: any) { setErrorMsg(err.message || 'Error consultando el catálogo.'); }
    finally { setLoadingCatalog(false); }
  };
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !modelId.trim()) {
      setErrorMsg('Nombre e ID del modelo son requeridos.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const modelData = {
        name: name.trim(),
        provider,
        modelId: modelId.trim(),
        connectionType,
        endpoint: endpoint.trim(),
        ...(connectionType === 'cloud' && apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      };
      if (editingModelId) {
        await updateData('modelConfigs', editingModelId, modelData);
      } else {
        await addData('modelConfigs', {
          ...modelData,
          status: 'activo',
          createdAt: new Date().toISOString(),
        });
      }
      setName('');
      setProvider('Google Gemini');
      setModelId('gemini-1.5-pro');
      setConnectionType('cloud');
      setEndpoint('');
      setApiKey('');
      setEditingModelId(null);
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el modelo');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (model: ModelConfig) => {
    setEditingModelId(model.id);
    setName(model.name || '');
    setProvider(model.provider || 'Google Gemini');
    setModelId(model.modelId || '');
    setConnectionType(model.connectionType || 'cloud');
    setEndpoint(model.endpoint || '');
    setApiKey(model.apiKey || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditingModelId(null);
    setName('');
    setProvider('Google Gemini');
    setModelId('gemini-1.5-pro');
    setConnectionType('cloud');
    setEndpoint('');
    setApiKey('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta configuración de modelo?')) {
      await deleteData('modelConfigs', id);
    }
  };

  const toggleStatus = async (model: ModelConfig) => {
    const nextStatus = model.status === 'activo' ? 'inactivo' : 'activo';
    await updateData('modelConfigs', model.id, { status: nextStatus });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BrainCircuit className="text-purple-400" size={24} />
            Modelos de Inteligencia Artificial
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configura motores LLM en la nube y modelos locales ejecutados en tu PC.</p>
        </div>
        <ActionButton label="Añadir Modelo" onClick={openCreate} icon={<Plus size={16} />} />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Cargando modelos desde Firestore...</div>
      ) : models.length === 0 ? (
        <Card>
          <div className="p-8 text-center space-y-3">
            <BrainCircuit size={40} className="mx-auto text-slate-600" />
            <h3 className="text-base font-medium text-slate-300">No hay modelos configurados</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Registra modelos como Gemini 1.5, OpenAI GPT-4o, Claude o servidores Ollama locales para asignarlos a tus agentes.
            </p>
            <ActionButton label="Configurar primer modelo" onClick={openCreate} />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <Card key={m.id} className="border-slate-800/80 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-purple-950/60 text-purple-400 rounded-lg border border-purple-800/40">
                      {m.connectionType === 'local' ? <Cpu size={20} /> : <Globe size={20} />}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-100 text-sm">{m.name}</h3>
                      <p className="text-xs text-slate-400">{m.provider}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    m.status === 'activo'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800/60 mt-3 font-mono">
                  <div className="text-slate-400">
                    <span className="text-slate-500">ID: </span>
                    {m.modelId}
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-500">Tipo: </span>
                    {m.connectionType === 'local' ? 'Local PC (Ollama / VLLM)' : 'API Cloud'}
                  </div>
                  {m.endpoint && (
                    <div className="text-slate-400 truncate">
                      <span className="text-slate-500">Endpoint: </span>
                      {m.endpoint}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 mt-4">
                <button
                  onClick={() => openEdit(m)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => toggleStatus(m)}
                  className="text-xs text-slate-400 hover:text-purple-400 transition-colors"
                >
                  {m.status === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  title="Eliminar modelo"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Añadir Modelo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-100 text-lg">{editingModelId ? 'Editar Modelo de IA' : 'Registrar Modelo de IA'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingModelId(null); }} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-300 text-xs rounded">
                  {errorMsg}
                </div>
              )}

              <InputField
                label="Nombre identificador"
                value={name}
                onChange={setName}
                placeholder="Ej. Gemini 1.5 Flash Principal"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Proveedor</label>
                  <select
                    value={provider}
                    onChange={(e) => { setProvider(e.target.value); setCatalogModels([]); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Google Gemini">Google Gemini</option>
                    <option value="NVIDIA NIM">NVIDIA NIM</option>
                    <option value="OpenRouter">OpenRouter</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="Anthropic">Anthropic</option>
                    <option value="Ollama (Local)">Ollama (Local PC)</option>
                    <option value="DeepSeek">DeepSeek</option>
                    <option value="Personalizado">Otro / Compatible</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Conexión</label>
                  <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="cloud">Cloud API</option>
                    <option value="local">Local PC Endpoint</option>
                  </select>
                </div>
              </div>

              <InputField
                label="Identificador de Modelo (modelId)"
                value={modelId}
                onChange={setModelId}
                placeholder={provider === 'NVIDIA NIM' ? 'meta/llama-3.3-70b-instruct' : provider === 'OpenRouter' ? 'openai/gpt-4o' : 'gemini-1.5-pro, gpt-4o, llama3:8b...'}
              />
              {catalogModels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Buscar modelo ({filteredCatalogModels.length} de {catalogModels.length})</label>
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={provider === 'OpenRouter' ? 'Escribe free para ver solo los gratuitos' : 'Buscar por nombre o identificador'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <select value={filteredCatalogModels.some((entry) => entry.id === modelId) ? modelId : ''} onChange={(e) => { const item = filteredCatalogModels.find((entry) => entry.id === e.target.value); if (item) { setModelId(item.id); if (!name.trim()) setName(item.name); } }} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200">
                    <option value="" disabled>{filteredCatalogModels.length ? 'Selecciona un modelo' : 'No hay modelos que coincidan'}</option>
                    {filteredCatalogModels.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.id}</option>)}
                  </select>
                </div>
              )}

              {connectionType === 'cloud' && (
                <InputField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  isSecret
                  placeholder={editingModelId && apiKey ? 'Clave guardada (déjala igual o reemplázala)' : 'Pega aquí la API Key del proveedor'}
                />
              )}

              {connectionType === 'cloud' && ['OpenRouter', 'NVIDIA NIM', 'Google Gemini'].includes(provider) && (
                <button type="button" onClick={loadModelCatalog} disabled={loadingCatalog || !apiKey.trim()} className="w-full rounded-lg border border-cyan-800/70 bg-cyan-950/30 px-3 py-2 text-sm text-cyan-300 disabled:opacity-50">
                  {loadingCatalog ? 'Consultando catálogo...' : 'Cargar todos los modelos disponibles'}
                </button>
              )}
              {connectionType === 'local' && (
                <InputField
                  label="Endpoint Local / URL"
                  value={endpoint}
                  onChange={setEndpoint}
                  placeholder="http://localhost:11434"
                />
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingModelId(null); }}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <ActionButton label={saving ? 'Guardando...' : editingModelId ? 'Guardar cambios' : 'Registrar Modelo'} onClick={() => {}} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
