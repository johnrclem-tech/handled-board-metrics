import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { uploads } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = getDb()
    const allUploads = await db
      .select()
      .from(uploads)
      .orderBy(desc(uploads.uploadedAt))

    return NextResponse.json({ uploads: allUploads })
  } catch (error) {
    console.error("Uploads fetch error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch uploads" },
      { status: 500 }
    )
  }
}
