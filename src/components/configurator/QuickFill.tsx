import { useState } from 'react';
import { Zap } from 'lucide-react';
import { serverPlatforms } from '../../data/serverPlatforms';
import { getOemForPlatform } from '../../data/oemConfigs';
import { useConfigStore } from '../../store/configStore';
import type { PlatformId, OemId } from '../../types';

export function QuickFill() {
  const [platformId, setPlatformId] = useState<PlatformId>('gb300-nvl72');
  const [oemId, setOemId] = useState<OemId>('nvidia');
  const quickFill = useConfigStore(s => s.quickFill);

  const oems = getOemForPlatform(platformId);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-500" />
        Quick Fill — Homogeneous Deployment
      </h3>

      <div className="flex gap-2 flex-wrap">
        <select
          value={platformId}
          onChange={(e) => {
            const pid = e.target.value as PlatformId;
            setPlatformId(pid);
            const available = getOemForPlatform(pid);
            if (available.length > 0 && !available.find(o => o.oemId === oemId)) {
              setOemId(available[0].oemId);
            }
          }}
          className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          {serverPlatforms.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={oemId}
          onChange={(e) => setOemId(e.target.value as OemId)}
          className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          {oems.map(o => (
            <option key={o.oemId} value={o.oemId}>{o.oemName} — {o.chassisModel}</option>
          ))}
        </select>

        <button
          onClick={() => quickFill(platformId, oemId)}
          className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-medium text-white transition-colors"
        >
          Fill All Racks
        </button>

        <button
          onClick={() => useConfigStore.getState().clearAll()}
          className="px-4 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium text-slate-300 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
