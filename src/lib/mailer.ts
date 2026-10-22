import { env } from "./env";
import { escapeHtml, renderMarkdown } from "./safe";

export type Email = {
  to: string;
  subject: string;
  /** Markdown body. Rendered to safe HTML and a plain-text version. */
  body: string;
  fromName?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
};

export type SentEmail = Email & { html: string; sentAt: Date };

// The last emails sent, kept in memory so tests and the dev console can inspect them.
export const outbox: SentEmail[] = [];

export function renderEmailHtml(email: Email): string {
  const footer = email.unsubscribeUrl
    ? `<p style="font-size:12px;color:#6b7280;margin-top:32px">You're receiving this because you signed up or bought from ${escapeHtml(
        email.fromName ?? env.appName,
      )}. <a href="${escapeHtml(email.unsubscribeUrl)}">Unsubscribe</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px">${renderMarkdown(
    email.body,
  )}${footer}</body></html>`;
}

function fromHeader(name?: string) {
  if (!name) return env.emailFrom;
  const addr = /<([^>]+)>/.exec(env.emailFrom)?.[1] ?? env.emailFrom;
  return `${name.replace(/[<>"\r\n]/g, "").slice(0, 60)} <${addr}>`;
}

export async function sendEmail(email: Email): Promise<void> {
  const subject = email.subject.replace(/[\r\n]+/g, " ").slice(0, 200);
  const html = renderEmailHtml(email);
  const record: SentEmail = { ...email, subject, html, sentAt: new Date() };
  outbox.unshift(record);
  outbox.length = Math.min(outbox.length, 200);

  if (env.emailProvider === "resend" && env.resendApiKey) {
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      // One-click unsubscribe (RFC 8058) posts to the API route; the footer link opens a confirm page.
      headers["List-Unsubscribe"] = `<${email.unsubscribeUrl.replace("/u/", "/api/unsubscribe/")}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(email.fromName),
        to: [email.to],
        subject,
        html,
        text: email.body,
        reply_to: email.replyTo,
        headers,
      }),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  if (process.env.NODE_ENV !== "test") {
    console.log(`[email] to=${email.to} subject="${subject}"\n${email.body}\n`);
  }
}
