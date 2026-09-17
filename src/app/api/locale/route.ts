import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, hasLocale } from "@/i18n/config";

// /api/locale?to=en&path=/bg/e/1?stage=3 → remembers the choice and opens the same page in English.
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "/";
  if (!hasLocale(to)) return NextResponse.json({ error: "Unknown locale" }, { status: 400 });

  // Same-site paths only, never an open redirect.
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const withoutLocale = safePath.replace(/^\/(bg|en)(?=\/|\?|$)/, "");

  const response = NextResponse.redirect(new URL(`/${to}${withoutLocale}`, request.url));
  response.cookies.set(LOCALE_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
