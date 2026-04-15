import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured" },
        { status: 500 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)

    await sql`
      CREATE TABLE IF NOT EXISTS financial_data (
        id SERIAL PRIMARY KEY,
        report_type TEXT NOT NULL,
        period TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        account_name TEXT NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
        record_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processed' NOT NULL,
        metadata JSONB
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company TEXT,
        lead_source TEXT,
        ad_campaign_name TEXT,
        ad TEXT,
        full_name TEXT,
        lead_status TEXT,
        created_time TIMESTAMP,
        upload_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS opportunities (
        id SERIAL PRIMARY KEY,
        closing_date DATE,
        opportunity_name TEXT,
        lead_source TEXT,
        lead_source_detail TEXT,
        created_time TIMESTAMP,
        stage TEXT,
        ad TEXT,
        upload_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS ad_campaign_performance (
        id SERIAL PRIMARY KEY,
        date DATE,
        campaign TEXT,
        campaign_type TEXT,
        ad_group TEXT,
        currency TEXT,
        cost NUMERIC(15, 2),
        clicks INTEGER,
        impressions INTEGER,
        conversions NUMERIC(15, 4),
        ctr NUMERIC(10, 4),
        avg_cpc NUMERIC(10, 4),
        conversion_rate NUMERIC(10, 4),
        cost_per_conversion NUMERIC(15, 4),
        search_lost_is_rank NUMERIC(10, 4),
        search_impr_share NUMERIC(10, 4),
        upload_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    // Back-fill columns on tables created before these fields existed
    await sql`ALTER TABLE ad_campaign_performance ADD COLUMN IF NOT EXISTS ad_group TEXT`
    await sql`ALTER TABLE ad_campaign_performance ADD COLUMN IF NOT EXISTS search_lost_is_rank NUMERIC(10, 4)`
    await sql`ALTER TABLE ad_campaign_performance ADD COLUMN IF NOT EXISTS search_impr_share NUMERIC(10, 4)`

    // Normalize pre-existing campaign names to the same shape the parser now
    // produces (text before the first "|"), so the upsert key works correctly
    // on rows imported under the old rules
    await sql`
      UPDATE ad_campaign_performance
      SET campaign = trim(split_part(campaign, '|', 1))
      WHERE campaign IS NOT NULL AND campaign LIKE '%|%'
    `

    // Drop duplicates on (date, campaign, ad_group), keeping the most recent
    // row, so we can add a unique index the upsert can target
    await sql`
      DELETE FROM ad_campaign_performance
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM ad_campaign_performance
        GROUP BY date, campaign, ad_group
      )
    `

    // Unique key used by the import upsert
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ad_campaign_perf_day_campaign_ad_group_key
      ON ad_campaign_performance (date, campaign, ad_group) NULLS NOT DISTINCT
    `

    await sql`
      CREATE TABLE IF NOT EXISTS kpi_targets (
        id SERIAL PRIMARY KEY,
        kpi_name TEXT NOT NULL,
        target_value NUMERIC(15, 2) NOT NULL,
        period TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    return NextResponse.json({ success: true, message: "Database tables created successfully" })
  } catch (error) {
    console.error("Setup error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    )
  }
}
