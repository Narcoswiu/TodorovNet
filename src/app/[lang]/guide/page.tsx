import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/guide">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).guide.title };
}

/** Race-day guide for officials, one section per role, in the words of the buttons they will press. */
export default async function GuidePage({ params }: PageProps<"/[lang]/guide">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const g = dict.guide;

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{g.title}</h1>
        <p className="mt-3">{g.intro}</p>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          {g.roles.map((role) => (
            <a key={role.id} href={`#${role.id}`} className="rounded-full border border-border px-3 py-1 hover:border-accent">
              {role.heading}
            </a>
          ))}
          <Link href={`/${lang}/t`} className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">
            {g.openTiming}
          </Link>
        </nav>
        {g.roles.map((role) => (
          <section key={role.id} id={role.id} className="mt-8 scroll-mt-4">
            <h2 className="text-lg font-semibold">{role.heading}</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed">
              {role.steps.map((stepText) => (
                <li key={stepText}>{stepText}</li>
              ))}
            </ol>
          </section>
        ))}
        <section className="mt-8 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">{g.checklistHeading}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {g.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
