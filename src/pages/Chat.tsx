import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Plus, Send, PanelLeftClose, PanelLeftOpen, MessageSquare, Trash2, Sparkles, ChevronDown, LoaderCircle, UserRound, AlertCircle, Image as ImageIcon, Mic, Video, Paperclip, X, FileText } from 'lucide-react';
import { subscribeCollection, getDocData } from '../services/firebase/db';
import { sendAgentChatMessage, fetchProviderCatalog, type ChatFileAttachment, type ChatOutputAttachment } from '../services/worker/client';

type Agent = { id: string; name: string; description?: string; model?: string; status?: 'activo' | 'inactivo' | 'pausado'; systemPrompt?: string; personality?: string };
type ModelOption = { id: string; name: string; modelId?: string; provider?: string; connectionType?: 'cloud' | 'local'; status?: 'activo' | 'inactivo'; apiKey?: string };
type ProviderOption = { id: string; name: string; type: string; endpoint?: string; apiKey?: string; status: 'activo' | 'inactivo' };
type CatalogModel = { id: string; name: string; inputModalities?: string[]; outputModalities?: string[]; inputModalitiesKnown?: boolean; outputModalitiesKnown?: boolean; capabilitiesSource?: 'provider' | 'inferred' | 'unknown'; supportedGenerationMethods?: string[] };
type ChatDisplayAttachment = { name: string; mimeType: string; data?: string; url?: string; size?: number };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; model?: string; attachments?: ChatDisplayAttachment[] };
type TemporaryModel = { provider: string; modelId: string; name: string };
type Conversation = { id: string; title: string; agentId: string; targetMode?: 'agent' | 'model'; targetId?: string; targetProviderId?: string; temporaryModel?: TemporaryModel; messages: ChatMessage[]; updatedAt: string };
const normalizeCommand = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const aliasFor = (agent: Agent) => normalizeCommand(agent.name).split(' ')[0];
const STORAGE_KEY = 'bot-ia-pc-chat-conversations-v1';
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Preview SVG snippets from text models, including common escaped/malformed output.
const normalizeSvg = (value: string) => {
  let svg = value
    .replace(/\\([<>\x60])/g, '$1')
    .replace(/\\(["'])/g, '$1')
    .replace(/xmlns\s*=\s*["']\[?(https?:\/\/www\.w3\.org\/2000\/svg)\]?\((https?:\/\/www\.w3\.org\/2000\/svg)\)["']/gi, 'xmlns="http://www.w3.org/2000/svg"')
    .replace(/^\s*--\s+(.+?)\s+-->\s*$/gm, '<!-- $1 -->')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<(foreignObject|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\s on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*("https?:[^"]*"|'https?:[^']*')/gi, '');
  const svgStart = svg.search(/<svg\b/i);
  if (svgStart > 0) svg = svg.slice(svgStart);
  if (/<svg\b/i.test(svg) && !/<\/svg\s*>/i.test(svg)) svg += '\n</svg>';
  return svg;
};

const SvgPreview = ({ source }: { source: string }) => {
  const [visible, setVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const svg = normalizeSvg(source.trim());
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const looksIncomplete = /<svg\b/i.test(svg) && (
    !/<\/svg\s*>/i.test(source) ||
    /<([a-z][\w:-]*)\b[^>]*$/i.test(svg.split('\n').slice(-2).join('\n')) ||
    /(?:=\s*["'][^"']*)$/.test(svg.split('\n').slice(-2).join('\n')) ||
    ((svg.match(/<([a-z][\w:-]*)\b[^>]*>/gi) || []).length > (svg.match(/<\/[a-z][\w:-]*\s*>/gi) || []).length + 2)
  );

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const field = document.createElement('textarea');
      field.value = svg;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const openSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return <div className="my-3 max-w-full">
    <button type="button" onClick={() => { setVisible(value => !value); setImageError(false); }} className="inline-flex items-center gap-2 rounded-lg border border-cyan-800 bg-cyan-950/50 px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-900/60">
      {visible ? 'Ocultar vista SVG' : 'Ver SVG'}
    </button>
    {visible && <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
        <span className="text-xs font-medium text-slate-300">Vista previa SVG</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500">Cuadrícula = transparencia</span>
          <button type="button" onClick={() => void copySvg()} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">{copied ? '¡Copiado!' : 'Copiar SVG'}</button>
          <button type="button" onClick={openSvg} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-cyan-300 hover:bg-slate-800">Abrir aparte</button>
        </div>
      </div>
      <div className="flex min-h-48 items-center justify-center p-4" style={{ backgroundColor: '#111827', backgroundImage: 'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)', backgroundSize: '24px 24px', backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0' }}>
        {imageError
          ? <div className="w-full max-w-2xl">
              <p className="mb-2 text-sm font-medium text-amber-300">No se pudo representar este SVG.</p>
              <p className="mb-3 text-xs leading-5 text-slate-400">{looksIncomplete ? 'Parece incompleto o contiene una etiqueta/atributo cortado. El visor no puede inventar el contenido que falta.' : 'El código contiene una estructura SVG que el navegador no pudo interpretar. Puedes copiarlo y revisarlo.'}</p>
              <details open className="rounded-lg border border-slate-700 bg-slate-950/80">
                <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300">Ver código SVG recibido</summary>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-3 text-[11px] leading-5 text-slate-300">{source}</pre>
              </details>
            </div>
          : <img src={src} alt="Vista previa del SVG generado" onError={() => setImageError(true)} className="max-h-[560px] max-w-full object-contain" />}
      </div>
    </div>}
  </div>;
};

const MessageContent = ({ content }: { content: string }) => {
  // Some models escape every backtick and angle bracket; normalize those before parsing.
  const displayContent = content.replace(/\\\x60/g, '\x60').replace(/\\</g, '<').replace(/\\>/g, '>');
  const pattern = /(\x60{3}(?:svg|xml|html)?[ \t]*\n?[\s\S]*?(?:\x60{3}|$)|<svg\b[\s\S]*?(?:<\/svg\s*>|$)|!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\))/gi;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(displayContent)) !== null) {
    const token = match[0];
    if (match.index > cursor) {
      parts.push(<span key={'text-' + cursor} className="whitespace-pre-wrap break-words">{displayContent.slice(cursor, match.index)}</span>);
    }

    if (token.startsWith('\x60\x60\x60')) {
      const body = token.replace(/^\x60{3}(?:svg|xml|html)?[ \t]*\n?/, '').replace(/\x60{3}$/, '').trim();
      const normalizedBody = normalizeSvg(body);
      if (/<svg\b/i.test(normalizedBody)) {
        parts.push(<SvgPreview key={'svg-' + tokenIndex++} source={normalizedBody} />);
      } else {
        parts.push(<span key={'code-' + tokenIndex++} className="whitespace-pre-wrap break-words">{token}</span>);
      }
    } else if (/<svg\b/i.test(token)) {
      parts.push(<SvgPreview key={'svg-' + tokenIndex++} source={token} />);
    } else {
      const alt = match[2]?.trim() || 'Imagen generada';
      const src = match[3];
      parts.push(<figure key={'image-' + tokenIndex++} className="my-3 max-w-full">
        <img src={src} alt={alt} loading="lazy" className="max-h-[560px] max-w-full rounded-xl border border-slate-700 bg-slate-900 object-contain" />
        {alt !== 'Imagen generada' && <figcaption className="mt-1 text-xs text-slate-500">{alt}</figcaption>}
      </figure>);
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < displayContent.length) {
    parts.push(<span key={'text-' + cursor} className="whitespace-pre-wrap break-words">{displayContent.slice(cursor)}</span>);
  }
  return parts.length ? <>{parts}</> : displayContent;
};
const readConversations = (): Conversation[] => {
  try { const value = localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) : []; }
  catch { return []; }
};

export const ChatPage = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(readConversations);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [targetMode, setTargetMode] = useState<'agent' | 'model'>('agent');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [temporaryProvider, setTemporaryProvider] = useState('openai');
  const [temporaryModelId, setTemporaryModelId] = useState('');
  const [temporaryApiKey, setTemporaryApiKey] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatFileAttachment[]>([]);
  const [workerUrl, setWorkerUrl] = useState('https://bot-ia-pc.elherreroanapse.workers.dev');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeCollection('agents', data => {
      const available = (data as Agent[]).filter(agent => !agent.status || agent.status === 'activo');
      setAgents(available);
      setLoadingAgents(false);
      setSelectedAgentId(current => current && available.some(agent => agent.id === current) ? current : (available[0]?.id || ''));
    });
    const unsubscribeProviders = subscribeCollection('providers', data => {
      const active = (data as ProviderOption[]).filter(provider => provider.status === 'activo');
      setProviders(active);
      setSelectedProviderId(current => active.some(provider => provider.id === current) ? current : (active[0]?.id || ''));

    });
    const unsubscribeModels = subscribeCollection('modelConfigs', data => {
      const availableModels = (data as ModelOption[]).filter(model => (!model.status || model.status === 'activo') && model.connectionType !== 'local' && Boolean(model.modelId));
      setModels(availableModels);
      setSelectedModelId(current => current && availableModels.some(model => model.id === current) ? current : (availableModels[0]?.id || ''));
    });
    getDocData('appSettings', 'workerConfig').then(saved => {
      if (saved?.value) setWorkerUrl(String(saved.value).replace(/\/$/, ''));
    }).catch(() => undefined);
    return () => { unsubscribe(); unsubscribeModels(); unsubscribeProviders(); };
  }, []);

  const refreshProviderModels = async (id = selectedProviderId) => {
    const provider = providers.find(item => item.id === id);
    if (!provider) {
      setCatalogModels([]);
      if (targetMode === 'model') setError(providers.length ? 'Selecciona un proveedor activo.' : 'No hay proveedores activos guardados.');
      return;
    }
    setCatalogLoading(true); setError(''); setCatalogModels([]);
    try {
      // Consultar el catálogo con los datos del proveedor elegido evita depender de una sincronización de configuración previa.
      const list = await fetchProviderCatalog(workerUrl, provider) as CatalogModel[];
      setCatalogModels(list);
      setSelectedModelId(current => list.some(item => item.id === current) ? current : (list[0]?.id || ''));
      if (!list.length) setError('El proveedor respondió, pero no ofreció modelos disponibles.');
    } catch (e: any) {
      setCatalogModels([]);
      if (targetMode === 'model') setError(e?.message || 'No se pudo leer la configuración guardada del proveedor.');
    } finally { setCatalogLoading(false); }
  };

  useEffect(() => {
    // El catálogo solo es necesario al hablar directamente con un modelo.
    // No consultarlo en modo Agente evita errores de configuración al abrir el chat.
    if (targetMode !== 'model') {
      setCatalogModels([]);
      setCatalogLoading(false);
      return;
    }
    if (selectedProviderId && providers.some(provider => provider.id === selectedProviderId)) {
      void refreshProviderModels(selectedProviderId);
    } else {
      setCatalogModels([]);
      setCatalogLoading(false);
      setError(providers.length ? 'Selecciona un proveedor activo.' : 'No hay proveedores activos guardados.');
    }
  }, [targetMode, selectedProviderId, providers]);

  useEffect(() => {
    // Keep conversation history lightweight: file bytes stay in memory, not localStorage.
    try {
      const compact = conversations.map(item => ({
        ...item,
        messages: item.messages.map(entry => ({
          ...entry,
          attachments: entry.attachments?.map(file => ({ name: file.name, mimeType: file.mimeType, size: file.size, url: file.url })),
        })),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch { /* storage unavailable */ }
  }, [conversations]);
  const activeConversation = conversations.find(item => item.id === activeConversationId) || null;
  const effectiveMode: 'agent' | 'model' = activeConversation?.targetMode || targetMode;
  const effectiveTargetId = activeConversation ? (activeConversation.targetId || activeConversation.agentId) : (targetMode === 'agent' ? selectedAgentId : selectedModelId);
  const selectedAgent = agents.find(agent => agent.id === (effectiveMode === 'agent' ? effectiveTargetId : selectedAgentId)) || null;
  const selectedModel = models.find(model => model.id === (effectiveMode === 'model' ? effectiveTargetId : selectedModelId)) || null;
  const selectedCatalogModel = catalogModels.find(model => model.id === (effectiveMode === 'model' ? effectiveTargetId : selectedModelId)) || null;
  const effectiveProviderId = activeConversation?.targetProviderId || selectedProviderId;
  const activeTemporaryModel = activeConversation?.temporaryModel || null;
  const temporarySelected = effectiveMode === 'model' && (Boolean(activeTemporaryModel) || (!activeConversation && selectedModelId === '__temporary__'));
  const effectiveTemporaryProvider = activeTemporaryModel?.provider || temporaryProvider;
  const effectiveTemporaryModelId = activeTemporaryModel?.modelId || temporaryModelId;
  const temporaryReady = Boolean(effectiveTemporaryProvider && effectiveTemporaryModelId.trim() && temporaryApiKey.trim());
  const temporaryLabel = activeTemporaryModel?.name || (effectiveTemporaryModelId.trim() ? `${effectiveTemporaryModelId.trim()} · temporal` : 'Modelo temporal');
  const filteredAgents = agents.filter(agent => normalizeCommand(agent.name).includes(normalizeCommand(targetSearch)));
  const filteredModels = catalogModels.filter(model => normalizeCommand(`${model.name} ${model.id}`).includes(normalizeCommand(targetSearch)));
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
    setActiveConversationId(''); setTargetMode('agent'); setSelectedAgentId(agentId); setSelectedModelId(models[0]?.id || '__temporary__'); setMessage(''); setPendingAttachments([]); setError('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const updateConversationTarget = (conversationId: string, mode: 'agent' | 'model', targetId: string, providerId?: string) => {
    setConversations(current => current.map(item => {
      if (item.id !== conversationId) return item;
      return {
        ...item,
        targetMode: mode,
        targetId,
        agentId: mode === 'agent' ? targetId : '',
        targetProviderId: mode === 'model' ? (providerId || selectedProviderId) : undefined,
        temporaryModel: undefined,
        updatedAt: new Date().toISOString(),
      };
    }));
  };
  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const allowed = (file: File) => /^(image\/(jpeg|png|gif|webp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/i.test(file.type);
    const existingBytes = pendingAttachments.reduce((sum, item) => sum + Math.floor(item.data.length * 3 / 4), 0);
    let totalBytes = existingBytes;
    const next: ChatFileAttachment[] = [];
    for (const file of files) {
      if (!allowed(file)) { setError(`"${file.name}" no es un tipo compatible. Usa JPG, PNG, GIF, WebP, audio, vídeo o PDF.`); continue; }
      if (file.size > 8 * 1024 * 1024) { setError(`"${file.name}" supera el límite de 8 MB por archivo.`); continue; }
      if (totalBytes + file.size > 10 * 1024 * 1024) { setError('Los adjuntos superan el límite total de 10 MB.'); continue; }
      const modality = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'pdf';
      const declaredInputs = selectedCatalogModel?.inputModalities || [];
      const modalitySupported = modality === 'pdf'
        ? declaredInputs.some(value => ['pdf', 'document', 'file'].includes(value))
        : declaredInputs.includes(modality);
      if (effectiveMode === 'model' && selectedCatalogModel?.inputModalitiesKnown && !modalitySupported) {
        setError(`El modelo seleccionado no declara compatibilidad de entrada con ${modality === 'pdf' ? 'PDF/documentos' : modality}. Selecciona otro modelo para adjuntar este archivo.`);
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer el archivo.'));
          reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
          reader.readAsDataURL(file);
        });
        const data = dataUrl.split(',')[1] || '';
        next.push({ name: file.name, mimeType: file.type, data });
        totalBytes += file.size;
      } catch { setError(`No se pudo leer "${file.name}".`); }
    }
    if (next.length) { setPendingAttachments(current => [...current, ...next]); setError(''); }
  };
  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const rawText = message.trim();
    const outgoingAttachments = pendingAttachments;
    if ((!rawText && !outgoingAttachments.length) || sending) return;
    setError('');

    let outgoingText = rawText;
    let mode: 'agent' | 'model' = activeConversation?.targetMode || targetMode;
    let targetId = activeConversation?.targetId || activeConversation?.agentId || (mode === 'agent' ? selectedAgentId : selectedModelId);
    const providerIdForRequest = activeConversation?.targetProviderId || selectedProviderId;
    const selectedProviderForRequest = providers.find(provider => provider.id === providerIdForRequest);
    const catalogModelForRequest = catalogModels.find(model => model.id === targetId);
    const temporaryModel = mode === 'model' && catalogModelForRequest && selectedProviderForRequest
      ? { provider: selectedProviderForRequest.type, modelId: catalogModelForRequest.id, apiKey: selectedProviderForRequest.apiKey || '' }
      : undefined;
    let localReply = '';

    if (/^\$agente\s+list\s*$/i.test(rawText)) {
      localReply = agents.length
        ? `Agentes disponibles:
${agents.map(agent => `• $${aliasFor(agent)} — ${agent.name}`).join('\\n')}`
        : 'No hay agentes activos disponibles.';
    } else {
      const generalCommand = rawText.match(/^\$agente\s+([\s\S]+)$/i);
      const directCommand = rawText.match(/^\$([\p{L}\p{N}_-]+)(?:\s+([\s\S]*))?$/u);
      if (generalCommand) {
        const commandBody = generalCommand[1].trim();
        const words = commandBody.split(/\s+/);
        let found: Agent | null = null;
        let consumed = 0;
        for (let count = words.length; count >= 1; count--) {
          const candidate = normalizeCommand(words.slice(0, count).join(' '));
          found = agents.find(agent => normalizeCommand(agent.name) === candidate || normalizeCommand(agent.id) === candidate || aliasFor(agent) === candidate) || null;
          if (found) { consumed = count; break; }
        }
        if (!found) { setError('No encontré ese agente. Usa $agente list para ver los disponibles.'); return; }
        mode = 'agent'; targetId = found.id;
        outgoingText = words.slice(consumed).join(' ').trim();
        setTargetMode('agent'); setSelectedAgentId(found.id);
        if (!outgoingText) {
          setTargetSearch(''); setMessage('');
          if (activeConversation) updateConversationTarget(activeConversation.id, 'agent', found.id);
          return;
        }
      } else if (directCommand) {
        const command = normalizeCommand(directCommand[1]);
        const found = agents.find(agent => aliasFor(agent) === command || normalizeCommand(agent.id) === command);
        if (found) {
          mode = 'agent'; targetId = found.id;
          outgoingText = (directCommand[2] || '').trim();
          setTargetMode('agent'); setSelectedAgentId(found.id);
          if (!outgoingText) {
            setMessage('');
            if (activeConversation) updateConversationTarget(activeConversation.id, 'agent', found.id);
            return;
          }
        }
      }
    }

    setSending(true); setMessage(''); setPendingAttachments([]);
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: makeId(), role: 'user',
      content: rawText || (outgoingAttachments.length ? 'Archivo adjunto' : ''),
      createdAt: now,
      attachments: outgoingAttachments.map(item => ({ ...item, size: Math.floor(item.data.length * 3 / 4) })),
    };
    let conversation = activeConversation;
    if (!conversation) {
      conversation = { id: makeId(), title: rawText.length > 42 ? `${rawText.slice(0, 42).trim()}…` : rawText, agentId: mode === 'agent' ? targetId : '', targetMode: mode, targetId, ...(mode === 'model' ? { targetProviderId: providerIdForRequest } : {}), messages: [], updatedAt: now };
      setActiveConversationId(conversation.id);
      setConversations(current => [conversation!, ...current]);
    } else if (mode !== (conversation.targetMode || 'agent') || targetId !== (conversation.targetId || conversation.agentId) || (mode === 'model' && providerIdForRequest !== conversation.targetProviderId)) {
      // Changing destination keeps the same chat and its history; only the target changes.
      conversation = { ...conversation, agentId: mode === 'agent' ? targetId : '', targetMode: mode, targetId, targetProviderId: mode === 'model' ? providerIdForRequest : undefined, temporaryModel: undefined, updatedAt: now };
      setConversations(current => current.map(item => item.id === conversation!.id ? conversation! : item));
    }
    const conversationId = conversation.id;
    const previousMessages = conversation.messages;
    // Keep the most recent user attachment available for follow-up questions in this live session.
    // If the user attaches a new file, send only the new file(s) to stay within request-size limits.
    const lastAttachmentMessage = [...previousMessages].reverse().find(item => item.role === 'user' && item.attachments?.some(file => Boolean(file.data)));
    const requestAttachments: ChatFileAttachment[] = outgoingAttachments.length
      ? outgoingAttachments
      : (lastAttachmentMessage?.attachments || []).filter(file => Boolean(file.data)).map(file => ({ name: file.name, mimeType: file.mimeType, data: file.data! }));
    setConversations(current => current.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, userMessage], updatedAt: now } : item));
    try {
      if (localReply) {
        const reply: ChatMessage = { id: makeId(), role: 'assistant', content: localReply, createdAt: new Date().toISOString() };
        setConversations(current => current.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, reply], updatedAt: reply.createdAt } : item));
      } else {
        if (!targetId) throw new Error(mode === 'agent' ? 'Selecciona un agente activo.' : 'Selecciona un modelo activo.');
        if (mode === 'model') {
          if (!providerIdForRequest || !targetId || !selectedProviderForRequest || !catalogModelForRequest) {
            throw new Error('Selecciona un proveedor activo y un modelo de su catálogo.');
          }
          if (!temporaryModel?.apiKey) throw new Error('El proveedor seleccionado no tiene una API key disponible.');
          if (!['openai', 'anthropic', 'google', 'openrouter', 'nvidia'].includes(temporaryModel.provider)) {
            throw new Error('Este tipo de proveedor todavía no admite el uso directo de modelos del catálogo en el chat.');
          }
        }
        const result = await sendAgentChatMessage(
          workerUrl,
          targetId,
          outgoingText,
          previousMessages.map(item => ({ role: item.role, content: item.content })),
          mode,
          mode === 'model' ? temporaryModel : undefined,
          mode === 'model' ? providerIdForRequest : undefined,
          requestAttachments
        );
        const reply: ChatMessage = {
          id: makeId(), role: 'assistant', content: result.reply, createdAt: new Date().toISOString(), model: result.model,
          attachments: (result.attachments || []) as ChatOutputAttachment[],
        };
        setConversations(current => current.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, reply], updatedAt: reply.createdAt } : item));
      }
    } catch (err: any) { setError(err?.message || 'No se pudo enviar el mensaje.'); }
    finally { setSending(false); setTimeout(() => textareaRef.current?.focus(), 0); }
  };
  const deleteConversation = (id: string) => {
    setConversations(current => current.filter(item => item.id !== id));
    if (activeConversationId === id) setActiveConversationId('');
  };
  const selectConversation = (item: Conversation) => { setActiveConversationId(item.id); setTargetMode(item.targetMode || 'agent'); setSelectedAgentId(item.agentId); if (item.targetMode === 'model' && item.targetId) { setSelectedModelId(item.targetId); setSelectedProviderId(item.targetProviderId || '');  } setError(''); };

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
        <div className="flex min-w-0 items-center gap-2"><button onClick={() => setSidebarOpen(value => !value)} title={sidebarOpen ? 'Ocultar conversaciones' : 'Mostrar conversaciones'} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">{sidebarOpen ? <PanelLeftClose size={18}/> : <PanelLeftOpen size={18}/>}</button><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{activeConversation ? activeConversation.title : 'Nuevo chat'}</p><p className="text-[11px] text-slate-500">Conversaciones separadas por agente o modelo</p></div></div>
        <div className="flex max-w-[62%] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-1.5 sm:gap-2 sm:px-3 sm:py-2">
          <select aria-label="Tipo de destino" value={activeConversation ? (activeConversation.targetMode || 'agent') : targetMode} onChange={event => {
            const next = event.target.value as 'agent' | 'model';
            setTargetMode(next); setError('');
            if (activeConversation) {
              const nextId = next === 'agent' ? selectedAgentId : selectedModelId;
              updateConversationTarget(activeConversation.id, next, nextId, selectedProviderId);
            }
          }} className="max-w-[86px] bg-transparent text-xs text-cyan-300 outline-none sm:max-w-none sm:text-sm"><option value="agent" className="bg-slate-900">Agente</option><option value="model" className="bg-slate-900">Modelo</option></select>
          {targetMode === 'agent' ? <>
            <input aria-label="Buscar agente" value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder="Buscar agente…" className="hidden w-24 min-w-0 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 sm:block"/>
            <select aria-label="Seleccionar agente" value={activeConversation && activeConversation.targetMode !== 'model' ? (activeConversation.targetId || activeConversation.agentId) : selectedAgentId} onChange={event => {
              const id = event.target.value;
              setSelectedAgentId(id); setError('');
              if (activeConversation) updateConversationTarget(activeConversation.id, 'agent', id);
            }} disabled={loadingAgents || agents.length === 0} className="min-w-0 max-w-[140px] bg-transparent text-xs text-slate-100 outline-none sm:max-w-[190px] sm:text-sm">
              {loadingAgents ? <option value="">Cargando…</option> : filteredAgents.length ? filteredAgents.map(agent => <option key={agent.id} value={agent.id} className="bg-slate-900">{agent.name}</option>) : <option value="">Sin agentes</option>}
            </select>
          </> : <>
            <select aria-label="Proveedor" value={effectiveProviderId} onChange={event => {
              const id = event.target.value;
              setSelectedProviderId(id); setSelectedModelId(''); setCatalogModels([]); setError('');
              if (activeConversation) updateConversationTarget(activeConversation.id, 'model', '', id);
            }} className="min-w-0 max-w-[120px] bg-transparent text-xs text-slate-100 outline-none sm:max-w-[160px] sm:text-sm">
              <option value="">Proveedor…</option>{providers.map(provider => <option key={provider.id} value={provider.id} className="bg-slate-900">{provider.name}</option>)}
            </select>
            <input aria-label="Buscar modelo" value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder={catalogLoading ? 'Cargando…' : 'Buscar modelo…'} className="hidden w-24 min-w-0 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 sm:block"/>
            <select aria-label="Modelo" value={activeConversation?.targetMode === 'model' ? (activeConversation.targetId || '') : selectedModelId} onChange={event => {
              const id = event.target.value;
              setSelectedModelId(id); setError('');
              if (activeConversation) updateConversationTarget(activeConversation.id, 'model', id, effectiveProviderId);
            }} disabled={!effectiveProviderId || catalogLoading || catalogModels.length === 0} className="min-w-0 max-w-[120px] bg-transparent text-xs text-slate-100 outline-none sm:max-w-[190px] sm:text-sm">
              {catalogLoading ? <option value="">Cargando…</option> : filteredModels.map(model => <option key={model.id} value={model.id} className="bg-slate-900">{model.name}</option>)}
              {!catalogLoading && !catalogModels.length && <option value="">Sin modelos</option>}
            </select>
            <button type="button" title="Actualizar modelos" onClick={() => void refreshProviderModels()} disabled={!effectiveProviderId || catalogLoading} className="px-1 text-xs text-cyan-300 disabled:opacity-40">{catalogLoading ? '…' : '↻'}</button>
          </>}
          <ChevronDown size={14} className="shrink-0 text-slate-500"/>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto"><div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        {!currentMessages.length ? <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-300 shadow-lg shadow-black/20"><Sparkles size={26}/></div><h2 className="text-xl sm:text-2xl font-semibold tracking-tight">¿En qué te ayudo?</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{effectiveMode === 'model' ? `Estás hablando directamente con ${temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'el modelo seleccionado')}, sin personalidad de agente.` : selectedAgent ? `Estás conversando con ${selectedAgent.name}. Escribe una pregunta o cuéntale qué necesitas.` : 'Selecciona un agente activo para empezar a conversar.'}</p>
          {effectiveMode === 'agent' && selectedAgent?.description && <div className="mt-5 max-w-md rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left text-xs leading-5 text-slate-400">{selectedAgent.description}</div>}
          <div className="mt-7 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">{['Explícame algo paso a paso','Ayúdame a resolver un problema','Dame ideas para un proyecto','Resume este texto'].map(suggestion => <button key={suggestion} onClick={() => setMessage(suggestion)} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-left text-xs sm:text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-900 transition-colors">{suggestion}</button>)}</div>
        </div> : <div className="space-y-7 pb-6">{currentMessages.map(item => <div key={item.id} className={`flex gap-3 sm:gap-4 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {item.role === 'assistant' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div>}
          <div className={`max-w-[88%] min-w-0 sm:max-w-[82%] ${item.role === 'user' ? 'rounded-2xl rounded-br-md bg-slate-800 px-4 py-3' : 'pt-1'}`}>{item.role === 'assistant' && <p className="mb-2 text-xs font-semibold text-slate-300">{effectiveMode === 'model' ? (temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'Modelo IA')) : (selectedAgent?.name || 'Agente IA')}</p>}{item.content && <div className="text-sm leading-7 text-slate-200">{<MessageContent content={item.content} />}</div>}
            {item.attachments?.length ? <div className="mt-3 flex flex-col gap-2">{item.attachments.map((file, index) => {
              const src = file.url || (file.data ? `data:${file.mimeType};base64,${file.data}` : '');
              return <div key={`${file.name}-${index}`} className="max-w-full">
                {file.mimeType.startsWith('image/') && src && <img src={src} alt={file.name} className="max-h-80 max-w-full rounded-xl border border-slate-700 object-contain" loading="lazy" />}
                {file.mimeType.startsWith('audio/') && src && <audio controls preload="metadata" src={src} className="max-w-full" />}
                {file.mimeType.startsWith('video/') && src && <video controls preload="metadata" src={src} className="max-h-80 max-w-full rounded-xl border border-slate-700" />}
                {file.mimeType === 'application/pdf' && src && <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300 hover:bg-slate-800"><FileText size={15} /> Abrir {file.name}</a>}
                {!src && <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><Paperclip size={14} /> {file.name}</span>}
              </div>;
            })}</div> : null}
            {item.model && <p className="mt-2 text-[10px] text-slate-600">Modelo: {item.model}</p>}</div>
          {item.role === 'user' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200"><UserRound size={16}/></div>}
        </div>)}{sending && <div className="flex gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-950 text-cyan-300"><Bot size={17}/></div><div className="flex items-center gap-2 pt-1 text-sm text-slate-400"><LoaderCircle size={16} className="animate-spin"/>{effectiveMode === 'model' ? (temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'El modelo')) : (selectedAgent?.name || 'El agente')} está pensando…</div></div>}<div ref={messagesEndRef}/></div>}
      </div></div>
      <div className="px-3 pb-3 sm:px-5 sm:pb-5"><div className="mx-auto max-w-3xl">
        {error && <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2.5 text-xs leading-5 text-red-300"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{error}</div>}
        <form onSubmit={handleSend} className="rounded-2xl border border-slate-700 bg-slate-900 shadow-lg shadow-black/20 focus-within:border-slate-500">
          {effectiveMode === 'model' && <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-4 py-2.5">
            <span className="mr-1 text-[10px] font-medium text-slate-400">Modelo:</span>
            <span className="max-w-[220px] truncate text-[11px] font-semibold text-slate-200" title={temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'Modelo seleccionado')}>{temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'Modelo seleccionado')}</span>
            {selectedCatalogModel?.inputModalitiesKnown ? <>
              {(selectedCatalogModel.inputModalities || []).includes('image') && <span title="Acepta imágenes como entrada" className="inline-flex items-center gap-1 rounded-md border border-cyan-800/70 bg-cyan-950/50 px-1.5 py-1 text-[10px] text-cyan-300"><ImageIcon size={12}/> Imagen</span>}
              {(selectedCatalogModel.inputModalities || []).includes('audio') && <span title="Acepta audio como entrada" className="inline-flex items-center gap-1 rounded-md border border-cyan-800/70 bg-cyan-950/50 px-1.5 py-1 text-[10px] text-cyan-300"><Mic size={12}/> Audio</span>}
              {(selectedCatalogModel.inputModalities || []).includes('video') && <span title="Acepta vídeo como entrada" className="inline-flex items-center gap-1 rounded-md border border-cyan-800/70 bg-cyan-950/50 px-1.5 py-1 text-[10px] text-cyan-300"><Video size={12}/> Vídeo</span>}
              {(selectedCatalogModel.inputModalities || []).some(modality => ['pdf', 'document', 'file'].includes(modality)) && <span className="inline-flex items-center gap-1 rounded-md border border-cyan-800/70 bg-cyan-950/50 px-1.5 py-1 text-[10px] text-cyan-300"><FileText size={12}/> PDF</span>}
              {!(selectedCatalogModel.inputModalities || []).some(modality => ['image', 'audio', 'video', 'pdf'].includes(modality)) && <span className="rounded-md border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400">Solo texto</span>}
              {(selectedCatalogModel.outputModalities || []).filter(modality => modality !== 'text').map(modality => <span key={modality} className="rounded-md border border-violet-800/70 bg-violet-950/40 px-1.5 py-1 text-[10px] text-violet-300">{modality === 'image' ? 'Genera imágenes' : modality === 'audio' ? 'Genera audio' : modality === 'video' ? 'Vídeo · API especial' : `Salida: ${modality}`}</span>)}
              {selectedCatalogModel.capabilitiesSource === 'inferred' && <span title="Modalidades estimadas a partir de la familia del modelo y sus métodos declarados" className="rounded-md border border-amber-900/70 bg-amber-950/30 px-1.5 py-1 text-[10px] text-amber-300">Capacidades estimadas</span>}
            </> : <span title="El proveedor no publicó metadatos suficientes para verificar las modalidades de entrada" className="rounded-md border border-amber-900/70 bg-amber-950/30 px-1.5 py-1 text-[10px] text-amber-300">Capacidades sin verificar</span>}
          </div>}
          {pendingAttachments.length > 0 && <div className="flex flex-wrap gap-2 border-b border-slate-800 px-3 py-2">{pendingAttachments.map((file, index) => <div key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300"><Paperclip size={13} className="shrink-0 text-cyan-300"/><span className="max-w-[180px] truncate">{file.name}</span><button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setPendingAttachments(current => current.filter((_, i) => i !== index))} className="rounded p-0.5 text-slate-500 hover:text-red-300"><X size={13}/></button></div>)}</div>}
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,audio/*,video/*,application/pdf" onChange={event => void handleFileSelection(event)} className="hidden" />
          <textarea ref={textareaRef} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder={effectiveMode === 'model' ? `Escribe a ${temporarySelected ? temporaryLabel : (selectedCatalogModel?.name || selectedModel?.name || 'el modelo')}…` : selectedAgent ? `Escribe a ${selectedAgent.name}…` : 'Activa o crea un agente para empezar…'} rows={2} disabled={(effectiveMode === 'model' ? (!selectedCatalogModel && !selectedModel && !temporarySelected) : !selectedAgent) || sending} className="max-h-40 min-h-[58px] w-full resize-y bg-transparent px-4 pt-4 pb-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none disabled:opacity-50"/>
          <div className="flex items-center justify-between gap-3 px-3 pb-3"><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || (effectiveMode === 'model' && !selectedCatalogModel && !selectedModel && !temporarySelected) || (effectiveMode === 'agent' && !selectedAgent)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40" title="Adjuntar imagen, audio, vídeo o PDF"><Paperclip size={16}/></button><p className="text-[10px] text-slate-600">Enter para enviar · Shift + Enter para nueva línea</p></div><button type="submit" disabled={(!message.trim() && !pendingAttachments.length) || (effectiveMode === 'model' ? (temporarySelected ? !temporaryReady : (!selectedCatalogModel && !selectedModel)) : !selectedAgent) || sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40" title="Enviar mensaje">{sending ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={16}/>}</button></div>
        </form><p className="mt-2 text-center text-[10px] text-slate-600">En modo Agente se aplica su personalidad; en modo Modelo se consulta directamente. Los modelos temporales no se registran y requieren volver a introducir la clave al recargar.</p>
      </div></div>
    </section>
  </div>;
};
