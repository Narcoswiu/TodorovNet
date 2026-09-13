"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { locales, type Locale } from "@/i18n/config";

type Props = { lang: Locale; label: string };

// The links go through /api/locale, which stores the choice in a cookie and keeps the page and its query.
export function LanguageSwitcher(props: Props) {
  return (
    <Suspense fallback={<Links {...props} query="" />}>
      <WithQuery {...props} />
    </Suspense>
  );
}

function WithQuery(props: Props) {
  const search = useSearchParams().toString();
  return <Links {...props} query={search ? `?${search}` : ""} />;
}

function Links({ lang, label, query }: Props & { query: string }) {
  const pathname = usePathname();
  const current = `${pathname}${query}`;

  return (
    <nav aria-label={label} className="flex rounded-md border border-border text-xs font-medium">
      {locales.map((locale) => (
        <a
          key={locale}
          href={`/api/locale?to=${locale}&path=${encodeURIComponent(current)}`}
          hrefLang={locale}
          aria-current={locale === lang ? "true" : undefined}
          className={`px-2 py-1 first:rounded-l-md last:rounded-r-md ${
            locale === lang ? "bg-foreground text-background" : "text-muted hover:text-foreground"
          }`}
        >
          {locale.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
