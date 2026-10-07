// Zone data ported intact from IslandCity Driver Accounting v1 (islandcity.vercel.app).
// VR: NYC demand zones. WR: hourly heat per zone, weekday (wkd) vs weekend (wke).

export type ZoneHeat = "hot" | "warm" | "cold";

export type Zone = { id: string; name: string; lat: number; lng: number };

const VR=[{id:"jfk",name:"JFK Airport",lat:40.6413,lng:-73.7781},{id:"lga",name:"LaGuardia Airport",lat:40.7769,lng:-73.874},{id:"ewr",name:"Newark Airport (EWR)",lat:40.6895,lng:-74.1745},{id:"penn",name:"Penn Station / MSG",lat:40.7506,lng:-73.9935},{id:"timesq",name:"Times Square",lat:40.758,lng:-73.9855},{id:"gct",name:"Grand Central",lat:40.7527,lng:-73.9772},{id:"midtown",name:"Midtown Manhattan",lat:40.7549,lng:-73.984},{id:"fidi",name:"Financial District",lat:40.7074,lng:-74.0113},{id:"ues",name:"Upper East Side",lat:40.7739,lng:-73.9575},{id:"wburg",name:"Williamsburg",lat:40.7081,lng:-73.9571},{id:"astoria",name:"Astoria / Queens",lat:40.7721,lng:-73.9302},{id:"bklyn",name:"Brooklyn Downtown",lat:40.6928,lng:-73.9903},{id:"meatpk",name:"Meatpacking / Chelsea",lat:40.7416,lng:-74.0057},{id:"les",name:"East Village / LES",lat:40.7264,lng:-73.9818},{id:"harlem",name:"Harlem",lat:40.8116,lng:-73.9465}]

