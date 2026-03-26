import { NextRequest, NextResponse } from "next/server"
import { parseExcelFile } from "@/lib/excel-parser"
import { getDb } from "@/lib/db"
import { financialData, uploads } from "@/lib/db/schema"

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

    // Collect unique periods for metadata
    const uniquePeriods = [...new Set(parsed.rows.map((r) => r.period))].sort()

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
