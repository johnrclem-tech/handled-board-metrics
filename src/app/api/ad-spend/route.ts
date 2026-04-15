import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { adCampaignPerformance, adGroupPerformance } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const view = request.nextUrl.searchParams.get("view") || "campaigns"
    const db = getDb()

    if (view === "ad-groups") {
      const rows = await db
        .select()
        .from(adGroupPerformance)
        .orderBy(sql`date DESC NULLS LAST, cost DESC NULLS LAST`)
      return NextResponse.json({ view: "ad-groups", rows })
    }

    const rows = await db
      .select()
      .from(adCampaignPerformance)
      .orderBy(sql`date DESC NULLS LAST, cost DESC NULLS LAST`)
    return NextResponse.json({ view: "campaigns", rows })
  } catch (error) {
    console.error("Ad spend error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch ad spend" },
      { status: 500 }
    )
  }
}
