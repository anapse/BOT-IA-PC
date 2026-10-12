import { validateToken } from './auth/auth';
import { getStorage } from './storage/kv';

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/status' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/sync' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });

      const token = authHeader.split(' ')[1];
      const { authorized } = await validateToken(token, env.FIREBASE_PROJECT_ID, env.ADMIN_EMAILS.split(','));
      
      if (!authorized) return new Response('Forbidden', { status: 403 });

      let config;
      try {
        config = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      if (!config.agents || !Array.isArray(config.agents)) {
        return new Response(JSON.stringify({ error: 'Invalid config: agents array required' }), { status: 400 });
      }

      const storage = getStorage(env);
      await storage.saveConfig(config);

      return new Response(JSON.stringify({ status: 'synced' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
