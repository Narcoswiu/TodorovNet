"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IncidentMap } from "@/components/admin/incident-map";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { saveStageTrack, setMandatoryWaypoints } from "@/lib/admin/actions/gps";
import { proposePenalty } from "@/lib/admin/actions/penalties";
import { formatClock } from "@/lib/format";
import {
  analyseRiderTrack,
  haversineM,
  parseGpxPoints,
  parseGpxWaypoints,
  type AnalysisResult,
  type Incident,
  type TrackPoint,
  type Waypoint,
} from "@/lib/gps/analysis";
import { createClient } from "@/lib/supabase/client";

export type GpsTrack = {
  id: number;
  stage_id: number;
  class_id: number | null;
  name: string;
  storage_path: string;
  point_count: number;
  length_m: number | null;
  mandatory_waypoints: string[];
};

type Props = {
  lang: Locale;
  dict: Dictionary;
  eventId: number;
  stages: { id: number; label: string }[];
  classes: { id: number; name: string }[];
  tracks: GpsTrack[];
  entries: { race_number: number; name: string }[];
  penaltyTypes: { id: number; code: string; name: string }[];
};

type Official = { path: string; points: TrackPoint[]; waypoints: Waypoint[] };

// Waypoint names that are usually mandatory in BG-X briefings (Р XIII.8 controls, SS start/finish).
const LIKELY_MANDATORY = /^(SS[_ ]|CP|КП|K\d|GATE|CONTROL|КОНТРОЛ)/i;

