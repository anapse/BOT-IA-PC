import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { ActionButton } from '../components/ActionButton';
import { useState } from 'react';

export const TelegramPage = () => {
  const [token, setToken] = useState('');
  return (
    <div className="space-y-6">
      <Card title="Registrar nuevo bot">
        <div className="space-y-4">
          <InputField label="Token del bot" value={token} onChange={setToken} isSecret />
          <ActionButton label="Validar Bot" onClick={() => console.log('Validar')} />
        </div>
      </Card>
    </div>
  );
};
