import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

// Shared by the server (first render) and the browser (live refresh), so both show the same thing.

type Client = SupabaseClient<Database>;

export type ClassInfo = {
  id: number;
  code: string;
  name: string;
  name_en: string | null;
  number_bg: string | null;
  number_fg: string | null;
};

export type EntryInfo = {
  id: number;
  race_number: number;
  class_id: number;
  first_name: string;
  last_name: string;
  country: string;
  club: string | null;
};

export type NavigationRow = Tables<"navigation_results"> & {
  last_checkpoint: { code: string; split_s: number; sort_order: number } | null;
};

export type StageView =
  | { kind: "navigation"; rows: NavigationRow[] }
  | { kind: "enduro_cross"; overall: Tables<"enduro_cross_results">[]; sessions: Tables<"session_results">[] }
  | { kind: "round"; rows: Tables<"round_results">[] };

export type StageSelector = { kind: "navigation" | "enduro_cross"; stageId: number } | { kind: "round" };

export async function loadClasses(supabase: Client, eventId: number): Promise<ClassInfo[]> {
  const { data, error } = await supabase
    .from("event_classes")
    .select("start_order, classes(id, code, name, name_en, number_bg, number_fg)")
    .eq("event_id", eventId)
    .order("start_order");
  if (error) throw error;
  return (data ?? []).flatMap((row) => (row.classes ? [row.classes] : []));
}

export async function loadEntries(supabase: Client, eventId: number): Promise<EntryInfo[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, race_number, class_id, riders(first_name, last_name, country), clubs(name)")
    .eq("event_id", eventId)
    .eq("withdrawn", false)
    .order("race_number");
  if (error) throw error;
  return (data ?? []).map((entry) => ({
    id: entry.id,
    race_number: entry.race_number,
    class_id: entry.class_id,
    first_name: entry.riders?.first_name ?? "",
    last_name: entry.riders?.last_name ?? "",
    country: entry.riders?.country ?? "",
    club: entry.clubs?.name ?? null,
  }));
}

export async function loadView(supabase: Client, eventId: number, selector: StageSelector): Promise<StageView> {
  if (selector.kind === "round") {
    const { data, error } = await supabase.from("round_results").select("*").eq("event_id", eventId);
    if (error) throw error;
    return { kind: "round", rows: data ?? [] };
  }

  if (selector.kind === "enduro_cross") {
    const [overall, sessions] = await Promise.all([
      supabase.from("enduro_cross_results").select("*").eq("stage_id", selector.stageId),
      supabase.from("session_results").select("*").eq("stage_id", selector.stageId),
    ]);
    if (overall.error) throw overall.error;
    if (sessions.error) throw sessions.error;
    return { kind: "enduro_cross", overall: overall.data ?? [], sessions: sessions.data ?? [] };
  }

  const [results, splits] = await Promise.all([
    supabase.from("navigation_results").select("*").eq("stage_id", selector.stageId),
    supabase
      .from("navigation_splits")
      .select("entry_id, checkpoint_code, sort_order, split_s")
      .eq("stage_id", selector.stageId),
  ]);
  if (results.error) throw results.error;
  if (splits.error) throw splits.error;

  const lastSplit = new Map<number, { code: string; split_s: number; sort_order: number }>();
  for (const split of splits.data ?? []) {
    if (split.entry_id == null) continue;
    const current = lastSplit.get(split.entry_id);
    const order = split.sort_order ?? 0;
    if (!current || order > current.sort_order) {
      lastSplit.set(split.entry_id, { code: split.checkpoint_code ?? "", split_s: split.split_s ?? 0, sort_order: order });
    }
  }

  return {
    kind: "navigation",
    rows: (results.data ?? []).map((row) => ({
      ...row,
      last_checkpoint: row.entry_id != null ? (lastSplit.get(row.entry_id) ?? null) : null,
    })),
  };
}
