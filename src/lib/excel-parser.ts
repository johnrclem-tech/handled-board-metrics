import { read as xlsxRead, utils as xlsxUtils } from "xlsx"

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

// ── Ad Spend Parsers ────────────────────────────────────────────────

export interface ParsedAdGroupRow {
  date: string | null
  campaign: string | null
  campaignType: string | null
  adGroup: string | null
  currency: string | null
  cost: number | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
  ctr: number | null
  avgCpc: number | null
  conversionRate: number | null
  costPerConversion: number | null
  searchLostIsRank: number | null
  searchImprShare: number | null
}

export interface ParsedAdGroupReport {
  reportType: "ad_group_performance"
  rows: ParsedAdGroupRow[]
}

export interface ParsedAdCampaignRow {
  date: string | null
  campaign: string | null
  campaignType: string | null
  currency: string | null
  cost: number | null
  clicks: number | null
  impressions: number | null
  conversions: number | null
  ctr: number | null
  avgCpc: number | null
  conversionRate: number | null
  costPerConversion: number | null
  searchLostIsBudget: number | null
  searchLostIsRank: number | null
  searchImprShare: number | null
}

export interface ParsedAdCampaignReport {
  reportType: "ad_campaign_performance"
  rows: ParsedAdCampaignRow[]
}

function parseNumericCell(val: unknown): number | null {
  if (val == null || val === "") return null
  if (typeof val === "number") return val
  if (typeof val === "string") {
    // Strip currency symbols, commas, percent signs, parens (negatives),
    // and comparison markers (< / >) used by Google Ads ("< 10%", "> 90%")
    const cleaned = val.replace(/[$€£¥,()\s%<>]/g, "").trim()
    if (cleaned === "" || cleaned === "—" || cleaned === "-" || cleaned === "--") return null
    const n = parseFloat(cleaned)
    if (isNaN(n)) return null
    return val.includes("(") ? -n : n
  }
  return null
}

