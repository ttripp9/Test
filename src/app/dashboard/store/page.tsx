import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Checkbox, Field, Input, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { requireCreator } from "@/lib/auth";
import { env } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { getPlan } from "@/lib/plans";
import { THEME_PRESETS } from "@/lib/themes";
import { applyPreset, saveDesign, savePixels, saveProfile } from "./actions";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export default async function StoreSettings() {
  const { user, store } = await requireCreator();
  const plan = getPlan(user.plan);
  const t = store.theme;
  const avatar = mediaUrl(store.avatarMediaId);
  return (
    <>
      <PageHeader title="My store" description="Your profile, look and tracking." actions={<a className={buttonClass("secondary")} href={`/${store.slug}`} target="_blank">View store ↗</a>} />
      <div className="space-y-6">
        <Card title="Profile">
          <ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input name="displayName" defaultValue={store.displayName} required />
            </Field>
            <Field label="Store link" hint={`${env.appUrl.replace(/^https?:\/\//, "")}/${store.slug}`}>
              <Input name="slug" defaultValue={store.slug} required />
            </Field>
            <Field label="Bio" className="sm:col-span-2" hint="Up to 400 characters.">
              <Textarea name="bio" defaultValue={store.bio} maxLength={400} rows={3} />
            </Field>
            <div className="flex items-center gap-4 sm:col-span-2">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-400">{store.displayName[0]}</div>
              )}
              <Field label="Profile photo" hint="PNG, JPG, WEBP or GIF up to 5MB.">
                <Input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
              </Field>
              {avatar && <Checkbox name="removeAvatar" label="Remove" />}
            </div>
            <Field label="Currency">
              <Select name="currency" defaultValue={store.currency}>
                {["usd", "eur", "gbp", "cad", "aud"].map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time zone" hint="Used for booking times.">
              <Select name="timezone" defaultValue={store.timezone}>
                {TIMEZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </Select>
            </Field>
            <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium text-slate-700">Social links</legend>
              {(["instagram", "tiktok", "youtube", "x", "linkedin", "threads", "website"] as const).map((k) => (
                <Input key={k} name={k} type="url" placeholder={`${k === "x" ? "X / Twitter" : k[0].toUpperCase() + k.slice(1)} URL`} defaultValue={store.socials[k] ?? ""} />
              ))}
              <Input name="email" type="email" placeholder="Contact email" defaultValue={store.socials.email ?? ""} />
            </fieldset>
            <div className="sm:col-span-2">
              <Checkbox name="published" defaultChecked={store.published} label="Store is live" hint="Turn off to hide your store while you set up." />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Save profile</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Design">
          <div className="mb-5 flex flex-wrap gap-2">
            {Object.entries(THEME_PRESETS).map(([name, p]) => (
              <form key={name} action={applyPreset}>
                <input type="hidden" name="preset" value={name} />
                <button
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm capitalize"
                  style={{ background: p.background, color: p.text, borderColor: t.preset === name ? p.accent : "#e2e8f0", borderWidth: t.preset === name ? 2 : 1 }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: p.accent }} />
                  {name}
                </button>
              </form>
            ))}
          </div>
          <ActionForm action={saveDesign} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="preset" value={t.preset} />
            {(["accent", "background", "text", "card"] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} color`}>
                <Input name={k} type="color" defaultValue={t[k]} className="h-10 p-1" />
              </Field>
            ))}
            <Field label="Font">
              <Select name="font" defaultValue={t.font}>
                <option value="sans">Clean sans</option>
                <option value="rounded">Friendly rounded</option>
                <option value="serif">Classic serif</option>
                <option value="mono">Monospace</option>
              </Select>
            </Field>
            <Field label="Button shape">
              <Select name="buttonShape" defaultValue={t.buttonShape}>
                <option value="pill">Pill</option>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </Select>
            </Field>
            <Field label="Layout">
              <Select name="layout" defaultValue={t.layout}>
                <option value="list">List (best on phones)</option>
                <option value="grid">Grid</option>
              </Select>
            </Field>
            <Field
              label="Custom CSS"
              className="sm:col-span-2"
              hint={plan.customCss ? "Applied to your store page only." : "Available on the Business plan."}
            >
              <Textarea name="customCss" defaultValue={store.customCss} rows={5} disabled={!plan.customCss} className="font-mono text-xs" placeholder=".store-card { border: 2px solid black; }" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Save design</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Tracking pixels">
          <p className="mb-4 text-sm text-slate-500">Included on every plan. Page views, checkouts and purchases are sent automatically.</p>
          <ActionForm action={savePixels} className="grid gap-4 sm:grid-cols-3">
            <Field label="Meta (Facebook) Pixel ID" hint="Numbers only">
              <Input name="metaPixelId" defaultValue={store.pixels.metaPixelId ?? ""} inputMode="numeric" />
            </Field>
            <Field label="TikTok Pixel ID">
              <Input name="tiktokPixelId" defaultValue={store.pixels.tiktokPixelId ?? ""} />
            </Field>
            <Field label="Google Analytics 4 ID" hint="Looks like G-XXXXXXX">
              <Input name="ga4Id" defaultValue={store.pixels.ga4Id ?? ""} />
            </Field>
            <div className="sm:col-span-3">
              <SubmitButton>Save pixels</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
