/**
 * TOLL PLAZAS 2026 — E-ZPass NY (NYCSC tag) rates for passenger cars (2 axles).
 *
 * Research date: 2026-10-19. All rates are the DISCOUNTED E-ZPass NY rate
 * (tag issued by the NY Customer Service Center, mounted in the car).
 * Tolls-by-Mail rates are higher and are NOT used here.
 *
 * VALIDATION ANCHOR: Queens Midtown Tunnel = $7.46 NY E-ZPass in 2026 ✓
 * (MTA rates effective January 4, 2026 — matches the user's known price.)
 *
 * Coordinates: bridge/tunnel midpoints or plaza areas from geocoding.
 * approx: true means the point is the crossing midpoint, not the exact gantry.
 * For geofencing (detecting "driver passed this toll"), a midpoint + radius works.
 *
 * Direction key:
 *  - "both"        → tolled in both directions (each crossing is charged)
 *  - "eastbound"   → tolled entering NY only (Port Authority Hudson crossings)
 *  - "southbound"  → tolled southbound only
 *  - "northbound"  → tolled northbound only
 *  - "one-way barrier" → GSP barrier plazas collect in one direction only
 *  - "ticket"      → distance-based ticket system, paid at exit
 */

export interface TollPlaza {
  name: string;
  operator: "MTA" | "PANYNJ" | "NJTA" | "NYSTA" | "GSP";
  lat: number;
  lng: number;
  /** true = crossing midpoint, not the exact gantry position */
  approx?: boolean;
  /** NY E-ZPass (NYCSC) 2026 rate, passenger car 2 axles. Peak rate where time-of-day pricing exists. */
  ezpass2026: number | null;
  /** NY E-ZPass off-peak 2026 rate, where time-of-day pricing exists. */
  ezpassOffPeak2026?: number | null;
  tollsByMail2026?: number | null;
  direction?: string;
  source: string;
}

