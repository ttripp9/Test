import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __plinthDb?: DB; __plinthSqlite?: Database.Database };

export function openDatabase(file: string): { db: DB; sqlite: Database.Database } {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return { db, sqlite };
}

function getDb(): DB {
  if (!globalForDb.__plinthDb) {
    const { db, sqlite } = openDatabase(env.databasePath);
    globalForDb.__plinthDb = db;
    globalForDb.__plinthSqlite = sqlite;
  }
  return globalForDb.__plinthDb;
}

/** Lazily-opened database so importing this module never touches disk at build time. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

/** Test hook: swap in a different database (e.g. in-memory). */
export function setDbForTests(next: DB) {
  globalForDb.__plinthDb = next;
}

export { schema };
