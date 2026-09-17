import { makeProjection, type Incident, type TrackPoint, type Waypoint } from "@/lib/gps/analysis";

const WIDTH = 640;
const HEIGHT = 400;

/**
 * Evidence map for one incident: official track, the rider's log, the offending section in red, and
 * a scale bar. Plain SVG so it can be turned into a PNG in the browser and published with the penalty.
 */
export function IncidentMap({
  id,
  official,
  rider,
  waypoints,
  incident,
  title,
}: {
  id: string;
  official: TrackPoint[];
  rider: TrackPoint[];
  waypoints: Waypoint[];
  incident: Incident;
  title: string;
}) {
  const project = makeProjection({ lat: incident.lat, lon: incident.lon });
  // Frame the offending section plus some log before and after it, so the map shows where the rider
  // left the official track and where they came back, not only the part that was off track.
  const CONTEXT_POINTS = 15;
  const section = rider
    .slice(Math.max(0, incident.startIndex - CONTEXT_POINTS), Math.min(rider.length, incident.endIndex + 1 + CONTEXT_POINTS))
    .map(project);
  section.push(project({ lat: incident.lat, lon: incident.lon }));

  const xs = section.map((p) => p.x);
  const ys = section.map((p) => p.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const margin = Math.max(250, incident.distanceM * 0.6);
  let halfX = (Math.max(...xs) - Math.min(...xs)) / 2 + margin;
  let halfY = (Math.max(...ys) - Math.min(...ys)) / 2 + margin;
  // Keep the map's aspect ratio so distances are the same in both directions.
  if (halfX / halfY > WIDTH / HEIGHT) halfY = (halfX * HEIGHT) / WIDTH;
  else halfX = (halfY * WIDTH) / HEIGHT;
  const scale = WIDTH / (2 * halfX);

  const toScreen = (p: { x: number; y: number }) => ({ x: WIDTH / 2 + (p.x - centerX) * scale, y: HEIGHT / 2 - (p.y - centerY) * scale });
  const inView = (p: { x: number; y: number }) => Math.abs(p.x - centerX) < halfX * 1.5 && Math.abs(p.y - centerY) < halfY * 1.5;

  const path = (points: TrackPoint[]) => {
    let d = "";
    let drawing = false;
    for (const point of points) {
      const p = project(point);
      if (!inView(p)) {
        drawing = false;
        continue;
      }
      const s = toScreen(p);
      d += `${drawing ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
      drawing = true;
    }
    return d;
  };

  const barMetres = [50, 100, 200, 500, 1000, 2000].find((m) => m * scale >= 80) ?? 2000;
  const visibleWaypoints = waypoints.map((w) => ({ w, s: toScreen(project(w)), p: project(w) })).filter(({ p }) => inView(p));

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full max-w-full rounded border border-border"
      role="img"
      aria-label={title}
    >
      <rect width={WIDTH} height={HEIGHT} fill="#f8fafc" />
      <path d={path(official)} fill="none" stroke="#94a3b8" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <path d={path(rider)} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
      <path
        d={path(rider.slice(incident.startIndex, incident.endIndex + 1))}
        fill="none"
        stroke="#dc2626"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {visibleWaypoints.map(({ w, s }) => (
        <g key={`${w.name}-${w.lat}-${w.lon}`}>
          <circle cx={s.x} cy={s.y} r={5} fill="#f59e0b" stroke="#111" strokeWidth={1} />
          <text x={s.x + 8} y={s.y + 4} fontSize={11} fontFamily="Arial, sans-serif" fill="#111">
            {w.name}
          </text>
        </g>
      ))}
      <rect x={8} y={8} width={WIDTH - 16} height={24} fill="#ffffff" opacity={0.85} />
      <text x={16} y={25} fontSize={13} fontFamily="Arial, sans-serif" fontWeight={700} fill="#111">
        {title}
      </text>
      <g transform={`translate(16 ${HEIGHT - 20})`}>
        <rect x={0} y={-6} width={barMetres * scale} height={6} fill="#111" />
        <text x={0} y={-10} fontSize={11} fontFamily="Arial, sans-serif" fill="#111">
          {barMetres >= 1000 ? `${barMetres / 1000} km` : `${barMetres} m`}
        </text>
      </g>
      <g transform={`translate(${WIDTH - 28} ${HEIGHT - 40})`} fontFamily="Arial, sans-serif">
        <path d="M0 -14 L7 6 L0 1 L-7 6 Z" fill="#111" />
        <text x={-4} y={20} fontSize={11} fill="#111">
          N
        </text>
      </g>
    </svg>
  );
}
