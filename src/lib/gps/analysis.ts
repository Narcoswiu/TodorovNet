// GPS track check for navigation days (Р XIX.4, XIX.7, XIX.8, XIX.11).
// Runs in the browser: the judge's files never leave the laptop until a penalty with evidence is proposed.
// No imports on purpose, so the same code runs in Node unit tests.

export type TrackPoint = { lat: number; lon: number; time: number | null };
export type Waypoint = { name: string; lat: number; lon: number };

export type IncidentKind = "deviation" | "signal_gap" | "missed_waypoint";

export type Incident = {
  kind: IncidentKind;
  /** Deviation: furthest perpendicular distance from the official track. Gap: distance with no log. */
  distanceM: number;
  /** Deviation: distance ridden while off track. */
  lengthM: number;
  startIndex: number;
  endIndex: number;
  startTime: number | null;
  endTime: number | null;
  /** Where to centre the evidence map. */
  lat: number;
  lon: number;
  waypoint?: string;
  /** Code in the default penalty catalogue, or null when below every threshold. */
  penaltyCode: string | null;
};

export type AnalysisOptions = {
  /** Off-track below this is tolerated (the rulebook's first bracket starts at 100 m). */
  deviationThresholdM: number;
  /** A jump between consecutive log points at least this long counts as a signal gap… */
  gapDistanceM: number;
  /** …but only when the time between them is at least this long, so fast riding is not a gap. */
  gapMinSeconds: number;
  /** A mandatory waypoint counts as passed when the log comes this close. */
  waypointRadiusM: number;
  /** Points that dip back on track for fewer than this many samples do not split one deviation in two. */
  mergeWithinPoints: number;
};

export const DEFAULT_OPTIONS: AnalysisOptions = {
  deviationThresholdM: 100,
  gapDistanceM: 100,
  gapMinSeconds: 10,
  waypointRadiusM: 50,
  mergeWithinPoints: 3,
};

// ─── GPX parsing ───

const NUMBER = /-?\d+(?:\.\d+)?/;

function attribute(tag: string, name: string): number | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*["'](${NUMBER.source})["']`).exec(tag);
  return match ? Number(match[1]) : null;
}

/** Track points (trkpt, or rtept for route files) in file order. */
export function parseGpxPoints(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const pattern = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const lat = attribute(match[2], "lat");
    const lon = attribute(match[2], "lon");
    if (lat == null || lon == null) continue;
    const time = /<time>\s*([^<]+?)\s*<\/time>/.exec(match[3] ?? "")?.[1];
    const parsed = time ? Date.parse(time) : Number.NaN;
    points.push({ lat, lon, time: Number.isNaN(parsed) ? null : parsed });
  }
  return points;
}

export function parseGpxWaypoints(xml: string): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const pattern = /<wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/wpt>)/g;
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const lat = attribute(match[1], "lat");
    const lon = attribute(match[1], "lon");
    if (lat == null || lon == null) continue;
    const name = /<name>\s*([^<]*?)\s*<\/name>/.exec(match[2] ?? "")?.[1] ?? "";
    waypoints.push({ name: decodeEntities(name), lat, lon });
  }
  return waypoints;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ─── Geometry ───

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Flat metres around a reference point. Accurate to well under 1% across a race area of tens of km. */
export function makeProjection(reference: { lat: number; lon: number }) {
  const cosLat = Math.cos(toRad(reference.lat));
  return (point: { lat: number; lon: number }) => ({
    x: toRad(point.lon - reference.lon) * EARTH_RADIUS_M * cosLat,
    y: toRad(point.lat - reference.lat) * EARTH_RADIUS_M,
  });
}

type Vec = { x: number; y: number };

function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Nearest distance from points to a polyline, using a uniform grid so a 20 000-point log against a
 * 10 000-point track stays fast. Points further than `searchM` get distance = Infinity-free cap searchM+.
 */
