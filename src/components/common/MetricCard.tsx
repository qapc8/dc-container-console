import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
  severity?: 'normal' | 'warning' | 'critical';
  tooltip?: string;
}

const severityColors = {
  normal: 'border-slate-700',
  warning: 'border-yellow-500/50',
  critical: 'border-red-500/50',
};

const valueColors = {
  normal: 'text-cyan-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
};

export function MetricCard({ label, value, subValue, icon, severity = 'normal', tooltip }: MetricCardProps) {
  return (
    <div
      className={`bg-slate-800 rounded-lg border ${severityColors[severity]} p-4 hover:bg-slate-750 transition-colors`}
      title={tooltip}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold ${valueColors[severity]} font-mono`}>{value}</div>
      {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}
