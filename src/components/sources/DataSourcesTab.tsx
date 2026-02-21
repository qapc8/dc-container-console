import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion, Info } from 'lucide-react';
import { dataSources } from '../../data/dataSources';
import { serverPlatforms } from '../../data/serverPlatforms';
import { oemConfigs } from '../../data/oemConfigs';
import { getSourcesForIds } from '../../data/dataSources';
import type { DataSource } from '../../types';

const confidenceConfig = {
  high: { icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'High — official vendor docs' },
  medium: { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Medium — tech press / analysis' },
  low: { icon: ShieldQuestion, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', label: 'Low — derived / estimated' },
};

function SourceCard({ source }: { source: DataSource }) {
  const conf = confidenceConfig[source.confidence];
  const Icon = conf.icon;

  return (
    <div className={`rounded-lg border p-3 ${conf.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 shrink-0 ${conf.color}`} />
            <span className="text-sm font-medium text-slate-200 truncate">{source.label}</span>
          </div>
          <div className="text-xs text-slate-400 mb-1">
            {source.publisher} — accessed {source.accessDate}
          </div>
          {source.notes && (
            <p className="text-xs text-slate-500 leading-relaxed">{source.notes}</p>
          )}
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Open source"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export function DataSourcesTab() {
  // Group sources by platform
  const platformGroups = serverPlatforms.map(platform => {
    const platformSources = getSourcesForIds(platform.sourceIds);
    const oemForPlatform = oemConfigs.filter(o => o.platformId === platform.id);
    const oemSourceIds = oemForPlatform.flatMap(o => o.sourceIds);
    const oemSources = getSourcesForIds(oemSourceIds).filter(
      s => !platformSources.some(ps => ps.id === s.id)
    );
    return { platform, platformSources, oemSources };
  });

  // General / shared sources
  const allPlatformSourceIds = new Set(
    [...serverPlatforms.flatMap(p => p.sourceIds), ...oemConfigs.flatMap(o => o.sourceIds)]
  );
  const generalSources = dataSources.filter(s => !allPlatformSourceIds.has(s.id));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Intro */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Data Sources & Confidence Levels</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every specification in this tool is traceable to a published source.
              Confidence levels reflect source reliability: <strong className="text-green-400">High</strong> = official vendor datasheets / product pages,{' '}
              <strong className="text-yellow-400">Medium</strong> = reputable tech press or vendor-adjacent analysis,{' '}
              <strong className="text-orange-400">Low</strong> = estimated or derived from rules of thumb.
              Where OEM-specific specs differ from platform defaults (e.g. Dell's 70% liquid fraction vs Supermicro's 98%),
              the OEM override is applied automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Confidence legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(confidenceConfig).map(([key, conf]) => {
          const Icon = conf.icon;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
              <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
              <span>{conf.label}</span>
            </div>
          );
        })}
      </div>

      {/* Per-platform sources */}
      {platformGroups.map(({ platform, platformSources, oemSources }) => (
        <div key={platform.id} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${platform.coolingType === 'liquid' ? 'bg-cyan-500' : 'bg-yellow-500'}`} />
            {platform.name}
            <span className="text-xs text-slate-500 font-normal">
              — {platform.powerPerUnit_kW} kW, {platform.coolingType === 'liquid' ? `${(platform.liquidFraction * 100).toFixed(0)}% liquid, ${platform.inletTempRange_C[0]}-${platform.inletTempRange_C[1]}°C inlet` : 'air-cooled'}
            </span>
          </h3>
          <div className="grid gap-2">
            {platformSources.map(s => <SourceCard key={s.id} source={s} />)}
            {oemSources.map(s => <SourceCard key={s.id} source={s} />)}
          </div>
          {platformSources.length === 0 && oemSources.length === 0 && (
            <p className="text-xs text-slate-600 italic">No dedicated sources (uses general references)</p>
          )}
        </div>
      ))}

      {/* General sources */}
      {generalSources.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200">General References</h3>
          <div className="grid gap-2">
            {generalSources.map(s => <SourceCard key={s.id} source={s} />)}
          </div>
        </div>
      )}

      {/* Spec summary table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Platform Specifications Summary</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-2 pr-3">Platform</th>
              <th className="text-right px-2">Power/Unit</th>
              <th className="text-right px-2">Liquid %</th>
              <th className="text-right px-2">Flow (L/min)</th>
              <th className="text-right px-2">Inlet Range</th>
              <th className="text-right px-2">Max ΔT</th>
              <th className="text-right px-2">Weight</th>
              <th className="text-right px-2">GPU TDP</th>
              <th className="text-right px-2">Sources</th>
            </tr>
          </thead>
          <tbody>
            {serverPlatforms.map(p => (
              <tr key={p.id} className="border-b border-slate-700/50">
                <td className="py-2 pr-3 text-slate-200 font-medium">{p.name}</td>
                <td className="text-right px-2 text-cyan-400 font-mono">{p.powerPerUnit_kW} kW</td>
                <td className="text-right px-2 font-mono">{p.liquidFraction > 0 ? `${(p.liquidFraction * 100).toFixed(0)}%` : '—'}</td>
                <td className="text-right px-2 text-blue-400 font-mono">{p.flowPerUnit_Lpm > 0 ? p.flowPerUnit_Lpm : '—'}</td>
                <td className="text-right px-2 font-mono">{p.inletTempRange_C[0]}–{p.inletTempRange_C[1]}°C</td>
                <td className="text-right px-2 font-mono">{p.maxDeltaT_C > 0 ? `${p.maxDeltaT_C}°C` : '—'}</td>
                <td className="text-right px-2 font-mono">{p.weightPerUnit_kg} kg</td>
                <td className="text-right px-2 font-mono">{p.tdpGpu_W ? `${p.tdpGpu_W}W` : '—'}</td>
                <td className="text-right px-2 text-slate-500">{p.sourceIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
