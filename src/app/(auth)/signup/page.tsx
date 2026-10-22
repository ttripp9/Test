import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { env } from "@/lib/env";
import { signup } from "../actions";

export const metadata = { title: "Create your store" };

export default function SignupPage() {
  const host = env.appUrl.replace(/^https?:\/\//, "");
  return (
    <>
      <h1 className="text-xl font-bold">Create your store</h1>
      <p className="mt-1 text-sm text-slate-500">Free forever plan. No card needed.</p>
      <ActionForm action={signup} className="mt-6 space-y-4">
        <Field label="Your name">
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
        </Field>
        <Field label="Store link" hint={`${host}/your-name`}>
          <Input name="slug" required pattern="[A-Za-z0-9\-]{3,32}" placeholder="your-name" />
        </Field>
        <SubmitButton className="w-full" pendingText="Creating…">Create my store</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have a store? <Link href="/login" className="font-medium text-brand-700">Log in</Link>
      </p>
    </>
  );
}
