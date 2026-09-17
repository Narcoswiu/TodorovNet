import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimingApp } from "@/components/timing/timing-app";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/t">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).timing.heading };
}

// The page itself holds no data: everything loads in the browser so the app keeps working offline.
export default async function TimingPage({ params }: PageProps<"/[lang]/t">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TimingApp lang={lang} dict={getDictionary(lang)} />;
}
