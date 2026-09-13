"use client";

import { useActionState } from "react";
import type { FormAction } from "@/lib/admin/action-result";

type Props = {
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  className?: string;
  children: React.ReactNode;
};

/** A form bound to a server action, showing the action's success or error message next to the button. */
export function ActionForm({ action, submitLabel, pendingLabel, className, children }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {state &&
          (state.ok ? (
            <span role="status" className="text-sm text-good">
              {state.message}
            </span>
          ) : (
            <span role="alert" className="text-sm text-bad">
              {state.error}
            </span>
          ))}
      </div>
    </form>
  );
}
