"use server";

import { refresh } from "next/cache";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { explainDbError } from "@/lib/admin/action-result";
import { isValidId } from "@/lib/admin/form";
import { getViewer } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

export type StageTrackInput = {
  eventId: number;
  stageId: number;
  classId: number | null;
  name: string;
  storagePath: string;
  pointCount: number;
  lengthM: number;
  mandatoryWaypoints: string[];
};

/** Records (or replaces) the official track after the browser has uploaded the file to storage. */
export async function saveStageTrack(lang: string, input: StageTrackInput): Promise<Result> {
  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (
    !isValidId(input.eventId) ||
    !isValidId(input.stageId) ||
    (input.classId !== null && !isValidId(input.classId)) ||
    !input.storagePath.startsWith(`events/${input.eventId}/`) ||
    !Array.isArray(input.mandatoryWaypoints)
  ) {
    return { ok: false, error: dict.admin.errors.invalid };
  }

  const { error } = await viewer.supabase.from("stage_tracks").upsert(
    {
      event_id: input.eventId,
      stage_id: input.stageId,
      class_id: input.classId,
      name: input.name.slice(0, 200),
      storage_path: input.storagePath,
      point_count: Math.max(0, Math.round(input.pointCount)),
      length_m: Math.round(input.lengthM * 10) / 10,
      mandatory_waypoints: input.mandatoryWaypoints.map((name) => String(name).slice(0, 100)),
      uploaded_by: viewer.userId,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "stage_id,class_id" },
  );
  if (error) return { ok: false, error: explainDbError(error, dict) };

  refresh();
  return { ok: true };
}

export async function setMandatoryWaypoints(lang: string, trackId: number, names: string[]): Promise<Result> {
  const dict = getDictionary(hasLocale(lang) ? lang : defaultLocale);
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: dict.admin.errors.forbidden };
  if (!isValidId(trackId) || !Array.isArray(names)) return { ok: false, error: dict.admin.errors.invalid };

  const { data, error } = await viewer.supabase
    .from("stage_tracks")
    .update({ mandatory_waypoints: names.map((name) => String(name).slice(0, 100)) })
    .eq("id", trackId)
    .select("id");
  if (error) return { ok: false, error: explainDbError(error, dict) };
  if (!data?.length) return { ok: false, error: dict.admin.errors.forbidden };

  refresh();
  return { ok: true };
}
