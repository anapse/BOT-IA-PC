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
      if (!authHeader?.startsWith('Bearer ')) return respond('Unauthorized', 401);

      const token = authHeader.split(' ')[1];
      const { authorized } = await validateToken(
        token,
        env.FIREBASE_PROJECT_ID,
        String(env.ADMIN_EMAILS || '').split(',').map((email: string) => email.trim()).filter(Boolean),
      );

      if (!authorized) return respond('Forbidden', 403);

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
