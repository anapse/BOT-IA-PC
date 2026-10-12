export const WORKER_ENDPOINTS = {
  STATUS: '/status',
  SYNC: '/sync',
};

import { auth } from '../firebase/firebase';

export const checkWorkerStatus = async (workerUrl: string) => {
  const response = await fetch(`${workerUrl}${WORKER_ENDPOINTS.STATUS}`);
  if (!response.ok) throw new Error(`Worker no disponible (HTTP ${response.status})`);
  return await response.json();
};

export const syncWorkerConfig = async (workerUrl: string, config: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');

  const token = await user.getIdToken();

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
      // Keep the raw response fallback below for non-JSON errors.
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
