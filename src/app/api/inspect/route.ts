import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData, leads, opportunities, uploads } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type")
  const db = getDb()

  // Record counts by report type
  const financialCounts = await db
    .select({
      reportType: financialData.reportType,
      count: sql<number>`count(*)`,
    })
    .from(financialData)
    .groupBy(financialData.reportType)

  const leadsCount = await db.select({ count: sql<number>`count(*)` }).from(leads)
  const oppsCount = await db.select({ count: sql<number>`count(*)` }).from(opportunities)

  const counts = [
    ...financialCounts,
    { reportType: "leads", count: leadsCount[0]?.count ?? 0 },
    { reportType: "opportunities", count: oppsCount[0]?.count ?? 0 },
  ]

  // Recent uploads
  const recentUploads = await db
    .select()
    .from(uploads)
    .orderBy(sql`uploaded_at DESC`)
    .limit(10)

  // Sample data for a specific type
  let sample: unknown[] = []
  if (type === "leads") {
    sample = await db.select().from(leads).limit(50)
  } else if (type === "opportunities") {
    sample = await db.select().from(opportunities).limit(50)
  } else if (type) {
    sample = await db
      .select()
      .from(financialData)
      .where(eq(financialData.reportType, type))
      .limit(50)
  }

  return NextResponse.json({ counts, recentUploads, sample })
}
