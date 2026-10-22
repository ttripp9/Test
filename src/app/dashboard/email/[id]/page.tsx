import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Button, Card, Checkbox, Field, Input, PageHeader, Textarea, buttonClass } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { sequenceSteps, sequences } from "@/lib/db/schema";
import { addStep, deleteSequence, deleteStep, saveSequence, saveStep } from "../actions";

export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = await requireCreator();
  const seq = await db.select().from(sequences).where(and(eq(sequences.id, id), eq(sequences.storeId, store.id))).get();
  if (!seq) notFound();
  const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id)).orderBy(asc(sequenceSteps.delayHours), asc(sequenceSteps.position)).all();
  return (
    <>
      <PageHeader title={seq.name} description="Each email is sent the set number of days after someone enters the sequence." actions={<Link href="/dashboard/email" className={buttonClass("ghost")}>← Email</Link>} />
      <Card className="mb-6">
        <ActionForm action={saveSequence} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="id" value={seq.id} />
          <Field label="Name" className="min-w-56 flex-1">
            <Input name="name" defaultValue={seq.name} />
          </Field>
          <Checkbox name="active" defaultChecked={seq.active} label="Sequence is on" hint="New people start receiving it." />
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.id}>
            <Card title={`Email ${i + 1}`}>
              <ActionForm action={saveStep} className="grid gap-3">
                <input type="hidden" name="sequenceId" value={seq.id} />
                <input type="hidden" name="stepId" value={s.id} />
                <Field label="Send after (days)" hint="0 = immediately">
                  <Input name="delayDays" type="number" min={0} max={365} step="0.5" defaultValue={s.delayHours / 24} className="max-w-32" />
                </Field>
                <Field label="Subject">
                  <Input name="subject" defaultValue={s.subject} required />
                </Field>
                <Field label="Message" hint="Markdown. Variables: {{first_name}}, {{name}}, {{store_name}}, {{store_url}}">
                  <Textarea name="body" defaultValue={s.body} rows={7} required />
                </Field>
                <div>
                  <SubmitButton size="sm">Save email</SubmitButton>
                </div>
              </ActionForm>
              <form action={deleteStep} className="mt-3 border-t border-slate-100 pt-3">
                <input type="hidden" name="sequenceId" value={seq.id} />
                <input type="hidden" name="stepId" value={s.id} />
                <ConfirmButton message="Delete this email from the sequence?" variant="ghost">Delete email</ConfirmButton>
              </form>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <form action={addStep}>
          <input type="hidden" name="sequenceId" value={seq.id} />
          <Button variant="secondary">Add another email</Button>
        </form>
        <form action={deleteSequence}>
          <input type="hidden" name="id" value={seq.id} />
          <ConfirmButton message="Delete this whole sequence? Scheduled emails will not be sent.">Delete sequence</ConfirmButton>
        </form>
      </div>
    </>
  );
}
