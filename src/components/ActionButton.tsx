export const ActionButton = ({ label, onClick, variant = 'primary' }: { label: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger' }) => {
  const baseClass = "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 border";
  const variants = {
    primary: "bg-cyan-600 text-white border-transparent hover:bg-cyan-500",
    secondary: "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white",
    danger: "bg-red-950 text-red-400 border-red-900 hover:border-red-800",
  };
  return <button onClick={onClick} className={`${baseClass} ${variants[variant]}`}>{label}</button>;
};
