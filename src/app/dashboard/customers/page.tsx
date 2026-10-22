import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Badge, Card, Checkbox, Empty, Field, Input, PageHeader, Table, Td, Textarea, buttonClass } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { getPlan } from "@/lib/plans";
import { addContacts, deleteContact, toggleSubscribed } from "./actions";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, store } = await requireCreator();
  const { q } = await searchParams;
  const plan = getPlan(user.plan);
  const conds: SQL[] = [eq(contacts.storeId, store.id)];
  const term = q?.trim().slice(0, 100);
  if (term) {
    const pattern = `%${term}%`;
    conds.push(or(like(contacts.email, pattern), like(contacts.name, pattern), like(contacts.tags, pattern))!);
  }
  const [rows, total] = await Promise.all([
    db.select().from(contacts).where(and(...conds)).orderBy(desc(contacts.createdAt)).limit(200).all(),
    db.select({ n: count() }).from(contacts).where(eq(contacts.storeId, store.id)).get(),
  ]);
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total?.n ?? 0} of ${plan.maxContacts.toLocaleString()} contacts. Buyers and leads are added automatically.`}
        actions={<a href="/dashboard/customers/export" className={buttonClass("secondary")}>Export CSV</a>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form className="mb-4 flex gap-2">
            <Input name="q" defaultValue={term} placeholder="Search email, name or tag" />
            <button className={buttonClass("secondary")}>Search</button>
          </form>
          {rows.length === 0 ? (
            <Empty title={term ? "No matches" : "No contacts yet"}>Contacts appear here when someone buys or grabs a freebie.</Empty>
          ) : (
            <Table head={["Contact", "Tags", "Spent", "Email", ""]}>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div className="font-medium">{c.name || "—"}</div>
                    <div className="text-xs text-slate-500">{c.email}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">{c.tags.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}</div>
                  </Td>
                  <Td className="tabular-nums">{c.totalSpentCents ? formatMoney(c.totalSpentCents, store.currency) : "—"}</Td>
                  <Td>
                    <form action={toggleSubscribed}>
                      <input type="hidden" name="id" value={c.id} />
                      <button title="Toggle">{c.subscribed ? <Badge tone="green">Subscribed</Badge> : <Badge>Unsubscribed</Badge>}</button>
                    </form>
                  </Td>
                  <Td>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message="Delete this contact? (Their orders are kept.)" variant="ghost">Delete</ConfirmButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Add contacts">
          <ActionForm action={addContacts} className="space-y-3" resetOnSuccess>
            <Field label="Emails" hint="One per line. You can use Name <email@x.com>. Only add people who agreed to hear from you.">
              <Textarea name="emails" rows={6} required />
            </Field>
            <Field label="Tag (optional)">
              <Input name="tag" placeholder="e.g. podcast" />
            </Field>
            <Checkbox name="welcome" label="Start my welcome sequence for them" />
            <SubmitButton>Add contacts</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
