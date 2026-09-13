import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, locales, negotiateLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocalePrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  // Every page lives under /bg or /en. Pick the language from the cookie or the browser.
  if (!hasLocalePrefix) {
    const locale = negotiateLocale(
      request.cookies.get(LOCALE_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals, API routes and files with an extension (icons, sw.js, manifest).
    "/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
