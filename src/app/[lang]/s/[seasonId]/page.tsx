import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PositionBadge } from "@/components/brand/status-badge";
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
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-white/5 hover:text-foreground"}`;
  const roundHeaders = data.rounds.map((round) => (
    <th key={round.id} className="hidden whitespace-nowrap py-3 pr-2 text-right font-semibold sm:table-cell" title={text(round.name)}>
      {t(s.round, { n: round.round_number ?? "?" })}
    </th>
  ));

  let body: React.ReactNode;
  if (!data.rounds.length) {
    body = <p className="text-muted">{s.noData}</p>;
  } else if (showTeams) {
    body = (
      <>
        <p className="mb-4 text-sm text-muted">{s.teamNote}</p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card px-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-[0.7rem] uppercase tracking-wider text-muted">
                <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.pos}</th>
                <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{s.club}</th>
                {roundHeaders}
                <th className="whitespace-nowrap py-2 text-right font-medium">{dict.results.total}</th>
              </tr>
            </thead>
            <tbody className="row-in">
              {data.teams.map((row) => (
                <tr key={row.club_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
                  <td className="py-2 pr-2 text-right font-medium tabular-nums"><PositionBadge position={row.position} /></td>
                  <td className="w-full py-2 pr-2 font-semibold">{text(row.club)}</td>
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
        <p className="mb-6 text-sm text-muted">
          {data.dropApplies ? s.finalNote : t(s.interimNote, { n: data.season.drop_worst_rounds + 1 })}
        </p>
        {data.classes.map((cls) => {
          const rows = data.riders.filter((row) => row.class_id === cls.id);
          if (!rows.length) return null;
          return (
            <section key={cls.id} className="reveal mb-10">
              <h2 className="font-display mb-3 flex items-center gap-3 text-2xl font-bold uppercase tracking-wide">
                <span className="inline-block size-4 rounded border border-white/20" style={numberPlateStyle(cls.number_bg, cls.number_fg)} aria-hidden />
                {localizedName(cls, lang)}
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-border bg-card px-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-[0.7rem] uppercase tracking-wider text-muted">
                      <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{dict.results.pos}</th>
                      <th className="whitespace-nowrap py-2 pr-2 text-left font-medium">{dict.results.rider}</th>
                      {roundHeaders}
                      <th className="whitespace-nowrap py-2 pr-2 text-right font-medium">{s.gross}</th>
                      {data.dropApplies && <th className="whitespace-nowrap py-2 text-right font-medium">{s.net}</th>}
                    </tr>
                  </thead>
                  <tbody className="row-in">
                    {rows.map((row) => (
                      <tr key={row.rider_id} className="border-t border-border/70 transition-colors hover:bg-white/[0.03]">
                        <td className="py-2 pr-2 text-right font-medium tabular-nums"><PositionBadge position={row.position} /></td>
                        <td className="w-full py-2 pr-2">
                          <Link href={`/${lang}/r/${row.rider_id}`} className="font-semibold leading-tight hover:text-accent">{riderName(row.first_name, row.last_name, lang)}</Link>
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/20 via-card to-card p-6 sm:p-10">
          <span className="font-display pointer-events-none absolute -bottom-10 -right-4 text-[10rem] font-bold leading-none text-white/[0.05]">
            {data.season.year}
          </span>
          <p className="rise text-sm font-semibold uppercase tracking-wider text-accent">{data.season.name}</p>
          <h1 className="rise font-display mt-2 text-4xl font-bold uppercase tracking-tight sm:text-6xl" style={{ "--d": "80ms" } as React.CSSProperties}>
            {t(s.heading, { year: data.season.year })}
          </h1>
          <p className="rise mt-3 text-muted" style={{ "--d": "140ms" } as React.CSSProperties}>
            {t(s.roundsHeld, { n: data.rounds.length })}
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <nav className="flex gap-1 rounded-full border border-border bg-card p-1">
            <Link href="?" className={tab(!showTeams)}>
              {s.individual}
            </Link>
            <Link href="?view=team" className={tab(showTeams)}>
              {s.team}
            </Link>
          </nav>
          <Link href={`/${lang}/s/${seasonId}/numbers`} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-accent">
            {s.numbers}
          </Link>
          {data.rounds.length > 0 && (
            <a
              href={`/api/pdf/season/${seasonId}?lang=${lang}${showTeams ? "&view=team" : ""}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-accent"
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
