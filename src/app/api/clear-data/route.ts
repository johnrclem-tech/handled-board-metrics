import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL is not configured" },
        { status: 500 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)

    await sql`DELETE FROM financial_data`
    await sql`DELETE FROM uploads`

    return NextResponse.json({ success: true, message: "All data cleared successfully" })
  } catch (error) {
    console.error("Clear data error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    )
  }
}
