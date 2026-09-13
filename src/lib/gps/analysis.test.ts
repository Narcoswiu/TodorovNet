// Unit tests for the GPS track check. Run: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyseRiderTrack,
  deviationPenaltyCode,
  gapPenaltyCode,
  haversineM,
  parseGpxPoints,
  parseGpxWaypoints,
  type TrackPoint,
} from "./analysis.ts";

// Synthetic course near Kirkovo: a straight line 5 km due east. One degree of longitude there is ≈ 88 km.
const LAT = 41.33;
const LON = 25.36;
const metresToLat = (m: number) => m / 111_195;
const metresToLon = (m: number) => m / (111_195 * Math.cos((LAT * Math.PI) / 180));

function straightTrack(lengthM: number, stepM: number): TrackPoint[] {
  return Array.from({ length: Math.floor(lengthM / stepM) + 1 }, (_, i) => ({ lat: LAT, lon: LON + metresToLon(i * stepM), time: null }));
}

/** A rider log every 10 m / 2 s along the course, pushed `offsetM` north between two distances. */
function riderLog(offsetM: number, fromM: number, toM: number, gap?: { fromM: number; toM: number }): TrackPoint[] {
  const points: TrackPoint[] = [];
  const start = Date.parse("2026-09-26T07:00:00Z");
  for (let m = 0, i = 0; m <= 5000; m += 10, i++) {
    if (gap && m > gap.fromM && m < gap.toM) continue;
    const north = m >= fromM && m <= toM ? offsetM : 5;
    points.push({ lat: LAT + metresToLat(north), lon: LON + metresToLon(m), time: start + i * 2000 });
  }
  return points;
}

describe("penalty brackets (Р XIX.4)", () => {
  it("maps distances to the rulebook brackets", () => {
    assert.equal(deviationPenaltyCode(80), null);
    assert.equal(deviationPenaltyCode(100), "track_dev_100_500");
    assert.equal(deviationPenaltyCode(500), "track_dev_100_500");
    assert.equal(deviationPenaltyCode(501), "track_dev_500_1000");
    assert.equal(deviationPenaltyCode(1001), "track_dev_over_1000");
    assert.equal(gapPenaltyCode(400), "gps_gap_100_500");
    assert.equal(gapPenaltyCode(1500), "gps_gap_over_1000");
  });
});

describe("analyseRiderTrack", () => {
  const official = straightTrack(5000, 50);

  it("finds nothing for a rider who stays on track", () => {
    const result = analyseRiderTrack(official, riderLog(5, 0, 0));
    assert.equal(result.incidents.length, 0);
    assert.ok(result.maxDeviationM < 10, `max deviation ${result.maxDeviationM}`);
    assert.ok(Math.abs(result.riderDistanceM - 5000) < 50, `ridden ${result.riderDistanceM}`);
  });

  for (const [offset, code] of [
    [300, "track_dev_100_500"],
    [800, "track_dev_500_1000"],
    [1200, "track_dev_over_1000"],
  ] as const) {
    it(`classifies a ${offset} m deviation as ${code}`, () => {
      const result = analyseRiderTrack(official, riderLog(offset, 2000, 2600));
      const deviations = result.incidents.filter((incident) => incident.kind === "deviation");
      assert.equal(deviations.length, 1);
      assert.equal(deviations[0].penaltyCode, code);
      assert.ok(Math.abs(deviations[0].distanceM - offset) < offset * 0.02, `distance ${deviations[0].distanceM}`);
      assert.ok(deviations[0].startTime! < deviations[0].endTime!, "times in order");
    });
  }

  it("does not split one deviation when the log briefly touches the track", () => {
    const log = riderLog(300, 2000, 2600);
    const middle = log.findIndex((point) => point.lon >= LON + metresToLon(2300));
    log[middle] = { ...log[middle], lat: LAT };
    const result = analyseRiderTrack(official, log);
    assert.equal(result.incidents.filter((incident) => incident.kind === "deviation").length, 1);
  });

  it("reports a signal gap with its length", () => {
    const result = analyseRiderTrack(official, riderLog(5, 0, 0, { fromM: 3000, toM: 3400 }));
    const gaps = result.incidents.filter((incident) => incident.kind === "signal_gap");
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].penaltyCode, "gps_gap_100_500");
    assert.ok(Math.abs(gaps[0].distanceM - 400) < 15, `gap ${gaps[0].distanceM}`);
  });

  it("does not call fast riding a signal gap", () => {
    const log = riderLog(5, 0, 0);
    // 150 m between two points but only 5 s apart: a sample dropped at speed, not a missing log.
    const quick = [log[0], { ...log[15], time: log[0].time! + 5000 }];
    const result = analyseRiderTrack(official, quick);
    assert.equal(result.incidents.filter((incident) => incident.kind === "signal_gap").length, 0);
  });

  it("flags a mandatory waypoint the rider never reached", () => {
    const onCourse = { name: "SS_START 1", lat: LAT, lon: LON + metresToLon(1000) };
    const offCourse = { name: "CP2", lat: LAT + metresToLat(400), lon: LON + metresToLon(4000) };
    const result = analyseRiderTrack(official, riderLog(5, 0, 0), [onCourse, offCourse]);
    const missed = result.incidents.filter((incident) => incident.kind === "missed_waypoint");
    assert.equal(missed.length, 1);
    assert.equal(missed[0].waypoint, "CP2");
    assert.equal(missed[0].penaltyCode, "missed_control");
  });

  it("stays fast on a long log", () => {
    const longOfficial = straightTrack(60_000, 20);
    const log: TrackPoint[] = Array.from({ length: 30_000 }, (_, i) => ({ lat: LAT + metresToLat(8), lon: LON + metresToLon(i * 2), time: i * 1000 }));
    const started = performance.now();
    const result = analyseRiderTrack(longOfficial, log);
    const elapsed = performance.now() - started;
    assert.equal(result.incidents.length, 0);
    assert.ok(elapsed < 3000, `took ${Math.round(elapsed)} ms`);
  });
});

describe("GPX parsing", () => {
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin">
  <wpt lat="41.3300" lon="25.3700"><name>SS_START &amp; CP1</name></wpt>
  <trk><name>Pro</name><trkseg>
    <trkpt lat="41.3300" lon="25.3600"><ele>520</ele><time>2026-09-26T07:00:00Z</time></trkpt>
    <trkpt lon='25.3610' lat='41.3301'><time>2026-09-26T07:00:05Z</time></trkpt>
    <trkpt lat="41.3302" lon="25.3620"/>
  </trkseg></trk>
</gpx>`;

  it("reads track points in order, with and without times, whatever the attribute order", () => {
    const points = parseGpxPoints(gpx);
    assert.equal(points.length, 3);
    assert.deepEqual(points[1], { lat: 41.3301, lon: 25.361, time: Date.parse("2026-09-26T07:00:05Z") });
    assert.equal(points[2].time, null);
    assert.ok(haversineM(points[0], points[1]) > 80);
  });

  it("reads named waypoints and decodes entities", () => {
    assert.deepEqual(parseGpxWaypoints(gpx), [{ name: "SS_START & CP1", lat: 41.33, lon: 25.37 }]);
  });
});
