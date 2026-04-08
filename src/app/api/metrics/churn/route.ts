import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function roundPct(n: number): number {
  return Math.round(n * 10000) / 100
}

export async function GET(request: NextRequest) {
  try {
    const segment = request.nextUrl.searchParams.get("segment") || "all"
    const db = getDb()

    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        category: financialData.category,
        amount: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(inArray(financialData.category, [...CATEGORIES]))
      .groupBy(financialData.accountName, financialData.period, financialData.category)

    if (rows.length === 0) {
      return NextResponse.json({ months: [], quarterly: [], ttm: [], annualNrr: [], summary: null })
    }

    // Build per-customer per-period totals and track categories per customer
    const customerPeriodTotals = new Map<string, Map<string, number>>()
    const customerCategories = new Map<string, Set<string>>()
    const allPeriods = new Set<string>()

    for (const row of rows) {
      if (!customerPeriodTotals.has(row.accountName)) {
        customerPeriodTotals.set(row.accountName, new Map())
        customerCategories.set(row.accountName, new Set())
      }
      const periodMap = customerPeriodTotals.get(row.accountName)!
      const amount = parseFloat(row.amount)
      periodMap.set(row.period, (periodMap.get(row.period) || 0) + amount)
      if (amount > 0) {
        customerCategories.get(row.accountName)!.add(row.category)
      }
      allPeriods.add(row.period)
    }

    // Exclude customers whose only lifetime revenue is Shipping Revenue
    const shippingOnlyCustomers = new Set<string>()
    for (const [customer, cats] of customerCategories) {
      if (cats.size === 1 && cats.has("Shipping Revenue")) {
        shippingOnlyCustomers.add(customer)
        customerPeriodTotals.delete(customer)
      }
    }

    // Identify pre-existing customers (revenue > 0 in Sep 2024)
    const existingCustomers = new Set<string>()
    for (const [customer, periodMap] of customerPeriodTotals) {
      const sep = periodMap.get("2024-09")
      if (sep && sep > 0) {
        existingCustomers.add(customer)
      }
    }

    // Filter by segment (shipping-only customers already removed above)
    const filteredCustomers = new Set<string>()
    for (const customer of customerPeriodTotals.keys()) {
      if (shippingOnlyCustomers.has(customer)) continue
      if (segment === "new" && existingCustomers.has(customer)) continue
      if (segment === "existing" && !existingCustomers.has(customer)) continue
      filteredCustomers.add(customer)
    }

    // Sort periods
    const sortedPeriods = [...allPeriods].sort()

    // Helper: get active customers with revenue for a given period
    function getActiveCustomers(period: string): Map<string, number> {
      const active = new Map<string, number>()
      for (const customer of filteredCustomers) {
        const rev = customerPeriodTotals.get(customer)!.get(period) || 0
        if (rev > 0) active.set(customer, rev)
      }
      return active
    }

    // ── Determine churned customers ──
    // A customer is churned ONLY if:
    //   1. They had revenue in at least one period
    //   2. They have $0 revenue in the MOST RECENT period
    // Each customer can only churn once.
    // Churn month = the most recent period (not when they first disappeared).

    const mostRecentPeriod = sortedPeriods[sortedPeriods.length - 1]
    const mostRecentActive = getActiveCustomers(mostRecentPeriod)

    // Build the set of customers who are truly churned (had revenue before, $0 in most recent)
    const trueChurnedSet = new Set<string>()
    for (const customer of filteredCustomers) {
      const periodMap = customerPeriodTotals.get(customer)!
      // Check if they ever had revenue
      let everHadRevenue = false
      for (const p of sortedPeriods) {
        if ((periodMap.get(p) || 0) > 0) { everHadRevenue = true; break }
      }
      if (everHadRevenue && !mostRecentActive.has(customer)) {
        trueChurnedSet.add(customer)
      }
    }

    // For each month, determine active and churned customers
    const months: {
      period: string
      activeCount: number
      churnedCount: number
      logoChurnRate: number
      revenueChurnRate: number
      lostRevenue: number
      totalRevenue: number
      nrr: number
      churnedCustomers: { name: string; lastRevenue: number; revenueSharePct: number }[]
    }[] = []

    let prevActive = new Map<string, number>()

    for (const period of sortedPeriods) {
      const currActive = getActiveCustomers(period)

      let churnedCount = 0
      let lostRevenue = 0
      const churnedCustomers: { name: string; lastRevenue: number; revenueSharePct: number }[] = []
      const totalPrevRevenue = [...prevActive.values()].reduce((s, v) => s + v, 0)

      if (period === mostRecentPeriod) {
        // Only count churn in the most recent period, and only for truly churned customers
        for (const [customer, prevRev] of prevActive) {
          if (trueChurnedSet.has(customer) && !currActive.has(customer)) {
            churnedCount++
            lostRevenue += prevRev
            churnedCustomers.push({
              name: customer,
              lastRevenue: round2(prevRev),
              revenueSharePct: totalPrevRevenue > 0 ? roundPct(prevRev / totalPrevRevenue) : 0,
            })
          }
        }
      }
      // Non-most-recent periods: churnedCount stays 0 (customers only churn once, in the most recent period)

      churnedCustomers.sort((a, b) => b.lastRevenue - a.lastRevenue)

      const prevActiveCount = prevActive.size
      const logoChurnRate = prevActiveCount > 0 ? churnedCount / prevActiveCount : 0
      const revenueChurnRate = totalPrevRevenue > 0 ? lostRevenue / totalPrevRevenue : 0

      let retainedRevenue = 0
      for (const [customer, currRev] of currActive) {
        if (prevActive.has(customer)) {
          retainedRevenue += currRev
        }
      }
      const nrr = totalPrevRevenue > 0 ? (retainedRevenue / totalPrevRevenue) * 100 : 0

      months.push({
        period,
        activeCount: currActive.size,
        churnedCount,
        logoChurnRate: roundPct(logoChurnRate),
        revenueChurnRate: roundPct(revenueChurnRate),
        lostRevenue: round2(lostRevenue),
        totalRevenue: round2([...currActive.values()].reduce((s, v) => s + v, 0)),
        nrr: round2(nrr),
        churnedCustomers,
      })

      prevActive = currActive
    }

    // ── True Cohort Churn: Quarterly ──
    // For each quarter, find customers active at period-start (month before Q),
    // then identify which of those churned during Q, using their period-start revenue.
    interface PeriodChurn {
      label: string
      period: string
      logoChurnRate: number
      revenueChurnRate: number
      nrr: number
      startingActive: number
      startingRevenue: number
      totalChurned: number
      cohortLostRevenue: number
      churnedCustomers: { name: string; startRevenue: number; revenueSharePct: number }[]
    }

    const quarterly: PeriodChurn[] = []
    // Group sortedPeriods into calendar quarters
    const quarterGroups = new Map<string, string[]>()
    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const q = Math.ceil(m / 3)
      const qKey = `${y}-Q${q}`
      if (!quarterGroups.has(qKey)) quarterGroups.set(qKey, [])
      quarterGroups.get(qKey)!.push(period)
    }

    for (const [qKey, qPeriods] of [...quarterGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (qPeriods.length < 3) continue // only complete quarters

      const firstPeriodIdx = sortedPeriods.indexOf(qPeriods[0])
      if (firstPeriodIdx <= 0) continue // need a prior month for starting cohort

      const startPeriod = sortedPeriods[firstPeriodIdx - 1]
      const startingCohort = getActiveCustomers(startPeriod)
      const startingActive = startingCohort.size
      const startingRevenue = [...startingCohort.values()].reduce((s, v) => s + v, 0)

      // Which starting-cohort customers churned during the quarter?
      // A customer churned if they had $0 revenue in the LAST month of the quarter
      const endCohort = getActiveCustomers(qPeriods[qPeriods.length - 1])
      let totalChurned = 0
      let cohortLostRevenue = 0
      const qChurnedCustomers: { name: string; startRevenue: number; revenueSharePct: number }[] = []

      for (const [customer, startRev] of startingCohort) {
        // Only count as churned if they are truly churned (no revenue in most recent period)
        if (!endCohort.has(customer) && trueChurnedSet.has(customer)) {
          totalChurned++
          cohortLostRevenue += startRev
          qChurnedCustomers.push({
            name: customer,
            startRevenue: round2(startRev),
            revenueSharePct: startingRevenue > 0 ? roundPct(startRev / startingRevenue) : 0,
          })
        }
      }
      qChurnedCustomers.sort((a, b) => b.startRevenue - a.startRevenue)

      let retainedRev = 0
      for (const [customer, endRev] of endCohort) {
        if (startingCohort.has(customer)) {
          retainedRev += endRev
        }
      }

      const [y, qPart] = qKey.split("-Q")
      quarterly.push({
        label: `Q${qPart} ${y.slice(2)}`,
        period: qKey,
        logoChurnRate: startingActive > 0 ? roundPct(totalChurned / startingActive) : 0,
        revenueChurnRate: startingRevenue > 0 ? roundPct(cohortLostRevenue / startingRevenue) : 0,
        nrr: startingRevenue > 0 ? round2((retainedRev / startingRevenue) * 100) : 0,
        startingActive,
        startingRevenue: round2(startingRevenue),
        totalChurned,
        cohortLostRevenue: round2(cohortLostRevenue),
        churnedCustomers: qChurnedCustomers,
      })
    }

    // ── True Cohort Churn: Rolling TTM ──
    const ttm: PeriodChurn[] = []
    for (let i = 12; i < sortedPeriods.length; i++) {
      // TTM window: sortedPeriods[i-11] through sortedPeriods[i]
      // Starting cohort: active in sortedPeriods[i-12] (the month before the window)
      const startPeriod = sortedPeriods[i - 12]
      const endPeriod = sortedPeriods[i]

      const startingCohort = getActiveCustomers(startPeriod)
      const startingActive = startingCohort.size
      const startingRevenue = [...startingCohort.values()].reduce((s, v) => s + v, 0)

      const endCohort = getActiveCustomers(endPeriod)

      let totalChurned = 0
      let cohortLostRevenue = 0
      const ttmChurnedCustomers: { name: string; startRevenue: number; revenueSharePct: number }[] = []

      for (const [customer, startRev] of startingCohort) {
        // Only count as churned if they are truly churned (no revenue in most recent period)
        if (!endCohort.has(customer) && trueChurnedSet.has(customer)) {
          totalChurned++
          cohortLostRevenue += startRev
          ttmChurnedCustomers.push({
            name: customer,
            startRevenue: round2(startRev),
            revenueSharePct: startingRevenue > 0 ? roundPct(startRev / startingRevenue) : 0,
          })
        }
      }
      ttmChurnedCustomers.sort((a, b) => b.startRevenue - a.startRevenue)

      let retainedRev = 0
      for (const [customer, endRev] of endCohort) {
        if (startingCohort.has(customer)) {
          retainedRev += endRev
        }
      }

      const [ey, em] = endPeriod.split("-").map(Number)
      const monthName = new Date(ey, em - 1).toLocaleString("en-US", { month: "short" })

      ttm.push({
        label: `${monthName} ${String(ey).slice(2)}`,
        period: endPeriod,
        logoChurnRate: startingActive > 0 ? roundPct(totalChurned / startingActive) : 0,
        revenueChurnRate: startingRevenue > 0 ? roundPct(cohortLostRevenue / startingRevenue) : 0,
        nrr: startingRevenue > 0 ? round2((retainedRev / startingRevenue) * 100) : 0,
        startingActive,
        startingRevenue: round2(startingRevenue),
        totalChurned,
        cohortLostRevenue: round2(cohortLostRevenue),
        churnedCustomers: ttmChurnedCustomers,
      })
    }

    // ── Annual NRR ──
    const annualNrr: { period: string; priorPeriod: string; nrr: number; customerCount: number; priorRevenue: number; currentRevenue: number; customers: { name: string; priorRevenue: number; currentRevenue: number; change: number }[] }[] = []

    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const priorPeriod = `${y - 1}-${String(m).padStart(2, "0")}`

      if (!sortedPeriods.includes(priorPeriod)) continue

      let priorRevenue = 0
      let currentRevenue = 0
      let customerCount = 0
      const customers: { name: string; priorRevenue: number; currentRevenue: number; change: number }[] = []

      for (const customer of filteredCustomers) {
        const priorRev = customerPeriodTotals.get(customer)!.get(priorPeriod) || 0
        if (priorRev > 0) {
          const currRev = customerPeriodTotals.get(customer)!.get(period) || 0
          priorRevenue += priorRev
          currentRevenue += currRev
          customerCount++
          customers.push({
            name: customer,
            priorRevenue: round2(priorRev),
            currentRevenue: round2(currRev),
            change: round2(currRev - priorRev),
          })
        }
      }

      customers.sort((a, b) => a.change - b.change)

      if (priorRevenue > 0) {
        annualNrr.push({
          period,
          priorPeriod,
          nrr: roundPct(currentRevenue / priorRevenue),
          customerCount,
          priorRevenue: round2(priorRevenue),
          currentRevenue: round2(currentRevenue),
          customers,
        })
      }
    }

    // ── Summary ──
    const lastQ = quarterly.length > 0 ? quarterly[quarterly.length - 1] : null
    const lastTtm = ttm.length > 0 ? ttm[ttm.length - 1] : null

    const summary = {
      lastQuarter: {
        logoChurn: lastQ?.logoChurnRate || 0,
        revenueChurn: lastQ?.revenueChurnRate || 0,
      },
      ttm: {
        logoChurn: lastTtm?.logoChurnRate || 0,
        revenueChurn: lastTtm?.revenueChurnRate || 0,
      },
    }

    return NextResponse.json({ months, quarterly, ttm, annualNrr, summary })
  } catch (error) {
    console.error("Churn error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute churn" },
      { status: 500 }
    )
  }
}
