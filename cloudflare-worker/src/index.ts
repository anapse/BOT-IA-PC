import { validateToken } from './auth';
import { getStorage } from './storage';

const ALLOWED_ORIGINS = new Set([
  'https://anapse.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
]);

/**
 * Telegram is sent plain text (without parse_mode), so normalize common Markdown
 * and LaTeX from model output instead of exposing formatting markers to users.
 */
function formatTelegramText(value: string): string {
  return value
    // Undo literal escaping sometimes returned by models.
    .replace(/\\([*_#\[\]()])/g, '$1')
    // Markdown links: keep the visible label (including emoji), drop the URL.
    .replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    // Display/inline math delimiters.
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    // Common LaTeX commands that are useful in plain-text Telegram.
    .replace(/\\text\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1 ÷ $2)')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\div\b/g, '÷')
    .replace(/\\quad\b/g, ' ')
    .replace(/\\left\b|\\right\b/g, '')
    .replace(/\\,/g, ' ')
    // Headings and emphasis markers; preserve their text.
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    .replace(/~~(.*?)~~/gs, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Vary': 'Origin',
    };

    if (ALLOWED_ORIGINS.has(origin)) corsHeaders['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const respond = (body: BodyInit | null, status = 200, extraHeaders: Record<string, string> = {}) =>
      new Response(body, { status, headers: { ...corsHeaders, ...extraHeaders } });
    const json = (body: unknown, status = 200) =>
      respond(JSON.stringify(body), status, { 'Content-Type': 'application/json' });

    if (url.pathname === '/models/catalog' && request.method === 'POST') {
      let input: any;
      try { input = await request.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
      const provider = String(input?.provider || input?.type || '').toLowerCase();
      const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
      if (!apiKey) return json({ error: 'Introduce primero la API Key.' }, 400);
      let base = typeof input?.endpoint === 'string' ? input.endpoint.trim().replace(/\/+$/, '') : '';
      const defaults: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        google: 'https://generativelanguage.googleapis.com/v1beta',
        gemini: 'https://generativelanguage.googleapis.com/v1beta',
        openrouter: 'https://openrouter.ai/api/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
      };
      if (!base) base = defaults[provider] || '';
      if (!base) return json({ error: 'Configura un endpoint base HTTPS para este proveedor.' }, 400);
      let parsedEndpoint: URL;
      try { parsedEndpoint = new URL(base); } catch { return json({ error: 'Endpoint no válido.' }, 400); }
      if (parsedEndpoint.protocol !== 'https:' || parsedEndpoint.username || parsedEndpoint.password || parsedEndpoint.hostname === 'localhost' || parsedEndpoint.hostname === '127.0.0.1') {
        return json({ error: 'El endpoint debe usar HTTPS y no puede incluir credenciales ni localhost.' }, 400);
      }
      let endpoint = base + '/models';
      let headers: Record<string, string> = { Authorization: 'Bearer ' + apiKey };
      if (provider.includes('google') || provider.includes('gemini')) {
        endpoint = base + '/models?key=' + encodeURIComponent(apiKey); headers = {};
      } else if (provider.includes('anthropic')) {
        headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      }
      try {
        const upstream = await fetch(endpoint, { headers });
        const payload: any = await upstream.json().catch(() => ({}));
        if (!upstream.ok) { const detail = typeof payload?.error?.message === 'string' ? payload.error.message : (typeof payload?.detail === 'string' ? payload.detail : (typeof payload?.message === 'string' ? payload.message : (typeof payload?.title === 'string' ? payload.title : 'El proveedor rechazó la clave.'))); const hint = upstream.status === 401 ? ' Verifica que sea una API Key nvapi- creada en build.nvidia.com y que no tenga espacios.' : upstream.status === 403 ? ' La cuenta puede no tener permiso para usar este endpoint.' : ''; return json({ error: 'Catálogo (HTTP ' + upstream.status + '): ' + detail.slice(0, 250) + hint }, upstream.status === 401 || upstream.status === 403 ? 400 : 502); }
        const source = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        const models = source.map((item: any) => { const id = String(item?.id || item?.name || '').replace(/^models\//, ''); const name = String(item?.name || item?.displayName || id).replace(/^models\//, ''); return id ? { id, name, contextLength: item?.context_length || item?.inputTokenLimit || null } : null; }).filter(Boolean).sort((a: any, b: any) => a.name.localeCompare(b.name));
        return json({ models, count: models.length });
      } catch { return json({ error: 'No se pudo consultar el catálogo del proveedor.' }, 502); }
    }
    if (url.pathname === '/providers/test' && request.method === 'POST') {
      let input: any;
      try { input = await request.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
      const type = String(input?.type || '').toLowerCase();
      const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
      let base = typeof input?.endpoint === 'string' ? input.endpoint.trim() : '';
      if (!apiKey) return json({ error: 'Introduce una API key para probar la conexión.' }, 400);
      const defaults: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        google: 'https://generativelanguage.googleapis.com/v1beta',
        openrouter: 'https://openrouter.ai/api/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
      };
      base = (base || defaults[type] || '').replace(/\/+$/, '');
      if (!base) return json({ error: 'Configura un endpoint HTTPS válido.' }, 400);
      let parsed: URL;
      try { parsed = new URL(base); } catch { return json({ error: 'El endpoint no es una URL válida.' }, 400); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
        return json({ error: 'El endpoint debe usar HTTPS y no puede incluir credenciales ni localhost.' }, 400);
      }
      let testUrl = base + '/models';
      const headers: Record<string, string> = { Authorization: 'Bearer ' + apiKey };
      if (type === 'google') { testUrl = base + '/models?key=' + encodeURIComponent(apiKey); delete headers.Authorization; }
      if (type === 'anthropic') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; delete headers.Authorization; }
      try {
        const upstream = await fetch(testUrl, { headers, signal: AbortSignal.timeout(12000) });
        const payload: any = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          const detail = typeof payload?.error?.message === 'string' ? payload.error.message
            : typeof payload?.message === 'string' ? payload.message
            : typeof payload?.detail === 'string' ? payload.detail : 'El proveedor rechazó la conexión.';
          return json({ ok: false, error: 'Prueba fallida (HTTP ' + upstream.status + '): ' + detail.slice(0, 220) }, 400);
        }
        const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        return json({ ok: true, provider: type, modelsAvailable: list.length, message: 'La API key y el endpoint respondieron correctamente.' });
      } catch {
        return json({ error: 'No se pudo contactar con el endpoint. Revisa la URL y la conexión.' }, 502);
      }
    }

    if (url.pathname === '/providers/sync' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const validation = await validateToken(token, env.FIREBASE_PROJECT_ID || '', String(env.ADMIN_EMAILS || '').split(',').map((email: string) => email.trim()).filter(Boolean));
      if (!validation.authorized) return json({ error: 'No autorizado para sincronizar proveedores.' }, 403);
      let input: any;
      try { input = await request.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
      if (!Array.isArray(input?.providers)) return json({ error: 'La lista de proveedores guardados no es válida.' }, 400);
      const storage = getStorage(env);
      const currentConfig = await storage.getConfig();
      await storage.saveConfig({ ...currentConfig, providers: input.providers });
      return json({ status: 'synced', providers: input.providers.length });
    }

    if (url.pathname === '/providers/catalog' && request.method === 'POST') {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const validation = await validateToken(token, env.FIREBASE_PROJECT_ID || '', String(env.ADMIN_EMAILS || '').split(',').map((email: string) => email.trim()).filter(Boolean));
      if (!validation.authorized) return json({ error: 'No autorizado para consultar proveedores.' }, 403);
      let input: any;
      try { input = await request.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
      const providerId = typeof input?.providerId === 'string' ? input.providerId : '';
      // If the caller supplies the just-read Firebase snapshot, use it for this request.
      // KV propagation between edge locations is not guaranteed to be immediate.
      const providers = Array.isArray(input?.providers)
        ? input.providers
        : (await getStorage(env).getConfig()).providers;
      const provider = Array.isArray(providers)
        ? providers.find((item: any) => String(item?.id || '') === providerId && item?.status === 'activo')
        : null;
      if (!provider) return json({ error: 'Proveedor activo no encontrado en Firebase ni en la configuración sincronizada.' }, 404);
      const apiKey = typeof provider.apiKey === 'string' ? provider.apiKey.trim() : '';
      const type = String(provider.type || '').toLowerCase();
      const base = String(provider.endpoint || '').replace(/\/+$/, '');
      if (!apiKey || !base) return json({ error: 'El proveedor necesita API key y endpoint.' }, 400);
      let endpoint = base + '/models';
      let headers: Record<string, string> = { Authorization: 'Bearer ' + apiKey };
      if (type === 'google' || type === 'gemini') { endpoint = base + '/models?key=' + encodeURIComponent(apiKey); headers = {}; }
      if (type === 'anthropic') headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      try {
        const upstream = await fetch(endpoint, { headers, signal: AbortSignal.timeout(12000) });
        const payload: any = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          const detail = typeof payload?.error?.message === 'string' ? payload.error.message : typeof payload?.message === 'string' ? payload.message : 'El proveedor rechazó la consulta.';
          return json({ error: 'Catálogo (HTTP ' + upstream.status + '): ' + detail.slice(0, 220) }, 400);
        }
        const source = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        const models = source.map((item: any) => {
          const id = String(item?.id || item?.name || '').replace(/^models\//, '');
          const name = String(item?.displayName || item?.name || item?.id || id).replace(/^models\//, '');
          return id ? { id, name, contextLength: item?.context_length || item?.inputTokenLimit || null } : null;
        }).filter(Boolean).sort((a: any, b: any) => a.name.localeCompare(b.name));
        return json({ models, count: models.length });
      } catch { return json({ error: 'No se pudo consultar el catálogo del proveedor.' }, 502); }
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      return json({ status: 'ok', version: '1.0.0' });
    }

    const telegramMatch = url.pathname.match(/^\/webhook\/telegram\/([^/]+)$/);
    if (telegramMatch && request.method === 'POST') {
      let update: any;
      try { update = await request.json(); } catch { return json({ error: 'Invalid update' }, 400); }
      const config = await getStorage(env).getConfig();
      const connection = Array.isArray(config.connections) ? config.connections.find((item: any) => item?.id === decodeURIComponent(telegramMatch[1])) : null;
      if (!connection || connection.status !== 'activo' || !connection.botToken) return json({ error: 'Bot no encontrado o inactivo' }, 404);
      const incoming = update?.message;
      const chatId = incoming?.chat?.id;
      const sender = incoming?.from;
      let message = typeof incoming?.text === 'string' ? incoming.text.trim() : '';
      if (!chatId || !message) return json({ status: 'ignored' });
      const allowedUsers = Array.isArray(connection.allowedUsers) ? connection.allowedUsers.map((value: any) => String(value).trim().replace(/^@/, '').toLowerCase()).filter(Boolean) : [];
      if (allowedUsers.length) {
        const senderId = sender?.id == null ? '' : String(sender.id);
        const senderUsername = String(sender?.username || '').replace(/^@/, '').toLowerCase();
        if (!allowedUsers.includes(senderId) && (!senderUsername || !allowedUsers.includes(senderUsername))) {
          const denied = await fetch(`https://api.telegram.org/bot${connection.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: '⛔ No tienes permiso para usar este bot.' }) });
          return json({ status: 'user_not_allowed' });
        }
      }
      const send = async (text: string) => fetch(`https://api.telegram.org/bot${connection.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
      const allAgents = Array.isArray(config.agents) ? config.agents : [];
      const configuredAgentIds = Array.isArray(connection.agentIds) && connection.agentIds.length ? connection.agentIds.map(String) : (connection.agentId ? [String(connection.agentId)] : []);
      // Restrict each Telegram connection to the agents assigned to that bot.
      const activeAgents = allAgents.filter((item: any) =>
        (!item?.status || item.status === 'activo') && configuredAgentIds.includes(String(item?.id))
      );
      const normalizeCommand = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
      const stateKey = `telegram:selected-agent:${String(connection.botToken).slice(-10)}:${String(chatId)}`;
      const commandMatch = message.match(/^\$(\S+)(?:\s+([\s\S]*))?$/);
      let selectedAgentId = '';
      let routedMessage = message;
      if (commandMatch) {
        const command = normalizeCommand(commandMatch[1]);
        const argument = (commandMatch[2] || '').trim();
        if (command === 'agente' || command === 'agent') {
          const argumentWords = argument.split(/\s+/).filter(Boolean);
          const requested = normalizeCommand(argumentWords[0] || '');
          if (!argument || requested === 'list' || requested === 'lista') {
            const lines = activeAgents.map((item: any) => {
              const label = String(item.name || item.nombre || item.id || 'Agente').trim();
              const alias = label.split(/\s+/)[0];
              return `• $${alias} — ${label}`;
            });
            await send(lines.length ? `Agentes disponibles:\n${lines.join('\n')}` : 'No hay agentes activos.');
            return json({ status: 'agent_list' });
          }
          let found: any = null;
          let consumedWords = 0;
          for (let count = argumentWords.length; count >= 1; count--) {
            const candidate = argumentWords.slice(0, count).join(' ');
            found = activeAgents.find((item: any) => {
              const label = String(item.name || item.nombre || '').trim();
              const alias = label.split(/\s+/)[0];
              return normalizeCommand(alias) === normalizeCommand(candidate) ||
                normalizeCommand(label) === normalizeCommand(candidate) ||
                normalizeCommand(String(item.id || '')) === normalizeCommand(candidate);
            });
            if (found) { consumedWords = count; break; }
          }
          if (!found) {
            await send('Agente no disponible.');
            return json({ status: 'agent_not_found' });
          }
          selectedAgentId = String(found.id);
          routedMessage = argumentWords.slice(consumedWords).join(' ').trim();
          await env.WORKER_KV.put(stateKey, selectedAgentId);
          if (!routedMessage) {
            await send(`Seleccionado: ${found.name || found.id}`);
            return json({ status: 'agent_selected', agentId: selectedAgentId });
          }
        }
        if (command !== 'agente' && command !== 'agent') {
          // Match a friendly alias based on the configured agent name, including names with spaces.
          // Example: "$dismary cosina hola" selects "dismary cosina" and routes "hola".
          const words = [command, ...argument.split(/\s+/).filter(Boolean)];
          let directAgent: any = null;
          let consumedWords = 0;
          for (let count = words.length; count >= 1; count--) {
            const candidate = words.slice(0, count).join(' ');
            directAgent = activeAgents.find((item: any) => {
              const label = String(item.name || item.nombre || '').trim();
              const alias = label.split(/\s+/)[0];
              return normalizeCommand(alias) === normalizeCommand(candidate) ||
                normalizeCommand(label) === normalizeCommand(candidate) ||
                normalizeCommand(String(item.id || '')) === normalizeCommand(candidate);
            });
            if (directAgent) {
              consumedWords = count;
              break;
            }
          }
          if (directAgent) {
            selectedAgentId = String(directAgent.id);
            routedMessage = words.slice(consumedWords).join(' ').trim();
            await env.WORKER_KV.put(stateKey, selectedAgentId);
            if (!routedMessage) {
              await send(`Seleccionado: ${directAgent.name || directAgent.id}`);
              return json({ status: 'agent_selected', agentId: selectedAgentId });
            }
          } else {
            await send('Agente no disponible.');
            return json({ status: 'unknown_command' });
          }
        }
      } else {
        selectedAgentId = String(await env.WORKER_KV.get(stateKey) || '');
      }
      // Remove stale per-chat selections that are no longer assigned to this bot.
      if (!activeAgents.some((item: any) => String(item?.id) === selectedAgentId)) {
        selectedAgentId = '';
        await env.WORKER_KV.delete(stateKey);
      }
      if (!selectedAgentId) {
        const defaultAgentId = String(connection.agentId || '');
        selectedAgentId = activeAgents.some((item: any) => String(item?.id) === defaultAgentId)
          ? defaultAgentId
          : String(activeAgents[0]?.id || '');
      }
      message = routedMessage;
      const agent = activeAgents.find((item: any) => String(item?.id) === selectedAgentId) || null;
      if (!agent || (agent.status && agent.status !== 'activo')) {
        await send(!agent ? 'Este bot no tiene un agente válido asignado. Revisa BOT IA PC.' : 'El agente asignado está pausado o inactivo.');
        return json({ status: 'agent_unavailable' });
      }
      const models = Array.isArray(config.models) ? config.models : [];
      const providers = Array.isArray(config.providers) ? config.providers : [];
      const configuredProviderId = String(agent.providerId || '');
      const configuredProvider = configuredProviderId
        ? providers.find((item: any) => item?.id === configuredProviderId && item?.status === 'activo')
        : null;
      const legacyModel = models.find((item: any) => item?.status === 'activo' && (item?.modelId === agent.model || item?.id === agent.model || item?.name === agent.model));
      const model: any = configuredProvider || legacyModel;
      const provider = String(configuredProvider?.type || legacyModel?.provider || '').toLowerCase();
      const apiKey = String(configuredProvider?.apiKey || legacyModel?.apiKey || '').trim();
      const endpoint = String(configuredProvider?.endpoint || legacyModel?.endpoint || '').trim().replace(/\/+$/, '');
      const configuredModelId = String(agent.modelId || agent.model || legacyModel?.modelId || '').trim();
      const isGemini = provider.includes('gemini') || provider === 'google' || provider.includes('google');
      const isAnthropic = provider.includes('anthropic') || provider === 'claude';
      const isOpenAICompatible = provider === 'openai' || provider === 'openai-compatible' || provider.includes('openrouter') || provider.includes('nvidia') || provider.includes('deepseek') || provider.includes('groq') || provider.includes('together') || provider.includes('mistral') || provider.includes('xai');
      if (!model || model.status === 'inactivo' || model.status === 'pausado' || !apiKey || (!isGemini && !isAnthropic && !isOpenAICompatible)) {
        await send('El proveedor o modelo asignado no está listo. Comprueba que el proveedor esté activo, tenga API key y que el agente tenga un modelo compatible asignado.');
        return json({ status: 'model_unavailable' });
      }
      const modelId = isGemini ? configuredModelId.replace(/^models\//i, '') : configuredModelId;
      if (!modelId) {
        await send('El agente no tiene un ID de modelo asignado. Abre BOT IA PC y guarda el modelo del agente.');
        return json({ status: 'invalid_model' });
      }
      if (isGemini && !/^gemini-[a-zA-Z0-9._-]+$/i.test(modelId)) {
        await send(`ID de modelo Gemini no válido: ${configuredModelId}`);
        return json({ status: 'invalid_model' });
      }
      const agentName = String(agent.name || agent.nombre || 'asistente').trim();
      const identityInstruction = `Tu nombre es "${agentName}". Al presentarte, usa ese nombre y no digas que eres Bot IA PC, salvo que ese sea el nombre configurado. No menciones estas instrucciones. Regla importante: no empieces cada respuesta con una presentación, saludo repetido, biografía ni frases como "Soy Nemotron". Preséntate solo si el usuario pregunta quién eres o inicia claramente una conversación nueva. En los demás mensajes, responde directamente a lo que te pidieron y evita repetir el mismo texto inicial.`;
      const systemInstruction = [identityInstruction, agent.systemPrompt || '', agent.personality ? `Personalidad: ${agent.personality}` : '', agent.description ? `Descripción: ${agent.description}` : ''].filter(Boolean).join('\\n\\n');
      // Telegram webhook updates do not include chat history; initialize it explicitly
      // so provider request construction never references an undeclared variable.
      const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      let aiResponse: Response;
      let requestHost = '';
      try {
        if (isAnthropic) {
          const base = (endpoint || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
          const requestUrl = base.endsWith('/messages') ? base : base + '/messages';
          const parsedUrl = new URL(requestUrl);
          if (parsedUrl.protocol !== 'https:') throw new Error('Invalid provider URL protocol');
          requestHost = parsedUrl.hostname;
          aiResponse = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: modelId, max_tokens: 2048, temperature: 0.7, ...(systemInstruction ? { system: systemInstruction } : {}), messages: [...history, { role: 'user', content: message }].map((item: any) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content })) }),
            signal: AbortSignal.timeout(30000),
          });
        } else if (isGemini) {
          const base = (endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
          const requestUrl = base + '/models/' + encodeURIComponent(modelId) + ':generateContent?key=' + encodeURIComponent(apiKey);
          const parsedUrl = new URL(requestUrl);
          if (parsedUrl.protocol !== 'https:') throw new Error('Invalid provider URL protocol');
          requestHost = parsedUrl.hostname;
          aiResponse = await fetch(requestUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}), contents: [...history, { role: 'user', content: message }].map((item: any) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })), generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
            signal: AbortSignal.timeout(30000),
          });
        } else {
          const defaultBase = provider.includes('openrouter') ? 'https://openrouter.ai/api/v1'
            : provider.includes('nvidia') ? 'https://integrate.api.nvidia.com/v1'
            : provider.includes('deepseek') ? 'https://api.deepseek.com'
            : provider.includes('groq') ? 'https://api.groq.com/openai/v1'
            : provider.includes('together') ? 'https://api.together.xyz/v1'
            : provider.includes('mistral') ? 'https://api.mistral.ai/v1'
            : provider.includes('xai') ? 'https://api.x.ai/v1'
            : 'https://api.openai.com/v1';
          const base = (endpoint || defaultBase).replace(/\/+$/, '');
          const requestUrl = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
          const parsedUrl = new URL(requestUrl);
          if (parsedUrl.protocol !== 'https:') throw new Error('Invalid provider URL protocol');
          requestHost = parsedUrl.hostname;
          aiResponse = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey, ...(provider.includes('openrouter') ? { 'HTTP-Referer': 'https://anapse.github.io/BOT-IA-PC/', 'X-OpenRouter-Title': 'BOT IA PC' } : {}) },
            body: JSON.stringify({ model: modelId, messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...history, { role: 'user', content: message }], temperature: 0.7, max_tokens: 2048, stream: false }),
            signal: AbortSignal.timeout(30000),
          });
        }
      } catch (error) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error('Telegram AI request failed', { provider, modelId, requestHost: requestHost || 'invalid-url', errorName });
        await send('No se pudo conectar con el proveedor ' + (provider.toUpperCase() || 'de IA') + ' (' + errorName + '). Revisa el endpoint y los registros de Cloudflare.');
        return json({ error: 'AI provider unavailable', provider, errorName }, 502);
      }
      const result: any = await aiResponse.json().catch(() => ({}));
      const rawReply = isAnthropic
        ? (Array.isArray(result?.content) ? result.content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '')
        : isGemini
          ? (Array.isArray(result?.candidates?.[0]?.content?.parts) ? result.candidates[0].content.parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '')
          : (typeof result?.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content.trim() : '');
      const reply = formatTelegramText(rawReply);
      if (!aiResponse.ok || !reply) {
        await send(aiResponse.status === 429 ? 'La IA está ocupada. Inténtalo en un momento.' : 'La IA no pudo responder. Revisa el modelo configurado.');
        return json({ error: 'AI request failed' }, 502);
      }
      // Telegram's message limit is 4096 characters. Keep a safety margin.
      const chunks = reply.match(/[\s\S]{1,3900}/g) || [''];
      for (const chunk of chunks) {
        const sent = await send(chunk);
        if (!sent.ok) return json({ error: 'Telegram sendMessage failed' }, 502);
      }
      return json({ status: 'ok' });
    }

    if ((url.pathname === '/sync' && request.method === 'POST') ||
        (url.pathname === '/config' && request.method === 'GET') ||
        (url.pathname === '/chat' && request.method === 'POST')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return json({ error: 'missing_bearer_token' }, 401);
      }

      const token = authHeader.slice('Bearer '.length).trim();
      const validation = await validateToken(
        token,
        env.FIREBASE_PROJECT_ID,
        String(env.ADMIN_EMAILS || '').split(',').map((email: string) => email.trim()).filter(Boolean),
      );

      if (!validation.authorized) {
        const messages: Record<string, string> = {
          invalid_token: 'Firebase ID token inválido o el proyecto configurado no coincide.',
          email_missing: 'El token de Firebase no contiene un correo.',
          email_unverified: 'El correo de la cuenta de Firebase no está verificado.',
          not_admin: 'La cuenta autenticada no está en la lista de administradores del Worker.',
        };
        return json({
          error: 'forbidden',
          reason: validation.reason,
          message: messages[validation.reason],
        }, 403);
      }

      const storage = getStorage(env);

      if (url.pathname === '/config' && request.method === 'GET') {
        const config = await storage.getConfig();
        const safeConfig = {
          ...config,
          models: Array.isArray(config.models) ? config.models.map((model: any) => {
            const { apiKey, ...safeModel } = model || {};
            return safeModel;
          }) : [],
          providers: Array.isArray(config.providers) ? config.providers.map((provider: any) => {
            const { apiKey, ...safeProvider } = provider || {};
            return safeProvider;
          }) : [],
        };
        return json({ status: 'ok', config: safeConfig });
      }

      if (url.pathname === '/chat' && request.method === 'POST') {
        let input: any;
        try { input = await request.json(); }
        catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
        const mode = input?.mode === 'model' ? 'model' : 'agent';
        const agentId = typeof input?.agentId === 'string' ? input.agentId : (mode === 'agent' && typeof input?.targetId === 'string' ? input.targetId : '');
        const requestedModelId = typeof input?.modelId === 'string' ? input.modelId : (mode === 'model' && typeof input?.targetId === 'string' ? input.targetId : '');
        const message = typeof input?.message === 'string' ? input.message.trim() : '';
        const history = Array.isArray(input?.history) ? input.history.slice(-20).filter((item: any) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string').map((item: any) => ({ role: item.role, content: item.content.slice(0, 12000) })) : [];
        if ((mode === 'agent' ? !agentId : !requestedModelId) || !message) return json({ error: 'El destino y el mensaje son obligatorios.' }, 400);
        if (message.length > 12000) return json({ error: 'El mensaje supera el límite de 12000 caracteres.' }, 413);
        const config = await storage.getConfig();
        const agent = mode === 'agent' ? (Array.isArray(config.agents) ? config.agents.find((item: any) => item?.id === agentId) : null) : null;
        if (mode === 'agent' && !agent) return json({ error: 'El agente no aparece en la configuración sincronizada. Sincroniza desde el panel.' }, 404);
        if (mode === 'agent' && agent?.status && agent.status !== 'activo') return json({ error: 'El agente está pausado o inactivo.' }, 409);
        const models = Array.isArray(config.models) ? config.models : [];
        const temporary = mode === 'model' && input?.temporaryModel && typeof input.temporaryModel === 'object'
          ? input.temporaryModel : null;
        let model: any = null;
        let provider = '';
        let modelId = '';
        let apiKey = '';
        let endpoint = '';
        let isAnthropic = false;
        let isGemini = false;
        let isOpenAICompatible = false;

        if (temporary) {
          provider = String(temporary.provider || '').trim().toLowerCase();
          modelId = String(temporary.modelId || '').trim();
          apiKey = typeof temporary.apiKey === 'string' ? temporary.apiKey.trim() : '';
          const allowedProviders = new Set(['openai', 'anthropic', 'google', 'openrouter', 'nvidia']);
          if (!allowedProviders.has(provider)) return json({ error: 'Proveedor temporal no admitido.' }, 400);
          if (!modelId || modelId.length > 240 || /[\r\n]/.test(modelId)) return json({ error: 'Introduce un ID técnico de modelo válido (máximo 240 caracteres).' }, 400);
          if (!apiKey || apiKey.length > 500) return json({ error: 'Introduce una API Key válida.' }, 400);
          // Temporary keys are used only for this request: never write them to KV or Firebase.
        } else {
          const providers = Array.isArray(config.providers) ? config.providers : [];
          const providerId = mode === 'agent' ? String(agent?.providerId || '') : String(input?.providerId || '');
          const configuredProvider = providerId ? providers.find((item: any) => item?.id === providerId && item?.status === 'activo') : null;
          if (configuredProvider) {
            provider = String(configuredProvider.type || '').toLowerCase();
            modelId = String(mode === 'agent' ? (agent?.modelId || agent?.model || '') : requestedModelId).trim();
            apiKey = typeof configuredProvider.apiKey === 'string' ? configuredProvider.apiKey.trim() : '';
            endpoint = typeof configuredProvider.endpoint === 'string' ? configuredProvider.endpoint.trim() : '';
            model = configuredProvider;
            if (!apiKey) return json({ error: 'El proveedor seleccionado no tiene API key guardada.' }, 400);
          } else {
            model = mode === 'model'
              ? models.find((item: any) => item?.status === 'activo' && (item?.id === requestedModelId || item?.modelId === requestedModelId || item?.name === requestedModelId))
              : models.find((item: any) => item?.status === 'activo' && (item?.modelId === agent?.model || item?.id === agent?.model || item?.name === agent?.model));
            if (!model) return json({ error: mode === 'model' ? 'No se encontró ese modelo activo. Selecciona un proveedor configurado o sincroniza la configuración.' : 'No se encontró un proveedor/modelo activo para este agente. Revisa su asignación.' }, 400);
            if (model.connectionType === 'local') return json({ error: 'Los modelos locales todavía no se ejecutan desde este Worker.' }, 400);
            provider = String(model.provider || '').toLowerCase();
            modelId = String(model.modelId || (mode === 'agent' ? agent?.model : '') || '').trim();
            apiKey = typeof model.apiKey === 'string' ? model.apiKey.trim() : '';
            endpoint = typeof model.endpoint === 'string' ? model.endpoint.trim() : '';
            if (!apiKey) return json({ error: 'El modelo no tiene API Key guardada. Edítalo y guarda la clave antes de sincronizar.' }, 400);
          }
        }

        isGemini = provider.includes('gemini') || provider === 'google' || provider.includes('google');
        isAnthropic = provider.includes('anthropic') || provider === 'claude';
        isOpenAICompatible = provider === 'openai' || provider === 'openai-compatible' || provider.includes('openrouter') || provider.includes('nvidia') || provider.includes('deepseek') || provider.includes('groq') || provider.includes('together') || provider.includes('mistral') || provider.includes('xai');
        if (!isGemini && !isAnthropic && !isOpenAICompatible) return json({ error: 'Proveedor no compatible. Usa OpenAI, Anthropic, Google Gemini, OpenRouter o NVIDIA NIM.' }, 400);
        if (isGemini) modelId = modelId.replace(/^models\//i, '');
        if (!modelId) return json({ error: 'Introduce el ID técnico del modelo.' }, 400);
        if (isGemini && !/^gemini-[a-zA-Z0-9._-]+$/i.test(modelId)) return json({ error: `El ID de modelo Gemini no es válido: "${modelId}".` }, 400);

        const systemInstruction = mode === 'agent' ? ['No repitas presentaciones ni saludos al principio de cada respuesta. Preséntate solo si el usuario pregunta quién eres; responde directamente a la consulta y varía la redacción de forma natural.', agent?.systemPrompt || '', agent?.personality ? `Personalidad: ${agent.personality}` : '', agent?.description ? `Descripción: ${agent.description}` : ''].filter(Boolean).join('\\n\\n') : '';
        const safeHistory = history.map((item: any) => ({ role: item.role, content: item.content }));
        let upstream: Response;
        try {
          if (isAnthropic) {
            upstream = await fetch((endpoint ? endpoint.replace(/\/+$/, '') : 'https://api.anthropic.com/v1') + '/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'false' },
              body: JSON.stringify({ model: modelId, max_tokens: 2048, temperature: 0.7, ...(systemInstruction ? { system: systemInstruction } : {}), messages: [...safeHistory, { role: 'user', content: message }].map((item: any) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content })) }),
            });
          } else if (isGemini) {
            upstream = await fetch((endpoint ? endpoint.replace(/\/+$/, '') : 'https://generativelanguage.googleapis.com/v1beta') + `/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}), contents: [...safeHistory, { role: 'user', content: message }].map((item: any) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })), generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
            });
          } else {
            const defaultEndpoint = provider.includes('openrouter') ? 'https://openrouter.ai/api/v1/chat/completions'
              : provider.includes('nvidia') ? 'https://integrate.api.nvidia.com/v1/chat/completions'
               : provider === 'openai-compatible' ? endpoint : provider === 'openai' ? 'https://api.openai.com/v1/chat/completions'
              : provider.includes('deepseek') ? 'https://api.deepseek.com/chat/completions'
              : provider.includes('groq') ? 'https://api.groq.com/openai/v1/chat/completions'
              : provider.includes('together') ? 'https://api.together.xyz/v1/chat/completions'
              : provider.includes('mistral') ? 'https://api.mistral.ai/v1/chat/completions'
              : provider.includes('xai') ? 'https://api.x.ai/v1/chat/completions'
              : 'https://api.openai.com/v1/chat/completions';
            // Temporary models use fixed provider URLs, not user-controlled endpoints.
            const requestEndpoint = temporary ? defaultEndpoint : (endpoint ? (endpoint.replace(/\/+$/, '').endsWith('/chat/completions') ? endpoint.replace(/\/+$/, '') : endpoint.replace(/\/+$/, '') + '/chat/completions') : defaultEndpoint);
            upstream = await fetch(requestEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(provider.includes('openrouter') ? { 'HTTP-Referer': 'https://anapse.github.io/BOT-IA-PC/', 'X-OpenRouter-Title': 'BOT IA PC' } : {}) },
              body: JSON.stringify({ model: modelId, messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), ...safeHistory, { role: 'user', content: message }], temperature: 0.7, max_tokens: 2048, stream: false }),
            });
          }
        } catch { return json({ error: 'No se pudo conectar con el proveedor de IA.' }, 502); }
        const result: any = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          const apiMessage = typeof result?.error?.message === 'string' ? result.error.message : (typeof result?.error?.type === 'string' ? result.error.type : (typeof result?.detail === 'string' ? result.detail : (typeof result?.message === 'string' ? result.message : 'El proveedor rechazó la solicitud.')));
          return json({ error: `${provider.toUpperCase()} (HTTP ${upstream.status}): ${apiMessage.slice(0, 300)}` }, upstream.status === 429 ? 429 : 502);
        }
        const reply = isAnthropic
          ? (Array.isArray(result?.content) ? result.content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '')
          : isGemini
            ? (Array.isArray(result?.candidates?.[0]?.content?.parts) ? result.candidates[0].content.parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '')
            : (typeof result?.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content.trim() : '');
        if (!reply) return json({ error: `${provider.toUpperCase()} respondió, pero no devolvió texto. Revisa el ID del modelo o sus permisos.` }, 502);
        return json({ status: 'ok', reply, model: modelId });
      }

      let config;
      try {
        config = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      if (!config?.agents || !Array.isArray(config.agents)) {
        return json({ error: 'Invalid config: agents array required' }, 400);
      }

      await storage.saveConfig(config);
      const telegramWebhooks = [];
      if (Array.isArray(config.connections)) {
        for (const connection of config.connections) {
          if (!connection?.id || !connection?.botToken) continue;
          if (connection.status !== 'activo') {
            telegramWebhooks.push({ id: connection.id, status: 'inactive' });
            continue;
          }
          try {
            const botApiBase = `https://api.telegram.org/bot${String(connection.botToken).trim()}`;
            const identityResponse = await fetch(`${botApiBase}/getMe`);
            const identityResult: any = await identityResponse.json().catch(() => ({}));
            if (!identityResponse.ok || !identityResult?.ok) {
              const reason = identityResult?.description || `Telegram respondió HTTP ${identityResponse.status}`;
              telegramWebhooks.push({ id: connection.id, name: connection.name || 'Bot sin nombre', status: 'error', description: `Token rechazado por Telegram: ${reason}. Comprueba que hayas copiado el token completo desde @BotFather, sin espacios ni el prefijo adicional «bot».` });
              continue;
            }
            const webhookUrl = `${url.origin}/webhook/telegram/${encodeURIComponent(connection.id)}`;
            const telegramResponse = await fetch(`${botApiBase}/setWebhook`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
            });
            const telegramResult: any = await telegramResponse.json().catch(() => ({}));
            telegramWebhooks.push({ id: connection.id, name: connection.name || identityResult.result?.username || 'Bot sin nombre', username: identityResult.result?.username, status: telegramResponse.ok && telegramResult?.ok ? 'registered' : 'error', description: telegramResponse.ok && telegramResult?.ok ? 'Webhook registrado correctamente.' : (telegramResult?.description || `Telegram respondió HTTP ${telegramResponse.status}`) });
          } catch {
            telegramWebhooks.push({ id: connection.id, name: connection.name || 'Bot sin nombre', status: 'error', description: 'No se pudo contactar con la API de Telegram. Comprueba la conexión e inténtalo de nuevo.' });
          }
        }
      }
      return json({ status: 'synced', telegramWebhooks });
    }

    return respond('Not Found', 404);
  },
};
