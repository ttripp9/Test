import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { login } from "../actions";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-bold">Welcome back</h1>
      <ActionForm action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>
        <SubmitButton className="w-full" pendingText="Logging in…">Log in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        New here? <Link href="/signup" className="font-medium text-brand-700">Create a free store</Link>
      </p>
    </>
  );
}
