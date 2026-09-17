import Link from "next/link";
import { Logo3D } from "@/components/brand/logo-3d";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const link = "relative text-sm font-medium text-muted transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform hover:after:scale-x-100";
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
        <Link href={`/${lang}`} className="group flex items-center gap-2.5" aria-label="TodorovNET">
          <Logo3D />
          <span className="font-display text-xl font-bold uppercase tracking-wide">
            Todorov<span className="text-gradient">NET</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href={`/${lang}/archive`} className={`hidden sm:inline ${link}`}>
            {dict.nav.archive}
          </Link>
          <Link href={`/${lang}/t`} className={link}>
            {dict.nav.timing}
          </Link>
          <LanguageSwitcher lang={lang} label={dict.common.language} />
        </nav>
      </div>
    </header>
  );
}
