import Link from "next/link";
import { Logo3D } from "@/components/brand/logo-3d";

/**
 * The 404 page. It cannot know the visitor's language (Next renders it without route params), so it
 * speaks both, and links into both versions of the site.
 */
export function NotFoundContent() {
  return (
    <main className="page-glow flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Logo3D size="4.5rem" />
      <p className="font-display mt-8 text-8xl font-bold leading-none text-white/10">404</p>
      <h1 className="font-display mt-2 text-3xl font-bold uppercase tracking-wide">Страницата не е намерена</h1>
      <p className="mt-1 text-lg text-muted">Page not found</p>
      <p className="mt-4 max-w-md text-sm text-muted">
        Състезанието, резултатът или адресът не съществуват или още не са публикувани.
        <br />
        The event, result or address does not exist or has not been published yet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/bg" className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground">
          Към началото
        </Link>
        <Link href="/en" className="rounded-full border border-border bg-card px-6 py-3 font-semibold">
          Go to home
        </Link>
      </div>
    </main>
  );
}
