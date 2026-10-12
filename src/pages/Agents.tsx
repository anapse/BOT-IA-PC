import { useState, useEffect } from 'react';
import { ActionButton } from '../components/ActionButton';
import { getCollectionData, addData } from '../services/firebase/db';
import { Card } from '../components/Card';

export const AgentsPage = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollectionData('agents').then(data => {
      setAgents(data || []);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    const newAgent = { name: 'Nuevo Agente', createdAt: new Date().toISOString() };
    await addData('agents', newAgent);
    const data = await getCollectionData('agents');
    setAgents(data || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Lista de Agentes</h2>
        <ActionButton label="Crear Agente" onClick={handleCreate} />
      </div>
      {loading ? <div>Cargando...</div> : (
        <div className="grid gap-4">
          {agents.map(agent => (
            <Card key={agent.id}>
              <div className="flex justify-between items-center">
                <span className="font-medium">{agent.name}</span>
                <span className="text-xs text-slate-500">{new Date(agent.createdAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
