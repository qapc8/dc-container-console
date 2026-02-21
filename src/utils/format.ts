import type { UnitSystem } from '../types';

export function formatPower(kW: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const btu = kW * 3412.14;
    if (btu >= 1_000_000) return `${(btu / 1_000_000).toFixed(2)} MBTU/h`;
    return `${btu.toFixed(0)} BTU/h`;
  }
  if (kW >= 1000) return `${(kW / 1000).toFixed(2)} MW`;
  return `${kW.toFixed(1)} kW`;
}

export function formatFlow(lpm: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const gpm = lpm * 0.264172;
    return `${gpm.toFixed(1)} GPM`;
  }
  return `${lpm.toFixed(1)} L/min`;
}

export function formatTemp(celsius: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const f = celsius * 9 / 5 + 32;
    return `${f.toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

export function formatWeight(kg: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const lbs = kg * 2.20462;
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k lbs`;
    return `${lbs.toFixed(0)} lbs`;
  }
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg.toFixed(0)} kg`;
}

export function formatLength(meters: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const feet = meters * 3.28084;
    return `${feet.toFixed(1)} ft`;
  }
  if (meters < 1) return `${(meters * 100).toFixed(0)} cm`;
  return `${meters.toFixed(2)} m`;
}

export function formatVolume(liters: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const gallons = liters * 0.264172;
    return `${gallons.toFixed(1)} gal`;
  }
  return `${liters.toFixed(1)} L`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPue(pue: number): string {
  return pue.toFixed(3);
}

export function formatPressure(bar: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const psi = bar * 14.5038;
    return `${psi.toFixed(1)} psi`;
  }
  return `${bar.toFixed(2)} bar`;
}

export function formatDiameter(mm: number, units: UnitSystem = 'metric'): string {
  if (units === 'imperial') {
    const inches = mm / 25.4;
    return `${inches.toFixed(1)}"`;
  }
  return `${mm.toFixed(0)} mm`;
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export function formatEnergy(mwh: number): string {
  if (mwh >= 1000) return `${(mwh / 1000).toFixed(1)} GWh`;
  return `${mwh.toFixed(0)} MWh`;
}
