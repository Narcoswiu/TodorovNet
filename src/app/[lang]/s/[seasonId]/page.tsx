import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { numberPlateStyle } from "@/lib/classes";
import { createClient } from "@/lib/supabase/server";

async function loadSeason(seasonId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("id, year, name, drop_worst_rounds").eq("id", seasonId).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/s/[seasonId]">): Promise<Metadata> {
  const { lang, seasonId } = await params;
  const season = await loadSeason(Number(seasonId));
  if (!season || !hasLocale(lang)) return {};
  return { title: t(getDictionary(lang).season.heading, { year: season.year }) };
}

export default async function SeasonPage({ params, searchParams }: PageProps<"/[lang]/s/[seasonId]">) {
  const { lang, seasonId: rawId } = await params;
  if (!hasLocale(lang)) notFound();
  const seasonId = Number(rawId);
  if (!Number.isInteger(seasonId)) notFound();
  const dict = getDictionary(lang);
  const s = dict.season;

  const season = await loadSeason(seasonId);
  if (!season) notFound();

  const { view } = await searchParams;
  const showTeams = view === "team";
  const supabase = await createClient();

  const [{ data: events }, { data: classes }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, location, round_number, status")
      .eq("season_id", seasonId)
      .eq("kind", "championship_round")
      .in("status", ["live", "finished"])
      .order("round_number"),
    supabase.from("classes").select("id, code, name, name_en, number_bg, number_fg, sort_order").eq("season_id", seasonId).order("sort_order"),
  ]);
  const eventIds = (events ?? []).map((event) => event.id);
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-foreground text-background" : "text-muted hover:bg-card hover:text-foreground"}`;

  let body: React.ReactNode;

  if (!eventIds.length) {
    body = <p className="text-muted">{s.noData}</p>;
  } else if (showTeams) {
    const [{ data: standings }, { data: perRound }] = await Promise.all([
      supabase.from("team_season_standings").select("club_id, rounds_scored, team_points, position").eq("season_id", seasonId).order("position"),
      supabase.from("team_round_results").select("event_id, club_id, team_points").in("event_id", eventIds),
    ]);
    const clubIds = (standings ?? []).map((row) => row.club_id).filter((id): id is number => id != null);
    const { data: clubs } = clubIds.length
      ? await supabase.from("clubs").select("id, name").in("id", clubIds)
      : { data: [] as { id: number; name: string }[] };
    const clubName = new Map((clubs ?? []).map((club) => [club.id, club.name]));
    const points = new Map((perRound ?? []).map((row) => [`${row.event_id}:${row.club_id}`, row.team_points]));

    body = (
      <>
        <p className="mb-3 text-xs text-muted">{s.teamNote}</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.pos}</th>
                <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{s.club}</th>
                {(events ?? []).map((event) => (
                  <th key={event.id} className="whitespace-nowrap py-2 pr-2 text-right font-medium" title={text(event.name)}>
                    {t(s.round, { n: event.round_number ?? "?" })}
                  </th>
                ))}
                <th className="whitespace-nowrap py-2 text-right font-medium">{dict.results.total}</th>
              </tr>
            </thead>
            <tbody>
              {(standings ?? []).map((row) => (
                <tr key={row.club_id} className="border-t border-border">
                  <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.position}</td>
                  <td className="w-full py-2 pr-2 font-medium">{text(clubName.get(row.club_id ?? 0) ?? "")}</td>
                  {(events ?? []).map((event) => (
                    <td key={event.id} className="py-2 pr-2 text-right tabular-nums text-muted">
                      {points.get(`${event.id}:${row.club_id}`) ?? "–"}
                    </td>
                  ))}
                  <td className="py-2 text-right font-semibold tabular-nums">{row.team_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else {
    const [{ data: standings }, { data: perRound }] = await Promise.all([
      supabase
        .from("season_standings")
        .select("rider_id, class_id, rounds_held, rounds_ridden, gross_points, net_points, position, position_gross, drop_applies")
        .eq("season_id", seasonId),
      supabase.from("round_results").select("event_id, rider_id, class_id, total_points").in("event_id", eventIds),
    ]);
    const riderIds = [...new Set((standings ?? []).map((row) => row.rider_id).filter((id): id is number => id != null))];
    const { data: riders } = riderIds.length
      ? await supabase.from("riders").select("id, first_name, last_name, clubs(name)").in("id", riderIds)
      : { data: [] };
    const riderById = new Map((riders ?? []).map((rider) => [rider.id, rider]));
    const points = new Map((perRound ?? []).map((row) => [`${row.event_id}:${row.rider_id}:${row.class_id}`, row.total_points]));
    const dropApplies = (standings ?? []).some((row) => row.drop_applies);

    body = (
      <>
        <p className="mb-4 text-xs text-muted">
          {dropApplies ? s.finalNote : t(s.interimNote, { n: (season.drop_worst_rounds ?? 1) + 1 })}
        </p>
        {(classes ?? []).map((cls) => {
          const rows = (standings ?? [])
            .filter((row) => row.class_id === cls.id)
            .sort((a, b) => (dropApplies ? (a.position ?? 0) - (b.position ?? 0) : (a.position_gross ?? 0) - (b.position_gross ?? 0)));
          if (!rows.length) return null;
          return (
            <section key={cls.id} className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <span className="inline-block size-3 rounded-sm border border-border" style={numberPlateStyle(cls.number_bg, cls.number_fg)} aria-hidden />
                {localizedName(cls, lang)}
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.pos}</th>
                      <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{dict.results.rider}</th>
                      {(events ?? []).map((event) => (
                        <th key={event.id} className="hidden whitespace-nowrap py-2 pr-2 text-right font-medium sm:table-cell" title={text(event.name)}>
                          {t(s.round, { n: event.round_number ?? "?" })}
                        </th>
                      ))}
                      <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{s.gross}</th>
                      {dropApplies && <th className="whitespace-nowrap py-2 text-right font-medium">{s.net}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rider = riderById.get(row.rider_id ?? 0);
                      return (
                        <tr key={row.rider_id} className="border-t border-border">
                          <td className="py-2 pr-2 text-right font-medium tabular-nums">{dropApplies ? row.position : row.position_gross}</td>
                          <td className="w-full py-2 pr-2">
                            <div className="font-medium leading-tight">{rider ? riderName(rider.first_name, rider.last_name, lang) : ""}</div>
                            {rider?.clubs?.name && <div className="text-xs text-muted">{text(rider.clubs.name)}</div>}
                          </td>
                          {(events ?? []).map((event) => (
                            <td key={event.id} className="hidden py-2 pr-2 text-right tabular-nums text-muted sm:table-cell">
                              {points.get(`${event.id}:${row.rider_id}:${row.class_id}`) ?? "–"}
                            </td>
                          ))}
                          <td className={`py-2 pr-2 text-right tabular-nums ${dropApplies ? "text-muted" : "font-semibold"}`}>{row.gross_points}</td>
                          {dropApplies && <td className="py-2 text-right font-semibold tabular-nums">{row.net_points}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </>
    );
  }

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t(s.heading, { year: season.year })}</h1>
        <p className="mb-5 text-sm text-muted">{season.name}</p>
        <nav className="mb-4 flex gap-1">
          <Link href="?" className={tab(!showTeams)}>
            {s.individual}
          </Link>
          <Link href="?view=team" className={tab(showTeams)}>
            {s.team}
          </Link>
        </nav>
        {body}
      </main>
    </>
  );
}
