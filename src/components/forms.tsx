"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx, type ButtonVariant } from "./ui";

export type FormState = { error?: string; ok?: string } | undefined;
export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function SubmitButton({ children, variant = "primary", size = "md", className, pendingText }: { children: ReactNode; variant?: ButtonVariant; size?: "sm" | "md"; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(buttonClass(variant, size), className)}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

/** A form wired to a server action that shows its error or success message. */
export function ActionForm({ action, children, className, resetOnSuccess }: { action: FormAction; children: ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}

export function ConfirmButton({ children, message, variant = "danger", size = "sm" }: { children: ReactNode; message: string; variant?: ButtonVariant; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, size)}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={(e) => {
        navigator.clipboard?.writeText(text);
        const el = e.currentTarget;
        el.textContent = "Copied!";
        setTimeout(() => (el.textContent = label), 1500);
      }}
    >
      {label}
    </button>
  );
}
