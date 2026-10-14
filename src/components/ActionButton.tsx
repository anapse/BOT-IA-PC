import { ReactNode } from 'react';

export const ActionButton = ({
  label,
  onClick,
  variant = 'primary',
  icon,
  className = '',
  type,
}: {
  label: string;
  onClick: (e?: any) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const baseClass = "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-cyan-600 text-white border-transparent hover:bg-cyan-500 shadow-sm shadow-cyan-950",
    secondary: "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white",
    danger: "bg-red-950 text-red-400 border-red-900 hover:border-red-800",
  };
  return (
    <button type={type} onClick={onClick} className={`${baseClass} ${variants[variant]} ${className}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
};