export function makeTrackDistance(track: TrackPoint[], cellM = 250) {
  const projected = track.map(makeProjection(track[0] ?? { lat: 0, lon: 0 }));
  const project = makeProjection(track[0] ?? { lat: 0, lon: 0 });
  const cells = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx}:${cy}`;

  for (let i = 0; i < projected.length - 1; i++) {
    const a = projected[i];
    const b = projected[i + 1];
    const minX = Math.floor(Math.min(a.x, b.x) / cellM);
    const maxX = Math.floor(Math.max(a.x, b.x) / cellM);
    const minY = Math.floor(Math.min(a.y, b.y) / cellM);
    const maxY = Math.floor(Math.max(a.y, b.y) / cellM);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = cells.get(key(cx, cy));
        if (bucket) bucket.push(i);
        else cells.set(key(cx, cy), [i]);
      }
    }
  }

  return (point: { lat: number; lon: number }): number => {
    const p = project(point);
    const cx = Math.floor(p.x / cellM);
    const cy = Math.floor(p.y / cellM);
    // Grow the search ring until something is found and the ring is past the best distance so far.
    let best = Number.POSITIVE_INFINITY;
    for (let ring = 0; ring < 400; ring++) {
      const seen = new Set<number>();
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          for (const index of cells.get(key(cx + dx, cy + dy)) ?? []) {
            if (seen.has(index)) continue;
            seen.add(index);
            best = Math.min(best, pointSegmentDistance(p, projected[index], projected[index + 1]));
          }
        }
      }
      if (best <= ring * cellM) break;
    }
    if (projected.length === 1) best = Math.hypot(p.x - projected[0].x, p.y - projected[0].y);
    return best;
  };
}

// ─── Rules ───

export function deviationPenaltyCode(distanceM: number, thresholdM = DEFAULT_OPTIONS.deviationThresholdM): string | null {
  if (distanceM > 1000) return "track_dev_over_1000";
  if (distanceM > 500) return "track_dev_500_1000";
  if (distanceM >= thresholdM) return "track_dev_100_500";
  return null;
}

export function gapPenaltyCode(distanceM: number, thresholdM = DEFAULT_OPTIONS.gapDistanceM): string | null {
  if (distanceM > 1000) return "gps_gap_over_1000";
  if (distanceM > 500) return "gps_gap_500_1000";
  if (distanceM >= thresholdM) return "gps_gap_100_500";
  return null;
}

export type AnalysisResult = {
  incidents: Incident[];
  riderDistanceM: number;
  maxDeviationM: number;
  distances: number[];
};

export function analyseRiderTrack(
  official: TrackPoint[],
  rider: TrackPoint[],
  mandatory: Waypoint[] = [],
  options: Partial<AnalysisOptions> = {},
): AnalysisResult {
  const o = { ...DEFAULT_OPTIONS, ...options };
  if (official.length < 2 || rider.length === 0) return { incidents: [], riderDistanceM: 0, maxDeviationM: 0, distances: [] };

  const distanceToTrack = makeTrackDistance(official);
  const distances = rider.map(distanceToTrack);
  const incidents: Incident[] = [];

  // Deviations: runs of points further than the threshold, merged across short dips back on track.
  let runStart = -1;
  let lastOff = -1;
  const closeRun = (start: number, end: number) => {
    let max = 0;
    let at = start;
    let length = 0;
    for (let i = start; i <= end; i++) {
      if (distances[i] > max) {
        max = distances[i];
        at = i;
      }
      if (i > start) length += haversineM(rider[i - 1], rider[i]);
    }
    incidents.push({
      kind: "deviation",
      distanceM: max,
      lengthM: length,
      startIndex: start,
      endIndex: end,
      startTime: rider[start].time,
      endTime: rider[end].time,
      lat: rider[at].lat,
      lon: rider[at].lon,
      penaltyCode: deviationPenaltyCode(max, o.deviationThresholdM),
    });
  };
  for (let i = 0; i < rider.length; i++) {
    if (distances[i] >= o.deviationThresholdM) {
      if (runStart < 0) runStart = i;
      else if (i - lastOff > o.mergeWithinPoints) {
        closeRun(runStart, lastOff);
        runStart = i;
      }
      lastOff = i;
    }
  }
  if (runStart >= 0) closeRun(runStart, lastOff);

  // Signal gaps: long jumps between consecutive points that also took a while.
  let riderDistance = 0;
  for (let i = 1; i < rider.length; i++) {
    const jump = haversineM(rider[i - 1], rider[i]);
    riderDistance += jump;
    const seconds = rider[i].time != null && rider[i - 1].time != null ? (rider[i].time! - rider[i - 1].time!) / 1000 : null;
    if (jump >= o.gapDistanceM && (seconds == null || seconds >= o.gapMinSeconds)) {
      incidents.push({
        kind: "signal_gap",
        distanceM: jump,
        lengthM: jump,
        startIndex: i - 1,
        endIndex: i,
        startTime: rider[i - 1].time,
        endTime: rider[i].time,
        lat: (rider[i - 1].lat + rider[i].lat) / 2,
        lon: (rider[i - 1].lon + rider[i].lon) / 2,
        penaltyCode: gapPenaltyCode(jump, o.gapDistanceM),
      });
    }
  }

  // Mandatory waypoints (controls, special-stage start and finish) the log never came close to.
  for (const waypoint of mandatory) {
    let nearest = Number.POSITIVE_INFINITY;
    let nearestIndex = 0;
    rider.forEach((point, index) => {
      const d = haversineM(point, waypoint);
      if (d < nearest) {
        nearest = d;
        nearestIndex = index;
      }
    });
    if (nearest > o.waypointRadiusM) {
      incidents.push({
        kind: "missed_waypoint",
        distanceM: nearest,
        lengthM: 0,
        startIndex: nearestIndex,
        endIndex: nearestIndex,
        startTime: rider[nearestIndex].time,
        endTime: rider[nearestIndex].time,
        lat: waypoint.lat,
        lon: waypoint.lon,
        waypoint: waypoint.name,
        penaltyCode: "missed_control",
      });
    }
  }

  incidents.sort((a, b) => a.startIndex - b.startIndex);
  return { incidents, riderDistanceM: riderDistance, maxDeviationM: Math.max(0, ...distances), distances };
}
