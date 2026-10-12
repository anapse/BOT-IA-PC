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

    if (ALLOWED_ORIGINS.has(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const respond = (body: BodyInit | null, status = 200, extraHeaders: Record<string, string> = {}) =>
      new Response(body, {
        status,
        headers: { ...corsHeaders, ...extraHeaders },
      });

    if (url.pathname === '/status' && request.method === 'GET') {
      return respond(JSON.stringify({ status: 'ok', version: '1.0.0' }), 200, {
        'Content-Type': 'application/json',
      });
    }

    if (url.pathname === '/sync' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return respond(JSON.stringify({ error: 'missing_bearer_token' }), 401, {
          'Content-Type': 'application/json',
        });
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
        return respond(JSON.stringify({
          error: 'forbidden',
          reason: validation.reason,
          message: messages[validation.reason],
        }), 403, { 'Content-Type': 'application/json' });
      }

      let config;
      try {
        config = await request.json();
      } catch {
        return respond(JSON.stringify({ error: 'Invalid JSON' }), 400, {
          'Content-Type': 'application/json',
        });
      }

      if (!config?.agents || !Array.isArray(config.agents)) {
        return respond(JSON.stringify({ error: 'Invalid config: agents array required' }), 400, {
          'Content-Type': 'application/json',
        });
      }

      const storage = getStorage(env);
      await storage.saveConfig(config);

      return respond(JSON.stringify({ status: 'synced' }), 200, {
        'Content-Type': 'application/json',
      });
    }

    return respond('Not Found', 404);
  },
};
