import { describe, expect, it } from "vitest";
import { cleanPixelIds, normalizeSlug, renderMarkdown, safeHttpUrl, sanitizeCss, slugError, videoEmbedUrl } from "@/lib/safe";

describe("renderMarkdown", () => {
  it("escapes HTML so creators can't inject scripts", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
  it("only links to http(s) URLs", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("href");
    expect(renderMarkdown("[site](https://example.com)")).toContain('href="https://example.com/"');
  });
  it("does not allow attribute breakout through link URLs", () => {
    const html = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))');
    expect(html).not.toMatch(/"\s*onmouseover=/);
  });
  it("renders basic formatting", () => {
    const html = renderMarkdown("# Title\n\n**bold** and *italic*\n\n- one\n- two");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul>\n<li>one</li>");
  });
});

describe("input cleaning", () => {
  it("rejects non-http URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("https://ok.com")).toBe("https://ok.com/");
  });
  it("normalizes and checks slugs", () => {
    expect(normalizeSlug("  Hello World!! ")).toBe("hello-world");
    expect(slugError("dashboard")).toBeTruthy();
    expect(slugError("ab")).toBeTruthy();
    expect(slugError("cara")).toBeNull();
  });
  it("strips style-tag breakouts from custom CSS", () => {
    const css = sanitizeCss('a{color:red}</style><script>alert(1)</script>@import url(evil.css);');
    expect(css).not.toContain("<");
    expect(css).not.toContain("@import");
    expect(css).toContain("a{color:red}");
  });
  it("only accepts well-formed pixel ids", () => {
    expect(cleanPixelIds({ metaPixelId: "123456789012345", ga4Id: "G-ABC123", tiktokPixelId: "C1234567890ABCDEF" })).toEqual({
      metaPixelId: "123456789012345",
      ga4Id: "G-ABC123",
      tiktokPixelId: "C1234567890ABCDEF",
    });
    expect(cleanPixelIds({ metaPixelId: "1');alert(1)//" }).metaPixelId).toBeUndefined();
  });
  it("converts video links to embeds", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(videoEmbedUrl("https://evil.com/watch?v=abc")).toBeNull();
  });
});
