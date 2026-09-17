import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PositionBadge } from "@/components/brand/status-badge";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

async function loadRider(riderId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("riders").select("id, first_name, last_name, country, clubs(name)").eq("id", riderId).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[riderId]">): Promise<Metadata> {
  const { lang, riderId } = await params;
  const rider = await loadRider(Number(riderId));
  if (!rider || !hasLocale(lang)) return {};
  return { title: riderName(rider.first_name, rider.last_name, lang) };
}

/** Public rider profile: club, season numbers, round results and championship positions. No personal data. */
export default async function RiderPage({ params }: PageProps<"/[lang]/r/[riderId]">) {
  const { lang, riderId: rawId } = await params;
  if (!hasLocale(lang)) notFound();
  const riderId = Number(rawId);
  if (!Number.isInteger(riderId)) notFound();
  const dict = getDictionary(lang);
  const p = dict.rider;

  const rider = await loadRider(riderId);
  if (!rider) notFound();
  const supabase = await createClient();

  const [{ data: numbers }, { data: rounds }, { data: standings }] = await Promise.all([
    supabase.from("season_numbers").select("race_number, seasons(id, year)").eq("rider_id", riderId),
    supabase.from("round_results").select("event_id, class_id, position, total_points").eq("rider_id", riderId),
    supabase.from("season_standings").select("season_id, class_id, position, position_gross, net_points, gross_points, drop_applies").eq("rider_id", riderId),
  ]);

  const eventIds = [...new Set((rounds ?? []).map((row) => row.event_id).filter((id): id is number => id != null))];
  const classIds = [
    ...new Set([...(rounds ?? []), ...(standings ?? [])].map((row) => row.class_id).filter((id): id is number => id != null)),
  ];
  const [{ data: events }, { data: classes }, { data: seasons }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, name, location, date_from, date_to, round_number, status").in("id", eventIds).neq("status", "draft")
      : Promise.resolve({ data: [] as { id: number; name: string; location: string; date_from: string; date_to: string; round_number: number | null; status: string }[] }),
    classIds.length
      ? supabase.from("classes").select("id, name, name_en").in("id", classIds)
      : Promise.resolve({ data: [] as { id: number; name: string; name_en: string | null }[] }),
    supabase.from("seasons").select("id, year"),
  ]);
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const className = new Map((classes ?? []).map((cls) => [cls.id, localizedName(cls, lang)]));
  const seasonYear = new Map((seasons ?? []).map((season) => [season.id, season.year]));
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  const resultRows = (rounds ?? [])
    .flatMap((row) => {
      const event = row.event_id != null ? eventById.get(row.event_id) : undefined;
      return event ? [{ ...row, event }] : [];
    })
    .sort((a, b) => b.event.date_from.localeCompare(a.event.date_from));

  const scored = resultRows.filter((row) => row.total_points);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/20 via-card to-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <span className="rise font-display grid size-24 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-4xl font-bold text-accent-foreground shadow-[0_10px_40px_-10px_var(--accent)]">
              {(rider.first_name[0] ?? "") + (rider.last_name[0] ?? "")}
            </span>
            <div className="min-w-0">
              <h1 className="rise font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl" style={{ "--d": "80ms" } as React.CSSProperties}>
                {riderName(rider.first_name, rider.last_name, lang)}
              </h1>
              <p className="rise mt-2 text-muted" style={{ "--d": "140ms" } as React.CSSProperties}>
                {[rider.clubs?.name ? text(rider.clubs.name) : null, rider.country].filter(Boolean).join(" · ")}
              </p>
              <div className="rise mt-3 flex flex-wrap gap-2 text-sm" style={{ "--d": "180ms" } as React.CSSProperties}>
                {(numbers ?? []).map((row) =>
                  row.seasons ? (
                    <Link
                      key={row.seasons.id}
                      href={`/${lang}/s/${row.seasons.id}/numbers`}
                      className="font-display rounded-md border border-white/15 bg-black/30 px-2.5 py-0.5 font-bold hover:border-accent"
                    >
                      {t(p.seasonNumber, { number: row.race_number, year: row.seasons.year })}
                    </Link>
                  ) : null,
                )}
              </div>
            </div>
          </div>
          <dl className="rise mt-6 grid grid-cols-4 gap-2" style={{ "--d": "240ms" } as React.CSSProperties}>
            {[
              { label: p.statRounds, value: scored.length },
              { label: p.statWins, value: scored.filter((row) => row.position === 1).length },
              { label: p.statPodiums, value: scored.filter((row) => (row.position ?? 99) <= 3).length },
              { label: p.statBest, value: scored.length ? `${Math.min(...scored.map((row) => row.position ?? 99))}.` : "–" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/60">{stat.label}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(standings ?? []).length > 0 && (
          <section className="mt-6">
            <h2 className="font-display mb-3 text-2xl font-bold uppercase tracking-wide">{p.standings}</h2>
            <ul className="space-y-1 text-sm">
              {(standings ?? []).map((row) => (
                <li key={`${row.season_id}-${row.class_id}`}>
                  <Link href={`/${lang}/s/${row.season_id}`} className="hover:underline">
                    {seasonYear.get(row.season_id ?? 0)} · {className.get(row.class_id ?? 0)} ·{" "}
                    <span className="font-semibold">{row.drop_applies ? row.position : row.position_gross}.</span>{" "}
                    {row.drop_applies ? row.net_points : row.gross_points} {p.points.toLowerCase()}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h2 className="font-display mb-3 text-2xl font-bold uppercase tracking-wide">{p.results}</h2>
          {!resultRows.length ? (
            <p className="text-sm text-muted">{p.noResults}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card px-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-[0.7rem] uppercase tracking-wider text-muted">
                    <th className="py-2 pr-2 text-left font-medium">{p.event}</th>
                    <th className="py-2 pr-2 text-left font-medium">{p.class}</th>
                    <th className="py-2 pr-2 text-right font-medium">{p.position}</th>
                    <th className="py-2 text-right font-medium">{p.points}</th>
                  </tr>
                </thead>
                <tbody className="row-in">
                  {resultRows.map((row) => (
                    <tr key={`${row.event_id}-${row.class_id}`} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
                      <td className="py-2 pr-2">
                        <Link href={`/${lang}/e/${row.event.id}?stage=round`} className="font-medium hover:underline">
                          {text(row.event.name)}
                        </Link>
                        <div className="text-xs text-muted">
                          {[text(row.event.location), formatDateRange(row.event.date_from, row.event.date_to, lang)].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-muted">{className.get(row.class_id ?? 0)}</td>
                      <td className="py-2 pr-2 text-right font-semibold tabular-nums">{row.total_points ? <PositionBadge position={row.position} /> : "–"}</td>
                      <td className="py-2 text-right tabular-nums">{row.total_points || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
