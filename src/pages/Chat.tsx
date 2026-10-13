import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Plus, Send, PanelLeftClose, PanelLeftOpen, MessageSquare, Trash2, Sparkles, ChevronDown, LoaderCircle, UserRound, AlertCircle } from 'lucide-react';
import { subscribeCollection, getDocData } from '../services/firebase/db';
import { sendAgentChatMessage } from '../services/worker/client';

type Agent = { id: string; name: string; description?: string; model?: string; status?: 'activo' | 'inactivo' | 'pausado' };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; model?: string };
type Conversation = { id: string; title: string; agentId: string; messages: ChatMessage[]; updatedAt: string };
const STORAGE_KEY = 'bot-ia-pc-chat-conversations-v1';
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const readConversations = (): Conversation[] => {
  try { const value = localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) : []; }
  catch { return []; }
};

export const ChatPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(readConversations);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [message, setMessage] = useState('');
  const [workerUrl, setWorkerUrl] = useState('https://bot-ia-pc.elherreroanapse.workers.dev');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeCollection('agents', data => {
      const available = (data as Agent[]).filter(agent => !agent.status || agent.status === 'activo');
      setAgents(available);
      setLoadingAgents(false);
      setSelectedAgentId(current => current && available.some(agent => agent.id === current) ? current : (available[0]?.id || ''));
    });
    getDocData('appSettings', 'workerConfig').then(saved => {
      if (saved?.value) setWorkerUrl(String(saved.value).replace(/\/$/, ''));
    }).catch(() => undefined);
    return () => unsubscribe();
  }, []);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); } catch { /* storage unavailable */ } }, [conversations]);
  const activeConversation = conversations.find(item => item.id === activeConversationId) || null;
  const selectedAgent = agents.find(agent => agent.id === (activeConversation?.agentId || selectedAgentId)) || null;
  const currentMessages = activeConversation?.messages || [];
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [currentMessages.length, sending]);

  const groupedConversations = useMemo(() => {
    const today = new Date().toDateString();
    return [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).reduce((groups, item) => {
      const key = new Date(item.updatedAt).toDateString() === today ? 'Hoy' : 'Anteriores';
      groups[key] = [...(groups[key] || []), item];
      return groups;
    }, {} as Record<string, Conversation[]>);
  }, [conversations]);

  const startNewChat = (agentId = selectedAgentId) => {
    setActiveConversationId(''); setSelectedAgentId(agentId); setMessage(''); setError('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    if (!selectedAgent) { setError('Primero crea o activa un agente en la sección Agentes de IA.'); return; }
    setError(''); setSending(true); setMessage('');
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content: text, createdAt: now };
    let conversation = activeConversation;
    if (!conversation) {
      conversation = { id: makeId(), title: text.length > 42 ? `${text.slice(0, 42).trim()}…` : text, agentId: selectedAgent.id, messages: [], updatedAt: now };
      setActiveConversationId(conversation.id);
      setConversations(current => [conversation!, ...current]);
    }
    const conversationId = conversation.id;
    const previousMessages = conversation.messages;
    setConversations(current => current.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, userMessage], updatedAt: now } : item));
    try {
      const result = await sendAgentChatMessage(workerUrl, selectedAgent.id, text, previousMessages.map(item => ({ role: item.role, content: item.content })));
      const reply: ChatMessage = { id: makeId(), role: 'assistant', content: result.reply, createdAt: new Date().toISOString(), model: result.model };
      setConversations(current => current.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, reply], updatedAt: reply.createdAt } : item));
    } catch (err: any) { setError(err?.message || 'No se pudo enviar el mensaje al agente.'); }
    finally { setSending(false); setTimeout(() => textareaRef.current?.focus(), 0); }
  };
  const deleteConversation = (id: string) => {
    setConversations(current => current.filter(item => item.id !== id));
    if (activeConversationId === id) setActiveConversationId('');
  };
  const selectConversation = (item: Conversation) => { setActiveConversationId(item.id); setSelectedAgentId(item.agentId); setError(''); };

  return <div className="flex -m-4 sm:-m-8 h-[calc(100dvh-64px)] min-h-[520px] overflow-hidden bg-slate-950 text-slate-100">
    {sidebarOpen && <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col max-md:w-[76px]">
      <div className="p-3 sm:p-4"><button onClick={() => startNewChat()} className="flex w-full items-center justify-center sm:justify-start gap-2 rounded-xl border border-slate-700 px-3 py-3 text-sm hover:bg-slate-900 transition-colors"><Plus size={18}/><span className="max-md:hidden">Nuevo chat</span></button></div>
      <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 max-md:hidden">Conversaciones</div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4">
        {Object.entries(groupedConversations).map(([group, items]) => <div key={group}><p className="px-2 pb-1 text-[11px] text-slate-600 max-md:hidden">{group}</p>
          {items.map(item => <div key={item.id} className={`group flex items-center gap-1 rounded-lg ${activeConversationId === item.id ? 'bg-slate-800' : 'hover:bg-slate-900'}`}>
            <button onClick={() => selectConversation(item)} title={item.title} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2.5 text-left text-xs text-slate-300"><MessageSquare size={15} className="shrink-0 text-slate-500"/><span className="truncate max-md:hidden">{item.title}</span></button>
            <button onClick={() => deleteConversation(item.id)} title="Eliminar conversación" className="mr-1 hidden rounded p-1 text-slate-500 hover:text-red-400 group-hover:block max-md:hidden"><Trash2 size={13}/></button>
          </div>)}
        </div>)}
        {!conversations.length && <p className="px-3 py-4 text-xs leading-5 text-slate-600 max-md:hidden">Tus conversaciones aparecerán aquí.</p>}
      </div>
      <div className="border-t border-slate-800 p-3 flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-950 text-cyan-300"><Bot size={17}/></span><div className="min-w-0 max-md:hidden"><p className="text-xs font-semibold">BOT IA PC</p><p className="text-[10px] text-slate-500">Chat de agentes</p></div></div>
    </aside>}
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-[62px] items-center justify-between gap-3 border-b border-slate-800 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2"><button onClick={() => setSidebarOpen(value => !value)} title={sidebarOpen ? 'Ocultar conversaciones' : 'Mostrar conversaciones'} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">{sidebarOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</button><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{activeConversation ? activeConversation.title : 'Nuevo chat'}</p><p className="text-[11px] text-slate-500">Conversación con tus agentes de IA</p></div></div>
        <label className="flex max-w-[48%] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2 sm:px-3 py-2"><Bot size={16} className="shrink-0 text-cyan-400"/><select aria-label="Seleccionar agente" value={activeConversation?.agentId || selectedAgentId} onChange={event => { setSelectedAgentId(event.target.value); if (activeConversation) setActiveConversationId(''); setError(''); }} disabled={loadingAgents || agents.length === 0} className="min-w-0 max-w-full bg-transparent text-xs sm:text-sm text-slate-100 outline-none">
          {loadingAgents && <option value="">Cargando agentes…</option>}{!loadingAgents && agents.length === 0 && <option value="">Sin agentes activos</option>}{agents.map(agent => <option key={agent.id} value={agent.id} className="bg-slate-900">{agent.name}</option>)}
        </select><ChevronDown size={14} className="shrink-0 text-slate-500"/></label>
      </header>
      <div className="flex-1 overflow-y-auto"><div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        {!currentMessages.length ? <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-300 shadow-lg shadow-black/20"><Sparkles size={26}/></div><h2 className="text-xl sm:text-2xl font-semibold tracking-tight">¿En qué te ayudo?</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{selectedAgent ? `Estás conversando con ${selectedAgent.name}. Escribe una pregunta o cuéntale qué necesitas.` : 'Selecciona un agente activo para empezar a conversar.'}</p>
          {selectedAgent?.description && <div className="mt-5 max-w-md rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left text-xs leading-5 text-slate-400">{selectedAgent.description}</div>}
          <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">{['Explícame algo paso a paso','Ayúdame a resolver un problema','Dame ideas para un proyecto','Resume este texto'].map(suggestion => <button key={suggestion} onClick={() => setMessage(suggestion)} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-left text-xs sm:text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-900 transition-colors">{suggestion}</button>)}</div>
        </div> : <div className="space-y-7 pb-6">{currentMessages.map(item => <div key={item.id} className={`flex gap-3 sm:gap-4 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {item.role === 'assistant' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div>}
          <div className={`max-w-[88%] min-w-0 sm:max-w-[82%] ${item.role === 'user' ? 'rounded-2xl rounded-br-md bg-slate-800 px-4 py-3' : 'pt-1'}`}>{item.role === 'assistant' && <p className="mb-2 text-xs font-semibold text-slate-300">{selectedAgent?.name || 'Agente IA'}</p>}<div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{item.content}</div>{item.model && <p className="mt-2 text-[10px] text-slate-600">Modelo: {item.model}</p>}</div>
          {item.role === 'user' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200"><UserRound size={16}/></div>}
        </div>)}{sending && <div className="flex gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div><div className="flex items-center gap-2 pt-1 text-sm text-slate-400"><LoaderCircle size={16} className="animate-spin"/>{selectedAgent?.name || 'El agente'} está pensando…</div></div>}<div ref={messagesEndRef}/></div>}
      </div></div>
      <div className="px-3 pb-3 sm:px-5 sm:pb-5"><div className="mx-auto max-w-3xl">
        {error && <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2.5 text-xs leading-5 text-red-300"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{error}</div>}
        <form onSubmit={handleSend} className="rounded-2xl border border-slate-700 bg-slate-900 shadow-lg shadow-black/20 focus-within:border-slate-500">
          <textarea ref={textareaRef} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder={selectedAgent ? `Escribe a ${selectedAgent.name}…` : 'Activa o crea un agente para empezar…'} rows={2} disabled={!selectedAgent || sending} className="max-h-40 min-h-[58px] w-full resize-y bg-transparent px-4 pt-4 pb-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none disabled:opacity-50"/>
          <div className="flex items-center justify-between gap-3 px-3 pb-3"><p className="text-[10px] text-slate-600">Enter para enviar · Shift + Enter para nueva línea</p><button type="submit" disabled={!message.trim() || !selectedAgent || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40" title="Enviar mensaje">{sending ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={16}/>}</button></div>
        </form><p className="mt-2 text-center text-[10px] text-slate-600">Las respuestas dependen del agente, su modelo y la configuración del sistema.</p>
      </div></div>
    </section>
  </div>;
};
