import { and, asc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, Checkbox, Field, Input, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { quizToText } from "@/lib/courses";
import { db } from "@/lib/db";
import { lessons, media, products } from "@/lib/db/schema";
import { mediaUrl } from "@/lib/media";
import { PRODUCT_TYPES } from "@/lib/product-types";
import { addLesson, archiveProduct, deleteLesson, duplicateProduct, moveLesson, saveLesson, saveProduct } from "../actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2).replace(/\.00$/, ""));

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const { store } = await requireCreator();
  const product = await db.select().from(products).where(and(eq(products.id, id), eq(products.storeId, store.id))).get();
  if (!product || product.archived) notFound();
  const others = await db
    .select({ id: products.id, title: products.title, type: products.type })
    .from(products)
    .where(and(eq(products.storeId, store.id), ne(products.id, product.id), eq(products.archived, false)))
    .orderBy(asc(products.position))
    .all();
  const sellable = others.filter((o) => !["link", "tip", "membership", "bundle"].includes(o.type));
  const file = product.fileMediaId ? await db.select().from(media).where(eq(media.id, product.fileMediaId)).get() : null;
  const courseLessons = product.type === "course"
    ? await db.select().from(lessons).where(eq(lessons.productId, product.id)).orderBy(asc(lessons.position)).all()
    : [];
  const t = PRODUCT_TYPES[product.type];
  const s = product.settings;
  const image = mediaUrl(product.imageMediaId);
  const priced = ["digital", "course", "booking", "membership", "bundle"].includes(product.type);
  const delivers = ["digital", "lead_magnet", "bundle", "course"].includes(product.type);

  return (
    <>
      <PageHeader
        title={product.title}
        description={`${t.emoji} ${t.label}`}
        actions={
          <>
            {product.type !== "link" && (
              <a className={buttonClass("secondary")} href={`/${store.slug}/p/${product.id}`} target="_blank">Preview ↗</a>
            )}
            <Link className={buttonClass("ghost")} href="/dashboard/products">← All products</Link>
          </>
        }
      />
      {isNew && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Your product is hidden until you tick <b>Show on my store</b> and save.
        </p>
      )}

      <ActionForm action={saveProduct} className="space-y-6">
        <input type="hidden" name="id" value={product.id} />
        <Card title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" defaultValue={product.title} required maxLength={120} />
            </Field>
            <Field label="Short subtitle" className="sm:col-span-2" hint="Shown on your store under the title.">
              <Input name="subtitle" defaultValue={product.subtitle} maxLength={160} />
            </Field>
            {product.type !== "link" && (
              <Field label="Description" className="sm:col-span-2" hint="Supports **bold**, *italic*, # headings, - lists and [links](https://…).">
                <Textarea name="description" defaultValue={product.description} rows={8} />
              </Field>
            )}
            <Field label="Button text">
              <Input name="ctaLabel" defaultValue={product.ctaLabel} maxLength={40} />
            </Field>
            <div className="flex items-end gap-3">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <Field label="Cover image" hint="Up to 5MB">
                <Input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif" />
              </Field>
            </div>
            {image && <Checkbox name="removeImage" label="Remove cover image" />}
            <div className="sm:col-span-2">
              <Checkbox name="active" defaultChecked={product.active} label="Show on my store" />
            </div>
          </div>
        </Card>

        {product.type === "link" && (
          <Card title="Link">
            <Field label="Where should this go?">
              <Input name="url" type="url" defaultValue={s.url ?? ""} required />
            </Field>
          </Card>
        )}

        {(priced || product.type === "tip") && (
          <Card title="Pricing">
            <div className="grid gap-4 sm:grid-cols-3">
              {priced && (
                <Field label={product.type === "membership" ? `Price per ${s.interval ?? "month"}` : "Price"} hint="Use 0 to make it free.">
                  <Input name="price" defaultValue={money(product.priceCents)} inputMode="decimal" required />
                </Field>
              )}
              {priced && product.type !== "membership" && (
                <Field label="Compare-at price" hint="Shown crossed out.">
                  <Input name="compareAt" defaultValue={money(product.compareAtCents)} inputMode="decimal" />
                </Field>
              )}
              {product.type === "membership" && (
                <Field label="Billing">
                  <Select name="interval" defaultValue={s.interval ?? "month"}>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </Select>
                </Field>
              )}
              {product.type === "tip" && (
                <Field label="Minimum tip">
                  <Input name="minPrice" defaultValue={money(s.minPriceCents ?? 300)} inputMode="decimal" />
                </Field>
              )}
              {(product.type === "digital" || product.type === "course") && (
                <>
                  <div className="flex items-end">
                    <Checkbox name="payWhatYouWant" defaultChecked={s.payWhatYouWant} label="Pay what you want" hint="Buyers can pay more than the minimum." />
                  </div>
                  <Field label="Minimum (pay what you want)">
                    <Input name="minPrice" defaultValue={money(s.minPriceCents)} inputMode="decimal" />
                  </Field>
                </>
              )}
            </div>
          </Card>
        )}

        {delivers && (
          <Card title="Delivery">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="File" hint={file ? `Current: ${file.filename} (${Math.round(file.sizeBytes / 1024)} KB)` : "Up to 50MB. Buyers get a private download link."}>
                <Input type="file" name="file" />
              </Field>
              <Field label="…or a private link" hint="Notion, Google Drive, Dropbox, etc.">
                <Input name="deliveryUrl" type="url" defaultValue={s.deliveryUrl ?? ""} placeholder="https://" />
              </Field>
              {file && <Checkbox name="removeFile" label="Remove file" />}
              <Field label="Download limit per buyer">
                <Input name="maxDownloads" type="number" min={1} max={1000} defaultValue={s.maxDownloads ?? 20} />
              </Field>
              <Field label="Thank-you message" className="sm:col-span-2" hint="Shown after purchase and in the receipt email.">
                <Textarea name="thankYouMessage" defaultValue={s.thankYouMessage ?? ""} rows={3} />
              </Field>
            </div>
          </Card>
        )}

        {product.type === "booking" && (
          <Card title="Availability">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Call length (minutes)">
                <Input name="durationMinutes" type="number" min={10} max={480} defaultValue={s.durationMinutes ?? 30} />
              </Field>
              <Field label="Break between calls (minutes)">
                <Input name="bufferMinutes" type="number" min={0} max={240} defaultValue={s.bufferMinutes ?? 15} />
              </Field>
              <Field label="Bookable days ahead">
                <Input name="daysAhead" type="number" min={1} max={90} defaultValue={s.daysAhead ?? 14} />
              </Field>
              <Field label="From">
                <Input name="startTime" type="time" defaultValue={s.startTime ?? "09:00"} />
              </Field>
              <Field label="Until">
                <Input name="endTime" type="time" defaultValue={s.endTime ?? "17:00"} />
              </Field>
              <Field label="Meeting link" hint="Zoom, Google Meet, etc. Sent after booking.">
                <Input name="meetingUrl" type="url" defaultValue={s.meetingUrl ?? ""} />
              </Field>
              <fieldset className="sm:col-span-3">
                <legend className="mb-2 text-sm font-medium text-slate-700">Days ({store.timezone})</legend>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d, i) => (
                    <Checkbox key={d} name="weekdays" value={String(i)} label={d} defaultChecked={(s.weekdays ?? [1, 2, 3, 4, 5]).includes(i)} />
                  ))}
                </div>
              </fieldset>
            </div>
          </Card>
        )}

        {product.type === "membership" && (
          <Card title="Members-only content">
            <Field label="What members see" hint="Markdown. Members get a private page with this content while their subscription is active.">
              <Textarea name="memberContent" defaultValue={s.memberContent ?? ""} rows={10} />
            </Field>
          </Card>
        )}

        {product.type === "bundle" && (
          <Card title="What's in the bundle">
            {others.filter((o) => !["link", "tip", "bundle", "membership"].includes(o.type)).length === 0 ? (
              <p className="text-sm text-slate-500">Create some products first, then add them here.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {others
                  .filter((o) => !["link", "tip", "bundle", "membership"].includes(o.type))
                  .map((o) => (
                    <Checkbox key={o.id} name="bundleProductIds" value={o.id} label={o.title} hint={PRODUCT_TYPES[o.type].label} defaultChecked={s.bundleProductIds?.includes(o.id)} />
                  ))}
              </div>
            )}
          </Card>
        )}

        {product.type !== "link" && product.type !== "tip" && (
          <Card title="Boost your sales">
            <div className="grid gap-4 sm:grid-cols-2">
              {product.type !== "membership" && (
                <>
                  <Field label="Order bump" hint="A one-click add-on shown at checkout.">
                    <Select name="bumpProductId" defaultValue={s.bumpProductId ?? ""}>
                      <option value="">None</option>
                      {sellable.map((o) => (
                        <option key={o.id} value={o.id}>{o.title}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Bump price" hint="Leave empty to use the product's normal price.">
                    <Input name="bumpPrice" defaultValue={money(s.bumpPriceCents)} inputMode="decimal" />
                  </Field>
                </>
              )}
              <Field label="After-purchase offer" hint="Shown on the thank-you page.">
                <Select name="upsellProductId" defaultValue={s.upsellProductId ?? ""}>
                  <option value="">None</option>
                  {others.filter((o) => !["link", "tip"].includes(o.type)).map((o) => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Offer discount %">
                <Input name="upsellDiscountPercent" type="number" min={0} max={90} defaultValue={s.upsellDiscountPercent ?? 20} />
              </Field>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <SubmitButton variant="brand">Save product</SubmitButton>
        </div>
      </ActionForm>

      {product.type === "course" && (
        <Card title={`Lessons (${courseLessons.length})`} className="mt-6">
          <p className="mb-4 text-sm text-slate-500">Students see lessons in this order, grouped by module. Add a quiz to any lesson — students must pass it to complete the lesson, and get a certificate when they finish everything.</p>
          <ul className="space-y-2">
            {courseLessons.map((l, i) => (
              <li key={l.id} className="rounded-xl border border-slate-200">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className="text-xs text-slate-400">{i + 1}</span>
                    <span className="flex-1">
                      <span className="font-medium">{l.title}</span>
                      <span className="ml-2 text-xs text-slate-500">{l.module}</span>
                    </span>
                    {l.videoUrl && <Badge>Video</Badge>}
                    {l.quiz?.length ? <Badge tone="purple">Quiz · {l.quiz.length}</Badge> : null}
                  </summary>
                  <div className="border-t border-slate-200 p-4">
                    <ActionForm action={saveLesson} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="lessonId" value={l.id} />
                      <Field label="Lesson title">
                        <Input name="title" defaultValue={l.title} />
                      </Field>
                      <Field label="Module">
                        <Input name="module" defaultValue={l.module} />
                      </Field>
                      <Field label="Video link" className="sm:col-span-2" hint="YouTube, Vimeo or Loom.">
                        <Input name="videoUrl" type="url" defaultValue={l.videoUrl ?? ""} />
                      </Field>
                      <Field label="Lesson content" className="sm:col-span-2">
                        <Textarea name="content" defaultValue={l.content} rows={6} />
                      </Field>
                      <Field
                        label="Quiz (optional)"
                        className="sm:col-span-2"
                        hint={<>One question per block. Start with <code>Q:</code>, list options with <code>-</code>, mark the correct one with <code>*</code>.</>}
                      >
                        <Textarea name="quiz" defaultValue={quizToText(l.quiz)} rows={5} className="font-mono text-xs" placeholder={"Q: What's the first step?\n- Guess\n* Research\n- Skip it"} />
                      </Field>
                      <Field label="Pass mark %">
                        <Input name="passPercent" type="number" min={0} max={100} defaultValue={l.passPercent} />
                      </Field>
                      <div className="flex items-end">
                        <SubmitButton size="sm">Save lesson</SubmitButton>
                      </div>
                    </ActionForm>
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      {(["up", "down"] as const).map((dir) => (
                        <form key={dir} action={moveLesson}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="lessonId" value={l.id} />
                          <input type="hidden" name="dir" value={dir} />
                          <Button variant="ghost" size="sm">Move {dir}</Button>
                        </form>
                      ))}
                      <form action={deleteLesson} className="ml-auto">
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="lessonId" value={l.id} />
                        <ConfirmButton message="Delete this lesson? Student progress for it will be lost.">Delete</ConfirmButton>
                      </form>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <form action={addLesson} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="productId" value={product.id} />
            <Input name="title" placeholder="New lesson title" className="max-w-xs" />
            <Input name="module" placeholder="Module" defaultValue={courseLessons.at(-1)?.module ?? "Module 1"} className="max-w-[10rem]" />
            <Button variant="secondary">Add lesson</Button>
          </form>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
        <form action={duplicateProduct}>
          <input type="hidden" name="id" value={product.id} />
          <Button variant="secondary" size="sm">Duplicate</Button>
        </form>
        <form action={archiveProduct}>
          <input type="hidden" name="id" value={product.id} />
          <ConfirmButton message="Archive this product? It will be removed from your store. Past orders and buyer access are kept.">Archive product</ConfirmButton>
        </form>
      </div>
    </>
  );
}