function parseDateCell(val: unknown): string | null {
  if (val == null || val === "") return null
  if (typeof val === "number") {
    // Excel serial date
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + val * 86400000)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  if (typeof val === "string") {
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Locate the header row in a Google Ads export. The export starts with a few
 * summary rows; the header row is the first row that contains a "Campaign"
 * cell along with at least one other non-empty text label. We normalize
 * whitespace (including non-breaking spaces) so quirky exports still match.
 */
function findAdHeaderRow(rawData: unknown[][]): { headerIndex: number; headers: string[]; packed: boolean } | null {
  const normalize = (s: string) =>
    s.replace(/[\u00a0\ufeff]/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
  const limit = Math.min(rawData.length, 100)

  // First pass: standard multi-cell header
  for (let i = 0; i < limit; i++) {
    const row = rawData[i] as unknown[]
    if (!row) continue
    const textCells = row.map((c) =>
      c != null ? normalize(String(c)) : "",
    )
    const hasCampaign = textCells.some((c) => c === "campaign" || c === "campaign name")
    if (!hasCampaign) continue
    const nonEmpty = textCells.filter((c) => c.length > 0)
    if (nonEmpty.length >= 2) {
      const headers = row.map((c) =>
        c != null ? String(c).replace(/[\u00a0\ufeff]/g, " ").trim() : "",
      )
      return { headerIndex: i, headers, packed: false }
    }
  }

  // Second pass: "packed" header — all column names crammed into one cell
  // (e.g., CSV saved with quotes around the whole header line).
  for (let i = 0; i < limit; i++) {
    const row = rawData[i] as unknown[]
    if (!row) continue
    for (const cell of row) {
      if (cell == null) continue
      const str = String(cell).replace(/[\u00a0\ufeff]/g, " ").trim()
      if (!str.includes(",")) continue
      const parts = str.split(",").map((p) => p.trim())
      const normalizedParts = parts.map((p) => normalize(p))
      const hasCampaign = normalizedParts.some((p) => p === "campaign" || p === "campaign name")
      if (hasCampaign && parts.length >= 2) {
        return { headerIndex: i, headers: parts, packed: true }
      }
    }
  }

  console.warn(
    `[parser] findAdHeaderRow: no header found in ${limit} rows. First 5 rows:`,
    rawData.slice(0, 5).map((r) => (r as unknown[])?.map((c) => `${typeof c}:${String(c).slice(0, 40)}`)),
  )
  return null
}

// For "packed" CSV rows where xlsx over-split commas but the true CSV has a
// field (typically the campaign name) that contains commas, reconstruct the
// raw line and re-split, letting the campaign column absorb the extras.
function unpackCsvRow(cells: unknown[], expectedCols: number, campaignIdx: number): string[] {
  const line = cells.map((c) => (c == null ? "" : String(c))).join(",")
  const tokens = line.split(",")
  const extra = tokens.length - expectedCols
  if (extra <= 0 || campaignIdx < 0) {
    const out = [...tokens]
    while (out.length < expectedCols) out.push("")
    return out
  }
  const before = tokens.slice(0, campaignIdx)
  const campaign = tokens.slice(campaignIdx, campaignIdx + 1 + extra).join(",").trim()
  const after = tokens.slice(campaignIdx + 1 + extra)
  return [...before, campaign, ...after]
}

function parseAdGroupPerformance(rawData: unknown[][]): ParsedAdGroupReport {
  const hdr = findAdHeaderRow(rawData)
  if (!hdr) {
    console.warn(
      `[parser] ad_group_performance: no header row detected (scanned ${Math.min(
        rawData.length,
        100,
      )} rows). Total rows: ${rawData.length}. First 10 rows:`,
      JSON.stringify(rawData.slice(0, 10), null, 2),
    )
    return { reportType: "ad_group_performance", rows: [] }
  }
  const { headerIndex, headers, packed } = hdr
  console.log(
    `[parser] ad_group_performance: header at row ${headerIndex}${packed ? " (packed)" : ""}, columns:`,
    headers,
  )

  const normalize = (s: string) =>
    s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
  const normalizedHeaders = headers.map((h) => normalize(h))
  const col = (...names: string[]): number => {
    const lowered = names.map((n) => normalize(n))
    return normalizedHeaders.findIndex((h) => lowered.includes(h))
  }

  const iDate = col("day", "date", "start date")
  const iCampaign = col("campaign", "campaign name")
  const iCampaignType = col("campaign type", "advertising channel type", "channel type")
  const iAdGroup = col("ad group", "ad group name")
  const iCurrency = col("currency code", "currency")
  const iCost = col("cost", "spend", "amount spent")
  const iClicks = col("clicks")
  const iImpressions = col("impressions", "impr.", "impr")
  const iConversions = col("conversions", "all conv.", "all conversions")
  const iCtr = col("ctr", "click-through rate")
  const iAvgCpc = col("avg. cpc", "avg cpc", "cpc")
  const iConvRate = col("conv. rate", "conversion rate", "conv rate", "all conv. rate")
  const iCostPerConv = col("cost / conv.", "cost per conv.", "cost per conversion", "cost/conv.")
  const iSearchLostIsRank = col(
    "search lost is (rank)",
    "search lost impression share (rank)",
    "search lost is(rank)",
  )
  const iSearchImprShare = col(
    "search impr. share",
    "search impression share",
    "search impr share",
  )

  const rows: ParsedAdGroupRow[] = []
  const absorbIdx = iAdGroup >= 0 ? iAdGroup : iCampaign
  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const rawRow = rawData[i] as unknown[]
    if (!rawRow || rawRow.length === 0) continue
    if (rawRow.every((c) => c == null || String(c).trim() === "")) continue
    const row = packed ? unpackCsvRow(rawRow, headers.length, absorbIdx) : rawRow

    const campaignRaw = iCampaign >= 0 ? cellStr(row[iCampaign]) : null
    // Collapse Google Ads "Name | Account | Network | Market"-style campaigns
    // down to just the leading segment (before the first pipe)
    const campaign = campaignRaw ? campaignRaw.split("|")[0].trim() || null : null
    if (campaign && campaign.toLowerCase().startsWith("total")) continue
    const cost = iCost >= 0 ? parseNumericCell(row[iCost]) : null
    if (!campaign && (cost == null || cost === 0)) continue

    rows.push({
      date: iDate >= 0 ? parseDateCell(row[iDate]) : null,
      campaign,
      campaignType: iCampaignType >= 0 ? cellStr(row[iCampaignType]) : null,
      adGroup: iAdGroup >= 0 ? cellStr(row[iAdGroup]) : null,
      currency: iCurrency >= 0 ? cellStr(row[iCurrency]) : null,
      cost,
      clicks: iClicks >= 0 ? parseNumericCell(row[iClicks]) : null,
      impressions: iImpressions >= 0 ? parseNumericCell(row[iImpressions]) : null,
      conversions: iConversions >= 0 ? parseNumericCell(row[iConversions]) : null,
      ctr: iCtr >= 0 ? parseNumericCell(row[iCtr]) : null,
      avgCpc: iAvgCpc >= 0 ? parseNumericCell(row[iAvgCpc]) : null,
      conversionRate: iConvRate >= 0 ? parseNumericCell(row[iConvRate]) : null,
      costPerConversion: iCostPerConv >= 0 ? parseNumericCell(row[iCostPerConv]) : null,
      searchLostIsRank: iSearchLostIsRank >= 0 ? parseNumericCell(row[iSearchLostIsRank]) : null,
      searchImprShare: iSearchImprShare >= 0 ? parseNumericCell(row[iSearchImprShare]) : null,
    })
  }

  return { reportType: "ad_group_performance", rows }
}

function parseAdCampaignPerformance(rawData: unknown[][]): ParsedAdCampaignReport {
  const hdr = findAdHeaderRow(rawData)
  if (!hdr) {
    console.warn(
      `[parser] ad_campaign_performance: no header row detected (scanned ${Math.min(
        rawData.length,
        100,
      )} rows). Total rows in file: ${rawData.length}. First 10 rows:`,
      JSON.stringify(rawData.slice(0, 10), null, 2),
    )
    return { reportType: "ad_campaign_performance", rows: [] }
  }
  const { headerIndex, headers, packed } = hdr
  console.log(
    `[parser] ad_campaign_performance: header at row ${headerIndex}${packed ? " (packed)" : ""}, columns:`,
    headers,
  )

  const normalize = (s: string) =>
    s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
  const normalizedHeaders = headers.map((h) => normalize(h))
  const col = (...names: string[]): number => {
    const lowered = names.map((n) => normalize(n))
    return normalizedHeaders.findIndex((h) => lowered.includes(h))
  }

  const iDate = col("day", "date", "start date")
  const iCampaign = col("campaign", "campaign name")
  const iCampaignType = col("campaign type", "advertising channel type", "channel type")
  const iCurrency = col("currency code", "currency")
  const iCost = col("cost", "spend", "amount spent")
  const iClicks = col("clicks")
  const iImpressions = col("impressions", "impr.", "impr")
  const iConversions = col("conversions", "all conv.", "all conversions")
  const iCtr = col("ctr", "click-through rate")
  const iAvgCpc = col("avg. cpc", "avg cpc", "cpc")
  const iConvRate = col("conv. rate", "conversion rate", "conv rate", "all conv. rate")
  const iCostPerConv = col("cost / conv.", "cost per conv.", "cost per conversion", "cost/conv.")
  const iSearchLostIsBudget = col(
    "search lost is (budget)",
    "search lost impression share (budget)",
    "search lost is(budget)",
  )
  const iSearchLostIsRank = col(
    "search lost is (rank)",
    "search lost impression share (rank)",
    "search lost is(rank)",
  )
  const iSearchImprShare = col(
    "search impr. share",
    "search impression share",
    "search impr share",
  )

  const rows: ParsedAdCampaignRow[] = []
  let skippedEmpty = 0
  let skippedTotal = 0
  let skippedFilter = 0
  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const rawRow = rawData[i] as unknown[]
    if (!rawRow || rawRow.length === 0) { skippedEmpty++; continue }
    if (rawRow.every((c) => c == null || String(c).trim() === "")) { skippedEmpty++; continue }
    const row = packed ? unpackCsvRow(rawRow, headers.length, iCampaign) : rawRow

    const campaignRaw = iCampaign >= 0 ? cellStr(row[iCampaign]) : null
    const campaign = campaignRaw ? campaignRaw.split(/[|,]/)[0].trim() || null : null
    if (campaign && campaign.toLowerCase().startsWith("total")) { skippedTotal++; continue }
    const cost = iCost >= 0 ? parseNumericCell(row[iCost]) : null
    const searchLostIsBudget = iSearchLostIsBudget >= 0 ? parseNumericCell(row[iSearchLostIsBudget]) : null
    const searchLostIsRank = iSearchLostIsRank >= 0 ? parseNumericCell(row[iSearchLostIsRank]) : null
    const searchImprShare = iSearchImprShare >= 0 ? parseNumericCell(row[iSearchImprShare]) : null
    if (
      !campaign &&
      (cost == null || cost === 0) &&
      searchLostIsBudget == null &&
      searchLostIsRank == null &&
      searchImprShare == null
    ) {
      skippedFilter++
      continue
    }

    rows.push({
      date: iDate >= 0 ? parseDateCell(row[iDate]) : null,
      campaign,
      campaignType: iCampaignType >= 0 ? cellStr(row[iCampaignType]) : null,
      currency: iCurrency >= 0 ? cellStr(row[iCurrency]) : null,
      cost,
      clicks: iClicks >= 0 ? parseNumericCell(row[iClicks]) : null,
      impressions: iImpressions >= 0 ? parseNumericCell(row[iImpressions]) : null,
      conversions: iConversions >= 0 ? parseNumericCell(row[iConversions]) : null,
      ctr: iCtr >= 0 ? parseNumericCell(row[iCtr]) : null,
      avgCpc: iAvgCpc >= 0 ? parseNumericCell(row[iAvgCpc]) : null,
      conversionRate: iConvRate >= 0 ? parseNumericCell(row[iConvRate]) : null,
      costPerConversion: iCostPerConv >= 0 ? parseNumericCell(row[iCostPerConv]) : null,
      searchLostIsBudget,
      searchLostIsRank,
      searchImprShare,
    })
  }

  console.log(
    `[parser] ad_campaign_performance: parsed ${rows.length} rows from ${rawData.length - headerIndex - 1} data rows (skipped: ${skippedEmpty} empty, ${skippedTotal} totals, ${skippedFilter} filtered). Column indexes:`,
    {
      iDate, iCampaign, iCampaignType, iCurrency, iCost, iClicks, iImpressions,
      iConversions, iCtr, iAvgCpc, iConvRate, iCostPerConv,
      iSearchLostIsBudget, iSearchLostIsRank, iSearchImprShare,
    },
  )
  if (rows.length > 0) {
    console.log(`[parser] ad_campaign_performance: sample row:`, rows[0])
  }
  if (rows.length === 0 && rawData.length > headerIndex + 1) {
    const sampleRow = rawData[headerIndex + 1] as unknown[]
    console.warn(`[parser] ad_campaign_performance: 0 rows parsed! Sample data row:`, sampleRow)
  }
  return { reportType: "ad_campaign_performance", rows }
}

export function parseAdGroupFile(buffer: ArrayBuffer): ParsedAdGroupReport {
  const workbook = xlsxRead(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
  return parseAdGroupPerformance(rawData)
}

export function parseAdCampaignFile(buffer: ArrayBuffer): ParsedAdCampaignReport {
  const workbook = xlsxRead(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
  return parseAdCampaignPerformance(rawData)
}

// ── Main Entry Point ────────────────────────────────────────────────

export function parseCrmFile(buffer: ArrayBuffer, reportType: string): ParsedCrmReport {
  const workbook = xlsxRead(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

  if (reportType === "leads") return parseLeads(rawData)
  if (reportType === "opportunities") return parseOpportunities(rawData)

  throw new Error(`Unknown CRM report type: ${reportType}`)
}

export function parseExcelFile(buffer: ArrayBuffer, reportType: string): ParsedReport {
  const workbook = xlsxRead(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rawData = xlsxUtils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

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
