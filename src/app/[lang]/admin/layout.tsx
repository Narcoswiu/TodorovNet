import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { hasLocale, t } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireViewer } from "@/lib/auth";
import { signOut } from "./actions";

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const viewer = await requireViewer(lang, `/${lang}/admin`);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
          <Link href={`/${lang}/admin`} className="font-medium text-foreground">
            {dict.admin.heading}
          </Link>
          <form action={signOut} className="flex items-center gap-3">
            <span>{t(dict.admin.signedInAs, { email: viewer.email })}</span>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className="underline hover:text-foreground">
              {dict.common.signOut}
            </button>
          </form>
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
