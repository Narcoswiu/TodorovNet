import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangePassword } from "@/components/change-password";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { manualBg } from "@/i18n/manual/bg";
import { manualEn } from "@/i18n/manual/en";
import { getViewer } from "@/lib/auth";
import { signOut } from "../admin/actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/staff">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).staffHub.title };
}

/** One door for officials: sign in here, then admin, timing and the manual are one tap away. */
export default async function StaffHubPage({ params }: PageProps<"/[lang]/staff">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const h = dict.staffHub;
  const manual = lang === "en" ? manualEn : manualBg;
  const viewer = await getViewer();

  const cards = [
    { href: `/${lang}/admin`, icon: "🗂️", title: h.adminTitle, text: h.adminText },
    { href: `/${lang}/t`, icon: "⏱️", title: h.timingTitle, text: h.timingText },
    { href: `/${lang}/guide`, icon: "📖", title: manual.title, text: h.manualText },
  ];

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="rise text-xs font-semibold uppercase tracking-[0.2em] text-accent">{h.kicker}</p>
        <h1 className="rise font-display mt-2 text-4xl font-bold uppercase tracking-tight sm:text-5xl" style={{ "--d": "80ms" } as React.CSSProperties}>
          {h.title}
        </h1>

        {viewer ? (
          <>
            <p className="rise mt-3 text-muted" style={{ "--d": "140ms" } as React.CSSProperties}>
              {t(dict.admin.signedInAs, { email: viewer.email })}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {cards.map((card, index) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="card-lift rise flex flex-col rounded-2xl border border-border bg-card p-6"
                  style={{ "--d": `${index * 80 + 200}ms` } as React.CSSProperties}
                >
                  <span aria-hidden className="text-3xl">
                    {card.icon}
                  </span>
                  <span className="font-display mt-3 text-xl font-bold uppercase leading-tight tracking-wide">{card.title}</span>
                  <span className="mt-2 text-sm text-muted">{card.text}</span>
                  <span className="mt-4 text-sm font-semibold text-accent">{h.open} →</span>
                </Link>
              ))}
            </div>
            <div className="mt-8">
              <ChangePassword dict={dict} />
            </div>
            <form action={signOut} className="mt-6">
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="text-sm text-muted underline hover:text-foreground">
                {dict.common.signOut}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="rise mt-3 max-w-xl text-lg text-muted" style={{ "--d": "140ms" } as React.CSSProperties}>
              {h.intro}
            </p>
            <Link
              href={`/${lang}/login?next=/${lang}/staff`}
              className="rise mt-8 inline-block rounded-full bg-accent px-6 py-3 text-lg font-semibold text-accent-foreground"
              style={{ "--d": "200ms" } as React.CSSProperties}
            >
              {dict.common.signIn}
            </Link>
            <p className="mt-6 text-sm text-muted">{h.noAccount}</p>
          </>
        )}
      </main>
    </>
  );
}
