import { useState } from 'react';
import { serverPlatforms } from '../../data/serverPlatforms';
import { getOemForPlatform, oemList } from '../../data/oemConfigs';
import type { PlatformId, OemId } from '../../types';

interface ServerSelectorProps {
  onSelect: (platformId: PlatformId, oemId: OemId) => void;
  onCancel: () => void;
}

export function ServerSelector({ onSelect, onCancel }: ServerSelectorProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);

  const availableOems = selectedPlatform ? getOemForPlatform(selectedPlatform) : [];

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">Select Server Platform</h3>

      <div className="grid grid-cols-1 gap-2">
        {serverPlatforms.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPlatform(p.id)}
            className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
              selectedPlatform === p.id
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-600 hover:border-slate-500 text-slate-300'
            }`}
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {p.powerPerUnit_kW} kW • {p.formFactor} • {p.coolingType === 'liquid' ? `${(p.liquidFraction * 100).toFixed(0)}% liquid` : 'Air cooled'}
            </div>
          </button>
        ))}
      </div>

      {selectedPlatform && (
        <>
          <h3 className="text-sm font-semibold text-slate-200">Select OEM</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableOems.map(oem => {
              const oemInfo = oemList.find(o => o.id === oem.oemId);
              return (
                <button
                  key={oem.oemId}
                  onClick={() => onSelect(selectedPlatform, oem.oemId)}
                  className="text-left px-3 py-2 rounded border border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10 text-sm transition-colors"
                >
                  <div className="font-medium text-slate-200">{oemInfo?.name}</div>
                  <div className="text-xs text-slate-400">{oem.chassisModel}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
