import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { getDocData, setDocData } from '../services/firebase/db';
import { useAuth } from '../services/firebase/auth';
import { Settings as SettingsIcon, CheckCircle2, Save } from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  const [appName, setAppName] = useState('Bot IA PC');
  const [environment, setEnvironment] = useState('production');
  const [defaultModel, setDefaultModel] = useState('gemini-1.5-pro');
  const [adminEmail, setAdminEmail] = useState('elherreroanapse@gmail.com');
  const [autoSyncWorker, setAutoSyncWorker] = useState(true);
  const [maxRetries, setMaxRetries] = useState('3');
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    getDocData('appSettings', 'generalSettings').then((doc) => {
      if (doc) {
        if (doc.appName) setAppName(doc.appName);
        if (doc.environment) setEnvironment(doc.environment);
        if (doc.defaultModel) setDefaultModel(doc.defaultModel);
        if (doc.adminEmail) setAdminEmail(doc.adminEmail);
        if (doc.autoSyncWorker !== undefined) setAutoSyncWorker(doc.autoSyncWorker);
        if (doc.maxRetries) setMaxRetries(String(doc.maxRetries));
      } else if (user?.email) {
        setAdminEmail(user.email);
      }
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDocData('appSettings', 'generalSettings', {
        appName: appName.trim(),
        environment,
        defaultModel,
        adminEmail: adminEmail.trim(),
        autoSyncWorker,
        maxRetries: parseInt(maxRetries, 10) || 3,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin',
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="text-cyan-400" size={24} />
          Configuración Global del Sistema
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Ajustes generales de la plataforma guardados persistentemente en Cloud Firestore.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card title="Identidad y Parámetros Principales">
          <div className="space-y-4">
            <InputField
              label="Nombre de la Plataforma"
              value={appName}
              onChange={setAppName}
              placeholder="Bot IA PC"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Entorno</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="production">Producción</option>
                  <option value="staging">Staging / Pruebas</option>
                  <option value="development">Desarrollo Local</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Modelo por Defecto</label>
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              </div>
            </div>

            <InputField
              label="Correo de Notificaciones y Administración"
              value={adminEmail}
              onChange={setAdminEmail}
              placeholder="admin@ejemplo.com"
            />
          </div>
        </Card>

        <Card title="Comportamiento del Worker y Reintentos">
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-slate-200 text-sm font-medium block">
                  Sincronización Automática con Cloudflare KV
                </span>
                <span className="text-xs text-slate-500">
                  Transmite los cambios de agentes al Worker perimetral cuando se guardan
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoSyncWorker}
                onChange={(e) => setAutoSyncWorker(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <InputField
              label="Máximo de Reintentos de Envío a Telegram"
              value={maxRetries}
              onChange={setMaxRetries}
              placeholder="3"
            />
          </div>
        </Card>

        <div className="flex items-center justify-between pt-2">
          {savedFeedback ? (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 size={15} />
              Configuración guardada persistentemente en Cloud Firestore.
            </div>
          ) : <div />}

          <ActionButton
            label={saving ? 'Guardando...' : 'Guardar Configuración'}
            onClick={() => {}}
            icon={<Save size={16} />}
          />
        </div>
      </form>
    </div>
  );
};
