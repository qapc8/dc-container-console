import { useState } from 'react';
import { Save, Trash2, Download, X } from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import { useComparisonStore } from '../../store/comparisonStore';
import { useUiStore } from '../../store/uiStore';
import { formatPower, formatFlow, formatTemp, formatWeight, formatPue } from '../../utils/format';
import type { SavedConfig } from '../../types';
import { ComparisonCharts } from './ComparisonCharts';

export function CompareTab() {
  const [saveName, setSaveName] = useState('');
  const { racks, ambientTemp_C, coolantId, inletTemp_C, cduRedundancy, results } = useConfigStore();
  const { savedConfigs, selectedIds, saveConfig, deleteConfig, toggleSelection, clearSelection } = useComparisonStore();
  const unitSystem = useUiStore(s => s.unitSystem);

  const handleSave = () => {
    if (!results || !saveName.trim()) return;
    const config: SavedConfig = {
      id: `cfg-${Date.now()}`,
      name: saveName.trim(),
      timestamp: Date.now(),
      racks: JSON.parse(JSON.stringify(racks)),
      ambientTemp_C,
      coolantId,
      inletTemp_C,
      cduRedundancy,
      results: JSON.parse(JSON.stringify(results)),
    };
    saveConfig(config);
    setSaveName('');
  };

  const handleExport = () => {
    const selected = savedConfigs.filter(c => selectedIds.includes(c.id));
    const data = selected.length > 0 ? selected : savedConfigs;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dc-container-configs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const selected = savedConfigs.filter(c => selectedIds.includes(c.id));
    const data = selected.length > 0 ? selected : savedConfigs;
    const headers = ['Name', 'IT Power (kW)', 'Wall Power (kW)', 'PUE', 'Flow (L/min)', 'Max Outlet (°C)', 'CDU Count', 'Weight (kg)', 'Racks Used'];
    const rows = data.map(c => [
      c.name,
      c.results.power.totalIT_kW.toFixed(1),
      c.results.pue.totalFacilityPower_kW.toFixed(1),
      c.results.pue.pue.toFixed(3),
      c.results.thermal.totalFlow_Lpm.toFixed(1),
      c.results.thermal.maxOutletTemp_C.toFixed(1),
      c.results.cdu.totalCount,
      c.results.container.totalWeight_kg.toFixed(0),
      c.results.container.usedRacks,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dc-container-configs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedConfigs = savedConfigs.filter(c => selectedIds.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Save current */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Save Current Configuration</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Configuration name..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={!results || !saveName.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-sm font-medium text-white transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Saved configs list */}
      {savedConfigs.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Saved Configurations ({savedConfigs.length})
            </h3>
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <button onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear selection
                </button>
              )}
              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
                <Download className="w-3 h-3" /> JSON
              </button>
              <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {savedConfigs.map(config => (
              <div
                key={config.id}
                onClick={() => toggleSelection(config.id)}
                className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                  selectedIds.includes(config.id)
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-slate-200">{config.name}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(config.timestamp).toLocaleString()} — {config.results.container.usedRacks} racks
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-cyan-400 font-mono">{formatPower(config.results.power.totalIT_kW, unitSystem)}</span>
                  <span className="text-green-400 font-mono">PUE {formatPue(config.results.pue.pue)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConfig(config.id);
                    }}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison table */}
      {selectedConfigs.length >= 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Side-by-Side Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 pr-4 text-slate-400 font-medium">Metric</th>
                {selectedConfigs.map(c => (
                  <th key={c.id} className="text-right py-2 px-3 text-slate-200 font-medium">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                { label: 'IT Power', fn: (c: SavedConfig) => formatPower(c.results.power.totalIT_kW, unitSystem) },
                { label: 'Wall Power', fn: (c: SavedConfig) => formatPower(c.results.pue.totalFacilityPower_kW, unitSystem) },
                { label: 'PUE', fn: (c: SavedConfig) => formatPue(c.results.pue.pue) },
                { label: 'Peak Rack', fn: (c: SavedConfig) => formatPower(c.results.power.peakRack_kW, unitSystem) },
                { label: 'Flow Rate', fn: (c: SavedConfig) => formatFlow(c.results.thermal.totalFlow_Lpm, unitSystem) },
                { label: 'Max Outlet', fn: (c: SavedConfig) => formatTemp(c.results.thermal.maxOutletTemp_C, unitSystem) },
                { label: 'Avg ΔT', fn: (c: SavedConfig) => `${c.results.thermal.avgDeltaT_C.toFixed(1)}°C` },
                { label: 'CDU Count', fn: (c: SavedConfig) => `${c.results.cdu.totalCount}× ${c.results.cdu.selectedSize_kW}kW` },
                { label: 'Heat Rejection', fn: (c: SavedConfig) => c.results.heatRejection.method },
                { label: 'Weight', fn: (c: SavedConfig) => formatWeight(c.results.container.totalWeight_kg, unitSystem) },
                { label: 'Racks Used', fn: (c: SavedConfig) => `${c.results.container.usedRacks} / ${c.results.container.maxRacks}` },
                { label: 'Warnings', fn: (c: SavedConfig) => `${c.results.warnings.length}` },
              ].map(row => (
                <tr key={row.label} className="border-b border-slate-700/50">
                  <td className="py-2 pr-4 text-slate-400">{row.label}</td>
                  {selectedConfigs.map(c => (
                    <td key={c.id} className="py-2 px-3 text-right text-slate-200 font-mono">{row.fn(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison charts */}
      {selectedConfigs.length >= 2 && (
        <ComparisonCharts configs={selectedConfigs} unitSystem={unitSystem} />
      )}

      {savedConfigs.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No saved configurations yet</p>
          <p className="text-xs mt-1">Configure racks and save snapshots to compare</p>
        </div>
      )}
    </div>
  );
}
