export const WORKER_ENDPOINTS = {
  STATUS: '/status',
  SYNC: '/sync',
  CONFIG: '/config',
};

import { auth } from '../firebase/firebase';

const getAdminToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  return user.getIdToken();
};

export const checkWorkerStatus = async (workerUrl: string) => {
  const response = await fetch(`${workerUrl}${WORKER_ENDPOINTS.STATUS}`);
  if (!response.ok) throw new Error(`Worker no disponible (HTTP ${response.status})`);
  return await response.json();
};

export const syncWorkerConfig = async (workerUrl: string, config: any) => {
  const token = await getAdminToken();
  const response = await fetch(`${workerUrl}${WORKER_ENDPOINTS.SYNC}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    let serverMessage = '';
    try {
      const parsed = JSON.parse(details);
      serverMessage = typeof parsed.message === 'string' ? parsed.message : '';
    } catch {
      // Use the response text below for non-JSON errors.
    }

    if (response.status === 401) {
      throw new Error('HTTP 401: no se recibió un token válido de Firebase. Cierra sesión y vuelve a entrar.');
    }
    if (response.status === 403) {
      throw new Error(`HTTP 403: ${serverMessage || 'el Worker rechazó la cuenta. Comprueba el correo administrador verificado.'}`);
    }
    throw new Error(`HTTP ${response.status}${details ? `: ${details.slice(0, 200)}` : ''}`);
  }

  return await response.json();
};

export const readWorkerConfig = async (workerUrl: string) => {
  const token = await getAdminToken();
  const response = await fetch(`${workerUrl}${WORKER_ENDPOINTS.CONFIG}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    let serverMessage = '';
    try {
      const parsed = JSON.parse(details);
      serverMessage = typeof parsed.message === 'string' ? parsed.message : '';
    } catch {
      // Keep a concise fallback for non-JSON errors.
    }
    throw new Error(`No se pudo leer la configuración de KV (HTTP ${response.status})${serverMessage ? `: ${serverMessage}` : ''}`);
  }

  return await response.json();
};

export const sendAgentChatMessage = async (workerUrl: string, agentId: string, message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<{ reply: string; model: string }> => {
  const token = await getAdminToken();
  const baseUrl = workerUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentId, message, history }),
  });
  const result = await response.json().catch(() => ({} as any));
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : `Error del Worker (HTTP ${response.status})`);
  if (typeof result?.reply !== 'string') throw new Error('La respuesta del Worker no contiene texto.');
  return { reply: result.reply, model: String(result.model || '') };
}
