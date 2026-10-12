# Despliegue de Bot IA PC Worker

1. Crea un KV Namespace en Cloudflare: `npx wrangler kv:namespace create WORKER_KV`
2. Actualiza `wrangler.toml` con el ID generado.
3. Configura los secretos en Cloudflare:
   - `FIREBASE_PROJECT_ID`
   - `ADMIN_EMAILS`
4. Despliega: `npm run deploy`
