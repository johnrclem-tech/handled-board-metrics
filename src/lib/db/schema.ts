import { pgTable, serial, text, timestamp, numeric, integer, date, jsonb } from "drizzle-orm/pg-core"

export const financialData = pgTable("financial_data", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(), // 'profit_loss', 'balance_sheet', 'cash_flow'
  period: text("period").notNull(), // e.g., '2024-01', '2024-Q1'
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  category: text("category").notNull(), // e.g., 'Revenue', 'COGS', 'Operating Expenses'
  subcategory: text("subcategory"), // e.g., 'Shipping Revenue', 'Labor Costs'
  accountName: text("account_name").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'profit_loss', 'balance_sheet', etc.
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  recordCount: integer("record_count").default(0),
  status: text("status").default("processed").notNull(), // 'processing', 'processed', 'error'
  metadata: jsonb("metadata"),
})

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  company: text("company"),
  leadSource: text("lead_source"),
  adCampaignName: text("ad_campaign_name"),
  ad: text("ad"),
  fullName: text("full_name"),
  leadStatus: text("lead_status"),
  createdTime: timestamp("created_time"),
  uploadId: integer("upload_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  closingDate: date("closing_date"),
  opportunityName: text("opportunity_name"),
  leadSource: text("lead_source"),
  leadSourceDetail: text("lead_source_detail"),
  createdTime: timestamp("created_time"),
  stage: text("stage"),
  ad: text("ad"),
  uploadId: integer("upload_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const adCampaignPerformance = pgTable("ad_campaign_performance", {
  id: serial("id").primaryKey(),
  date: date("date"),
  campaign: text("campaign"),
  campaignType: text("campaign_type"),
  adGroup: text("ad_group"),
  currency: text("currency"),
  cost: numeric("cost", { precision: 15, scale: 2 }),
  clicks: integer("clicks"),
  impressions: integer("impressions"),
  conversions: numeric("conversions", { precision: 15, scale: 4 }),
  ctr: numeric("ctr", { precision: 10, scale: 4 }),
  avgCpc: numeric("avg_cpc", { precision: 10, scale: 4 }),
  conversionRate: numeric("conversion_rate", { precision: 10, scale: 4 }),
  costPerConversion: numeric("cost_per_conversion", { precision: 15, scale: 4 }),
  searchLostIsRank: numeric("search_lost_is_rank", { precision: 10, scale: 4 }),
  searchImprShare: numeric("search_impr_share", { precision: 10, scale: 4 }),
  uploadId: integer("upload_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const kpiTargets = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  kpiName: text("kpi_name").notNull(),
  targetValue: numeric("target_value", { precision: 15, scale: 2 }).notNull(),
  period: text("period").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
