import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Championship standings for one season, shared by the public page and its PDF so both always agree.

type Client = SupabaseClient<Database>;

export type SeasonClass = {
  id: number;
  code: string;
  name: string;
  name_en: string | null;
  number_bg: string | null;
  number_fg: string | null;
};

export type SeasonRound = { id: number; name: string; location: string; round_number: number | null };

export type SeasonRiderRow = {
  rider_id: number;
  class_id: number;
  first_name: string;
  last_name: string;
  club: string | null;
  rounds_ridden: number;
  gross_points: number;
  net_points: number;
  /** Final rule when the worst-round drop applies, otherwise the interim sum. */
  position: number;
  /** Points per round, keyed by event id. */
  rounds: Record<number, number>;
};

export type SeasonTeamRow = {
  club_id: number;
  club: string;
  position: number;
  team_points: number;
  rounds: Record<number, number>;
};

export type SeasonStandings = {
  season: { id: number; year: number; name: string; drop_worst_rounds: number };
  rounds: SeasonRound[];
  classes: SeasonClass[];
  dropApplies: boolean;
  riders: SeasonRiderRow[];
  teams: SeasonTeamRow[];
};

export async function loadSeasonStandings(supabase: Client, seasonId: number): Promise<SeasonStandings | null> {
  const { data: season } = await supabase
    .from("seasons")
    .select("id, year, name, drop_worst_rounds")
    .eq("id", seasonId)
    .maybeSingle();
  if (!season) return null;

  const [{ data: rounds }, { data: classes }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, location, round_number")
      .eq("season_id", seasonId)
      .eq("kind", "championship_round")
      .in("status", ["live", "finished"])
      .order("round_number"),
    supabase
      .from("classes")
      .select("id, code, name, name_en, number_bg, number_fg")
      .eq("season_id", seasonId)
      .order("sort_order"),
  ]);
  const eventIds = (rounds ?? []).map((round) => round.id);
  const empty: SeasonStandings = { season, rounds: [], classes: classes ?? [], dropApplies: false, riders: [], teams: [] };
  if (!eventIds.length) return empty;

  const [{ data: standings }, { data: riderRounds }, { data: teamStandings }, { data: teamRounds }] = await Promise.all([
    supabase
      .from("season_standings")
      .select("rider_id, class_id, rounds_ridden, gross_points, net_points, position, position_gross, drop_applies")
      .eq("season_id", seasonId),
    // A season has thousands of round results, past the API's 1000-row page: read them page by page.
    allRows((from, to) =>
      supabase.from("round_results").select("event_id, rider_id, class_id, total_points").in("event_id", eventIds).order("entry_id").range(from, to),
    ),
    supabase.from("team_season_standings").select("club_id, team_points, position").eq("season_id", seasonId),
    allRows((from, to) =>
      supabase.from("team_round_results").select("event_id, club_id, team_points").in("event_id", eventIds).order("club_id").order("event_id").range(from, to),
    ),
  ]);

  const riderIds = [...new Set((standings ?? []).map((row) => row.rider_id).filter((id): id is number => id != null))];
  const clubIds = [...new Set((teamStandings ?? []).map((row) => row.club_id).filter((id): id is number => id != null))];
  const [{ data: riders }, { data: clubs }] = await Promise.all([
    riderIds.length
      ? supabase.from("riders").select("id, first_name, last_name, clubs(name)").in("id", riderIds)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string; clubs: { name: string } | null }[] }),
    clubIds.length
      ? supabase.from("clubs").select("id, name").in("id", clubIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ]);

  const riderById = new Map((riders ?? []).map((rider) => [rider.id, rider]));
  const clubName = new Map((clubs ?? []).map((club) => [club.id, club.name]));
  const dropApplies = (standings ?? []).some((row) => row.drop_applies);

  const riderRows: SeasonRiderRow[] = (standings ?? []).flatMap((row) => {
    if (row.rider_id == null || row.class_id == null) return [];
    const rider = riderById.get(row.rider_id);
    const perRound: Record<number, number> = {};
    for (const result of riderRounds ?? []) {
      if (result.rider_id === row.rider_id && result.class_id === row.class_id && result.event_id != null) {
        perRound[result.event_id] = result.total_points ?? 0;
      }
    }
    return [
      {
        rider_id: row.rider_id,
        class_id: row.class_id,
        first_name: rider?.first_name ?? "",
        last_name: rider?.last_name ?? "",
        club: rider?.clubs?.name ?? null,
        rounds_ridden: row.rounds_ridden ?? 0,
        gross_points: row.gross_points ?? 0,
        net_points: row.net_points ?? 0,
        position: (dropApplies ? row.position : row.position_gross) ?? 0,
        rounds: perRound,
      },
    ];
  });

  const teamRows: SeasonTeamRow[] = (teamStandings ?? []).flatMap((row) => {
    if (row.club_id == null) return [];
    const perRound: Record<number, number> = {};
    for (const result of teamRounds ?? []) {
      if (result.club_id === row.club_id && result.event_id != null) perRound[result.event_id] = result.team_points ?? 0;
    }
    return [{ club_id: row.club_id, club: clubName.get(row.club_id) ?? "", position: row.position ?? 0, team_points: row.team_points ?? 0, rounds: perRound }];
  });

  return {
    season,
    rounds: rounds ?? [],
    classes: classes ?? [],
    dropApplies,
    riders: riderRows.sort((a, b) => a.position - b.position),
    teams: teamRows.sort((a, b) => a.position - b.position),
  };
}

const PAGE = 1000;

/** Reads every row of a query in pages of 1000, the most the API returns at once. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[] }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: rows };
  }
}
