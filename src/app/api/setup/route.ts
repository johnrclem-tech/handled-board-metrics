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
