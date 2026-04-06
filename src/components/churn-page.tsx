"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/info-tooltip"
import { UserX, DollarSign, Users, TableProperties, TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
}

export function ChurnPage({ segment, period }: ChurnPageProps) {
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

  // Use API-computed quarterly and TTM data (true cohort churn)
  const quarterlyLogoData = (data.quarterly || []).map((q) => ({ label: q.label, quarterlyLogoChurnRate: q.logoChurnRate }))
  const quarterlyRevData = (data.quarterly || []).map((q) => ({ label: q.label, quarterlyRevenueChurnRate: q.revenueChurnRate }))
  const quarterlyNrrData = (data.quarterly || []).map((q) => ({ label: q.label, quarterlyNrr: q.nrr }))

  const rollingTtmLogoData = (data.ttm || []).map((t) => ({ label: t.label, ttmLogoChurnRate: t.logoChurnRate }))
  const rollingTtmRevData = (data.ttm || []).map((t) => ({ label: t.label, ttmRevenueChurnRate: t.revenueChurnRate }))

  // Annual NRR data (year-over-year same-customer comparison)
  const annualNrrData = (data?.annualNrr || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period),
  }))

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
  const tooltipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Logo Churn
              <InfoTooltip text={
                period === "monthly"
                  ? "% of prior month\u2019s active customers who had $0 revenue in the current month."
                  : period === "quarterly"
                    ? "Average of the 3 monthly logo churn rates per calendar quarter."
                    : "12-month rolling average of monthly logo churn rates."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="logoChurnRate" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : period === "quarterly" ? (
                <LineChart data={quarterlyLogoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyLogoChurnRate" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <LineChart data={rollingTtmLogoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="ttmLogoChurnRate" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
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
                  ? "% of prior month\u2019s revenue lost from customers who dropped to $0 in the current month."
                  : period === "quarterly"
                    ? "True quarterly cohort churn: period-start revenue of customers who churned during the quarter / total period-start revenue."
                    : "True TTM cohort churn: 12-month-ago revenue of customers who churned during the TTM window / total 12-month-ago revenue."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Revenue Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="revenueChurnRate" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : period === "quarterly" ? (
                <LineChart data={quarterlyRevData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Revenue Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyRevenueChurnRate" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <LineChart data={rollingTtmRevData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM Revenue Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="ttmRevenueChurnRate" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
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
                ? "Revenue from prior month\u2019s customers as % of prior month\u2019s total revenue. >100% = expansion outpaces churn."
                : period === "quarterly"
                  ? "Average of the 3 monthly NRR values per calendar quarter."
                  : "Year-over-year revenue retention. For each month, compares revenue from customers who had revenue in the same month last year. Click a point to see customer details."
            } />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            {period === "monthly" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "NRR"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="nrr" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : period === "quarterly" ? (
              <LineChart data={quarterlyNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly NRR"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="quarterlyNrr" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <LineChart
                data={annualNrrData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
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
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  formatter={(value, _name, props) => {
                    const entry = props?.payload
                    return [`${Number(value).toFixed(1)}% (${entry?.customerCount || 0} customers)`, "Annual NRR"]
                  }}
                  labelFormatter={(l) => `${l} — click for details`}
                  contentStyle={tooltipStyle}
                />
                <ReferenceLine y={100} stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="nrr" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 7, stroke: "var(--chart-2)", strokeWidth: 3 }} />
              </LineChart>
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

      <ChurnDetailsTable months={months} />
    </div>
  )
}

function ChurnDetailsTable({ months }: { months: ChurnMonth[] }) {
  const [showCustomers, setShowCustomers] = useState(false)

  const dataMonths = months.slice(1)

  const allChurned = dataMonths.flatMap((m) =>
    m.churnedCustomers.map((c) => ({
      ...c,
      churnMonth: m.period,
      churnMonthLabel: formatPeriodLabel(m.period),
    }))
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Monthly Churn Details
              <InfoTooltip text={showCustomers
                ? `${allChurned.length} churned customers across all months, sorted by revenue impact.`
                : "Active customers, churned count, and lost revenue by month."
              } />
            </CardTitle>
          </div>
          <Button
            variant={showCustomers ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCustomers(!showCustomers)}
            className="gap-1"
          >
            <TableProperties className="h-4 w-4" />
            {showCustomers ? "Summary" : "Churned Customers"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!showCustomers ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Active</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Churned</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Logo %</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Lost</th>
                  <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Rev %</th>
                </tr>
              </thead>
              <tbody>
                {dataMonths.map((m) => (
                  <tr key={m.period} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{formatPeriodLabel(m.period)}</td>
                    <td className="text-right py-2 px-3">{m.activeCount}</td>
                    <td className="text-right py-2 px-3">{m.churnedCount}</td>
                    <td className={`text-right py-2 px-3 font-mono ${m.logoChurnRate > 10 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(m.logoChurnRate)}
                    </td>
                    <td className="text-right py-2 px-3 font-mono">{formatCurrency(m.totalRevenue)}</td>
                    <td className="text-right py-2 px-3 font-mono text-red-600">{m.lostRevenue > 0 ? formatCurrency(m.lostRevenue) : "-"}</td>
                    <td className={`text-right py-2 pl-3 font-mono ${m.revenueChurnRate > 10 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(m.revenueChurnRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Churn Month</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Last Monthly Revenue</th>
                  <th className="text-right py-2 pl-3 font-medium text-muted-foreground">% of Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {allChurned.map((c, i) => (
                  <tr key={`${c.name}-${c.churnMonth}-${i}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 px-3">{c.churnMonthLabel}</td>
                    <td className="text-right py-2 px-3 font-mono text-red-600">{formatCurrency(c.lastRevenue)}</td>
                    <td className={`text-right py-2 pl-3 font-mono ${c.revenueSharePct > 5 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(c.revenueSharePct)}
                    </td>
                  </tr>
                ))}
                {allChurned.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No churned customers in this segment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
