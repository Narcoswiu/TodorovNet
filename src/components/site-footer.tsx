import Link from "next/link";
import { Logo3D } from "@/components/brand/logo-3d";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-white/5 bg-black/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted">
        <span className="flex items-center gap-2.5">
          <Logo3D size="1.5rem" />
          <span className="font-display font-bold uppercase tracking-wide text-foreground">
            Todorov<span className="text-accent">NET</span>
          </span>
          <span className="hidden sm:inline">· {dict.author.builtBy}</span>
        </span>
        <span className="flex flex-wrap gap-5">
          <Link href={`/${lang}/archive`} className="hover:text-foreground">
            {dict.nav.archive}
          </Link>
          <Link href={`/${lang}/staff`} className="hover:text-foreground">
            {dict.nav.staff}
          </Link>
          <Link href={`/${lang}/privacy`} className="hover:text-foreground">
            {dict.footer.privacy}
          </Link>
        </span>
      </div>
    </footer>
  );
}
