import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { adCampaignPerformance } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(adCampaignPerformance)
      .orderBy(sql`date DESC NULLS LAST, cost DESC NULLS LAST`)
    return NextResponse.json({ rows })
  } catch (error) {
    console.error("Ad spend error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ad spend" },
      { status: 500 }
    )
  }
}
