// Helpers that keep creator-provided content from turning into XSS or open redirects.

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the URL only if it is an absolute http(s) URL. */
export function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function inline(text: string): string {
  // `text` is already HTML-escaped here.
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const decoded = href.replace(/&amp;/g, "&");
      const safe = safeHttpUrl(decoded);
      if (!safe) return label;
      return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    });
}

/**
 * Minimal Markdown to HTML. Everything is escaped first, so creators can't
 * inject tags or scripts; only a small set of formatting is produced.
 */
export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src.replace(/\r\n?/g, "\n")).split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join("<br>"))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length + 1; // h2-h4 inside content
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      flushPara();
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
    } else if (/^&gt;\s?/.test(line)) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/, ""))}</blockquote>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join("\n");
}

const RESERVED_SLUGS = new Set([
  "api", "access", "login", "signup", "logout", "dashboard", "admin", "checkout", "learn", "d", "u", "m",
  "aff", "media", "pricing", "settings", "static", "_next", "about", "terms", "privacy", "help",
  "support", "www", "app", "blog", "store", "stores", "favicon.ico", "robots.txt", "sitemap.xml",
]);

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function slugError(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 letters or numbers.";
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved. Try another.";
  return null;
}

/** Strip anything that could break out of a <style> tag or load remote code. */
export function sanitizeCss(css: string): string {
  return css
    .slice(0, 20_000)
    .replace(/<\/?[a-z!][^>]*>?/gi, "")
    .replace(/[<>]/g, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/behavior\s*:/gi, "");
}

export function cleanPixelIds(input: { metaPixelId?: string; tiktokPixelId?: string; ga4Id?: string }) {
  const meta = input.metaPixelId?.trim() ?? "";
  const tiktok = input.tiktokPixelId?.trim().toUpperCase() ?? "";
  const ga4 = input.ga4Id?.trim().toUpperCase() ?? "";
  return {
    metaPixelId: /^\d{5,20}$/.test(meta) ? meta : undefined,
    tiktokPixelId: /^[A-Z0-9]{10,30}$/.test(tiktok) ? tiktok : undefined,
    ga4Id: /^G-[A-Z0-9]{4,15}$/.test(ga4) ? ga4 : undefined,
  };
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Convert a YouTube/Vimeo/Loom link to an embeddable player URL, or null. */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  const safe = safeHttpUrl(input);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (/^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  }
  if (host === "loom.com") {
    const m = /^\/share\/([a-f0-9]{16,40})/.exec(url.pathname);
    if (m) return `https://www.loom.com/embed/${m[1]}`;
  }
  return null;
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(value);
}
