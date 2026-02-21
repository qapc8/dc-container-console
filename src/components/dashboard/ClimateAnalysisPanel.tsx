import { Globe, Sun, Snowflake } from 'lucide-react';
import type { AnnualPueResult, ClimateProfile } from '../../types';
import { formatPue, formatEnergy } from '../../utils/format';
import { climateProfiles } from '../../data/climateProfiles';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props {
  climate: AnnualPueResult | null;
  unitSystem: string;
  selectedProfile: ClimateProfile | null;
  onSelectProfile: (profile: ClimateProfile | null) => void;
}

export function ClimateAnalysisPanel({ climate, selectedProfile, onSelectProfile }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-teal-400" />
        <h3 className="text-sm font-semibold text-slate-200">Climate & Seasonal Analysis</h3>
      </div>

      {/* Location Selector */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1">Reference Location</label>
        <select
          value={selectedProfile?.locationName ?? ''}
          onChange={(e) => {
            const profile = climateProfiles.find(p => p.locationName === e.target.value) ?? null;
            onSelectProfile(profile);
          }}
          className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">Select a location...</option>
          {climateProfiles.map(p => (
            <option key={p.locationName} value={p.locationName}>{p.locationName}</option>
          ))}
        </select>
      </div>

      {climate && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Annual PUE</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {formatPue(climate.annualPue)}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Snowflake className="w-3 h-3" /> Free Cooling
              </div>
              <div className="text-lg font-bold text-blue-400 font-mono">
                {climate.freeCoolingHours.toLocaleString()} h
              </div>
              <div className="text-[10px] text-slate-500">{((climate.freeCoolingHours / 8760) * 100).toFixed(0)}% of year</div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Sun className="w-3 h-3" /> Chiller Hours
              </div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {climate.chillerHours.toLocaleString()} h
              </div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Annual Energy</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {formatEnergy(climate.annualEnergy_MWh)}
              </div>
            </div>
          </div>

          {/* Monthly PUE Chart */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Monthly PUE Profile
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={climate.monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v: number) => v.toFixed(3)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  formatter={(value: number | undefined, name?: string) => [
                    name === 'avgPue' ? (value ?? 0).toFixed(4) : `${(value ?? 0).toFixed(1)}°C`,
                    name === 'avgPue' ? 'PUE' : 'Avg Ambient',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avgPue"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', r: 3 }}
                  name="avgPue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Free cooling hours gauge */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                style={{ width: `${Math.min((climate.freeCoolingHours / 8760) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              {((climate.freeCoolingHours / 8760) * 100).toFixed(0)}% free cooling
            </span>
          </div>
        </>
      )}

      {!climate && selectedProfile === null && (
        <p className="text-xs text-slate-500">Select a reference location to see climate-adjusted PUE and free cooling analysis.</p>
      )}
    </div>
  );
}
