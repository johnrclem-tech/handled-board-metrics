import { neon } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

let _db: NeonHttpDatabase<typeof schema> | null = null

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Please add it to .env.local or your Vercel environment variables."
      )
    }
    const sql = neon(process.env.DATABASE_URL)
    _db = drizzle(sql, { schema })
  }
  return _db
}

// For convenience - use getDb() in API routes
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
