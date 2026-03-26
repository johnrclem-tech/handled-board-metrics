"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KpiOverview } from "@/components/kpi-overview"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { RevenueChart } from "@/components/revenue-chart"
import { Package, BarChart3, Upload, Table2 } from "lucide-react"

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <h1 className="text-xl font-bold">Handled</h1>
          </div>
          <span className="ml-4 text-sm text-muted-foreground">Board Metrics Dashboard</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              KPI Overview
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-2">
              <Table2 className="h-4 w-4" />
              Financial Data
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <KpiOverview key={`kpi-${refreshKey}`} />
              <RevenueChart key={`chart-${refreshKey}`} />
            </div>
          </TabsContent>

          <TabsContent value="financials">
            <FinancialTable key={`table-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="upload">
            <FileUpload onUploadComplete={handleUploadComplete} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
