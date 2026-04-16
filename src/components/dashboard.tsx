"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { CohortSummaryChart } from "@/components/cohort-summary-chart"
import { ConcentrationChart } from "@/components/concentration-chart"
import { ChurnPage } from "@/components/churn-page"
import { LifetimeGrossMarginCard } from "@/components/lifetime-gross-margin-card"
import { RevenueMetricsPage } from "@/components/revenue-metrics-page"
import type { ServicePeriod } from "@/components/revenue-metrics-page"
import { LeadsPage } from "@/components/leads-page"
import type { LeadsPeriod, LeadsTimeRange } from "@/components/leads-page"
import { AdSpendPage } from "@/components/ad-spend-page"
import type { AdSpendRange, AdSpendChannel, AdSpendPeriod } from "@/components/ad-spend-page"
import type { ConcentrationPeriod } from "@/components/concentration-chart"

export interface CohortDrillFilter {
  billingMonth: number
  category: string
  label: string
}

export type ChurnSegment = "all" | "new" | "existing"
export type ChurnPeriod = "monthly" | "quarterly" | "annually"

const PAGE_TITLES: Record<string, string> = {
  "revenue-metrics": "Service Revenue",
  financials: "Customer Revenue",
  churn: "LTV-Churn",
  leads: "Leads",
  "ad-spend": "Ad Spend",
  import: "Import",
}

const SEGMENTS: { value: ChurnSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "existing", label: "Existing" },
]

const PERIODS: { value: ChurnPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "TTM" },
]

