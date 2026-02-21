import { Server } from 'lucide-react';
import { UnitToggle } from '../common/UnitToggle';

export function Header() {
  return (
    <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <Server className="w-5 h-5 text-cyan-500" />
        <h1 className="text-base font-semibold text-slate-100">
          DC Container Console
        </h1>
        <span className="text-xs text-slate-500 hidden sm:inline">Liquid-Cooled Containerized Data Center Engineering</span>
      </div>
      <UnitToggle />
    </header>
  );
}
