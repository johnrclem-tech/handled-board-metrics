import * as XLSX from "xlsx"

export interface ParsedRow {
  category: string
  subcategory: string | null
  accountName: string
  amount: number
}

export interface ParsedReport {
  reportType: string
  period: string
  periodStart: string
  periodEnd: string
  rows: ParsedRow[]
}

export function parseExcelFile(buffer: ArrayBuffer, reportType: string): ParsedReport {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

  // Try to detect period from headers or filename
  const headers = (rawData[0] || []) as string[]
  let period = new Date().toISOString().slice(0, 7)
  let periodStart = new Date().toISOString().slice(0, 10)
  let periodEnd = new Date().toISOString().slice(0, 10)

  // Look for date patterns in headers
  for (const header of headers || []) {
    if (typeof header === "string") {
      const dateMatch = header.match(/(\w+\s+\d{4})|(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2})/)
      if (dateMatch) {
        const parsed = new Date(dateMatch[0])
        if (!isNaN(parsed.getTime())) {
          period = parsed.toISOString().slice(0, 7)
          periodStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1).toISOString().slice(0, 10)
          periodEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).toISOString().slice(0, 10)
        }
      }
    }
  }

  const rows: ParsedRow[] = []
  let currentCategory = ""
  let currentSubcategory: string | null = null

  // Process rows - QuickBooks P&L typically has:
  // Column A: Account name (with indentation for hierarchy)
  // Last column(s): Amount(s)
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as (string | number)[]
    if (!row || row.length === 0) continue

    const firstCell = String(row[0] || "").trim()
    if (!firstCell) continue

    // Find the last numeric value in the row
    let amount: number | null = null
    for (let j = row.length - 1; j >= 1; j--) {
      const val = row[j]
      if (typeof val === "number") {
        amount = val
        break
      }
      if (typeof val === "string") {
        const cleaned = val.replace(/[$,()]/g, "").trim()
        const parsed = parseFloat(cleaned)
        if (!isNaN(parsed)) {
          amount = val.includes("(") ? -parsed : parsed
          break
        }
      }
    }

    // Detect category headers (usually bold/uppercase or "Total" lines)
    const isTotalLine = firstCell.toLowerCase().startsWith("total ")
    const isMainCategory = firstCell === firstCell.toUpperCase() && firstCell.length > 2 && !isTotalLine

    if (isMainCategory && amount === null) {
      currentCategory = firstCell
      currentSubcategory = null
      continue
    }

    if (isTotalLine) {
      // Skip total lines as they're calculated
      continue
    }

    if (amount !== null) {
      rows.push({
        category: currentCategory || "Uncategorized",
        subcategory: currentSubcategory,
        accountName: firstCell,
        amount,
      })
    } else if (!isTotalLine) {
      // Could be a subcategory header
      currentSubcategory = firstCell
    }
  }

  return {
    reportType,
    period,
    periodStart,
    periodEnd,
    rows,
  }
}
