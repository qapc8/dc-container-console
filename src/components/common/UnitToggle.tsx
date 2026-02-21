import { useUiStore } from '../../store/uiStore';

export function UnitToggle() {
  const { unitSystem, toggleUnitSystem } = useUiStore();

  return (
    <button
      onClick={toggleUnitSystem}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium hover:bg-slate-700 transition-colors"
    >
      <span className={unitSystem === 'metric' ? 'text-cyan-400' : 'text-slate-500'}>Metric</span>
      <span className="text-slate-600">/</span>
      <span className={unitSystem === 'imperial' ? 'text-cyan-400' : 'text-slate-500'}>Imperial</span>
    </button>
  );
}
