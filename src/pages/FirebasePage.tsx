import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { ActionButton } from '../components/ActionButton';
import { useAuth } from '../services/firebase/auth';
import { getCollectionData } from '../services/firebase/db';
import { db } from '../services/firebase/firebase';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Database, ShieldCheck, CheckCircle2, RefreshCw, Key, UserCheck, Layers } from 'lucide-react';

export const FirebasePage = () => {
  const { user } = useAuth();
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: 'ok' | 'error'; ms?: number; message?: string } | null>(null);

  const [counts, setCounts] = useState({
    agents: 0,
    connections: 0,
    models: 0,
    routes: 0,
    logs: 0,
    settings: 0,
  });

  const loadCounts = async () => {
    const [agents, conns, models, routes, logs, settings] = await Promise.all([
      getCollectionData('agents'),
      getCollectionData('telegramConnections'),
      getCollectionData('modelConfigs'),
      getCollectionData('communicationRoutes'),
      getCollectionData('logs'),
      getCollectionData('appSettings'),
    ]);
    setCounts({
      agents: agents?.length || 0,
      connections: conns?.length || 0,
      models: models?.length || 0,
      routes: routes?.length || 0,
      logs: logs?.length || 0,
      settings: settings?.length || 0,
    });
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingResult(null);
    const start = performance.now();
    try {
      // Test read/write to Firestore database
      const testDocRef = doc(db, '_health_check', 'ping');
      await setDoc(testDocRef, { timestamp: new Date().toISOString(), pingedBy: user?.email || 'admin' });
      await getDocFromServer(testDocRef);
      const duration = Math.round(performance.now() - start);
      setPingResult({ status: 'ok', ms: duration });
      loadCounts();
    } catch (err: any) {
      setPingResult({ status: 'error', message: err.message || 'Error al conectar' });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="text-emerald-400" size={24} />
            Infraestructura Firebase & Cloud Firestore
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Persistencia activa de datos en base de datos dedicada y autenticación de usuarios.
          </p>
        </div>
        <ActionButton
          label={testingPing ? "Comprobando..." : "Comprobar Latencia Firestore"}
          onClick={handleTestConnection}
          icon={<RefreshCw size={16} className={testingPing ? 'animate-spin' : ''} />}
        />
      </div>

      {pingResult && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          pingResult.status === 'ok'
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            : 'bg-red-950/40 border-red-800/60 text-red-300'
        }`}>
          {pingResult.status === 'ok' ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>Conexión exitosa con la base de datos Firestore en <strong>{pingResult.ms} ms</strong>. Los datos leen y escriben en tiempo real.</span>
            </>
          ) : (
            <>
              <span className="font-bold">Error de conexión:</span>
              <span>{pingResult.message}</span>
            </>
          )}
        </div>
      )}

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Parámetros de Base de Datos y Proyecto">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">ID del Proyecto</span>
              <span className="font-mono text-xs text-cyan-400">{firebaseConfig.projectId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Base de Datos Firestore</span>
              <span className="font-mono text-xs text-slate-200">{firebaseConfig.firestoreDatabaseId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Región de Despliegue</span>
              <span className="text-slate-200">us-west1</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Dominio Auth</span>
              <span className="font-mono text-xs text-slate-400">{firebaseConfig.authDomain}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">API Key Cliente</span>
              <span className="font-mono text-xs text-slate-400">AIzaSyAS•••••••••••••••••••••••••</span>
            </div>
          </div>
        </Card>

        <Card title="Sesión del Administrador">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Usuario Autenticado</span>
              <span className="text-slate-200 font-medium flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-400" />
                {user?.email || 'No autenticado'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">UID de Firebase</span>
              <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]">{user?.uid || '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Proveedor</span>
              <span className="text-slate-300">Google OAuth 2.0</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Reglas de Seguridad</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck size={14} />
                Reglas Activas y Protegidas
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Collections summary */}
      <Card title="Volumen de Colecciones en Firestore">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Agentes</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.agents}</div>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Telegram</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.connections}</div>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Modelos</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.models}</div>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Rutas</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.routes}</div>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Registros</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.logs}</div>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-center">
            <span className="text-xs text-slate-500">Ajustes</span>
            <div className="text-xl font-bold text-slate-100 mt-1">{counts.settings}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
