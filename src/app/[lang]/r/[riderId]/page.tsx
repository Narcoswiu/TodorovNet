import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{riderName(rider.first_name, rider.last_name, lang)}</h1>
        <p className="mt-1 text-sm text-muted">
          {[rider.clubs?.name ? text(rider.clubs.name) : null, rider.country].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {(numbers ?? []).map((row) =>
            row.seasons ? (
              <Link key={row.seasons.id} href={`/${lang}/s/${row.seasons.id}/numbers`} className="rounded border border-border px-2 py-0.5">
                {t(p.seasonNumber, { number: row.race_number, year: row.seasons.year })}
              </Link>
            ) : null,
          )}
        </div>

        {(standings ?? []).length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{p.standings}</h2>
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
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{p.results}</h2>
          {!resultRows.length ? (
            <p className="text-sm text-muted">{p.noResults}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="py-2 pr-2 text-left font-medium">{p.event}</th>
                    <th className="py-2 pr-2 text-left font-medium">{p.class}</th>
                    <th className="py-2 pr-2 text-right font-medium">{p.position}</th>
                    <th className="py-2 text-right font-medium">{p.points}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.map((row) => (
                    <tr key={`${row.event_id}-${row.class_id}`} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <Link href={`/${lang}/e/${row.event.id}?stage=round`} className="font-medium hover:underline">
                          {text(row.event.name)}
                        </Link>
                        <div className="text-xs text-muted">
                          {[text(row.event.location), formatDateRange(row.event.date_from, row.event.date_to, lang)].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-muted">{className.get(row.class_id ?? 0)}</td>
                      <td className="py-2 pr-2 text-right font-semibold tabular-nums">{row.total_points ? row.position : "–"}</td>
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
