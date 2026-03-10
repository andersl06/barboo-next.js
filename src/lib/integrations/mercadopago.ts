import crypto from "crypto"

const MERCADOPAGO_API_BASE = "https://api.mercadopago.com"

export class MercadoPagoError extends Error {
  status?: number
  code: "CONFIG_ERROR" | "HTTP_ERROR" | "PARSE_ERROR"
  details?: unknown

  constructor(
    message: string,
    options: {
      code: "CONFIG_ERROR" | "HTTP_ERROR" | "PARSE_ERROR"
      status?: number
      details?: unknown
    }
  ) {
    super(message)
    this.name = "MercadoPagoError"
    this.code = options.code
    this.status = options.status
    this.details = options.details
  }
}

export type MercadoPagoPixPayment = {
  id: string
  status: string
  statusDetail: string | null
  amount: number
  expiresAt: string | null
  externalReference: string | null
  qrCode: string | null
  qrCodeBase64: string | null
  ticketUrl: string | null
}

function getAccessToken() {
  const value = process.env.MP_ACCESS_TOKEN?.trim()
  if (!value) {
    throw new MercadoPagoError("MP_ACCESS_TOKEN nao configurado.", {
      code: "CONFIG_ERROR",
      status: 500,
    })
  }
  return value
}

function resolveNotificationUrl() {
  const explicit = process.env.MP_NOTIFICATION_URL?.trim()
  if (explicit) return explicit

  const appUrl = process.env.APP_URL?.trim()
  if (!appUrl) return null
  return `${appUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asStringOrNumber(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractTransactionData(payload: Record<string, unknown>) {
  const poi = payload.point_of_interaction
  if (!poi || typeof poi !== "object") return {}
  const transaction = (poi as Record<string, unknown>).transaction_data
  if (!transaction || typeof transaction !== "object") return {}
  return transaction as Record<string, unknown>
}

function normalizePayment(payload: Record<string, unknown>): MercadoPagoPixPayment {
  const id = asStringOrNumber(payload.id)
  const status = asString(payload.status)
  const amount = asNumber(payload.transaction_amount)

  if (!id || !status || amount === null) {
    throw new MercadoPagoError("Resposta invalida do Mercado Pago.", {
      code: "PARSE_ERROR",
      status: 502,
      details: payload,
    })
  }

  const transaction = extractTransactionData(payload)
  return {
    id,
    status,
    statusDetail: asString(payload.status_detail),
    amount,
    expiresAt: asString(payload.date_of_expiration),
    externalReference: asString(payload.external_reference),
    qrCode: asString(transaction.qr_code),
    qrCodeBase64: asString(transaction.qr_code_base64),
    ticketUrl: asString(transaction.ticket_url),
  }
}

async function callMercadoPago<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getAccessToken()
  const url = `${MERCADOPAGO_API_BASE}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })

  const rawBody = await response.text()
  let parsed: unknown = null
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      if (!response.ok) {
        throw new MercadoPagoError("Falha ao chamar Mercado Pago.", {
          code: "HTTP_ERROR",
          status: response.status,
          details: rawBody,
        })
      }
      throw new MercadoPagoError("Resposta invalida do Mercado Pago.", {
        code: "PARSE_ERROR",
        status: response.status,
        details: rawBody,
      })
    }
  }

  if (!response.ok) {
    const message = (() => {
      if (parsed && typeof parsed === "object") {
        const parsedMessage = asString((parsed as Record<string, unknown>).message)
        if (parsedMessage) return parsedMessage
      }
      return "Falha ao chamar Mercado Pago."
    })()
    throw new MercadoPagoError(message, {
      code: "HTTP_ERROR",
      status: response.status,
      details: parsed ?? rawBody,
    })
  }

  if (!parsed || typeof parsed !== "object") {
    throw new MercadoPagoError("Resposta invalida do Mercado Pago.", {
      code: "PARSE_ERROR",
      status: response.status,
      details: parsed,
    })
  }

  return parsed as T
}

export async function createMercadoPagoPixPayment(input: {
  amountCents: number
  description: string
  externalReference: string
  payerEmail: string
  expiresInSeconds: number
  idempotencyKey?: string | null
}) {
  const notificationUrl = resolveNotificationUrl()
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
  const amount = Number((input.amountCents / 100).toFixed(2))

  const payload = await callMercadoPago<Record<string, unknown>>("/v1/payments", {
    method: "POST",
    headers: input.idempotencyKey ? { "X-Idempotency-Key": input.idempotencyKey } : undefined,
    body: JSON.stringify({
      transaction_amount: amount,
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.externalReference,
      date_of_expiration: expiresAt,
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      payer: {
        email: input.payerEmail,
      },
    }),
  })

  return normalizePayment(payload)
}

export async function getMercadoPagoPayment(paymentId: string) {
  const normalizedId = paymentId.trim()
  const payload = await callMercadoPago<Record<string, unknown>>(`/v1/payments/${normalizedId}`, {
    method: "GET",
  })
  return normalizePayment(payload)
}

export function verifyMercadoPagoSignature(input: {
  rawBody: string
  headers: Headers
  secret: string
  dataId: string | null
}) {
  const signatureHeader = input.headers.get("x-signature") ?? ""
  const requestId = input.headers.get("x-request-id") ?? ""
  if (!signatureHeader || !requestId || !input.dataId) return false

  const parts = signatureHeader
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const tsPart = parts.find((part) => part.startsWith("ts=")) ?? ""
  const v1Part = parts.find((part) => part.startsWith("v1=")) ?? ""
  const ts = tsPart.replace("ts=", "").trim()
  const signature = v1Part.replace("v1=", "").trim()
  if (!ts || !signature) return false

  const manifest = `id:${input.dataId};request-id:${requestId};ts:${ts};`
  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(manifest)
    .digest("hex")

  const expectedBuffer = Buffer.from(expected, "hex")
  const signatureBuffer = Buffer.from(signature, "hex")
  if (expectedBuffer.length === signatureBuffer.length) {
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  }

  return false
}

