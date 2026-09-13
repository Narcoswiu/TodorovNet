import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { numberPlateStyle } from "@/lib/classes";
import { loadSeasonStandings } from "@/lib/results/season";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/s/[seasonId]">): Promise<Metadata> {
  const { lang, seasonId } = await params;
  if (!hasLocale(lang)) return {};
  const supabase = await createClient();
  const { data: season } = await supabase.from("seasons").select("year").eq("id", Number(seasonId)).maybeSingle();
  return season ? { title: t(getDictionary(lang).season.heading, { year: season.year }) } : {};
}

export default async function SeasonPage({ params, searchParams }: PageProps<"/[lang]/s/[seasonId]">) {
  const { lang, seasonId: rawId } = await params;
  if (!hasLocale(lang)) notFound();
  const seasonId = Number(rawId);
  if (!Number.isInteger(seasonId)) notFound();
  const dict = getDictionary(lang);
  const s = dict.season;

  const data = await loadSeasonStandings(await createClient(), seasonId);
  if (!data) notFound();

  const { view } = await searchParams;
  const showTeams = view === "team";
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);
  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${active ? "bg-foreground text-background" : "text-muted hover:bg-card hover:text-foreground"}`;
  const roundHeaders = data.rounds.map((round) => (
    <th key={round.id} className="hidden whitespace-nowrap py-2 pr-2 text-right font-medium sm:table-cell" title={text(round.name)}>
      {t(s.round, { n: round.round_number ?? "?" })}
    </th>
  ));

  let body: React.ReactNode;
  if (!data.rounds.length) {
    body = <p className="text-muted">{s.noData}</p>;
  } else if (showTeams) {
    body = (
      <>
        <p className="mb-3 text-xs text-muted">{s.teamNote}</p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.pos}</th>
                <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{s.club}</th>
                {roundHeaders}
                <th className="whitespace-nowrap py-2 text-right font-medium">{dict.results.total}</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((row) => (
                <tr key={row.club_id} className="border-t border-border">
                  <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.position}</td>
                  <td className="w-full py-2 pr-2 font-medium">{text(row.club)}</td>
                  {data.rounds.map((round) => (
                    <td key={round.id} className="hidden py-2 pr-2 text-right tabular-nums text-muted sm:table-cell">
                      {row.rounds[round.id] ?? "–"}
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
    body = (
      <>
        <p className="mb-4 text-xs text-muted">
          {data.dropApplies ? s.finalNote : t(s.interimNote, { n: data.season.drop_worst_rounds + 1 })}
        </p>
        {data.classes.map((cls) => {
          const rows = data.riders.filter((row) => row.class_id === cls.id);
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
                      {roundHeaders}
                      <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{s.gross}</th>
                      {data.dropApplies && <th className="whitespace-nowrap py-2 text-right font-medium">{s.net}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rider_id} className="border-t border-border">
                        <td className="py-2 pr-2 text-right font-medium tabular-nums">{row.position}</td>
                        <td className="w-full py-2 pr-2">
                          <div className="font-medium leading-tight">{riderName(row.first_name, row.last_name, lang)}</div>
                          {row.club && <div className="text-xs text-muted">{text(row.club)}</div>}
                        </td>
                        {data.rounds.map((round) => (
                          <td key={round.id} className="hidden py-2 pr-2 text-right tabular-nums text-muted sm:table-cell">
                            {row.rounds[round.id] ?? "–"}
                          </td>
                        ))}
                        <td className={`py-2 pr-2 text-right tabular-nums ${data.dropApplies ? "text-muted" : "font-semibold"}`}>
                          {row.gross_points}
                        </td>
                        {data.dropApplies && <td className="py-2 text-right font-semibold tabular-nums">{row.net_points}</td>}
                      </tr>
                    ))}
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
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t(s.heading, { year: data.season.year })}</h1>
        <p className="mb-5 text-sm text-muted">{data.season.name}</p>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <nav className="flex gap-1">
            <Link href="?" className={tab(!showTeams)}>
              {s.individual}
            </Link>
            <Link href="?view=team" className={tab(showTeams)}>
              {s.team}
            </Link>
          </nav>
          <Link href={`/${lang}/s/${seasonId}/numbers`} className="text-sm text-accent underline">
            {s.numbers}
          </Link>
          {data.rounds.length > 0 && (
            <a
              href={`/api/pdf/season/${seasonId}?lang=${lang}${showTeams ? "&view=team" : ""}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline"
            >
              PDF
            </a>
          )}
        </div>
        {body}
      </main>
    </>
  );
}
