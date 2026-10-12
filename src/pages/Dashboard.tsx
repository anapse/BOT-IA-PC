import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { subscribeCollection, getDocData } from '../services/firebase/db';
import { checkWorkerStatus } from '../services/worker/client';
import { Bot, MessageSquare, BrainCircuit, Activity, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';

export const Dashboard = () => {
  const [agentsCount, setAgentsCount] = useState(0);
  const [activeAgentsCount, setActiveAgentsCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [activeConnectionsCount, setActiveConnectionsCount] = useState(0);
  const [modelsCount, setModelsCount] = useState(0);
  const [recentAgents, setRecentAgents] = useState<any[]>([]);

  const [workerStatus, setWorkerStatus] = useState<'online' | 'offline' | 'unconfigured'>('unconfigured');
  const [workerUrl, setWorkerUrl] = useState('');

  useEffect(() => {
    const unsubAgents = subscribeCollection('agents', (items) => {
      setAgentsCount(items.length);
      setActiveAgentsCount(items.filter(i => i.status === 'activo').length);
      setRecentAgents(items.slice(0, 4));
    });

    const unsubConnections = subscribeCollection('telegramConnections', (items) => {
      setConnectionsCount(items.length);
      setActiveConnectionsCount(items.filter(i => i.status === 'activo').length);
    });

    const unsubModels = subscribeCollection('modelConfigs', (items) => {
      setModelsCount(items.length);
    });

    // Check worker configuration from appSettings
    getDocData('appSettings', 'workerConfig').then(async (config) => {
      if (config && config.value) {
        setWorkerUrl(config.value);
        try {
          await checkWorkerStatus(config.value);
          setWorkerStatus('online');
        } catch {
          setWorkerStatus('offline');
        }
      } else {
        setWorkerStatus('unconfigured');
      }
    });

    return () => {
      unsubAgents();
      unsubConnections();
      unsubModels();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Panel de Control General</h2>
        <p className="text-sm text-slate-400 mt-1">Supervisión en tiempo real de infraestructura, agentes y conexiones de Bot IA PC.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Agentes IA</span>
            <span className="p-2 bg-cyan-950/60 text-cyan-400 rounded-lg border border-cyan-800/30">
              <Bot size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{agentsCount}</span>
            <span className="text-xs text-emerald-400 font-medium">{activeAgentsCount} activos</span>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Bots de Telegram</span>
            <span className="p-2 bg-blue-950/60 text-blue-400 rounded-lg border border-blue-800/30">
              <MessageSquare size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{connectionsCount}</span>
            <span className="text-xs text-emerald-400 font-medium">{activeConnectionsCount} conectados</span>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Modelos de IA</span>
            <span className="p-2 bg-purple-950/60 text-purple-400 rounded-lg border border-purple-800/30">
              <BrainCircuit size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{modelsCount}</span>
            <span className="text-xs text-slate-500 font-medium">configurados</span>
          </div>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Estado de Red</span>
            <span className="p-2 bg-emerald-950/60 text-emerald-400 rounded-lg border border-emerald-800/30">
              <Activity size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-emerald-400">Operativo</span>
            <span className="text-xs text-slate-500 font-mono">100% online</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Agents */}
        <Card title="Agentes Recientes" className="lg:col-span-2">
          {recentAgents.length === 0 ? (
            <p className="text-sm text-slate-500 p-4 text-center">No hay agentes creados aún.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {recentAgents.map((agent) => (
                <div key={agent.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-slate-800/80 text-cyan-400">
                      <Bot size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">{agent.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">{agent.model || 'Sin modelo'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    agent.status === 'activo'
                      ? 'bg-emerald-950/60 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* System Health */}
        <Card title="Salud del Ecosistema">
          <ul className="space-y-4 text-sm">
            <li className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-300">Firebase Firestore</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={15} />
                Conectado (us-west1)
              </span>
            </li>
            <li className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-300">Firebase Authentication</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={15} />
                Google Auth activo
              </span>
            </li>
            <li className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-300">Cloudflare Worker</span>
              {workerStatus === 'online' ? (
                <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
                  <CheckCircle2 size={15} />
                  En línea
                </span>
              ) : workerStatus === 'offline' ? (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                  <XCircle size={15} />
                  Inalcanzable
                </span>
              ) : (
                <span className="text-xs text-slate-500">Pendiente configurar</span>
              )}
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-300">Reglas de Seguridad</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={15} />
                Desplegadas
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
