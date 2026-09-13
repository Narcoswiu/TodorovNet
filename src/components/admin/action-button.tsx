"use client";

import { useActionState } from "react";
import type { FormAction } from "@/lib/admin/action-result";

type Props = {
  action: FormAction;
  fields: Record<string, string | number>;
  label: string;
  pendingLabel: string;
  tone?: "default" | "good" | "bad";
  /** Optional short text input sent with the action, e.g. the reason for a void. */
  input?: { name: string; placeholder: string; required?: boolean };
};

/** A one-click server action (confirm, remove, withdraw) that shows its own error inline. */
export function ActionButton({ action, fields, label, pendingLabel, tone = "default", input }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const color =
    tone === "good" ? "border-good text-good" : tone === "bad" ? "border-bad text-bad" : "border-border text-foreground";

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {input && (
        <input
          name={input.name}
          placeholder={input.placeholder}
          required={input.required}
          aria-label={input.placeholder}
          className="w-36 rounded border border-border bg-background px-2 py-1 text-xs"
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className={`whitespace-nowrap rounded border px-2 py-1 text-xs font-medium disabled:opacity-50 ${color}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state && !state.ok && (
        <span role="alert" className="text-xs text-bad">
          {state.error}
        </span>
      )}
      {state?.ok && state.message && <span className="text-xs text-good">{state.message}</span>}
    </form>
  );
}
