import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
        <span>
          Todorov<span className="text-accent">NET</span>
        </span>
        <Link href={`/${lang}/privacy`} className="hover:text-foreground">
          {dict.footer.privacy}
        </Link>
      </div>
    </footer>
  );
}
