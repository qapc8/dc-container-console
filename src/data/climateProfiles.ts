import type { ClimateProfile } from '../types';

/**
 * Temperature bin data for 8 reference cities.
 * Each bin represents a temperature range and the annual hours in that range.
 * Bins cover -10°C to 50°C in 5°C increments (total = 8760 hours).
 * Data based on typical meteorological year (TMY) approximations.
 */
export const climateProfiles: ClimateProfile[] = [
  {
    locationName: 'Phoenix, AZ',
    designDryBulb_C: 43,
    temperatureBins: [
      { tempMin_C: -10, tempMax_C: 0, hours: 0 },
      { tempMin_C: 0, tempMax_C: 5, hours: 50 },
      { tempMin_C: 5, tempMax_C: 10, hours: 350 },
      { tempMin_C: 10, tempMax_C: 15, hours: 650 },
      { tempMin_C: 15, tempMax_C: 20, hours: 800 },
      { tempMin_C: 20, tempMax_C: 25, hours: 1100 },
      { tempMin_C: 25, tempMax_C: 30, hours: 1400 },
      { tempMin_C: 30, tempMax_C: 35, hours: 1800 },
      { tempMin_C: 35, tempMax_C: 40, hours: 1800 },
      { tempMin_C: 40, tempMax_C: 45, hours: 710 },
      { tempMin_C: 45, tempMax_C: 50, hours: 100 },
    ],
  },
  {
    locationName: 'Oslo, Norway',
    designDryBulb_C: 28,
    temperatureBins: [
      { tempMin_C: -20, tempMax_C: -10, hours: 400 },
      { tempMin_C: -10, tempMax_C: -5, hours: 600 },
      { tempMin_C: -5, tempMax_C: 0, hours: 1200 },
      { tempMin_C: 0, tempMax_C: 5, hours: 1800 },
      { tempMin_C: 5, tempMax_C: 10, hours: 1600 },
      { tempMin_C: 10, tempMax_C: 15, hours: 1200 },
      { tempMin_C: 15, tempMax_C: 20, hours: 1000 },
      { tempMin_C: 20, tempMax_C: 25, hours: 700 },
      { tempMin_C: 25, tempMax_C: 30, hours: 260 },
    ],
  },
  {
    locationName: 'Singapore',
    designDryBulb_C: 34,
    temperatureBins: [
      { tempMin_C: 20, tempMax_C: 25, hours: 1500 },
      { tempMin_C: 25, tempMax_C: 30, hours: 4500 },
      { tempMin_C: 30, tempMax_C: 35, hours: 2760 },
    ],
  },
  {
    locationName: 'London, UK',
    designDryBulb_C: 30,
    temperatureBins: [
      { tempMin_C: -5, tempMax_C: 0, hours: 300 },
      { tempMin_C: 0, tempMax_C: 5, hours: 1600 },
      { tempMin_C: 5, tempMax_C: 10, hours: 2200 },
      { tempMin_C: 10, tempMax_C: 15, hours: 2000 },
      { tempMin_C: 15, tempMax_C: 20, hours: 1500 },
      { tempMin_C: 20, tempMax_C: 25, hours: 900 },
      { tempMin_C: 25, tempMax_C: 30, hours: 250 },
      { tempMin_C: 30, tempMax_C: 35, hours: 10 },
    ],
  },
  {
    locationName: 'Dallas, TX',
    designDryBulb_C: 39,
    temperatureBins: [
      { tempMin_C: -5, tempMax_C: 0, hours: 100 },
      { tempMin_C: 0, tempMax_C: 5, hours: 400 },
      { tempMin_C: 5, tempMax_C: 10, hours: 700 },
      { tempMin_C: 10, tempMax_C: 15, hours: 900 },
      { tempMin_C: 15, tempMax_C: 20, hours: 1100 },
      { tempMin_C: 20, tempMax_C: 25, hours: 1300 },
      { tempMin_C: 25, tempMax_C: 30, hours: 1500 },
      { tempMin_C: 30, tempMax_C: 35, hours: 1600 },
      { tempMin_C: 35, tempMax_C: 40, hours: 1060 },
      { tempMin_C: 40, tempMax_C: 45, hours: 100 },
    ],
  },
  {
    locationName: 'Chicago, IL',
    designDryBulb_C: 34,
    temperatureBins: [
      { tempMin_C: -20, tempMax_C: -10, hours: 200 },
      { tempMin_C: -10, tempMax_C: -5, hours: 400 },
      { tempMin_C: -5, tempMax_C: 0, hours: 800 },
      { tempMin_C: 0, tempMax_C: 5, hours: 1100 },
      { tempMin_C: 5, tempMax_C: 10, hours: 1000 },
      { tempMin_C: 10, tempMax_C: 15, hours: 1000 },
      { tempMin_C: 15, tempMax_C: 20, hours: 1200 },
      { tempMin_C: 20, tempMax_C: 25, hours: 1200 },
      { tempMin_C: 25, tempMax_C: 30, hours: 1100 },
      { tempMin_C: 30, tempMax_C: 35, hours: 660 },
      { tempMin_C: 35, tempMax_C: 40, hours: 100 },
    ],
  },
  {
    locationName: 'Dubai, UAE',
    designDryBulb_C: 46,
    temperatureBins: [
      { tempMin_C: 10, tempMax_C: 15, hours: 200 },
      { tempMin_C: 15, tempMax_C: 20, hours: 800 },
      { tempMin_C: 20, tempMax_C: 25, hours: 1200 },
      { tempMin_C: 25, tempMax_C: 30, hours: 1500 },
      { tempMin_C: 30, tempMax_C: 35, hours: 1800 },
      { tempMin_C: 35, tempMax_C: 40, hours: 1800 },
      { tempMin_C: 40, tempMax_C: 45, hours: 1200 },
      { tempMin_C: 45, tempMax_C: 50, hours: 260 },
    ],
  },
  {
    locationName: 'Tokyo, Japan',
    designDryBulb_C: 35,
    temperatureBins: [
      { tempMin_C: -5, tempMax_C: 0, hours: 200 },
      { tempMin_C: 0, tempMax_C: 5, hours: 1000 },
      { tempMin_C: 5, tempMax_C: 10, hours: 1400 },
      { tempMin_C: 10, tempMax_C: 15, hours: 1300 },
      { tempMin_C: 15, tempMax_C: 20, hours: 1200 },
      { tempMin_C: 20, tempMax_C: 25, hours: 1300 },
      { tempMin_C: 25, tempMax_C: 30, hours: 1500 },
      { tempMin_C: 30, tempMax_C: 35, hours: 800 },
      { tempMin_C: 35, tempMax_C: 40, hours: 60 },
    ],
  },
];
