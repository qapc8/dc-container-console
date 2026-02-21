import type { Coolant } from '../types';

export const coolants: Coolant[] = [
  {
    id: 'pg30',
    name: 'Propylene Glycol 30% (PG30)',
    specificHeat_JkgK: 3850,
    density_kgL: 1.032,
    viscosity_cP: 2.5,
    freezePoint_C: -14,
  },
  {
    id: 'di-water',
    name: 'Deionized Water (DI)',
    specificHeat_JkgK: 4186,
    density_kgL: 0.998,
    viscosity_cP: 0.89,
    freezePoint_C: 0,
  },
  {
    id: 'pg50',
    name: 'Propylene Glycol 50% (PG50)',
    specificHeat_JkgK: 3480,
    density_kgL: 1.048,
    viscosity_cP: 5.0,
    freezePoint_C: -33,
  },
];

export const coolantMap = new Map(coolants.map(c => [c.id, c]));
