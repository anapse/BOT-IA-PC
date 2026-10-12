export const WORKER_ENDPOINTS = {
  STATUS: '/status',
  SYNC: '/sync',
};

import { auth } from '../firebase/firebase';

export const checkWorkerStatus = async (workerUrl: string) => {
  const response = await fetch(`${workerUrl}${WORKER_ENDPOINTS.STATUS}`);
  if (!response.ok) throw new Error('Worker no disponible');
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
  if (!response.ok) throw new Error('Error al sincronizar');
  return await response.json();
};
