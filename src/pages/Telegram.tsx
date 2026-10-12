import { useState } from 'react';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';

type TelegramBot = {
  id: number;
  first_name: string;
  username: string;
};

export const TelegramPage = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [bot, setBot] = useState<TelegramBot | null>(null);

  const validateBot = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setStatus({ type: 'error', text: 'Introduce el token que te dio BotFather.' });
      setBot(null);
      return;
    }

    setLoading(true);
    setStatus(null);
    setBot(null);

    try {
      const response = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const result = await response.json();

      if (!response.ok || !result.ok || !result.result?.username) {
        setStatus({
          type: 'error',
          text: result.description || 'Telegram no aceptó el token. Comprueba que esté completo y sea correcto.',
        });
        return;
      }

      setBot(result.result as TelegramBot);
      setStatus({
        type: 'success',
        text: `Token válido. Bot conectado: @${result.result.username}`,
      });
    } catch {
      setStatus({
        type: 'error',
        text: 'No se pudo contactar con Telegram. Comprueba tu conexión e inténtalo otra vez.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Registrar nuevo bot">
        <div className="space-y-4">
          <InputField
            label="Token del bot (BotFather)"
            value={token}
            onChange={(value) => {
              setToken(value);
              setStatus(null);
              setBot(null);
            }}
            isSecret
          />
          <ActionButton
            label={loading ? 'Validando...' : 'Validar Bot'}
            onClick={validateBot}
            disabled={loading}
          />
          {status && (
            <p
              role="status"
              className={`text-sm ${
                status.type === 'success'
                  ? 'text-cyan-500'
                  : status.type === 'error'
                    ? 'text-red-500'
                    : 'text-slate-500'
              }`}
            >
              {status.text}
            </p>
          )}
          {bot && (
            <div className="rounded-md border border-slate-700 p-3 text-sm space-y-1">
              <p><span className="text-slate-500">Nombre:</span> {bot.first_name}</p>
              <p><span className="text-slate-500">Usuario:</span> @{bot.username}</p>
              <p><span className="text-slate-500">ID:</span> {bot.id}</p>
              <p className="text-slate-500">El token solo se usa para validar; todavía no se guarda ni se envía al Worker.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
