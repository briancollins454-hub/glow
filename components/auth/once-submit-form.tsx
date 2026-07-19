"use client";

import { useState, type FormEvent, type ReactNode } from "react";

/**
 * Disables the submit control after the first click so double-taps / impatient
 * retries can't fire two signup (or login) server actions in parallel.
 */
export function OnceSubmitForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (pending) {
      e.preventDefault();
      return;
    }
    setPending(true);
    const form = e.currentTarget;
    // Dim every submit button inside the form.
    form.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((btn) => {
      btn.disabled = true;
      if (!btn.dataset.label) btn.dataset.label = btn.textContent ?? "";
      btn.textContent = "Please wait…";
    });
  }

  return (
    <form action={action} onSubmit={onSubmit} className={className} aria-busy={pending}>
      {children}
    </form>
  );
}
