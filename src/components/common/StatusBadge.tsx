interface StatusBadgeProps {
  severity: 'info' | 'warning' | 'critical';
  label: string;
}

const colors = {
  info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function StatusBadge({ severity, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[severity]}`}>
      {severity === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-pulse" />}
      {severity === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5" />}
      {label}
    </span>
  );
}
