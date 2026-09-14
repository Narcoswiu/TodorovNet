"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";

const ADMIN_ROLES = ["organizer", "jury", "jury_chair", "gps_judge"];

/** Without an explicit target, admins and officials land in the admin panel, timekeepers in the timing app. */
export function LoginForm({ lang, dict, redirectTo }: { lang: Locale; dict: Dictionary; redirectTo: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (signInError || !data.user) {
        setError(dict.login.invalid);
        return;
      }
      let target = redirectTo;
      if (!target) {
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("is_super_admin").eq("id", data.user.id).maybeSingle(),
          supabase.from("event_staff").select("role").eq("user_id", data.user.id),
        ]);
        const official = profile?.is_super_admin || (roles ?? []).some((row) => ADMIN_ROLES.includes(row.role));
        target = official ? `/${lang}/admin` : `/${lang}/t`;
      }
      router.replace(target);
      router.refresh();
    });
  }

  const input =
    "mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-base outline-none focus:border-accent";

  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm">
        {dict.login.email}
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="block text-sm">
        {dict.login.password}
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? dict.common.loading : dict.login.submit}
      </button>
    </form>
  );
}
