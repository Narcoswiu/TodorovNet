"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ dict, redirectTo }: { dict: Dictionary; redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (signInError) {
        setError(dict.login.invalid);
        return;
      }
      router.replace(redirectTo);
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
