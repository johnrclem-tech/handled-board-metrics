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

// ── CRM Export Parsers ──────────────────────────────────────────────

/**
 * Find the header row in a CRM export (Zoho-style).
 * Layout: rows 1-6 are metadata, row 7 (index 6) has headers, data starts at row 8.
 * We detect the header row by looking for a row with 3+ non-empty text cells.
 */
function findCrmHeaderRow(rawData: unknown[][]): { headerIndex: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const row = rawData[i] as unknown[]
    if (!row) continue
    const textCells = row.filter((c) => typeof c === "string" && c.trim().length > 0)
    if (textCells.length >= 3) {
      const headers = row.map((c) => (typeof c === "string" ? c.trim() : ""))
      return { headerIndex: i, headers }
    }
  }
  return null
}

function cellStr(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim()
  return s.length > 0 ? s : null
}

/**
 * Parse a date/time string like "Apr 3, 2026 12:31 PM" or an Excel serial number.
 */
function parseCrmDateTime(val: unknown): Date | null {
  if (val == null) return null
  if (typeof val === "number") {
    // Excel serial date number
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + val * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof val === "string") {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Parse a date string like "Apr 30, 2026" or Excel serial to a YYYY-MM-DD string.
 */
function parseCrmDate(val: unknown): string | null {
  const d = parseCrmDateTime(val)
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export interface ParsedLead {
  company: string | null
  leadSource: string | null
  adCampaignName: string | null
  ad: string | null
  fullName: string | null
  leadStatus: string | null
  createdTime: Date | null
}

export interface ParsedOpportunity {
  closingDate: string | null
  opportunityName: string | null
  leadSource: string | null
  leadSourceDetail: string | null
  createdTime: Date | null
  stage: string | null
  ad: string | null
}

export interface ParsedCrmReport {
  reportType: string
  leads?: ParsedLead[]
  opportunities?: ParsedOpportunity[]
  rowCount: number
}

function parseLeads(rawData: unknown[][]): ParsedCrmReport {
  const hdr = findCrmHeaderRow(rawData)
  if (!hdr) return { reportType: "leads", leads: [], rowCount: 0 }

  // Build a column index map from header names
  const col = (name: string) => {
    const lower = name.toLowerCase()
    return hdr.headers.findIndex((h) => h.toLowerCase() === lower)
  }

  const iCompany = col("company")
  const iSource = col("lead source")
  const iCampaign = col("ad campaign name")
  const iAd = col("ad")
  const iName = col("full name")
  const iStatus = col("lead status")
  const iCreated = col("created time")

  const leads: ParsedLead[] = []
  for (let i = hdr.headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length === 0) continue
    // Skip rows where every cell is empty
    if (row.every((c) => c == null || String(c).trim() === "")) continue

    leads.push({
      company: iCompany >= 0 ? cellStr(row[iCompany]) : null,
      leadSource: iSource >= 0 ? cellStr(row[iSource]) : null,
      adCampaignName: iCampaign >= 0 ? cellStr(row[iCampaign]) : null,
      ad: iAd >= 0 ? cellStr(row[iAd]) : null,
      fullName: iName >= 0 ? cellStr(row[iName]) : null,
      leadStatus: iStatus >= 0 ? cellStr(row[iStatus]) : null,
      createdTime: iCreated >= 0 ? parseCrmDateTime(row[iCreated]) : null,
    })
  }

  return { reportType: "leads", leads, rowCount: leads.length }
}

function parseOpportunities(rawData: unknown[][]): ParsedCrmReport {
  const hdr = findCrmHeaderRow(rawData)
  if (!hdr) return { reportType: "opportunities", opportunities: [], rowCount: 0 }

  const col = (name: string) => {
    const lower = name.toLowerCase()
    return hdr.headers.findIndex((h) => h.toLowerCase() === lower)
  }

  const iClosing = col("closing date")
  const iName = col("opportunity name")
  const iSource = col("lead source")
  const iDetail = col("lead source detail")
  const iCreated = col("created time")
  const iStage = col("stage")
  const iAd = col("ad")

  const opportunities: ParsedOpportunity[] = []
  for (let i = hdr.headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[]
    if (!row || row.length === 0) continue
    if (row.every((c) => c == null || String(c).trim() === "")) continue

    opportunities.push({
      closingDate: iClosing >= 0 ? parseCrmDate(row[iClosing]) : null,
      opportunityName: iName >= 0 ? cellStr(row[iName]) : null,
      leadSource: iSource >= 0 ? cellStr(row[iSource]) : null,
      leadSourceDetail: iDetail >= 0 ? cellStr(row[iDetail]) : null,
      createdTime: iCreated >= 0 ? parseCrmDateTime(row[iCreated]) : null,
      stage: iStage >= 0 ? cellStr(row[iStage]) : null,
      ad: iAd >= 0 ? cellStr(row[iAd]) : null,
    })
  }

  return { reportType: "opportunities", opportunities, rowCount: opportunities.length }
}

// ── Main Entry Point ────────────────────────────────────────────────

export function parseCrmFile(buffer: ArrayBuffer, reportType: string): ParsedCrmReport {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

  if (reportType === "leads") return parseLeads(rawData)
  if (reportType === "opportunities") return parseOpportunities(rawData)

  throw new Error(`Unknown CRM report type: ${reportType}`)
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