export function GpsCheck({ lang, dict, eventId, stages, classes, tracks, entries, penaltyTypes }: Props) {
  const text = dict.admin.gps;
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [stageId, setStageId] = useState<number | null>(stages[0]?.id ?? null);
  const [classId, setClassId] = useState<number | null>(null);
  const [official, setOfficial] = useState<Official | null>(null);
  const [mandatory, setMandatory] = useState<string[] | null>(null);
  const [raceNumber, setRaceNumber] = useState("");
  const [riderFile, setRiderFile] = useState<File | null>(null);
  const [rider, setRider] = useState<TrackPoint[] | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [proposed, setProposed] = useState<Record<number, string>>({});

  const track =
    tracks.find((row) => row.stage_id === stageId && row.class_id === classId) ??
    tracks.find((row) => row.stage_id === stageId && row.class_id === null) ??
    null;
  const mandatoryNames = mandatory ?? track?.mandatory_waypoints ?? [];

  function resetAnalysis() {
    setOfficial(null);
    setMandatory(null);
    setResult(null);
    setRider(null);
    setProposed({});
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), tone: "bad" });
    } finally {
      setBusy(false);
    }
  }

  async function loadOfficial(): Promise<Official> {
    if (!track) throw new Error(text.needTrack);
    if (official?.path === track.storage_path) return official;
    const { data, error } = await supabase.storage.from("gps-tracks").download(track.storage_path);
    if (error || !data) throw new Error(error?.message ?? text.readError);
    const xml = await data.text();
    const loaded = { path: track.storage_path, points: parseGpxPoints(xml), waypoints: parseGpxWaypoints(xml) };
    setOfficial(loaded);
    return loaded;
  }

  const uploadOfficial = (file: File) =>
    run(async () => {
      if (stageId == null) return;
      const xml = await file.text();
      const points = parseGpxPoints(xml);
      if (points.length < 2) throw new Error(text.readError);
      const waypoints = parseGpxWaypoints(xml);
      const path = `events/${eventId}/stages/${stageId}/official-${classId ?? "all"}.gpx`;
      const upload = await supabase.storage.from("gps-tracks").upload(path, file, { upsert: true, contentType: "application/gpx+xml" });
      if (upload.error) throw new Error(upload.error.message);
      const lengthM = points.slice(1).reduce((sum, point, i) => sum + haversineM(points[i], point), 0);
      const defaults = waypoints.map((w) => w.name).filter((name) => LIKELY_MANDATORY.test(name));
      const saved = await saveStageTrack(lang, {
        eventId,
        stageId,
        classId,
        name: file.name,
        storagePath: path,
        pointCount: points.length,
        lengthM,
        mandatoryWaypoints: defaults,
      });
      if (!saved.ok) throw new Error(saved.error);
      setOfficial({ path, points, waypoints });
      setMandatory(defaults);
      router.refresh();
    });

  const saveWaypoints = () =>
    run(async () => {
      if (!track) return;
      const saved = await setMandatoryWaypoints(lang, track.id, mandatoryNames);
      if (!saved.ok) throw new Error(saved.error);
      setMessage({ text: dict.admin.saved, tone: "good" });
      router.refresh();
    });

  const analyse = () =>
    run(async () => {
      const loaded = await loadOfficial();
      if (!riderFile) throw new Error(text.readError);
      const points = parseGpxPoints(await riderFile.text());
      if (!points.length) throw new Error(text.readError);
      setRider(points);
      setProposed({});
      setResult(analyseRiderTrack(loaded.points, points, loaded.waypoints.filter((w) => mandatoryNames.includes(w.name))));
    });

  const propose = (index: number, incident: Incident) =>
    run(async () => {
      if (!official || !rider || stageId == null) return;
      const entry = entries.find((row) => row.race_number === Number(raceNumber));
      if (!entry) throw new Error(t(text.unknownNumber, { n: raceNumber }));
      const type = penaltyTypes.find((row) => row.code === incident.penaltyCode);
      if (!type) throw new Error(text.belowThreshold);

      const svg = document.getElementById(`incident-map-${index}`);
      if (!(svg instanceof SVGSVGElement)) throw new Error("map not found");
      const png = await svgToPng(svg);
      const base = `events/${eventId}/penalties/stage-${stageId}-no-${entry.race_number}-${Date.now()}`;
      const excerpt = gpxExcerpt(rider, incident.startIndex, incident.endIndex, `#${entry.race_number}`);

      const evidence = supabase.storage.from("evidence");
      const image = await evidence.upload(`${base}.png`, png, { contentType: "image/png" });
      if (image.error) throw new Error(image.error.message);
      const gpx = await evidence.upload(`${base}.gpx`, new Blob([excerpt], { type: "application/gpx+xml" }), { contentType: "application/gpx+xml" });
      if (gpx.error) throw new Error(gpx.error.message);

      const form = new FormData();
      form.set("lang", lang);
      form.set("event_id", String(eventId));
      form.set("stage_id", String(stageId));
      form.set("race_number", String(entry.race_number));
      form.set("penalty_type_id", String(type.id));
      form.set("units", "1");
      form.set("evidence_url", evidence.getPublicUrl(`${base}.png`).data.publicUrl);
      form.set(
        "note",
        t(text.evidenceNote, {
          kind: incidentLabel(incident),
          distance: t(text.distance, { m: Math.round(incident.distanceM) }),
          from: incident.startTime ? formatClock(new Date(incident.startTime)) : "?",
          to: incident.endTime ? formatClock(new Date(incident.endTime)) : "?",
          gpx: evidence.getPublicUrl(`${base}.gpx`).data.publicUrl,
        }),
      );
      const response = await proposePenalty(null, form);
      if (!response?.ok) throw new Error(response && !response.ok ? response.error : dict.admin.errors.invalid);
      setProposed((current) => ({ ...current, [index]: text.proposed }));
    });

  function incidentLabel(incident: Incident) {
    return incident.kind === "missed_waypoint" ? `${text.kinds.missed_waypoint} ${incident.waypoint ?? ""}` : text.kinds[incident.kind];
  }

  const control = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{text.intro}</p>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">
            {text.stage}
            <select
              className={control}
              value={stageId ?? ""}
              onChange={(e) => {
                setStageId(Number(e.target.value));
                resetAnalysis();
              }}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            {text.class}
            <select
              className={control}
              value={classId ?? ""}
              onChange={(e) => {
                setClassId(e.target.value ? Number(e.target.value) : null);
                resetAnalysis();
              }}
            >
              <option value="">{text.allClasses}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="mb-2 text-sm font-semibold">{text.officialTrack}</h2>
        <p className="mb-3 text-sm text-muted">
          {track
            ? t(text.trackInfo, { name: track.name, points: track.point_count, km: ((track.length_m ?? 0) / 1000).toFixed(1) })
            : text.noTrack}
        </p>
        <label className="text-xs text-muted">
          {text.uploadTrack}
          <input
            type="file"
            name="official_gpx"
            accept=".gpx,application/gpx+xml"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && uploadOfficial(e.target.files[0])}
            className="mt-1 block text-sm"
          />
        </label>

        {track && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{text.waypoints}</h3>
            <p className="mb-2 text-xs text-muted">{text.waypointsHelp}</p>
            {official ? (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {official.waypoints.map((w) => (
                    <label key={`${w.name}-${w.lat}`} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={mandatoryNames.includes(w.name)}
                        onChange={(e) =>
                          setMandatory(e.target.checked ? [...mandatoryNames, w.name] : mandatoryNames.filter((name) => name !== w.name))
                        }
                      />
                      {w.name}
                    </label>
                  ))}
                </div>
                <button type="button" onClick={saveWaypoints} disabled={busy} className="mt-2 rounded border border-border px-3 py-1 text-xs">
                  {text.saveWaypoints}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => run(async () => void (await loadOfficial()))} disabled={busy} className="rounded border border-border px-3 py-1 text-xs">
                {mandatoryNames.length ? mandatoryNames.join(", ") : "…"}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">{text.riderCheck}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            {text.raceNumber}
            <input type="number" min={1} name="gps_race_number" value={raceNumber} onChange={(e) => setRaceNumber(e.target.value)} className={control} />
            <span className="mt-1 block h-4 text-foreground">
              {entries.find((row) => row.race_number === Number(raceNumber))?.name ?? ""}
            </span>
          </label>
          <label className="text-xs text-muted">
            {text.riderFile}
            <input
              type="file"
              name="rider_gpx"
              accept=".gpx,application/gpx+xml"
              onChange={(e) => setRiderFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={analyse}
              disabled={busy || !riderFile || !track}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {busy ? text.working : text.analyse}
            </button>
          </div>
        </div>

        {message && (
          <p role={message.tone === "bad" ? "alert" : "status"} className={`mt-3 text-sm ${message.tone === "good" ? "text-good" : "text-bad"}`}>
            {message.text}
          </p>
        )}

        {result && official && rider && (
          <div className="mt-4">
            <p className="mb-3 text-sm">
              {t(text.summary, { km: (result.riderDistanceM / 1000).toFixed(1), m: Math.round(result.maxDeviationM) })}
            </p>
            {!result.incidents.length && <p className="text-sm text-good">{text.noIncidents}</p>}
            <ul className="space-y-6">
              {result.incidents.map((incident, index) => {
                const type = penaltyTypes.find((row) => row.code === incident.penaltyCode);
                const title = `#${raceNumber} · ${incidentLabel(incident)} · ${t(text.distance, { m: Math.round(incident.distanceM) })}`;
                return (
                  <li key={`${incident.kind}-${incident.startIndex}`} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2 text-sm">
                      <div>
                        <div className="font-medium">{incidentLabel(incident)}</div>
                        <div className="text-xs text-muted">
                          {t(text.distance, { m: Math.round(incident.distanceM) })}
                          {incident.kind === "deviation" && ` · ${t(text.offTrack, { m: Math.round(incident.lengthM) })}`}
                          {incident.startTime && ` · ${formatClock(new Date(incident.startTime))}`}
                          {incident.endTime && incident.endTime !== incident.startTime && `–${formatClock(new Date(incident.endTime))}`}
                        </div>
                        <div className="text-xs">{type ? type.name : text.belowThreshold}</div>
                      </div>
                      {proposed[index] ? (
                        <span className="text-xs text-good">{proposed[index]}</span>
                      ) : (
                        type && (
                          <button
                            type="button"
                            onClick={() => propose(index, incident)}
                            disabled={busy}
                            className="rounded border border-bad px-3 py-1 text-xs font-medium text-bad disabled:opacity-50"
                          >
                            {text.propose}
                          </button>
                        )
                      )}
                    </div>
                    <IncidentMap
                      id={`incident-map-${index}`}
                      official={official.points}
                      rider={rider}
                      waypoints={official.waypoints}
                      incident={incident}
                      title={title}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/** Draws the SVG onto a canvas at twice its size and returns a PNG. */
async function svgToPng(svg: SVGSVGElement): Promise<Blob> {
  const markup = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("map rendering failed"));
      img.src = url;
    });
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.scale(2, 2);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The rider's log around the incident as its own GPX, published next to the screenshot (Р XIX.10). */
function gpxExcerpt(points: TrackPoint[], start: number, end: number, name: string): string {
  const from = Math.max(0, start - 60);
  const to = Math.min(points.length - 1, end + 60);
  const body = points
    .slice(from, to + 1)
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.time ? `<time>${new Date(p.time).toISOString()}</time>` : ""}</trkpt>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="TodorovNET" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${body}</trkseg></trk></gpx>`;
}
