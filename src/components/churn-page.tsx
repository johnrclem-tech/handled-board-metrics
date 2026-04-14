"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/info-tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserX, DollarSign, Users, TrendingUp, ChevronDown } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts"
import type { ChurnSegment, ChurnPeriod } from "@/components/dashboard"

interface ChurnedCustomer {
  name: string
  lastRevenue: number
  revenueSharePct: number
}

interface ChurnMonth {
  period: string
  activeCount: number
  churnedCount: number
  logoChurnRate: number
  revenueChurnRate: number
  lostRevenue: number
  totalRevenue: number
  nrr: number
  churnedCustomers: ChurnedCustomer[]
}

interface AnnualNrrCustomer {
  name: string
  priorRevenue: number
  currentRevenue: number
  change: number
}

interface AnnualNrrEntry {
  period: string
  priorPeriod: string
  nrr: number
  customerCount: number
  priorRevenue: number
  currentRevenue: number
  customers: AnnualNrrCustomer[]
}

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

interface ChurnResponse {
  months: ChurnMonth[]
  quarterly: PeriodChurn[]
  ttm: PeriodChurn[]
  annualNrr: AnnualNrrEntry[]
  summary: {
    lastQuarter: { logoChurn: number; revenueChurn: number }
    ttm: { logoChurn: number; revenueChurn: number }
  } | null
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-")
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" })
  return `${monthName} ${year.slice(2)}`
}

interface ChurnPageProps {
  segment: ChurnSegment
  period: ChurnPeriod
  ltvCard?: React.ReactNode
  ltvChart?: React.ReactNode
  ltvTable?: React.ReactNode
}

