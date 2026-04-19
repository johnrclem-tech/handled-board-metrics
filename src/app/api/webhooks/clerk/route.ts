import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { neon } from "@neondatabase/serverless"

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await req.text()

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event
  } catch (err) {
    console.error("Webhook verification failed:", err)
    return NextResponse.json({ error: "Verification failed" }, { status: 400 })
  }

  if (event.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = event.data as {
      id: string
      email_addresses: { email_address: string }[]
      first_name: string | null
      last_name: string | null
    }

    const email = email_addresses?.[0]?.email_address
    if (!email) {
      return NextResponse.json({ error: "No email in payload" }, { status: 400 })
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null

    try {
      const sql = neon(process.env.DATABASE_URL!)
      await sql`
        INSERT INTO users (email, name, clerk_user_id, role)
        VALUES (${email}, ${name}, ${id}, 'viewer')
        ON CONFLICT (clerk_user_id) DO UPDATE SET email = ${email}, name = ${name}
      `
    } catch (err) {
      console.error("Failed to insert user:", err)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
