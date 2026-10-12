import { Card } from '../components/Card';

export const Dashboard = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <Card title="Resumen" className="col-span-full lg:col-span-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-md">
          <div className="text-sm text-slate-500">Agentes</div>
          <div className="text-2xl font-bold">0</div>
        </div>
        <div className="p-4 bg-slate-50 rounded-md">
          <div className="text-sm text-slate-500">Conexiones</div>
          <div className="text-2xl font-bold">0</div>
        </div>
      </div>
    </Card>
    <Card title="Estado del Sistema">
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between">Firebase <span className="text-green-600 font-medium">Conectado</span></li>
        <li className="flex justify-between">Worker <span className="text-slate-400">No configurado</span></li>
      </ul>
    </Card>
  </div>
);
