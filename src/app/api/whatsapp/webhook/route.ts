import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { verifyWhatsappSignature } from "@/lib/whatsapp/signature"
import { checkWhatsappRateLimit } from "@/lib/whatsapp/rate-limit"
import {
  dedupeInboundMessages,
  WhatsappInboundMessage,
} from "@/lib/whatsapp/dedupe"

export const runtime = "nodejs"

function extractInboundMessages(payload: unknown): WhatsappInboundMessage[] {
  const entries = Array.isArray((payload as { entry?: unknown })?.entry)
    ? (payload as { entry: unknown[] }).entry
    : []

  const results: WhatsappInboundMessage[] = []

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown })?.changes)
      ? (entry as { changes: unknown[] }).changes
      : []

    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as {
        messages?: Array<Record<string, unknown>>
        contacts?: Array<Record<string, unknown>>
      } | null

      if (!value) continue

      const messages = Array.isArray(value.messages) ? value.messages : []
      const contacts = Array.isArray(value.contacts) ? value.contacts : []
      const contactWaId = contacts[0]?.wa_id

      for (const message of messages) {
        const messageId = typeof message.id === "string" ? message.id : ""
        if (!messageId) continue

        const waId =
          typeof contactWaId === "string"
            ? contactWaId
            : typeof message.from === "string"
              ? message.from
              : ""
        if (!waId) continue

        const timestamp =
          typeof message.timestamp === "string" || typeof message.timestamp === "number"
            ? Number(message.timestamp)
            : NaN

        const receivedAt = Number.isFinite(timestamp)
          ? new Date(timestamp * 1000)
          : new Date()

        const type = typeof message.type === "string" ? message.type : null
        let bodyPreview: string | null = null
        if (type === "text") {
          const body = (message.text as { body?: unknown } | undefined)?.body
          if (typeof body === "string") {
            bodyPreview = body.slice(0, 200)
          }
        }

        results.push({
          waId,
          messageId,
          receivedAt,
          type,
          bodyPreview,
          raw: message,
        })
      }
    }
  }

  return results
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }

  return NextResponse.json({ ok: false }, { status: 403 })
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-hub-signature-256") ?? ""
  const appSecret = process.env.WHATSAPP_APP_SECRET

  if (appSecret) {
    if (!signature) {
      return NextResponse.json({ ok: false, reason: "MISSING_SIGNATURE" }, { status: 401 })
    }

    const valid = verifyWhatsappSignature(rawBody, signature, appSecret)
    if (!valid) {
      return NextResponse.json({ ok: false, reason: "INVALID_SIGNATURE" }, { status: 401 })
    }
  } else {
    console.warn("WHATSAPP_APP_SECRET not set. Skipping signature validation.")
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_JSON" }, { status: 400 })
  }

  const extracted = extractInboundMessages(payload)
  const messages = dedupeInboundMessages(extracted)

  if (messages.length === 0) {
    return NextResponse.json({ ok: true, ignored: true, reason: "NO_MESSAGES" }, { status: 200 })
  }

  const allowed: WhatsappInboundMessage[] = []
  let rateLimitedCount = 0

  for (const message of messages) {
    const limit = await checkWhatsappRateLimit(message.waId)
    if (!limit.allowed) {
      rateLimitedCount += 1
      continue
    }
    allowed.push(message)
  }

  if (allowed.length === 0 && rateLimitedCount > 0) {
    console.warn("WhatsApp webhook ignored by rate limit.")
    return NextResponse.json(
      { ok: true, ignored: true, reason: "RATE_LIMIT" },
      { status: 200 }
    )
  }

  const shouldStoreRaw = process.env.WHATSAPP_STORE_RAW === "true"

  const createData = allowed.map((message) => ({
    waId: message.waId,
    messageId: message.messageId,
    type: message.type ?? null,
    bodyPreview: message.bodyPreview ?? null,
    receivedAt: message.receivedAt,
    ...(shouldStoreRaw
      ? { raw: (message.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue }
      : {}),
  }))

  const created = await prisma.whatsAppInboundMessage.createMany({
    data: createData,
    skipDuplicates: true,
  })

  const latestByWaId = new Map<string, Date>()
  for (const message of allowed) {
    const current = latestByWaId.get(message.waId)
    if (!current || message.receivedAt > current) {
      latestByWaId.set(message.waId, message.receivedAt)
    }
  }

  for (const [waId, latest] of latestByWaId.entries()) {
    const contact = await prisma.whatsAppContact.findUnique({
      where: { waId },
      select: { lastInboundAt: true },
    })

    if (!contact) {
      await prisma.whatsAppContact.create({
        data: { waId, lastInboundAt: latest },
      })
      continue
    }

    if (!contact.lastInboundAt || contact.lastInboundAt < latest) {
      await prisma.whatsAppContact.update({
        where: { waId },
        data: { lastInboundAt: latest },
      })
    }
  }

  const duplicateCount = Math.max(0, allowed.length - created.count)

  return NextResponse.json(
    {
      ok: true,
      processed: created.count,
      ignored: duplicateCount + rateLimitedCount,
      rateLimited: rateLimitedCount,
    },
    { status: 200 }
  )
}
