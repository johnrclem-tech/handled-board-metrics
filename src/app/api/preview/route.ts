import { NextRequest, NextResponse } from "next/server"
import { read as xlsxRead, utils as xlsxUtils } from "xlsx"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = xlsxRead(buffer, { type: "array" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

    // Return first 10 rows so we can see headers + sample data
    const preview = rawData.slice(0, 10).map((row, i) => ({
      rowIndex: i,
      cells: (row as unknown[]).map((cell, j) => ({
        col: j,
        value: cell,
        type: typeof cell,
      })),
    }))

    return NextResponse.json({
      fileName: file.name,
      sheetName,
      totalRows: rawData.length,
      totalSheets: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      preview,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    )
  }
}
