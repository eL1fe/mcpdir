import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let neonClient: NeonQueryFunction<false, false> | null = null;
let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

function ensureConnection() {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    neonClient = neon(process.env.DATABASE_URL);
    dbInstance = drizzle(neonClient, { schema });
  }
  return { db: dbInstance, sql: neonClient! };
}

function getDb() {
  return ensureConnection().db;
}

export function getSql() {
  return ensureConnection().sql;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return getDb()[prop as keyof NeonHttpDatabase<typeof schema>];
  },
});
