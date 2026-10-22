import type { StoreTheme } from "./db/schema";

export const THEME_PRESETS: Record<string, Omit<StoreTheme, "preset" | "layout" | "buttonShape">> = {
  minimal: { accent: "#111827", background: "#f8fafc", text: "#0f172a", card: "#ffffff", font: "sans" },
  midnight: { accent: "#a78bfa", background: "#0b1020", text: "#e5e7eb", card: "#151b2e", font: "sans" },
  sunset: { accent: "#f97316", background: "#fff7ed", text: "#431407", card: "#ffffff", font: "rounded" },
  forest: { accent: "#15803d", background: "#f0fdf4", text: "#052e16", card: "#ffffff", font: "serif" },
  candy: { accent: "#db2777", background: "#fdf2f8", text: "#500724", card: "#ffffff", font: "rounded" },
  ocean: { accent: "#0284c7", background: "#f0f9ff", text: "#082f49", card: "#ffffff", font: "sans" },
  mono: { accent: "#e5e5e5", background: "#0a0a0a", text: "#fafafa", card: "#171717", font: "mono" },
};

export const DEFAULT_THEME: StoreTheme = {
  preset: "minimal",
  ...THEME_PRESETS.minimal,
  buttonShape: "pill",
  layout: "list",
};

export const FONT_STACKS: Record<StoreTheme["font"], string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
};

export const RADIUS: Record<StoreTheme["buttonShape"], string> = {
  pill: "9999px",
  rounded: "14px",
  square: "4px",
};

/** Pick black or white text for good contrast on a background color. */
export function contrastText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0a0a0a" : "#ffffff";
}