const WR={wkd:[[["timesq","hot"],["les","hot"],["wburg","warm"],["meatpk","warm"],["jfk","cold"]],[["timesq","hot"],["les","hot"],["wburg","warm"],["meatpk","warm"],["jfk","cold"]],[["timesq","hot"],["les","warm"],["wburg","warm"],["meatpk","cold"]],[["jfk","warm"],["lga","warm"],["timesq","cold"],["midtown","cold"]],[["jfk","hot"],["lga","warm"],["ewr","warm"],["timesq","cold"]],[["jfk","hot"],["lga","hot"],["ewr","warm"],["midtown","cold"]],[["lga","hot"],["jfk","warm"],["midtown","warm"],["gct","warm"],["penn","cold"]],[["midtown","hot"],["gct","hot"],["penn","warm"],["fidi","warm"],["lga","warm"]],[["midtown","hot"],["gct","hot"],["penn","hot"],["fidi","warm"],["ues","warm"]],[["midtown","hot"],["gct","warm"],["penn","warm"],["fidi","warm"],["ues","cold"]],[["midtown","hot"],["timesq","warm"],["ues","warm"],["fidi","cold"],["jfk","cold"]],[["midtown","hot"],["timesq","warm"],["ues","warm"],["bklyn","cold"]],[["midtown","hot"],["timesq","warm"],["ues","warm"],["penn","cold"],["bklyn","cold"]],[["midtown","hot"],["timesq","warm"],["ues","warm"],["penn","cold"]],[["midtown","hot"],["timesq","warm"],["penn","warm"],["ues","cold"]],[["penn","hot"],["midtown","hot"],["gct","warm"],["timesq","warm"]],[["penn","hot"],["gct","hot"],["midtown","hot"],["timesq","warm"],["ues","cold"]],[["penn","hot"],["gct","hot"],["midtown","hot"],["timesq","warm"],["fidi","warm"]],[["penn","hot"],["timesq","hot"],["gct","warm"],["midtown","warm"],["jfk","cold"]],[["timesq","hot"],["penn","warm"],["ues","warm"],["wburg","cold"],["jfk","cold"]],[["timesq","hot"],["ues","warm"],["wburg","warm"],["meatpk","cold"]],[["timesq","hot"],["wburg","warm"],["ues","warm"],["meatpk","warm"],["les","cold"]],[["timesq","hot"],["wburg","warm"],["meatpk","warm"],["les","warm"],["ues","cold"]],[["timesq","hot"],["les","warm"],["wburg","warm"],["meatpk","warm"],["jfk","cold"]]],wke:[[["timesq","hot"],["wburg","hot"],["les","hot"],["meatpk","warm"],["astoria","cold"]],[["timesq","hot"],["wburg","hot"],["les","hot"],["meatpk","warm"]],[["timesq","hot"],["wburg","hot"],["les","warm"],["meatpk","warm"]],[["timesq","warm"],["jfk","warm"],["wburg","cold"],["les","cold"]],[["jfk","hot"],["lga","warm"],["ewr","warm"],["timesq","cold"]],[["jfk","hot"],["lga","hot"],["ewr","warm"],["timesq","cold"]],[["jfk","warm"],["lga","warm"],["timesq","cold"],["midtown","cold"]],[["jfk","warm"],["lga","warm"],["midtown","cold"],["timesq","cold"]],[["jfk","warm"],["lga","warm"],["midtown","cold"],["bklyn","cold"]],[["jfk","warm"],["midtown","warm"],["timesq","warm"],["bklyn","cold"]],[["timesq","hot"],["midtown","warm"],["bklyn","warm"],["ues","cold"]],[["timesq","hot"],["midtown","warm"],["bklyn","warm"],["ues","cold"]],[["timesq","hot"],["midtown","warm"],["bklyn","warm"],["ues","warm"],["wburg","cold"]],[["timesq","hot"],["midtown","warm"],["ues","warm"],["bklyn","warm"],["wburg","cold"]],[["timesq","hot"],["midtown","warm"],["ues","warm"],["wburg","cold"],["bklyn","cold"]],[["timesq","hot"],["midtown","warm"],["ues","warm"],["wburg","warm"],["jfk","cold"]],[["timesq","hot"],["wburg","warm"],["midtown","warm"],["ues","warm"],["bklyn","cold"]],[["timesq","hot"],["wburg","warm"],["midtown","warm"],["les","cold"],["jfk","cold"]],[["timesq","hot"],["wburg","hot"],["midtown","warm"],["les","warm"],["meatpk","cold"]],[["timesq","hot"],["wburg","hot"],["les","warm"],["meatpk","warm"],["midtown","cold"]],[["timesq","hot"],["wburg","hot"],["les","warm"],["meatpk","warm"],["astoria","cold"]],[["timesq","hot"],["wburg","hot"],["les","warm"],["meatpk","warm"],["astoria","cold"]],[["timesq","hot"],["wburg","hot"],["les","warm"],["meatpk","warm"]],[["timesq","hot"],["wburg","hot"],["les","hot"],["meatpk","warm"],["astoria","cold"]]]}

// Haversine distance in km (v1 DE function, intact).
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (h: number) => (h * Math.PI) / 180;
  const c = toRad(lat2 - lat1);
  const f = toRad(lng2 - lng1);
  const d =
    Math.sin(c / 2) * Math.sin(c / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(f / 2) * Math.sin(f / 2);
  return 2 * 6371 * Math.asin(Math.sqrt(d));
}

export type ZoneRec = Zone & { heat: ZoneHeat; km: number | null };

// v1 ZR recommender, intact: top-5 zones for the hour, hot first, then nearest.
export function recommendZones(hour: number, day: number, lat: number | null, lng: number | null): ZoneRec[] {
  const list: Array<[string, ZoneHeat]> = (WR[day === 0 || day === 6 ? "wke" : "wkd"] as Array<Array<[string, ZoneHeat]>>)[hour] ?? [];
  const order: Record<ZoneHeat, number> = { hot: 0, warm: 1, cold: 2 };
  return list
    .map(([id, heat]) => {
      const z = VR.find((y) => y.id === id)!;
      const km = lat !== null && lng !== null ? haversineKm(lat, lng, z.lat, z.lng) : null;
      return { id: z.id, name: z.name, lat: z.lat, lng: z.lng, heat, km };
    })
    .sort((a, b) => {
      const h = order[a.heat] - order[b.heat];
      if (h !== 0) return h;
      if (a.km !== null && b.km !== null) return a.km - b.km;
      return 0;
    })
    .slice(0, 5);
}
