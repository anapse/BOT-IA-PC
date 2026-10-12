/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { AgentsPage } from './pages/Agents';
import { TelegramPage } from './pages/Telegram';
import { ModelsPage } from './pages/Models';
import { FirebasePage } from './pages/FirebasePage';
import { CommunicationPage } from './pages/Communication';
import { WorkerPage } from './pages/WorkerPage';
import { SecurityPage } from './pages/Security';
import { LogsPage } from './pages/Logs';
import { SettingsPage } from './pages/Settings';
import { useAuth } from './services/firebase/auth';

export default function App() {
  const { user, loading, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState('inicio');

  if (loading) return <div>Cargando...</div>;
  if (!user) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Bot IA PC</h1>
      <button onClick={signIn} className="px-4 py-2 bg-slate-900 text-white rounded-md">Iniciar Sesión con Google</button>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'inicio': return <Dashboard />;
      case 'agentes': return <AgentsPage />;
      case 'telegram': return <TelegramPage />;
      case 'modelos': return <ModelsPage />;
      case 'firebase': return <FirebasePage />;
      case 'comunicacion': return <CommunicationPage />;
      case 'worker': return <WorkerPage />;
      case 'seguridad': return <SecurityPage />;
      case 'logs': return <LogsPage />;
      case 'configuracion': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
