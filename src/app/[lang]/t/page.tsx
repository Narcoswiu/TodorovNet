import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { TimingApp } from "@/components/timing/timing-app";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata({ params }: PageProps<"/[lang]/t">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return {
    title: getDictionary(lang).timing.heading,
    // iPhone has no install prompt: these make "Add to Home Screen" open full screen with the app icon.
    appleWebApp: { capable: true, title: "TodorovNET", statusBarStyle: "black-translucent" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  viewportFit: "cover",
};

// The page itself holds no data: everything loads in the browser so the app keeps working offline.
export default async function TimingPage({ params }: PageProps<"/[lang]/t">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TimingApp lang={lang} dict={getDictionary(lang)} />;
}
