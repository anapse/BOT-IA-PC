export const Card = ({ title, children, className = '' }: { title?: string, children: React.ReactNode, className?: string }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-lg shadow-sm ${className}`}>
    {title && <div className="px-5 py-4 border-b border-slate-800 font-semibold text-slate-100 tracking-tight">{title}</div>}
    <div className="p-5">{children}</div>
  </div>
);
