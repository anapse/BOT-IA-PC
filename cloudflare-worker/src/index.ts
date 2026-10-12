import { validateToken } from './auth';
import { getStorage } from './storage';

const ALLOWED_ORIGINS = new Set([
  'https://anapse.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
]);

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

    if (url.pathname === '/status' && request.method === 'GET') {
      return json({ status: 'ok', version: '1.0.0' });
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
        };
        return json({ status: 'ok', config: safeConfig });
      }

      if (url.pathname === '/chat' && request.method === 'POST') {
        let input: any;
        try { input = await request.json(); }
        catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
        const agentId = typeof input?.agentId === 'string' ? input.agentId : '';
        const message = typeof input?.message === 'string' ? input.message.trim() : '';
        if (!agentId || !message) return json({ error: 'agentId y message son obligatorios.' }, 400);
        if (message.length > 12000) return json({ error: 'El mensaje supera el límite de 12000 caracteres.' }, 413);
        const config = await storage.getConfig();
        const agent = Array.isArray(config.agents) ? config.agents.find((item: any) => item?.id === agentId) : null;
        if (!agent) return json({ error: 'El agente no aparece en la configuración sincronizada. Sincroniza desde el panel.' }, 404);
        if (agent.status && agent.status !== 'activo') return json({ error: 'El agente está pausado o inactivo.' }, 409);
        const models = Array.isArray(config.models) ? config.models : [];
        const model = models.find((item: any) => item?.status === 'activo' && (item?.modelId === agent.model || item?.id === agent.model || item?.name === agent.model));
        if (!model) return json({ error: `No se encontró un modelo activo para "${agent.model || 'sin modelo'}". Comprueba la asignación y sincroniza otra vez.` }, 400);
        if (model.connectionType === 'local') return json({ error: 'Los modelos locales todavía no se ejecutan desde este Worker.' }, 400);
        if (!String(model.provider || '').toLowerCase().includes('gemini') && !String(model.provider || '').toLowerCase().includes('google')) return json({ error: 'Este endpoint de prueba solo admite Google Gemini por ahora.' }, 400);
        if (!model.apiKey) return json({ error: 'El modelo no tiene API Key guardada. Edítalo y guarda la clave antes de sincronizar.' }, 400);
        const modelId = String(model.modelId || agent.model || '');
        if (!/^gemini-[a-zA-Z0-9.-]+$/.test(modelId)) return json({ error: 'El ID de modelo Gemini no es válido.' }, 400);
        const systemInstruction = [agent.systemPrompt || '', agent.personality ? `Personalidad: ${agent.personality}` : '', agent.description ? `Descripción: ${agent.description}` : ''].filter(Boolean).join('\n\n');
        let upstream: Response;
        try {
          upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(model.apiKey)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}), contents: [{ role: 'user', parts: [{ text: message }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
          });
        } catch { return json({ error: 'No se pudo conectar con la API de Gemini.' }, 502); }
        const result: any = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          const apiMessage = typeof result?.error?.message === 'string' ? result.error.message : 'Google Gemini rechazó la solicitud.';
          return json({ error: `Gemini (HTTP ${upstream.status}): ${apiMessage.slice(0, 350)}` }, upstream.status === 429 ? 429 : 502);
        }
        const reply = Array.isArray(result?.candidates?.[0]?.content?.parts) ? result.candidates[0].content.parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim() : '';
        if (!reply) return json({ error: 'Gemini respondió, pero no devolvió texto. Revisa el modelo o sus permisos.' }, 502);
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
      return json({ status: 'synced' });
    }

    return respond('Not Found', 404);
  },
};