export const TOLL_PLAZAS_2026: TollPlaza[] = [
  // ───────────────────────── MTA BRIDGES & TUNNELS ─────────────────────────
  // Official: MTA Bridges and Tunnels "tolls by vehicle", effective Jan 4, 2026.
  {
    name: "Robert F. Kennedy Bridge (Triboro)",
    operator: "MTA",
    lat: 40.78934, lng: -73.92702, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Bronx-Whitestone Bridge",
    operator: "MTA",
    lat: 40.8163, lng: -73.8358, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Throgs Neck Bridge",
    operator: "MTA",
    lat: 40.81345, lng: -73.80858, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Verrazzano-Narrows Bridge",
    operator: "MTA",
    lat: 40.60187, lng: -74.05912, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both (split tolling since Dec 2020 — each direction charged the single rate)",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Queens Midtown Tunnel",
    operator: "MTA",
    lat: 40.74716, lng: -73.97095, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Hugh L. Carey Tunnel (Brooklyn-Battery)",
    operator: "MTA",
    lat: 40.67776, lng: -74.00224, approx: true,
    ezpass2026: 7.46, tollsByMail2026: 12.03,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Henry Hudson Bridge",
    operator: "MTA",
    lat: 40.87759, lng: -73.92246, approx: true,
    ezpass2026: 3.42, tollsByMail2026: 8.87,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Cross Bay Veterans Memorial Bridge",
    operator: "MTA",
    lat: 40.59721, lng: -73.82032, approx: true,
    ezpass2026: 2.80, tollsByMail2026: 6.02,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },
  {
    name: "Marine Parkway-Gil Hodges Memorial Bridge",
    operator: "MTA",
    lat: 40.57571, lng: -73.88627, approx: true,
    ezpass2026: 2.80, tollsByMail2026: 6.02,
    direction: "both",
    source: "MTA Bridges and Tunnels tolls by vehicle, effective Jan 4, 2026 (mta.info)",
  },

  // ─────────────── PORT AUTHORITY NY/NJ (all six crossings) ───────────────
  // Official: PANYNJ toll schedule, tariff effective Jan 4, 2026 (read July 2026).
  // Peak: wkdy 6–10am & 4–8pm, wknd 11am–9pm. Mid-tier (bad tag mount): $19.55.
  {
    name: "George Washington Bridge",
    operator: "PANYNJ",
    lat: 40.85116, lng: -73.94976, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },
  {
    name: "Lincoln Tunnel",
    operator: "PANYNJ",
    lat: 40.76516, lng: -74.01608, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },
  {
    name: "Holland Tunnel",
    operator: "PANYNJ",
    lat: 40.72982, lng: -74.03797, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },
  {
    name: "Bayonne Bridge",
    operator: "PANYNJ",
    lat: 40.64688, lng: -74.14009, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering Staten Island/NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },
  {
    name: "Goethals Bridge",
    operator: "PANYNJ",
    lat: 40.63696, lng: -74.1991, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering Staten Island/NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },
  {
    name: "Outerbridge Crossing",
    operator: "PANYNJ",
    lat: 40.52459, lng: -74.25879, approx: true,
    ezpass2026: 16.79, ezpassOffPeak2026: 14.79, tollsByMail2026: 23.30,
    direction: "eastbound only (entering Staten Island/NY; westbound free)",
    source: "Port Authority of NY & NJ toll schedule, tariff effective Jan 4, 2026 (panynj.gov)",
  },

  // ─────────── NJ TURNPIKE (ticket system — distance-based) ───────────
  // 3% increase Jan 1, 2026. Full length Exit 1→18E: $21.88 peak / $16.41 off-peak
  // E-ZPass (2026). Peak: M–F 7–9am & 4:30–6:30pm, all day Sat/Sun (njta.com).
  // Per-segment 2026 prices are NOT published as a simple table — use the
  // NJTA toll calculator (njta.com/toll-calculator) for exact entry→exit fares.
  {
    name: "NJ Turnpike Exit 13A (Newark Airport)",
    operator: "NJTA",
    lat: 40.72762, lng: -74.13025, approx: true,
    ezpass2026: null,
    direction: "ticket — paid at exit; both directions tolled",
    source: "NJTA toll calculator (njta.com/toll-calculator); 2026 full-length ref: $21.88 peak / $16.41 off-peak E-ZPass (nytollsinfo.com, thetraveler.org)",
  },
  {
    name: "NJ Turnpike Interchange 14 (I-78 / Newark)",
    operator: "NJTA",
    lat: 40.6985, lng: -74.15582, approx: true,
    ezpass2026: null,
    direction: "ticket — paid at exit; both directions tolled",
    source: "NJTA toll calculator (njta.com/toll-calculator); 2026 full-length ref: $21.88 peak / $16.41 off-peak E-ZPass",
  },
  {
    name: "NJ Turnpike Interchange 15E (Newark / Jersey City)",
    operator: "NJTA",
    lat: 40.724, lng: -74.075, approx: true,
    ezpass2026: null,
    direction: "ticket — paid at exit; both directions tolled",
    source: "NJTA toll calculator (njta.com/toll-calculator); 2026 full-length ref: $21.88 peak / $16.41 off-peak E-ZPass",
  },
  {
    name: "NJ Turnpike Interchange 18W (George Washington Bridge)",
    operator: "NJTA",
    lat: 40.8517, lng: -73.9527, approx: true,
    ezpass2026: null,
    direction: "ticket — paid at exit; both directions tolled",
    source: "NJTA toll calculator (njta.com/toll-calculator); 2026 full-length ref: $21.88 peak / $16.41 off-peak E-ZPass",
  },

  // ─────────── GARDEN STATE PARKWAY (barrier plazas) ───────────
  // 3% increase Jan 1, 2026: barrier plazas $2.30 E-ZPass (was $2.22 + 8¢),
  // ramp plazas $0.76 E-ZPass (+3¢). One-way barrier collection.
  {
    name: "GSP Union Toll Plaza (MP 142)",
    operator: "GSP",
    lat: 40.69336, lng: -74.26341, approx: true,
    ezpass2026: 2.30,
    direction: "one-way barrier",
    source: "NJTA 3% increase Jan 1, 2026 — barrier $2.30 E-ZPass (tollguru.com 2026 NJ guide)",
  },
  {
    name: "GSP Essex Toll Plaza (MP 145)",
    operator: "GSP",
    lat: 40.8109, lng: -74.18031, approx: true,
    ezpass2026: 2.30,
    direction: "one-way barrier",
    source: "NJTA 3% increase Jan 1, 2026 — barrier $2.30 E-ZPass (tollguru.com 2026 NJ guide)",
  },

  // ─────────── NY STATE THRUWAY ───────────
  // Official: Thruway Authority "Schedule of Special E-ZPass NY Discount Tolls
  // at Fixed Toll Barriers" (thruway.ny.gov). Mainline otherwise ~4.7¢/mile
  // NY E-ZPass through end of 2026 (5% increase Jan 1, 2027).
  {
    name: "Gov. Mario M. Cuomo Bridge (Tappan Zee)",
    operator: "NYSTA",
    lat: 41.07089, lng: -73.87972, approx: true,
    ezpass2026: 7.25, tollsByMail2026: 10.11,
    direction: "southbound only (Nyack → Tarrytown); $0.50/yr rise 2024–2027",
    source: "Thruway Authority fixed-barrier schedule (thruway.ny.gov); 2026 base $7.25 NY E-ZPass",
  },
  {
    name: "Thruway Yonkers Gantry (I-87)",
    operator: "NYSTA",
    lat: 40.98499, lng: -73.85296, approx: true,
    ezpass2026: 1.25,
    direction: "northbound only (roundtrip toll collected northbound)",
    source: "E-ZPass NY commuter plans: $1.25 standard NY E-ZPass rate at Yonkers gantry (e-zpassny.com/ezpass/plans)",
  },
  {
    name: "Thruway New Rochelle Gantry (I-95)",
    operator: "NYSTA",
    lat: 40.91534, lng: -73.78251, approx: true,
    ezpass2026: 1.74,
    direction: "southbound only (roundtrip toll collected southbound)",
    source: "E-ZPass NY commuter plans: $1.74 standard NY E-ZPass rate at New Rochelle gantry (e-zpassny.com/ezpass/plans)",
  },
];
