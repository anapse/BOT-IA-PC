import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { checkWorkerStatus } from '../services/worker/client';
import { getCollectionData, updateData, addData } from '../services/firebase/db';

export const WorkerPage = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    getCollectionData('appSettings').then(data => {
      const workerConfig = data?.find(item => item.key === 'workerUrl');
      if (workerConfig) {
        setUrl(workerConfig.value);
        setConfigId(workerConfig.id);
      }
    });
  }, []);

  const handleSave = async () => {
    if (configId) {
      await updateData('appSettings', configId, { key: 'workerUrl', value: url });
    } else {
      await addData('appSettings', { key: 'workerUrl', value: url });
    }
    alert('URL guardada');
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setStatus(null);
    try {
      await checkWorkerStatus(url);
      setStatus('Conectado correctamente');
    } catch (e) {
      setStatus('Error al conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Configuración del Worker">
        <div className="space-y-4">
          <InputField label="URL del Worker" value={url} onChange={setUrl} />
          <div className="flex gap-2">
            <ActionButton label="Guardar URL" onClick={handleSave} />
            <ActionButton label={loading ? "Probando..." : "Probar Conexión"} onClick={handleTestConnection} variant="secondary" />
          </div>
          {status && <p className={`text-sm ${status === 'Conectado correctamente' ? 'text-cyan-500' : 'text-red-500'}`}>{status}</p>}
        </div>
      </Card>
    </div>
  );
};
