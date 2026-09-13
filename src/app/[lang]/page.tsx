import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { transliterate } from "@/i18n/localize";
import { formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, location, date_from, date_to, status, round_number")
    .neq("status", "draft")
    .order("date_from", { ascending: false });

  const groups = [
    { status: "live", title: dict.home.live },
    { status: "upcoming", title: dict.home.upcoming },
    { status: "finished", title: dict.home.finished },
  ] as const;

  const text = (value: string) => (lang === "en" ? transliterate(value) : value);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{dict.home.heading}</h1>

        {!events?.length && <p className="text-muted">{dict.home.noEvents}</p>}

        {groups.map(({ status, title }) => {
          const list = (events ?? []).filter((event) => event.status === status);
          if (!list.length) return null;
          return (
            <section key={status} className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
                {status === "live" && <span className="size-2 animate-pulse rounded-full bg-bad" aria-hidden />}
                {title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/${lang}/e/${event.id}`}
                      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent"
                    >
                      <div className="font-medium">{text(event.name)}</div>
                      <div className="mt-1 text-sm text-muted">
                        {[
                          event.round_number ? t(dict.home.round, { n: event.round_number }) : null,
                          text(event.location),
                          formatDateRange(event.date_from, event.date_to, lang),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </>
  );
}
