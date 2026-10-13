import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { checkWorkerStatus, syncWorkerConfig, readWorkerConfig } from '../services/worker/client';
import { getDocData, setDocData, getCollectionDataStrict } from '../services/firebase/db';
import { Cpu, CheckCircle2, XCircle, RefreshCw, UploadCloud, DownloadCloud } from 'lucide-react';

const DEFAULT_WORKER_URL = 'https://bot-ia-pc.elherreroanapse.workers.dev';

export const WorkerPage = () => {
  const [url, setUrl] = useState(DEFAULT_WORKER_URL);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info' | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    getDocData('appSettings', 'workerConfig').then(data => {
      if (data && data.value) setUrl(data.value);
    });
  }, []);

  const handleSave = async () => {
    if (!url.trim()) return;
    try {
      await setDocData('appSettings', 'workerConfig', {
        key: 'workerUrl',
        value: url.trim(),
        updatedAt: new Date().toISOString(),
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
    } catch (err: any) {
      setStatus(`Error al guardar en Firestore: ${err.message}`);
      setStatusType('error');
    }
  };

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setStatus('Introduce una URL antes de probar.');
      setStatusType('error');
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await checkWorkerStatus(url.trim());
      setStatus(`Conexión exitosa. Versión del Worker: ${res.version || '1.0.0'}`);
      setStatusType('success');
    } catch (e: any) {
      setStatus(`Error al conectar con ${url}: ${e.message || 'Worker inalcanzable'}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAgents = async () => {
    if (!url.trim()) {
      setStatus('Debes configurar y guardar la URL del Worker primero.');
      setStatusType('error');
      return;
    }
    setSyncing(true);
    setStatus(null);
    try {
      const agents = await getCollectionDataStrict('agents');
      const models = await getCollectionDataStrict('modelConfigs');
      const connections = await getCollectionDataStrict('telegramConnections');
      const payload = {
        agents: agents || [],
        models: models || [],
        connections: connections || [],
        syncedAt: new Date().toISOString(),
      };
      const syncResult = await syncWorkerConfig(url.trim(), payload);
      const webhookResults = Array.isArray(syncResult?.telegramWebhooks) ? syncResult.telegramWebhooks : [];
      const registered = webhookResults.filter((item: any) => item.status === 'registered').length;
      const failed = webhookResults.filter((item: any) => item.status === 'error').length;
      const inactive = webhookResults.filter((item: any) => item.status === 'inactive').length;
      let message = `Sincronización correcta. Enviados a KV: ${payload.agents.length} agentes, ${payload.models.length} modelos y ${payload.connections.length} conexiones.`;
      if (webhookResults.length) {
        message += ` Webhooks Telegram: ${registered} registrados${failed ? `, ${failed} con error` : ''}${inactive ? `, ${inactive} inactivos (sin webhook)` : ''}.`;
        const webhookDetails = webhookResults.map((item: any) => {
          const connection = connections.find((candidate: any) => String(candidate?.id) === String(item?.id));
          const label = String(item?.name || connection?.name || connection?.username || item?.id || 'Conexión sin nombre');
          if (item.status === 'registered') return `${label}: webhook registrado correctamente`;
          if (item.status === 'inactive') return `${label}: conexión inactiva; no se registró webhook`;
          if (item.status === 'error') return `${label}: ERROR — ${item.description || 'no se pudo registrar el webhook'}`;
          return `${label}: estado ${item.status || 'desconocido'}`;
        });
        if (webhookDetails.length) message += ` Detalle por bot: ${webhookDetails.join(' | ')}.`;
      }
      setStatus(message);
      setStatusType(failed ? 'error' : 'success');
    } catch (err: any) {
      setStatus(`Fallo en la sincronización: ${err.message}`);
      setStatusType('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleVerifyKV = async () => {
    if (!url.trim()) {
      setStatus('Introduce la URL del Worker antes de verificar.');
      setStatusType('error');
      return;
    }
    setVerifying(true);
    setStatus(null);
    try {
      const result = await readWorkerConfig(url.trim());
      const config = result?.config;
      if (result?.status !== 'ok' || !config || !Array.isArray(config.agents)) {
        throw new Error('KV respondió, pero la estructura de la configuración no es válida.');
      }
      setStatus(`Lectura de KV correcta. Agentes: ${config.agents.length}; modelos: ${Array.isArray(config.models) ? config.models.length : 0}; conexiones: ${Array.isArray(config.connections) ? config.connections.length : 0}. Última sincronización: ${config.syncedAt || 'sin fecha'}.`);
      setStatusType('success');
    } catch (err: any) {
      setStatus(`No se pudo verificar la recuperación desde KV: ${err.message}`);
      setStatusType('error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Cpu className="text-amber-400" size={24} />
          Configuración e Integración de Cloudflare Worker
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Vincula tu Worker perimetral independiente con la base de datos Firestore y sincroniza configuraciones con KV.
        </p>
      </div>

      <Card title="Punto de Enlace del Worker">
        <div className="space-y-4">
          <InputField
            label="URL Base del Worker"
            value={url}
            onChange={setUrl}
            placeholder="https://bot-ia-pc.elherreroanapse.workers.dev"
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <ActionButton label="Guardar URL" onClick={handleSave} />
            <ActionButton
              label={loading ? "Probando..." : "Probar /status"}
              onClick={handleTestConnection}
              variant="secondary"
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            />
            <ActionButton
              label={syncing ? "Sincronizando..." : "Sincronizar con Worker KV"}
              onClick={handleSyncAgents}
              variant="secondary"
              icon={<UploadCloud size={14} className={syncing ? 'animate-spin' : ''} />}
            />
            <ActionButton
              label={verifying ? "Verificando..." : "Verificar lectura de KV"}
              onClick={handleVerifyKV}
              variant="secondary"
              icon={<DownloadCloud size={14} className={verifying ? 'animate-spin' : ''} />}
            />
          </div>

          {savedFeedback && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 size={16} />
              URL guardada de forma persistente en Cloud Firestore.
            </div>
          )}

          {status && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              statusType === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}>
              {statusType === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{status}</span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Detalles de la Arquitectura del Worker">
        <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
          <p>
            • <strong>Independencia:</strong> El código del Worker reside en la carpeta <code className="text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded">cloudflare-worker/</code>. No se compila con la web ni se despliega automáticamente, asegurando total soberanía de despliegue.
          </p>
          <p>
            • <strong>Seguridad JWT:</strong> Cada petición a <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">POST /sync</code> valida la firma y vigencia del Firebase ID Token emitido para tu usuario actual, verificando autorización administrativa en el backend.
          </p>
          <p>
            • <strong>Persistencia perimetral:</strong> Al sincronizar, las configuraciones se guardan en Cloudflare KV (<code className="text-purple-400 bg-slate-900 px-1.5 py-0.5 rounded">WORKER_KV</code>) para tiempos de respuesta ultra-bajos sin sobrecargar Firestore.
          </p>
        </div>
      </Card>
    </div>
  );
};
