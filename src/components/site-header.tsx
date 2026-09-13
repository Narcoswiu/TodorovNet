import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={`/${lang}`} className="text-lg font-semibold tracking-tight">
          Todorov<span className="text-accent">NET</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href={`/${lang}/t`} className="text-sm text-muted hover:text-foreground">
            {dict.nav.timing}
          </Link>
          <LanguageSwitcher lang={lang} label={dict.common.language} />
        </div>
      </div>
    </header>
  );
}
