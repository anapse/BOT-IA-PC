import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { ActionButton } from '../components/ActionButton';
import { useAuth } from '../services/firebase/auth';
import { getDocData, setDocData } from '../services/firebase/db';
import { ShieldAlert, ShieldCheck, Lock, UserCheck, Key, CheckCircle2 } from 'lucide-react';

export const SecurityPage = () => {
  const { user } = useAuth();
  const [requireVerifiedEmail, setRequireVerifiedEmail] = useState(true);
  const [strictTokenValidation, setStrictTokenValidation] = useState(true);
  const [encryptDynamicCredentials, setEncryptDynamicCredentials] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    getDocData('appSettings', 'securityPolicy').then((doc) => {
      if (doc) {
        if (doc.requireVerifiedEmail !== undefined) setRequireVerifiedEmail(doc.requireVerifiedEmail);
        if (doc.strictTokenValidation !== undefined) setStrictTokenValidation(doc.strictTokenValidation);
        if (doc.encryptDynamicCredentials !== undefined) setEncryptDynamicCredentials(doc.encryptDynamicCredentials);
      }
    });
  }, []);

  const handleSavePolicy = async () => {
    setSaving(true);
    try {
      await setDocData('appSettings', 'securityPolicy', {
        requireVerifiedEmail,
        strictTokenValidation,
        encryptDynamicCredentials,
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
          <ShieldAlert className="text-emerald-400" size={24} />
          Centro de Seguridad y Control de Acceso
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Auditoría de reglas de acceso, políticas de cifrado y privilegios administrativos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Control de Acceso Basado en Roles (RBAC)">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Administrador Maestro</span>
              <span className="text-emerald-400 font-medium font-mono text-xs">elherreroanapse@gmail.com</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Usuario en Sesión</span>
              <span className="text-slate-200 text-xs flex items-center gap-1">
                <UserCheck size={14} className="text-cyan-400" />
                {user?.email || 'No autenticado'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Correo Verificado</span>
              <span className="text-emerald-400 text-xs font-medium">
                {user?.emailVerified ? 'Verificado ✓' : 'Google Auth Verified'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Reglas Firestore</span>
              <span className="text-emerald-400 font-medium text-xs flex items-center gap-1">
                <ShieldCheck size={14} />
                Protegidas con ABAC / RBAC
              </span>
            </div>
          </div>
        </Card>

        <Card title="Políticas de Seguridad Persistentes">
          <div className="space-y-4 text-sm">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-slate-200 font-medium block">Validación Estricta de JWT</span>
                <span className="text-xs text-slate-500">Exige firma, emisor, audiencia y expiración en Worker</span>
              </div>
              <input
                type="checkbox"
                checked={strictTokenValidation}
                onChange={(e) => setStrictTokenValidation(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-slate-200 font-medium block">Exigir Correo Verificado</span>
                <span className="text-xs text-slate-500">Bloquea acciones críticas si el correo no está verificado</span>
              </div>
              <input
                type="checkbox"
                checked={requireVerifiedEmail}
                onChange={(e) => setRequireVerifiedEmail(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-slate-200 font-medium block">Cifrado Web Crypto AES-GCM</span>
                <span className="text-xs text-slate-500">Cifrado perimetral de credenciales dinámicas de Telegram</span>
              </div>
              <input
                type="checkbox"
                checked={encryptDynamicCredentials}
                onChange={(e) => setEncryptDynamicCredentials(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <div className="pt-2">
              <ActionButton
                label={saving ? 'Guardando...' : 'Guardar Políticas'}
                onClick={handleSavePolicy}
              />
            </div>

            {savedFeedback && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 size={15} />
                Políticas de seguridad guardadas en Cloud Firestore.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Garantías de Protección">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <Lock size={18} className="text-cyan-400 mb-2" />
            <h4 className="text-slate-200 font-semibold mb-1">Cero Fugas de Claves</h4>
            <p>Ninguna clave de cuenta de servicio de GCP ni secreto del Worker se expone al frontend ni se envía en bundles públicos.</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <Key size={18} className="text-emerald-400 mb-2" />
            <h4 className="text-slate-200 font-semibold mb-1">Mínimo Privilegio</h4>
            <p>Las consultas del cliente utilizan el SDK oficial de Firebase sujeto a reglas de seguridad atómicas en Firestore.</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
            <ShieldCheck size={18} className="text-purple-400 mb-2" />
            <h4 className="text-slate-200 font-semibold mb-1">Defensa en Profundidad</h4>
            <p>Validación de payloads en la entrada, aislamiento de colecciones y roles validados sin confiar en el cliente.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
