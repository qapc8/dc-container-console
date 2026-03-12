import type { Coolant } from '../types';

export const coolants: Coolant[] = [
  {
    id: 'pg25',
    name: 'DOWFROST LC-25 / PG25 (NVIDIA Blackwell)',
    specificHeat_JkgK: 3940,          // DOWFROST LC-25 at 25°C
    density_kgL: 1.027,
    viscosity_cP: 2.3,                // Lower than PG30 — better flow characteristics
    freezePoint_C: -10,
  },
  {
    id: 'pg30',
    name: 'Propylene Glycol 30% (PG30)',
    specificHeat_JkgK: 3915,          // Engineering Toolbox: 0.935 BTU/lb-F × 4187 at 25°C
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
    specificHeat_JkgK: 3558,          // Engineering Toolbox: 0.850 BTU/lb-F × 4187 at 25°C
    density_kgL: 1.048,
    viscosity_cP: 3.1,                // DOWFROST data at 25°C
    freezePoint_C: -33,
  },
];

export const coolantMap = new Map(coolants.map(c => [c.id, c]));
