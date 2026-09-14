import { notFound } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const { next } = await searchParams;
  // Only allow redirects back into this site.
  const redirectTo = typeof next === "string" && next.startsWith(`/${lang}/`) ? next : null;

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{dict.login.heading}</h1>
        <LoginForm lang={lang} dict={dict} redirectTo={redirectTo} />
      </main>
    </>
  );
}
