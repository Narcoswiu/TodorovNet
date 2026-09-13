import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { OPERATOR } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).privacy.title };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const p = dict.privacy;
  const contact = OPERATOR.email ? t(p.contact, { operator: OPERATOR.name, email: OPERATOR.email }) : p.contactOrganizer;

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{p.updated}</p>
        <p className="mt-4">{p.intro}</p>
        <p className="mt-2">{contact}</p>
        {p.sections.map((section) => (
          <section key={section.heading} className="mt-6">
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
