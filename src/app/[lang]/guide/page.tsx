import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorCard } from "@/components/brand/author-card";
import { SiteHeader } from "@/components/site-header";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { manualBg } from "@/i18n/manual/bg";
import { manualEn } from "@/i18n/manual/en";
import type { ManualSection } from "@/i18n/manual/types";

export async function generateMetadata({ params }: PageProps<"/[lang]/guide">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (lang === "en" ? manualEn : manualBg).title };
}

/** The officials' manual: contents on the side, one chapter per job, checklist and troubleshooting. */
export default async function GuidePage({ params }: PageProps<"/[lang]/guide">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const m = lang === "en" ? manualEn : manualBg;
  const toc = [
    ...m.chapters.map((chapter, index) => ({ id: chapter.id, label: chapter.title, number: `${index + 1}` })),
    { id: "roles", label: m.roles.title, number: "✓" },
    { id: "checklist", label: m.checklist.title, number: "☑" },
    { id: "faq", label: m.faq.title, number: "?" },
  ];

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main id="top" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20">
        <header className="relative overflow-hidden rounded-b-3xl border-x border-b border-border bg-gradient-to-br from-accent/20 via-card to-card px-6 pb-10 pt-14 sm:px-10">
          <span className="font-display pointer-events-none absolute -bottom-8 -right-2 text-[9rem] font-bold leading-none text-white/[0.04]">GUIDE</span>
          <p className="rise text-xs font-semibold uppercase tracking-[0.2em] text-accent">{m.updated}</p>
          <h1 className="rise font-display mt-3 text-4xl font-bold uppercase leading-none tracking-tight sm:text-6xl" style={{ "--d": "80ms" } as React.CSSProperties}>
            {m.title}
          </h1>
          <p className="rise mt-4 max-w-2xl text-lg text-muted" style={{ "--d": "140ms" } as React.CSSProperties}>
            {m.subtitle}
          </p>
          <div className="rise mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ "--d": "200ms" } as React.CSSProperties}>
            {m.quickStart.items.map((item) => (
              <a key={item.anchor} href={`#${item.anchor}`} className="card-lift rounded-2xl border border-border bg-background/60 p-4">
                <span className="font-display block text-lg font-bold uppercase tracking-wide">{item.role} →</span>
                <span className="mt-1 block text-sm text-muted">{item.text}</span>
              </a>
            ))}
          </div>
          <Link
            href={`/${lang}/t`}
            className="rise mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
            style={{ "--d": "260ms" } as React.CSSProperties}
          >
            ⏱ {dict.nav.timing}
          </Link>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_1fr]">
          <nav aria-label={m.contents} className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{m.contents}</p>
            <ol className="space-y-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground">
                    <span className="font-display grid size-6 shrink-0 place-items-center rounded-md border border-border text-xs font-bold group-hover:border-accent group-hover:text-accent">
                      {item.number}
                    </span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-14">
            {m.chapters.map((chapter, index) => (
              <section key={chapter.id} id={chapter.id} className="reveal scroll-mt-20">
                <div className="mb-6 flex items-start gap-4">
                  <span className="font-display grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-2xl font-bold text-accent-foreground shadow-[0_10px_30px_-12px_var(--accent)]">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide">
                      <span aria-hidden className="mr-2">
                        {chapter.icon}
                      </span>
                      {chapter.title}
                    </h2>
                    <p className="mt-1 text-muted">{chapter.summary}</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {chapter.sections.map((section) => (
                    <Section key={section.title} section={section} tipLabel={m.tipLabel} warningLabel={m.warningLabel} />
                  ))}
                </div>
              </section>
            ))}

            <section id="roles" className="reveal scroll-mt-20">
              <h2 className="font-display text-3xl font-bold uppercase tracking-wide">{m.roles.title}</h2>
              <p className="mt-2 text-muted">{m.roles.intro}</p>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-[0.7rem] uppercase tracking-wider text-muted">
                      <th className="px-4 py-3 text-left font-semibold" />
                      {m.roles.columns.map((column) => (
                        <th key={column} className="px-2 py-3 text-center font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.roles.rows.map((row) => (
                      <tr key={row.task} className="border-t border-border/60">
                        <td className="px-4 py-2.5">{row.task}</td>
                        {row.marks.map((mark, index) => (
                          <td key={index} className="px-2 py-2.5 text-center">
                            {mark ? <span className="inline-grid size-6 place-items-center rounded-full bg-good/15 text-good">{mark}</span> : <span className="text-border">·</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">{m.roles.legend}</p>
            </section>

            <section id="checklist" className="reveal scroll-mt-20">
              <h2 className="font-display text-3xl font-bold uppercase tracking-wide">{m.checklist.title}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {m.checklist.groups.map((group) => (
                  <div key={group.title} className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide text-accent">{group.title}</h3>
                    <ul className="mt-3 space-y-2 text-sm">
                      {group.items.map((item) => (
                        <li key={item} className="flex gap-2.5">
                          <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded border-2 border-border" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section id="faq" className="reveal scroll-mt-20">
              <h2 className="font-display text-3xl font-bold uppercase tracking-wide">{m.faq.title}</h2>
              <div className="mt-5 space-y-3">
                {m.faq.items.map((item) => (
                  <details key={item.q} className="group rounded-2xl border border-border bg-card px-5 py-4 open:border-accent/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                      {item.q}
                      <span aria-hidden className="text-accent transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <AuthorCard dict={dict} />

            <a href="#top" className="inline-block text-sm font-semibold text-accent hover:underline">
              ↑ {m.back}
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

function Section({ section, tipLabel, warningLabel }: { section: ManualSection; tipLabel: string; warningLabel: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="text-lg font-bold">{section.title}</h3>
      {section.text?.map((paragraph) => (
        <p key={paragraph} className="mt-3 leading-relaxed text-foreground/85">
          {paragraph}
        </p>
      ))}
      {section.steps && (
        <ol className="mt-4 space-y-3">
          {section.steps.map((step, index) => (
            <li key={step} className="flex gap-3 leading-relaxed">
              <span className="font-display grid size-7 shrink-0 place-items-center rounded-full border border-accent/60 text-sm font-bold text-accent">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
      {section.bullets && (
        <ul className="mt-4 space-y-2">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 leading-relaxed text-foreground/85">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {section.tip && (
        <p className="mt-4 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm">
          <span className="font-bold text-good">💡 {tipLabel}: </span>
          {section.tip}
        </p>
      )}
      {section.warning && (
        <p className="mt-4 rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm">
          <span className="font-bold text-warn">⚠️ {warningLabel}: </span>
          {section.warning}
        </p>
      )}
    </article>
  );
}
