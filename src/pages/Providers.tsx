import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ActionButton } from '../components/ActionButton';
import { subscribeCollection, addData, updateData, deleteData, getDocData, getCollectionDataStrict } from '../services/firebase/db';
import { syncWorkerConfig } from '../services/worker/client';
import { Plus, Trash2, Pencil, Globe, KeyRound, CheckCircle2, CircleAlert, PlugZap } from 'lucide-react';

type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'nvidia' | 'openai-compatible';
type Provider = {
  id: string; name: string; type: ProviderType; endpoint?: string; apiKey?: string;
  defaultModel?: string; customEndpoint?: string; promptLimit?: number; promptLimitType?: 'characters' | 'tokens';
  status: 'activo' | 'inactivo'; createdAt?: string; lastTestAt?: string; lastTestStatus?: 'ok' | 'error';
};

const providerOptions: { value: ProviderType; label: string; endpoint: string }[] = [
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  { value: 'google', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
  { value: 'nvidia', label: 'NVIDIA NIM', endpoint: 'https://integrate.api.nvidia.com/v1' },
  { value: 'openai-compatible', label: 'Compatible con API OpenAI', endpoint: '' },
];

export const ProvidersPage = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProviderType>('openrouter');
  const [endpoint, setEndpoint] = useState('https://openrouter.ai/api/v1');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [promptLimit, setPromptLimit] = useState('');
  const [promptLimitType, setPromptLimitType] = useState<'characters' | 'tokens'>('characters');
  const [status, setStatus] = useState<'activo' | 'inactivo'>('activo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeCollection('providers', data => {
    setProviders(data as Provider[]);
    setLoading(false);
  }), []);

  const reset = () => {
    setEditingId(null); setName(''); setType('openrouter');
    setEndpoint('https://openrouter.ai/api/v1'); setApiKey('');
    setDefaultModel(''); setCustomEndpoint(''); setPromptLimit(''); setPromptLimitType('characters');
    setStatus('activo'); setError(''); setNotice('');
  };
  const openCreate = () => { reset(); setModalOpen(true); };
  const openEdit = (provider: Provider) => {
    setEditingId(provider.id); setName(provider.name); setType(provider.type);
    setEndpoint(provider.endpoint || ''); setApiKey('');
    setDefaultModel(provider.defaultModel || ''); setCustomEndpoint(provider.customEndpoint || '');
    setPromptLimit(provider.promptLimit != null && Number(provider.promptLimit) > 0 ? String(provider.promptLimit) : '');
    setPromptLimitType(provider.promptLimitType === 'tokens' ? 'tokens' : 'characters');
    setStatus(provider.status || 'activo');
    setError(''); setNotice(''); setModalOpen(true);
  };
  const sync = async () => {
    const saved = await getDocData('appSettings', 'workerConfig');
    const workerUrl = String(saved?.value || 'https://bot-ia-pc.elherreroanapse.workers.dev').replace(/\/$/, '');
    const [agents, models, connections, currentProviders] = await Promise.all([
      getCollectionDataStrict('agents'), getCollectionDataStrict('modelConfigs'),
      getCollectionDataStrict('telegramConnections'), getCollectionDataStrict('providers')
    ]);
    return syncWorkerConfig(workerUrl, { agents, models, providers: currentProviders, connections, syncedAt: new Date().toISOString() });
  };
  const testConnection = async () => {
    if (!apiKey.trim() && !editingId) { setError('Introduce la API key para probar la conexión.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('https://bot-ia-pc.elherreroanapse.workers.dev/providers/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, endpoint: endpoint.trim(), customEndpoint: customEndpoint.trim(), apiKey: apiKey.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo verificar el proveedor.');
      setNotice('Conexión verificada correctamente. El proveedor respondió a la comprobación.');
    } catch (e: any) { setError(e?.message || 'Falló la prueba de conexión.'); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError('El nombre del proveedor es obligatorio.'); return; }
    if (!editingId && !apiKey.trim()) { setError('La API key es obligatoria para registrar el proveedor.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const value: any = {
        name: name.trim(), type, endpoint: endpoint.trim(), status, updatedAt: new Date().toISOString(),
        defaultModel: defaultModel.trim(), customEndpoint: customEndpoint.trim(),
        promptLimit: promptLimit.trim() && Number(promptLimit) > 0 ? Math.floor(Number(promptLimit)) : '',
        promptLimitType,
      };
      if (apiKey.trim()) value.apiKey = apiKey.trim();
      if (editingId) await updateData('providers', editingId, value);
      else await addData('providers', { ...value, createdAt: new Date().toISOString() });
      await sync();
      setModalOpen(false); reset();
    } catch (e: any) { setError(e?.message || 'No se pudo guardar el proveedor.'); }
    finally { setBusy(false); }
  };
  const remove = async (provider: Provider) => {
    if (!confirm('¿Eliminar el proveedor ' + provider.name + '? Los agentes que lo utilicen deberán asignarse a otro.')) return;
    try { await deleteData('providers', provider.id); await sync(); }
    catch (e: any) { setError(e?.message || 'No se pudo eliminar el proveedor.'); }
  };
  const toggle = async (provider: Provider) => {
    try { await updateData('providers', provider.id, { status: provider.status === 'activo' ? 'inactivo' : 'activo' }); await sync(); }
    catch (e: any) { setError(e?.message || 'No se pudo cambiar el estado.'); }
  };

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div><h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><PlugZap className="text-cyan-400" size={24}/> Proveedores de IA</h2>
        <p className="text-sm text-slate-400 mt-1">Registra conexiones y credenciales. Los modelos se eligen en los agentes o en el chat.</p></div>
      <ActionButton label="Añadir proveedor" onClick={openCreate} icon={<Plus size={16}/>} />
    </div>
    {error && <div className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
    {loading ? <p className="p-8 text-center text-slate-400">Cargando proveedores…</p> : providers.length === 0 ?
      <Card><div className="p-8 text-center space-y-3"><Globe size={36} className="mx-auto text-slate-600"/><h3 className="font-medium text-slate-200">Todavía no hay proveedores</h3><p className="text-sm text-slate-400">Añade OpenRouter, OpenAI, Google, Anthropic, NVIDIA u otro endpoint compatible.</p><ActionButton label="Configurar proveedor" onClick={openCreate}/></div></Card> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{providers.map(provider =>
        <Card key={provider.id} className="border-slate-800 p-5">
          <div className="flex justify-between gap-3"><div className="flex items-center gap-3"><span className="p-2 rounded-lg bg-cyan-950/60 text-cyan-300"><Globe size={20}/></span><div><h3 className="font-semibold text-slate-100">{provider.name}</h3><p className="text-xs text-slate-400">{providerOptions.find(p=>p.value===provider.type)?.label || provider.type}</p></div></div><span className={provider.status==='activo'?'text-emerald-400 text-xs':'text-slate-500 text-xs'}>{provider.status}</span></div>
          <p className="mt-3 text-xs text-slate-500 font-mono break-all">{provider.endpoint || 'Endpoint predeterminado'}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><KeyRound size={14}/>{provider.apiKey ? 'API key guardada' : 'Clave no disponible'}</div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button onClick={()=>toggle(provider)} className="text-xs text-slate-400 hover:text-cyan-300">{provider.status==='activo'?'Desactivar':'Activar'}</button>
            <div className="flex gap-2"><button onClick={()=>openEdit(provider)} title="Editar" className="p-2 text-slate-400 hover:text-cyan-300"><Pencil size={15}/></button><button onClick={()=>remove(provider)} title="Eliminar" className="p-2 text-slate-400 hover:text-red-300"><Trash2 size={15}/></button></div>
          </div>
        </Card>)}</div>}
    {modalOpen && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl p-5 space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-lg font-semibold text-slate-100">{editingId?'Editar proveedor':'Nuevo proveedor'}</h3><button onClick={()=>setModalOpen(false)} className="text-slate-400">✕</button></div>
      {error && <div className="text-sm text-red-300">{error}</div>}{notice && <div className="text-sm text-emerald-300 flex gap-2 items-center"><CheckCircle2 size={16}/>{notice}</div>}
      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs text-slate-400">Nombre visible<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder="Mi OpenRouter" required/></label>
        <label className="block text-xs text-slate-400">Tipo de proveedor<select value={type} onChange={e=>{const item=providerOptions.find(p=>p.value===e.target.value);setType(e.target.value as ProviderType);if(item?.endpoint)setEndpoint(item.endpoint);}} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100">{providerOptions.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="block text-xs text-slate-400">Endpoint base<input value={endpoint} onChange={e=>setEndpoint(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder="https://api.example.com/v1"/></label>
        <label className="block text-xs text-slate-400">API key {editingId?'(dejar vacío para conservar la actual)':''}<input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder={editingId?'•••••••• (guardada)':'Pega aquí la API key'} required={!editingId}/></label>
        <details className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-3">
          <summary className="cursor-pointer text-sm font-medium text-cyan-300">Opciones avanzadas (opcionales)</summary>
          <p className="text-xs leading-5 text-slate-500">Si dejas estos campos vacíos, se conserva el comportamiento normal del proveedor.</p>
          <label className="block text-xs text-slate-400">Modelo predeterminado<input value={defaultModel} onChange={e=>setDefaultModel(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder="Ej. black-forest-labs/flux.2-klein-4b" /></label>
          <label className="block text-xs text-slate-400">Endpoint de inferencia personalizado<input value={customEndpoint} onChange={e=>setCustomEndpoint(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder="https://.../ruta/completa" /><span className="mt-1 block text-[11px] text-slate-500">URL completa de la ruta de inferencia; si está vacío, se usa la ruta habitual.</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-slate-400">Límite del prompt<input type="number" min="1" step="1" value={promptLimit} onChange={e=>setPromptLimit(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100" placeholder="Ej. 800" /></label>
            <label className="block text-xs text-slate-400">Unidad del límite<select value={promptLimitType} onChange={e=>setPromptLimitType(e.target.value as 'characters' | 'tokens')} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100"><option value="characters">Caracteres</option><option value="tokens">Tokens (estimados)</option></select></label>
          </div>
          <p className="text-[11px] text-slate-500">El límite se aplica al mensaje antes de enviarlo. Los tokens se estiman de forma conservadora para funcionar con proveedores distintos.</p>
        </details>
        <label className="block text-xs text-slate-400">Estado<select value={status} onChange={e=>setStatus(e.target.value as any)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-sm text-slate-100"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
        <div className="flex flex-wrap gap-2 justify-end pt-2"><button type="button" onClick={testConnection} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-700 text-cyan-300 text-sm disabled:opacity-50"><CircleAlert size={15}/>{busy?'Probando…':'Probar conexión'}</button><button disabled={busy} className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm disabled:opacity-50">{busy?'Guardando…':'Guardar proveedor'}</button></div>
      </form>
    </div></div>}
  </div>;
};
