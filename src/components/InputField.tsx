import { useState } from 'react';
import { Eye, EyeOff, Copy } from 'lucide-react';

export const InputField = ({
  label,
  value,
  onChange,
  type = 'text',
  isSecret = false,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  isSecret?: boolean;
  placeholder?: string;
}) => {
  const [show, setShow] = useState(false);
  const handleCopy = () => navigator.clipboard.writeText(value);
  
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <input
          type={isSecret && !show ? 'password' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 border border-slate-700 bg-slate-950 rounded-md text-sm text-slate-100 placeholder:text-slate-600 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
        />
        {isSecret && <button onClick={() => setShow(!show)} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors"><EyeOff size={16} /></button>}
        <button onClick={handleCopy} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors"><Copy size={16} /></button>
      </div>
    </div>
  );
};