const CUSTOMER_PERIODS: { value: ConcentrationPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

const SERVICE_PERIODS: { value: ServicePeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

const LEADS_PERIODS: { value: LeadsPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

const LEADS_TIME_RANGES: { value: LeadsTimeRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ttm", label: "TTM" },
  { value: "ytd", label: "YTD" },
]

const AD_SPEND_RANGES: { value: AdSpendRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ytd", label: "YTD" },
  { value: "ttm", label: "TTM" },
  { value: "last-mo", label: "Last Mo" },
  { value: "last-qtr", label: "Last Qtr" },
]

const AD_SPEND_CHANNELS: { value: AdSpendChannel; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ppc-website", label: "Online Only" },
  { value: "ppc-only", label: "PPC only" },
]

const AD_SPEND_PERIODS: { value: AdSpendPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePage, setActivePage] = useState("revenue-metrics")
  const [drillFilter, setDrillFilter] = useState<CohortDrillFilter | null>(null)
  const [churnSegment, setChurnSegment] = useState<ChurnSegment>("all")
  const [churnPeriod, setChurnPeriod] = useState<ChurnPeriod>("monthly")
  const [customerPeriod, setCustomerPeriod] = useState<ConcentrationPeriod>("monthly")
  const [leadsPeriod, setLeadsPeriod] = useState<LeadsPeriod>("monthly")
  const [leadsTimeRange, setLeadsTimeRange] = useState<LeadsTimeRange>("all")
  const [servicePeriod, setServicePeriod] = useState<ServicePeriod>("monthly")
  const [adSpendRange, setAdSpendRange] = useState<AdSpendRange>("all")
  const [adSpendChannel, setAdSpendChannel] = useState<AdSpendChannel>("ppc-website")
  const [adSpendPeriod, setAdSpendPeriod] = useState<AdSpendPeriod>("monthly")

  useEffect(() => {
    fetch("/api/setup").catch(() => {})
  }, [])

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleCohortDrill = useCallback((filter: CohortDrillFilter) => {
    setDrillFilter(filter)
    setActivePage("financials")
  }, [])

  const handleClearDrill = useCallback(() => {
    setDrillFilter(null)
  }, [])

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page)
    if (page !== "financials") {
      setDrillFilter(null)
    }
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar activePage={activePage} onNavigate={handleNavigate} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-2xl font-bold tracking-tight text-foreground">{PAGE_TITLES[activePage] || "Dashboard"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {activePage === "revenue-metrics" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Customers:</span>
              <Tabs value={churnSegment} onValueChange={(v) => setChurnSegment(v as ChurnSegment)}>
                <TabsList className="bg-muted h-9">
                  {SEGMENTS.map((s) => (
                    <TabsTrigger key={s.value} value={s.value} className="px-4">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {activePage === "revenue-metrics" && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm font-medium text-muted-foreground">View:</span>
                  <Tabs value={servicePeriod} onValueChange={(v) => setServicePeriod(v as ServicePeriod)}>
                    <TabsList className="bg-muted h-9">
                      {SERVICE_PERIODS.map((p) => (
                        <TabsTrigger key={p.value} value={p.value} className="px-4">
                          {p.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </>
              )}
            </div>
          )}

          {activePage === "financials" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <Tabs value={customerPeriod} onValueChange={(v) => setCustomerPeriod(v as ConcentrationPeriod)}>
                <TabsList className="bg-muted h-9">
                  {CUSTOMER_PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value} className="px-4">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {activePage === "ad-spend" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <Tabs value={adSpendPeriod} onValueChange={(v) => setAdSpendPeriod(v as AdSpendPeriod)}>
                <TabsList className="bg-muted h-9">
                  {AD_SPEND_PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value} className="px-4">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-muted-foreground">Channel:</span>
              <Tabs value={adSpendChannel} onValueChange={(v) => setAdSpendChannel(v as AdSpendChannel)}>
                <TabsList className="bg-muted h-9">
                  {AD_SPEND_CHANNELS.map((c) => (
                    <TabsTrigger key={c.value} value={c.value} className="px-4">
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-muted-foreground">Range:</span>
              <Select value={adSpendRange} onValueChange={(v) => setAdSpendRange(v as AdSpendRange)}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_SPEND_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activePage === "leads" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Range:</span>
              <Tabs value={leadsTimeRange} onValueChange={(v) => setLeadsTimeRange(v as LeadsTimeRange)}>
                <TabsList className="bg-muted h-9">
                  {LEADS_TIME_RANGES.map((r) => (
                    <TabsTrigger key={r.value} value={r.value} className="px-4">
                      {r.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <Tabs value={leadsPeriod} onValueChange={(v) => setLeadsPeriod(v as LeadsPeriod)}>
                <TabsList className="bg-muted h-9">
                  {LEADS_PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value} className="px-4">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activePage === "churn" && (
            <ChurnPage
              key={`churn-${refreshKey}`}
              segment="all"
              period="annually"
              ltvCard={<LifetimeGrossMarginCard key={`ltv-card-${refreshKey}`} />}
              ltvChart={
                <CohortSummaryChart
                  key={`cohort-summary-${refreshKey}`}
                  onViewDetails={() => {}}
                  onDrill={handleCohortDrill}
                  period="monthly"
                />
              }
              ltvTable={<FinancialTable key={`ltv-table-${refreshKey}`} view="ltv" />}
            />
          )}

          {activePage === "revenue-metrics" && (
            <RevenueMetricsPage
              key={`revenue-metrics-${refreshKey}`}
              segment={churnSegment}
              period={servicePeriod}
            />
          )}

          {activePage === "financials" && (
            <div className="space-y-6">
              <ConcentrationChart key={`concentration-${refreshKey}`} period={customerPeriod} />
              <FinancialTable
                key={`table-${refreshKey}`}
                drillFilter={drillFilter}
                onClearDrill={handleClearDrill}
                view="raw"
              />
            </div>
          )}
          {activePage === "leads" && (
            <LeadsPage key={`leads-${refreshKey}`} period={leadsPeriod} timeRange={leadsTimeRange} />
          )}

          {activePage === "ad-spend" && (
            <AdSpendPage
              key={`ad-spend-${refreshKey}`}
              range={adSpendRange}
              channel={adSpendChannel}
              period={adSpendPeriod}
            />
          )}

          {activePage === "import" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Import Data</h2>
                <p className="text-sm text-muted-foreground">
                  Upload QuickBooks Excel exports to populate your dashboard.
                </p>
              </div>
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