export function ChurnPage({ segment, period, ltvCard, ltvChart, ltvTable }: ChurnPageProps) {
  const [data, setData] = useState<ChurnResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNrrDetail, setSelectedNrrDetail] = useState<AnnualNrrEntry | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/metrics/churn?segment=${segment}`)
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error("Failed to fetch churn data:", err))
      .finally(() => setLoading(false))
  }, [segment])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Loading churn data...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data || !data.summary || data.months.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <UserX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No churn data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import revenue files to see churn analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  const { months } = data

  // Skip first month (no prior to compare)
  const monthlyData = months.slice(1)

  // Get the most recent period's values for KPI cards
  const latestMonth = monthlyData[monthlyData.length - 1]

  // Build chart data based on selected period
  const chartData = monthlyData.map((m) => ({
    ...m,
    label: formatPeriodLabel(m.period),
  }))

  // Filter all churn charts to show only complete periods
  const _now = new Date()
  const _currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`
  const _currentQuarter = `${_now.getFullYear()}-Q${Math.ceil((_now.getMonth() + 1) / 3)}`
  // Monthly: drop current calendar month (used by Logo Churn, Revenue Churn, NRR)
  const filteredChartData = chartData.filter((m) => m.period < _currentMonth)
  const nrrMonthlyData = filteredChartData

  // Use API-computed quarterly and TTM data (true cohort churn)
  // Quarterly: drop current calendar quarter
  const quarterlyLogoData = (data.quarterly || []).filter((q) => q.period < _currentQuarter).map((q) => ({ label: q.label, quarterlyLogoChurnRate: q.logoChurnRate }))
  const quarterlyRevData = (data.quarterly || []).filter((q) => q.period < _currentQuarter).map((q) => ({ label: q.label, quarterlyRevenueChurnRate: q.revenueChurnRate }))
  const quarterlyNrrData = (data.quarterly || []).filter((q) => q.period < _currentQuarter).map((q) => ({ period: q.period, label: q.label, quarterlyNrr: q.nrr }))
  const nrrQuarterlyData = quarterlyNrrData

  // TTM: exclude the most recent month of data
  const rollingTtmLogoData = (data.ttm || []).slice(0, -1).map((t) => ({ label: t.label, ttmLogoChurnRate: t.logoChurnRate }))
  const rollingTtmRevData = (data.ttm || []).slice(0, -1).map((t) => ({ label: t.label, ttmRevenueChurnRate: t.revenueChurnRate }))

  // Annual NRR data (year-over-year same-customer comparison)
  const annualNrrData = (data?.annualNrr || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period),
  }))
  // NRR chart: drop the most recent month from annual NRR (TTM exclusion)
  const nrrAnnualData = annualNrrData.slice(0, -1)

  // Lookup for clicking on annual NRR points
  const annualNrrByPeriod = new Map(
    (data?.annualNrr || []).map((d) => [d.period, d])
  )

  // KPI cards: values based on selected period
  let kpiLabel = ""
  let kpiLogo = 0
  let kpiLogoSub = ""
  let kpiRevChurn = 0
  let kpiRevSub = ""
  let kpiNrr = 0
  let kpiNrrSub = ""

  if (period === "monthly") {
    const m = latestMonth
    kpiLabel = formatPeriodLabel(m.period)
    kpiLogo = m.logoChurnRate
    kpiLogoSub = `${m.churnedCount} of ${m.activeCount + m.churnedCount} customers`
    kpiRevChurn = m.revenueChurnRate
    kpiRevSub = `${formatCurrency(m.lostRevenue)} lost`
    kpiNrr = m.nrr
    kpiNrrSub = `${formatCurrency(m.totalRevenue)} current revenue`
  } else if (period === "quarterly" && quarterlyLogoData.length > 0) {
    const lastQ = quarterlyLogoData[quarterlyLogoData.length - 1]
    const lastQRev = quarterlyRevData[quarterlyRevData.length - 1]
    const lastQNrr = quarterlyNrrData[quarterlyNrrData.length - 1]
    kpiLabel = lastQ.label
    kpiLogo = lastQ.quarterlyLogoChurnRate
    kpiLogoSub = "Avg monthly rate for quarter"
    kpiRevChurn = lastQRev.quarterlyRevenueChurnRate
    kpiRevSub = "True quarterly cohort churn"
    kpiNrr = lastQNrr.quarterlyNrr
    kpiNrrSub = "Avg monthly NRR for quarter"
  } else if (period === "annually") {
    const lastAnnualNrr = annualNrrData.length > 0 ? annualNrrData[annualNrrData.length - 1] : null
    const lastTtmLogo = rollingTtmLogoData.length > 0 ? rollingTtmLogoData[rollingTtmLogoData.length - 1] : null
    const lastTtmRev = rollingTtmRevData.length > 0 ? rollingTtmRevData[rollingTtmRevData.length - 1] : null
    kpiLabel = lastTtmLogo?.label || lastAnnualNrr?.label || formatPeriodLabel(latestMonth.period)
    kpiLogo = lastTtmLogo?.ttmLogoChurnRate || 0
    kpiLogoSub = "True TTM cohort churn"
    kpiRevChurn = lastTtmRev?.ttmRevenueChurnRate || 0
    kpiRevSub = "True TTM cohort revenue churn"
    kpiNrr = lastAnnualNrr?.nrr || 0
    kpiNrrSub = lastAnnualNrr ? `${formatCurrency(lastAnnualNrr.priorRevenue)} prior → ${formatCurrency(lastAnnualNrr.currentRevenue)} current` : "No YoY data yet"
  }

  const kpiCards = [
    {
      title: "Logo Churn",
      value: formatPct(kpiLogo),
      sub: `${kpiLabel} — ${kpiLogoSub}`,
      icon: Users,
      warn: kpiLogo > 10,
    },
    {
      title: "Revenue Churn",
      value: formatPct(kpiRevChurn),
      sub: `${kpiLabel} — ${kpiRevSub}`,
      icon: DollarSign,
      warn: kpiRevChurn > 10,
    },
    {
      title: "Net Revenue Retention",
      value: formatPct(kpiNrr),
      sub: `${kpiLabel} — ${kpiNrrSub}`,
      icon: TrendingUp,
      warn: kpiNrr < 90,
    },
  ]

  // Shared chart tooltip style


  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {ltvCard}
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-3/15">
                <kpi.icon className="h-4 w-4 text-chart-3" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.warn ? "text-red-600" : ""}`}>
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPeriodLabel(latestMonth.period)} — {kpi.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {ltvChart}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Logo Churn
              <InfoTooltip text={
                period === "monthly"
                  ? "Churned customers / prior month active customers × 100. A customer is churned if they had revenue in M-1 but $0 in M."
                  : period === "quarterly"
                    ? "Total logos churned in the quarter / active logos at quarter-start × 100. Starting cohort = customers active in the month before the quarter. A customer churned if they were in the starting cohort but had $0 in the last month of the quarter."
                    : "Total logos churned in 12 months / active logos at start of 12-month window × 100. Starting cohort = customers active 12 months before the window end. Customers who joined mid-window and churned do not affect the rate."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <BarChart data={filteredChartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Bar dataKey="logoChurnRate" fill="var(--chart-3)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="logoChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              ) : period === "quarterly" ? (
                <BarChart data={quarterlyLogoData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Bar dataKey="quarterlyLogoChurnRate" fill="var(--chart-3)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="quarterlyLogoChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={rollingTtmLogoData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Bar dataKey="ttmLogoChurnRate" fill="var(--chart-3)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="ttmLogoChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Revenue Churn
              <InfoTooltip text={
                period === "monthly"
                  ? "Lost revenue / prior month total revenue × 100. Lost revenue = sum of M-1 revenue from customers who had $0 in M. Only counts complete departures, not contraction."
                  : period === "quarterly"
                    ? "Sum of quarter-start revenue of customers who churned during Q / total quarter-start revenue × 100. Uses each churned customer's revenue at the start of the quarter (not at time of departure) to avoid the intra-period expansion mismatch. Customers who joined mid-quarter and churned are excluded (not in starting cohort)."
                    : "Sum of 12-month-ago revenue of customers who churned during the TTM window / total 12-month-ago revenue × 100. Uses each churned customer's revenue from 12 months ago (not at time of departure). Customers who joined mid-window and churned are excluded."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <BarChart data={filteredChartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Bar dataKey="revenueChurnRate" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="revenueChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              ) : period === "quarterly" ? (
                <BarChart data={quarterlyRevData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Bar dataKey="quarterlyRevenueChurnRate" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="quarterlyRevenueChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={rollingTtmRevData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Bar dataKey="ttmRevenueChurnRate" fill="var(--chart-1)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="ttmRevenueChurnRate" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {period === "annually" ? "Annual Net Revenue Retention" : "Net Revenue Retention"}
            <InfoTooltip text={
              period === "monthly"
                ? "Current month revenue from prior month's customers / prior month total revenue × 100. Includes expansion (customers paying more), contraction (paying less), and churn ($0). Does NOT include new customers. >100% = expansion outpaces churn."
                : period === "quarterly"
                  ? "End-of-quarter revenue from starting cohort / starting cohort revenue × 100. Starting cohort = customers active in the month before the quarter. Compares their quarter-end revenue snapshot to their quarter-start revenue. A customer who churned mid-quarter but returned by quarter-end is counted as retained."
                  : "Year-over-year same-customer comparison. For each month M, finds customers with revenue in M-12 and compares their M revenue to their M-12 revenue. NRR = current month revenue / same-month-last-year revenue × 100. Click a point to see per-customer detail."
            } />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            {period === "monthly" ? (
              <BarChart data={nrrMonthlyData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Bar dataKey="nrr" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="nrr" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                </Bar>
              </BarChart>
            ) : period === "quarterly" ? (
              <BarChart data={nrrQuarterlyData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Bar dataKey="quarterlyNrr" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="quarterlyNrr" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={nrrAnnualData}
                margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload
                  if (payload?.period) {
                    const detail = annualNrrByPeriod.get(payload.period)
                    if (detail) setSelectedNrrDetail(detail)
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Bar dataKey="nrr" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="nrr" position="top" fontSize={10} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {selectedNrrDetail && period === "annually" && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Annual NRR Detail — {formatPeriodLabel(selectedNrrDetail.period)}
                  <InfoTooltip text={`Comparing ${formatPeriodLabel(selectedNrrDetail.period)} vs ${formatPeriodLabel(selectedNrrDetail.priorPeriod)} for ${selectedNrrDetail.customerCount} customers who had revenue in both periods.`} />
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedNrrDetail(null)} className="gap-1">
                <UserX className="h-4 w-4" />
                Close
              </Button>
            </div>
            <div className="flex gap-6 text-sm mt-2">
              <div>
                <span className="text-muted-foreground">Prior Year ({formatPeriodLabel(selectedNrrDetail.priorPeriod)})</span>
                <div className="font-semibold">{formatCurrency(selectedNrrDetail.priorRevenue)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Current ({formatPeriodLabel(selectedNrrDetail.period)})</span>
                <div className="font-semibold">{formatCurrency(selectedNrrDetail.currentRevenue)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">NRR</span>
                <div className={`font-semibold ${selectedNrrDetail.nrr < 100 ? "text-red-600" : "text-green-600"}`}>{formatPct(selectedNrrDetail.nrr)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Customers</span>
                <div className="font-semibold">{selectedNrrDetail.customerCount}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Customer</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">{formatPeriodLabel(selectedNrrDetail.priorPeriod)}</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">{formatPeriodLabel(selectedNrrDetail.period)}</th>
                    <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedNrrDetail.customers.map((c) => (
                    <tr key={c.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="text-right py-2 px-3 font-mono">{formatCurrency(c.priorRevenue)}</td>
                      <td className="text-right py-2 px-3 font-mono">{formatCurrency(c.currentRevenue)}</td>
                      <td className={`text-right py-2 pl-3 font-mono ${c.change < 0 ? "text-red-600" : c.change > 0 ? "text-green-600" : ""}`}>
                        {c.change > 0 ? "+" : ""}{formatCurrency(c.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ChurnDetailsTable months={months} period={period} quarterly={data.quarterly || []} ttm={data.ttm || []} ltvTable={ltvTable} />
    </div>
  )
}

function ChurnDetailsTable({ months, period, quarterly, ttm, ltvTable }: { months: ChurnMonth[]; period: ChurnPeriod; quarterly: PeriodChurn[]; ttm: PeriodChurn[]; ltvTable?: React.ReactNode }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [rawView, setRawView] = useState<"churn" | "ltv">("churn")

  if (rawView === "ltv" && ltvTable) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Raw Data</CardTitle>
            <Tabs value={rawView} onValueChange={(v) => setRawView(v as "churn" | "ltv")}>
              <TabsList className="bg-muted h-9">
                <TabsTrigger value="churn" className="px-4">Churn</TabsTrigger>
                <TabsTrigger value="ltv" className="px-4">LTV</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>{ltvTable}</CardContent>
      </Card>
    )
  }

  const dataMonths = months.slice(1)

  const periodLabel = period === "monthly" ? "Monthly" : period === "quarterly" ? "Quarterly" : "TTM"

  // Build rows with associated churned customers
  interface SummaryRow {
    key: string
    label: string
    active: number
    churned: number
    logoChurn: number
    revenue: number
    lost: number
    revChurn: number
    customers: { name: string; revenue: number; revShare: number }[]
  }

  const rows: SummaryRow[] = period === "monthly"
    ? dataMonths.map((m) => ({
        key: m.period,
        label: formatPeriodLabel(m.period),
        active: m.activeCount,
        churned: m.churnedCount,
        logoChurn: m.logoChurnRate,
        revenue: m.totalRevenue,
        lost: m.lostRevenue,
        revChurn: m.revenueChurnRate,
        customers: m.churnedCustomers.map((c) => ({
          name: c.name,
          revenue: c.lastRevenue,
          revShare: c.revenueSharePct,
        })),
      }))
    : period === "quarterly"
      ? quarterly.map((q) => ({
          key: q.period,
          label: q.label,
          active: q.startingActive,
          churned: q.totalChurned,
          logoChurn: q.logoChurnRate,
          revenue: q.startingRevenue,
          lost: q.cohortLostRevenue,
          revChurn: q.revenueChurnRate,
          customers: q.churnedCustomers.map((c) => ({
            name: c.name,
            revenue: c.startRevenue,
            revShare: c.revenueSharePct,
          })),
        }))
      : ttm.map((t) => ({
          key: t.period,
          label: t.label,
          active: t.startingActive,
          churned: t.totalChurned,
          logoChurn: t.logoChurnRate,
          revenue: t.startingRevenue,
          lost: t.cohortLostRevenue,
          revChurn: t.revenueChurnRate,
          customers: t.churnedCustomers.map((c) => ({
            name: c.name,
            revenue: c.startRevenue,
            revShare: c.revenueSharePct,
          })),
        }))

  const revenueLabel = period === "monthly" ? "Revenue" : "Starting Revenue"
  const lostLabel = period === "monthly" ? "Lost" : "Cohort Lost"
  const periodColLabel = period === "monthly" ? "Month" : period === "quarterly" ? "Quarter" : "TTM Period"
  const revLabel = period === "monthly" ? "Last Monthly Revenue" : "Period-Start Revenue"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Raw Data
            <InfoTooltip text={`${periodLabel} churn details. Active customers, churned count, and lost revenue by ${periodLabel.toLowerCase()} period. Click a row to see churned customers.`} />
          </CardTitle>
          {ltvTable && (
            <Tabs value={rawView} onValueChange={(v) => setRawView(v as "churn" | "ltv")}>
              <TabsList className="bg-muted h-9">
                <TabsTrigger value="churn" className="px-4">Churn</TabsTrigger>
                <TabsTrigger value="ltv" className="px-4">LTV</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-6"></th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{periodColLabel}</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">{period === "monthly" ? "Active" : "Starting"}</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Churned</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Logo %</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">{revenueLabel}</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">{lostLabel}</th>
                <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Rev %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isExpanded = expandedRow === r.key
                return (
                  <React.Fragment key={r.key}>
                    <tr
                      className={`border-b cursor-pointer transition-colors hover:bg-muted/50 ${isExpanded ? "bg-muted/30" : ""}`}
                      onClick={() => setExpandedRow(isExpanded ? null : r.key)}
                    >
                      <td className="py-2 pr-1">
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </td>
                      <td className="py-2 pr-4 font-medium">{r.label}</td>
                      <td className="text-right py-2 px-3">{r.active}</td>
                      <td className="text-right py-2 px-3">{r.churned}</td>
                      <td className={`text-right py-2 px-3 font-mono ${r.logoChurn > 10 ? "text-red-600 font-semibold" : ""}`}>
                        {formatPct(r.logoChurn)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono">{formatCurrency(r.revenue)}</td>
                      <td className="text-right py-2 px-3 font-mono text-red-600">{r.lost > 0 ? formatCurrency(r.lost) : "-"}</td>
                      <td className={`text-right py-2 pl-3 font-mono ${r.revChurn > 10 ? "text-red-600 font-semibold" : ""}`}>
                        {formatPct(r.revChurn)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={8} className="p-0">
                          <div className="px-6 py-3">
                            {r.customers.length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Customer</th>
                                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">{revLabel}</th>
                                    <th className="text-right py-1.5 pl-3 font-medium text-muted-foreground">% of Total Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.customers.map((c, i) => (
                                    <tr key={`${c.name}-${i}`} className="border-b last:border-0">
                                      <td className="py-1.5 pr-4 font-medium">{c.name}</td>
                                      <td className="text-right py-1.5 px-3 font-mono text-red-600">{formatCurrency(c.revenue)}</td>
                                      <td className={`text-right py-1.5 pl-3 font-mono ${c.revShare > 5 ? "text-red-600 font-semibold" : ""}`}>
                                        {formatPct(c.revShare)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No churned customers this period</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
