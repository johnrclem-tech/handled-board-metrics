import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData, uploads } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type")
  const db = getDb()

  // Record counts by report type
  const counts = await db
    .select({
      reportType: financialData.reportType,
      count: sql<number>`count(*)`,
    })
    .from(financialData)
    .groupBy(financialData.reportType)

  // Recent uploads
  const recentUploads = await db
    .select()
    .from(uploads)
    .orderBy(sql`uploaded_at DESC`)
    .limit(10)

  // Sample data for a specific type
  let sample: unknown[] = []
  if (type) {
    sample = await db
      .select()
      .from(financialData)
      .where(eq(financialData.reportType, type))
      .limit(50)
  }

  // Distinct categories and fields for leads/opportunities
  let fieldSummary: unknown[] = []
  if (type) {
    fieldSummary = await db
      .select({
        category: financialData.category,
        subcategory: financialData.subcategory,
        sampleAccount: sql<string>`MIN(account_name)`,
        count: sql<number>`count(*)`,
        periods: sql<string>`string_agg(DISTINCT period, ', ' ORDER BY period)`,
      })
      .from(financialData)
      .where(eq(financialData.reportType, type))
      .groupBy(financialData.category, financialData.subcategory)
  }

  return NextResponse.json({ counts, recentUploads, sample, fieldSummary })
}
