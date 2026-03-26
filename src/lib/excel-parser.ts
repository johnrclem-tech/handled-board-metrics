import * as XLSX from "xlsx"

export interface ParsedRow {
  category: string
  subcategory: string | null
  accountName: string
  amount: number
  period: string
  periodStart: string
  periodEnd: string
}

export interface ParsedReport {
  reportType: string
  rows: ParsedRow[]
}

const MONTH_YEAR_PATTERN = /^(\w+)\s+(\d{4})$/

function parseMonthHeader(header: string): { period: string; periodStart: string; periodEnd: string } | null {
  const match = header.trim().match(MONTH_YEAR_PATTERN)
  if (!match) return null

  const parsed = new Date(`${match[1]} 1, ${match[2]}`)
  if (isNaN(parsed.getTime())) return null

  const year = parsed.getFullYear()
  const month = parsed.getMonth()
  const period = `${year}-${String(month + 1).padStart(2, "0")}`
  const periodStart = new Date(year, month, 1).toISOString().slice(0, 10)
  const periodEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  return { period, periodStart, periodEnd }
}

function parseCellAmount(val: unknown): number | null {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const cleaned = val.replace(/[$,()]/g, "").trim()
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      return val.includes("(") ? -parsed : parsed
    }
  }
  return null
}

/**
 * Parse QuickBooks "Revenue by Customer" style reports.
 * Layout: Row 5 has month headers across columns, rows 6+ have customer names
 * in column A with amounts in each month's column.
 */
const REPORT_TYPE_CATEGORIES: Record<string, string> = {
  storage_revenue_by_customer: "Storage Revenue",
  shipping_revenue_by_customer: "Shipping Revenue",
  handling_revenue_by_customer: "Handling Revenue",
  revenue_by_customer: "Revenue",
}

function parseRevenueByCustomer(rawData: unknown[][], reportType: string): ParsedReport {
  const category = REPORT_TYPE_CATEGORIES[reportType] || "Revenue"
  const rows: ParsedRow[] = []

  // Find the header row containing month/year strings (e.g., "September 2024")
  let headerRowIndex = -1
  let monthColumns: { colIndex: number; period: string; periodStart: string; periodEnd: string }[] = []

  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i] as unknown[]
    if (!row) continue

    const candidates: typeof monthColumns = []
    for (let j = 1; j < row.length; j++) {
      const cell = row[j]
      if (typeof cell === "string") {
        const parsed = parseMonthHeader(cell)
        if (parsed) {
          candidates.push({ colIndex: j, ...parsed })
        }
      }
    }

    // If we found 2+ month headers in this row, it's the header row
    if (candidates.length >= 2) {
      headerRowIndex = i
      monthColumns = candidates
      break
    }
  }

  if (headerRowIndex === -1 || monthColumns.length === 0) {
    // Fallback: couldn't detect month headers
    return { reportType, rows: [] }
  }

  // Process data rows after the header
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length === 0) continue

    const customerName = String(row[0] || "").trim()
    if (!customerName) continue

    // Skip total/summary rows
    if (customerName.toLowerCase().startsWith("total")) continue

    // For each month column, create a record if there's a value
    for (const col of monthColumns) {
      const amount = parseCellAmount(row[col.colIndex])
      if (amount !== null && amount !== 0) {
        rows.push({
          category,
          subcategory: null,
          accountName: customerName,
          amount,
          period: col.period,
          periodStart: col.periodStart,
          periodEnd: col.periodEnd,
        })
      }
    }
  }

  return { reportType, rows }
}

/**
 * Parse standard QuickBooks P&L / Balance Sheet / Cash Flow reports.
 * Layout: Column A has account names, last column has amounts.
 */
function parseProfitLoss(rawData: unknown[][], reportType: string): ParsedReport {
  // Try to detect period from headers
  const headers = (rawData[0] || []) as string[]
  let period = new Date().toISOString().slice(0, 7)
  let periodStart = new Date().toISOString().slice(0, 10)
  let periodEnd = new Date().toISOString().slice(0, 10)

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

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as (string | number)[]
    if (!row || row.length === 0) continue

    const firstCell = String(row[0] || "").trim()
    if (!firstCell) continue

    // Find the last numeric value in the row
    let amount: number | null = null
    for (let j = row.length - 1; j >= 1; j--) {
      amount = parseCellAmount(row[j])
      if (amount !== null) break
    }

    const isTotalLine = firstCell.toLowerCase().startsWith("total ")
    const isMainCategory = firstCell === firstCell.toUpperCase() && firstCell.length > 2 && !isTotalLine

    if (isMainCategory && amount === null) {
      currentCategory = firstCell
      currentSubcategory = null
      continue
    }

    if (isTotalLine) continue

    if (amount !== null) {
      rows.push({
        category: currentCategory || "Uncategorized",
        subcategory: currentSubcategory,
        accountName: firstCell,
        amount,
        period,
        periodStart,
        periodEnd,
      })
    } else if (!isTotalLine) {
      currentSubcategory = firstCell
    }
  }

  return { reportType, rows }
}

export function parseExcelFile(buffer: ArrayBuffer, reportType: string): ParsedReport {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

  const revenueByCustomerTypes = [
    "revenue_by_customer",
    "storage_revenue_by_customer",
    "shipping_revenue_by_customer",
    "handling_revenue_by_customer",
  ]

  if (revenueByCustomerTypes.includes(reportType)) {
    return parseRevenueByCustomer(rawData, reportType)
  }

  return parseProfitLoss(rawData, reportType)
}
