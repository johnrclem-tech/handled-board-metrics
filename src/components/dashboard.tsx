"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { KpiOverview } from "@/components/kpi-overview"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { RevenueChart } from "@/components/revenue-chart"
import { CohortSummaryChart } from "@/components/cohort-summary-chart"
import { ConcentrationChart } from "@/components/concentration-chart"
import { NewCustomersChart } from "@/components/new-customers-chart"
import { ExistingCustomersChart } from "@/components/existing-customers-chart"
import { ChurnPage } from "@/components/churn-page"

export interface CohortDrillFilter {
  billingMonth: number
  category: string
  label: string
}

export type ChurnSegment = "all" | "new" | "existing"
export type ChurnPeriod = "monthly" | "quarterly" | "annually"

const PAGE_TITLES: Record<string, string> = {
  overview: "KPI Overview",
  financials: "Revenue",
  churn: "Churn",
}

const SEGMENTS: { value: ChurnSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "existing", label: "Existing" },
]

const PERIODS: { value: ChurnPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
]

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePage, setActivePage] = useState("overview")
  const [drillFilter, setDrillFilter] = useState<CohortDrillFilter | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [churnSegment, setChurnSegment] = useState<ChurnSegment>("all")
  const [churnPeriod, setChurnPeriod] = useState<ChurnPeriod>("monthly")

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
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{PAGE_TITLES[activePage] || "Dashboard"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {activePage === "churn" && (
            <>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex gap-1 rounded-lg border p-0.5">
                  {SEGMENTS.map((s) => (
                    <Button
                      key={s.value}
                      variant={churnSegment === s.value ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setChurnSegment(s.value)}
                      className="h-7 px-2.5 text-xs"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex gap-1 rounded-lg border p-0.5">
                  {PERIODS.map((p) => (
                    <Button
                      key={p.value}
                      variant={churnPeriod === p.value ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setChurnPeriod(p.value)}
                      className="h-7 px-2.5 text-xs"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {activePage === "overview" && (
            <div className="space-y-6">
              <KpiOverview key={`kpi-${refreshKey}`} />
              <ExistingCustomersChart key={`existing-${refreshKey}`} />
              <RevenueChart key={`chart-${refreshKey}`} />
            </div>
          )}

          {activePage === "churn" && (
            <ChurnPage
              key={`churn-${refreshKey}`}
              segment={churnSegment}
              period={churnPeriod}
            />
          )}

          {activePage === "financials" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <ConcentrationChart key={`concentration-${refreshKey}`} />
                <NewCustomersChart key={`new-customers-${refreshKey}`} />
              </div>
              <CohortSummaryChart
                key={`cohort-summary-${refreshKey}`}
                onViewDetails={() => {}}
                onDrill={handleCohortDrill}
              />
              <FinancialTable
                key={`table-${refreshKey}`}
                drillFilter={drillFilter}
                onClearDrill={handleClearDrill}
                onImport={() => setImportOpen(true)}
              />
            </div>
          )}
        </main>
      </SidebarInset>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Upload QuickBooks Excel exports to populate your dashboard.
            </DialogDescription>
          </DialogHeader>
          <FileUpload onUploadComplete={() => {
            handleUploadComplete()
            setImportOpen(false)
          }} />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
