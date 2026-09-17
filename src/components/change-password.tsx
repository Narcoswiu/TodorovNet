"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";

const MIN = 8;

/** Lets an official replace the password they were given, without going through an administrator. */
export function ChangePassword({ dict }: { dict: Dictionary }) {
  const text = dict.staffHub.password;
  const [value, setValue] = useState("");
  const [repeat, setRepeat] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value.length < MIN) return setState({ ok: false, message: text.tooShort });
    if (value !== repeat) return setState({ ok: false, message: text.mismatch });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: value });
    setBusy(false);
    setState(error ? { ok: false, message: error.message } : { ok: true, message: text.saved });
    if (!error) {
      setValue("");
      setRepeat("");
    }
  }

  const input = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent";

  return (
    <details className="rounded-2xl border border-border bg-card p-5">
      <summary className="cursor-pointer font-semibold">{text.title}</summary>
      <form onSubmit={submit} className="mt-4 grid max-w-md gap-3">
        <label className="block text-sm text-muted">
          {text.new}
          <input
            type="password"
            name="new_password"
            autoComplete="new-password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={input}
            required
            minLength={MIN}
          />
        </label>
        <label className="block text-sm text-muted">
          {text.repeat}
          <input
            type="password"
            name="repeat_password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            className={input}
            required
            minLength={MIN}
          />
        </label>
        <button type="submit" disabled={busy} className="justify-self-start rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-foreground disabled:opacity-60">
          {busy ? dict.common.loading : text.save}
        </button>
        {state && <p className={state.ok ? "text-good" : "text-bad"}>{state.message}</p>}
      </form>
    </details>
  );
}
