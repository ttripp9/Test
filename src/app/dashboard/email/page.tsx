import { and, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, Field, Input, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcasts, contacts, emailQueue, products, sequenceSteps, sequences } from "@/lib/db/schema";
import { getPlan } from "@/lib/plans";
import { createSequence, sendBroadcast } from "./actions";

const TRIGGER_LABEL = { new_contact: "When someone joins my list", lead_magnet: "When someone grabs a freebie", purchase: "When someone buys" };

export default async function EmailPage() {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  const [seqs, history, subs, stats, items] = await Promise.all([
    db
      .select({ seq: sequences, steps: sql<number>`(select count(*) from ${sequenceSteps} where ${sequenceSteps.sequenceId} = ${sequences.id})`, product: products.title })
      .from(sequences)
      .leftJoin(products, eq(products.id, sequences.productId))
      .where(eq(sequences.storeId, store.id))
      .orderBy(desc(sequences.createdAt))
      .all(),
    db.select().from(broadcasts).where(eq(broadcasts.storeId, store.id)).orderBy(desc(broadcasts.createdAt)).limit(10).all(),
    db.select({ n: count() }).from(contacts).where(and(eq(contacts.storeId, store.id), eq(contacts.subscribed, true))).get(),
    db
      .select({
        sent: sql<number>`sum(case when ${emailQueue.status} = 'sent' then 1 else 0 end)`,
        queued: sql<number>`sum(case when ${emailQueue.status} = 'queued' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${emailQueue.status} = 'failed' then 1 else 0 end)`,
      })
      .from(emailQueue)
      .where(eq(emailQueue.storeId, store.id))
      .get(),
    db.select({ id: products.id, title: products.title, type: products.type }).from(products).where(and(eq(products.storeId, store.id), eq(products.archived, false))).all(),
  ]);
  return (
    <>
      <PageHeader title="Email" description="Automated sequences and one-off broadcasts — included on every plan." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Subscribers" value={subs?.n ?? 0} />
        <Stat label="Emails sent" value={Number(stats?.sent ?? 0)} />
        <Stat label="Scheduled" value={Number(stats?.queued ?? 0)} />
        <Stat label="Failed" value={Number(stats?.failed ?? 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Sequences (${seqs.length}/${plan.maxSequences})`}>
          {seqs.length === 0 ? (
            <Empty title="No sequences yet">Start with the welcome series template — it's ready to go.</Empty>
          ) : (
            <ul className="mb-4 divide-y divide-slate-100">
              {seqs.map(({ seq, steps, product }) => (
                <li key={seq.id}>
                  <Link href={`/dashboard/email/${seq.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div>
                      <div className="font-medium">{seq.name}</div>
                      <div className="text-xs text-slate-500">
                        {TRIGGER_LABEL[seq.trigger]}{product ? `: ${product}` : ""} · {steps} email{Number(steps) === 1 ? "" : "s"}
                      </div>
                    </div>
                    {seq.active ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={createSequence} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <Field label="Start from">
              <Select name="template" defaultValue="welcome">
                <option value="welcome">Welcome series (3 emails)</option>
                <option value="buyer">After purchase (2 emails)</option>
                <option value="">Blank</option>
              </Select>
            </Field>
            <Field label="Send when">
              <Select name="trigger" defaultValue="">
                <option value="">Use the template's trigger</option>
                {Object.entries(TRIGGER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Only for this product (optional)">
              <Select name="productId" defaultValue="">
                <option value="">Any product</option>
                {items.filter((p) => p.type !== "link").map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
            <SubmitButton variant="secondary">Create sequence</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Send a broadcast">
          <ActionForm action={sendBroadcast} className="space-y-3" resetOnSuccess>
            <Field label="Subject">
              <Input name="subject" required maxLength={200} placeholder="Big news, {{first_name}}!" />
            </Field>
            <Field label="Message" hint="Markdown supported. Use {{first_name}}, {{store_name}}, {{store_url}}. An unsubscribe link is added automatically.">
              <Textarea name="body" rows={8} required />
            </Field>
            <Field label="Only contacts tagged (optional)" hint="e.g. customer, lead, course">
              <Input name="tag" />
            </Field>
            <SubmitButton pendingText="Queuing…">Send to subscribers</SubmitButton>
          </ActionForm>
          {history.length > 0 && (
            <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-100 text-sm">
              {history.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{b.subject}</span>
                  <span className="shrink-0 text-slate-500">{b.recipientCount} · {b.createdAt.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
