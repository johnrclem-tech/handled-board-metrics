import { NextRequest, NextResponse } from "next/server"
import { parseExcelFile } from "@/lib/excel-parser"
import { getDb } from "@/lib/db"
import { financialData, uploads } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const reportType = formData.get("reportType") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!reportType) {
      return NextResponse.json({ error: "Report type is required" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const parsed = parseExcelFile(buffer, reportType)
    const db = getDb()

    // Collect unique periods and categories for metadata
    const uniquePeriods = [...new Set(parsed.rows.map((r) => r.period))].sort()
    const uniqueCategories = [...new Set(parsed.rows.map((r) => r.category))]

    // Delete existing data for the same category and periods being imported
    // This ensures re-uploading a file overwrites old values instead of duplicating
    if (uniquePeriods.length > 0 && uniqueCategories.length > 0) {
      await db
        .delete(financialData)
        .where(
          and(
            inArray(financialData.category, uniqueCategories),
            inArray(financialData.period, uniquePeriods)
          )
        )
    }

    // Insert upload record
    const [upload] = await db
      .insert(uploads)
      .values({
        fileName: file.name,
        fileType: reportType,
        recordCount: parsed.rows.length,
        status: "processed",
        metadata: { periods: uniquePeriods },
      })
      .returning()

    // Insert financial data rows
    if (parsed.rows.length > 0) {
      await db.insert(financialData).values(
        parsed.rows.map((row) => ({
          reportType: parsed.reportType,
          period: row.period,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          category: row.category,
          subcategory: row.subcategory,
          accountName: row.accountName,
          amount: String(row.amount),
        }))
      )
    }

    return NextResponse.json({
      success: true,
      upload,
      rowCount: parsed.rows.length,
      periods: uniquePeriods,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
