import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localizedName, riderName, transliterate } from "@/i18n/localize";
import { numberPlateStyle } from "@/lib/classes";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/s/[seasonId]/numbers">): Promise<Metadata> {
  const { lang, seasonId } = await params;
  if (!hasLocale(lang)) return {};
  const supabase = await createClient();
  const { data: season } = await supabase.from("seasons").select("year").eq("id", Number(seasonId)).maybeSingle();
  return season ? { title: t(getDictionary(lang).season.numbersHeading, { year: season.year }) } : {};
}

/** Public list of taken race numbers, like bgx.bg/racenumbers.html. */
export default async function SeasonNumbersPage({ params }: PageProps<"/[lang]/s/[seasonId]/numbers">) {
  const { lang, seasonId: rawId } = await params;
  if (!hasLocale(lang)) notFound();
  const seasonId = Number(rawId);
  if (!Number.isInteger(seasonId)) notFound();
  const dict = getDictionary(lang);
  const supabase = await createClient();

  const [{ data: season }, { data: classes }, { data: numbers }] = await Promise.all([
    supabase.from("seasons").select("id, year, name").eq("id", seasonId).maybeSingle(),
    supabase.from("classes").select("id, name, name_en, number_bg, number_fg").eq("season_id", seasonId),
    supabase
      .from("season_numbers")
      .select("race_number, class_id, riders(id, first_name, last_name, clubs(name))")
      .eq("season_id", seasonId)
      .order("race_number"),
  ]);
  if (!season) notFound();
  const classById = new Map((classes ?? []).map((cls) => [cls.id, cls]));
  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t(dict.season.numbersHeading, { year: season.year })}</h1>
        <p className="mb-5 text-sm text-muted">
          {dict.season.numbersNote}{" "}
          <Link href={`/${lang}/s/${season.id}`} className="text-accent underline">
            {dict.season.link}
          </Link>
        </p>
        {!numbers?.length ? (
          <p className="text-muted">{dict.season.noNumbers}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card px-3">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 pr-2 text-right font-medium">{dict.results.number}</th>
                  <th className="py-2 pr-2 text-left font-medium">{dict.results.rider}</th>
                  <th className="py-2 pr-2 text-left font-medium">{dict.admin.entries.class}</th>
                  <th className="hidden py-2 text-left font-medium sm:table-cell">{dict.results.club}</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((row) => {
                  const cls = classById.get(row.class_id);
                  return (
                    <tr key={row.race_number} className="border-t border-border">
                      <td className="py-2 pr-2 text-right">
                        <span
                          className="inline-block min-w-10 rounded border border-border px-1.5 py-0.5 text-center font-mono text-sm font-semibold tabular-nums"
                          style={numberPlateStyle(cls?.number_bg, cls?.number_fg)}
                        >
                          {row.race_number}
                        </span>
                      </td>
                      <td className="w-full py-2 pr-2 font-medium">
                        {row.riders && (
                          <Link href={`/${lang}/r/${row.riders.id}`} className="hover:underline">
                            {riderName(row.riders.first_name, row.riders.last_name, lang)}
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 text-muted">{cls ? localizedName(cls, lang) : ""}</td>
                      <td className="hidden py-2 text-muted sm:table-cell">{row.riders?.clubs?.name ? text(row.riders.clubs.name) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
