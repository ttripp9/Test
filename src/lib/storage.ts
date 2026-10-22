import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

const IMAGE_MAX = 5 * 1024 * 1024;
const FILE_MAX = 50 * 1024 * 1024;

function storagePath(id: string) {
  if (!/^[A-Za-z0-9]{16}$/.test(id)) throw new Error("Bad media id");
  return path.resolve(env.storageDir, id.slice(0, 2), id);
}

/** Detect image type from the file's first bytes rather than trusting the browser. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

export type StoredFile = { mimeType: string; sizeBytes: number; filename: string };

export async function saveUpload(id: string, file: File, kind: "image" | "file"): Promise<StoredFile> {
  const max = kind === "image" ? IMAGE_MAX : FILE_MAX;
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > max) throw new Error(`Files must be under ${Math.round(max / 1024 / 1024)}MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  let mimeType = "application/octet-stream";
  if (kind === "image") {
    const sniffed = sniffImage(buf);
    if (!sniffed) throw new Error("Upload a PNG, JPG, WEBP or GIF image.");
    mimeType = sniffed;
  }
  const target = storagePath(id);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buf, { mode: 0o600 });
  const filename = (file.name || "download").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return { mimeType, sizeBytes: buf.length, filename };
}

export async function readUpload(id: string): Promise<Buffer> {
  return fs.readFile(storagePath(id));
}

export async function deleteUpload(id: string): Promise<void> {
  await fs.rm(storagePath(id), { force: true });
}
