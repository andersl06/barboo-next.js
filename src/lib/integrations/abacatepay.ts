import { ChargeStatus } from "@/lib/billing/types"

const ABACATEPAY_API_BASE = "https://api.abacatepay.com/v1"
const ABACATEPAY_TIMEOUT_MS = 10000

export class AbacatePayError extends Error {
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
    this.name = "AbacatePayError"
    this.code = options.code
    this.status = options.status
    this.details = options.details
  }
}

type AbacateResponse<T> = {
  data?: T
  error?: unknown
  message?: string
  detail?: string
  errors?: unknown
}

type AbacatePixChargePayload = {
  id?: string
  status?: string
  amount?: number
  brCode?: string
  brCodeBase64?: string
  expiresAt?: string
  createdAt?: string
  updatedAt?: string
}

export type CreatePixChargeInput = {
  amountCents: number
  description: string
  expiresInSeconds: number
  externalId?: string
}

export type PixChargeSnapshot = {
  chargeId: string
  status: ChargeStatus
  rawStatus: string
  amountCents: number
  qrCodeImageUrl: string | null
  qrCodeCopyPaste: string
  expiresAt: string | null
  createdAt: string | null
  paidAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asMessage(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function truncateForLog(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed
}

function extractErrorsMessage(value: unknown): string | null {
  if (!Array.isArray(value)) return null

  const parts = value
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (!isRecord(item)) return null
      const field = asMessage(item.field) ?? asMessage(item.path)
      const message = asMessage(item.message) ?? asMessage(item.detail)
      if (!message) return null
      return field ? `${field}: ${message}` : message
    })
    .filter((item): item is string => Boolean(item))

  return parts.length > 0 ? truncateForLog(parts.join(" | ")) : null
}

function extractHttpErrorMessage(payload: unknown, responseStatus: number): string {
  if (isRecord(payload)) {
    const error = payload.error

    if (isRecord(error)) {
      const nestedMessage = asMessage(error.message) ?? asMessage(error.detail) ?? extractErrorsMessage(error.errors)
      if (nestedMessage) return nestedMessage
    }

    if (typeof error === "string" && error.trim()) {
      return truncateForLog(error)
    }

    const topLevelMessage =
      asMessage(payload.message) ??
      asMessage(payload.detail) ??
      extractErrorsMessage(payload.errors) ??
      extractErrorsMessage(error)

    if (topLevelMessage) return topLevelMessage
  }

  if (typeof payload === "string" && payload.trim()) {
    return truncateForLog(payload)
  }

  return `Erro HTTP ${responseStatus} ao chamar AbacatePay.`
}

function getApiKey() {
  const value = process.env.ABACATEPAY_API_KEY?.trim()
  if (!value) {
    throw new AbacatePayError("ABACATEPAY_API_KEY não configurada.", {
      code: "CONFIG_ERROR",
      status: 500,
    })
  }
  return value
}

async function callAbacatePay<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = getApiKey()
  const url = `${ABACATEPAY_API_BASE}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ABACATEPAY_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AbacatePayError("Timeout ao chamar AbacatePay.", {
        code: "HTTP_ERROR",
        status: 504,
      })
    }
    throw new AbacatePayError("Falha de rede ao chamar AbacatePay.", {
      code: "HTTP_ERROR",
      status: 502,
    })
  } finally {
    clearTimeout(timeout)
  }

  let parsedPayload: unknown = null
  const rawBody = await response.text()

  if (rawBody) {
    try {
      parsedPayload = JSON.parse(rawBody)
    } catch {
      if (!response.ok) {
        throw new AbacatePayError(truncateForLog(rawBody), {
          code: "HTTP_ERROR",
          status: response.status,
          details: rawBody,
        })
      }

      throw new AbacatePayError("Resposta inválida da AbacatePay.", {
        code: "PARSE_ERROR",
        status: response.status,
        details: rawBody,
      })
    }
  }

  if (!response.ok) {
    const message = extractHttpErrorMessage(parsedPayload, response.status)
    throw new AbacatePayError(message, {
      code: "HTTP_ERROR",
      status: response.status,
      details: parsedPayload ?? rawBody,
    })
  }

  if (!isRecord(parsedPayload)) {
    throw new AbacatePayError("Resposta inválida da AbacatePay.", {
      code: "PARSE_ERROR",
      status: response.status,
      details: parsedPayload,
    })
  }

  const payload = parsedPayload as AbacateResponse<T>

  if (!payload.data) {
    throw new AbacatePayError("Resposta da AbacatePay sem campo data.", {
      code: "PARSE_ERROR",
      status: response.status,
      details: parsedPayload,
    })
  }

  return payload.data
}

function normalizeQrImage(value: string | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("data:image")) return trimmed
  return `data:image/png;base64,${trimmed}`
}

function mapChargeStatus(rawStatus: string | undefined, expiresAt: string | undefined): ChargeStatus {
  const normalized = (rawStatus ?? "").trim().toUpperCase()

  if (["PAID", "APPROVED", "SUCCEEDED", "SUCCESS", "COMPLETED"].includes(normalized)) {
    return "PAID"
  }

  if (["EXPIRED", "CANCELED", "CANCELLED", "FAILED", "VOID"].includes(normalized)) {
    return "EXPIRED"
  }

  if (["PENDING", "WAITING", "WAITING_PAYMENT", "OPEN", "CREATED", "ACTIVE", "PROCESSING"].includes(normalized)) {
    return "PENDING"
  }

  if (expiresAt) {
    const expiresAtDate = new Date(expiresAt)
    if (!Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() <= Date.now()) {
      return "EXPIRED"
    }
  }

  return "UNKNOWN"
}

function toSnapshot(
  payload: AbacatePixChargePayload,
  options?: { allowMissingQr?: boolean }
): PixChargeSnapshot {
  const chargeId = payload.id?.trim()
  const qrCodeCopyPaste = payload.brCode?.trim() ?? ""

  if (!chargeId) {
    throw new AbacatePayError("Resposta da AbacatePay sem chargeId.", {
      code: "PARSE_ERROR",
    })
  }

  if (!qrCodeCopyPaste && !options?.allowMissingQr) {
    throw new AbacatePayError("Resposta da AbacatePay sem Código copia e cola.", {
      code: "PARSE_ERROR",
    })
  }

  const rawStatus = payload.status?.trim() ?? "UNKNOWN"
  const status = mapChargeStatus(payload.status, payload.expiresAt)
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null
  const createdAt = payload.createdAt ? new Date(payload.createdAt).toISOString() : null

  return {
    chargeId,
    status,
    rawStatus,
    amountCents: Number.isFinite(payload.amount) ? Number(payload.amount) : 0,
    qrCodeImageUrl: normalizeQrImage(payload.brCodeBase64),
    qrCodeCopyPaste,
    expiresAt,
    createdAt,
    paidAt: status === "PAID" ? (payload.updatedAt ? new Date(payload.updatedAt).toISOString() : new Date().toISOString()) : null,
  }
}

export async function createPixCharge(input: CreatePixChargeInput): Promise<PixChargeSnapshot> {
  const payload = await callAbacatePay<AbacatePixChargePayload>("/pixQrCode/create", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountCents,
      expiresIn: input.expiresInSeconds,
      description: input.description,
      metadata: input.externalId
        ? {
            externalId: input.externalId,
          }
        : undefined,
    }),
  })

  return toSnapshot(payload)
}

export async function getPixChargeStatus(chargeId: string): Promise<PixChargeSnapshot> {
  const normalizedChargeId = chargeId.trim()
  const payload = await callAbacatePay<AbacatePixChargePayload>(
    `/pixQrCode/check?id=${encodeURIComponent(normalizedChargeId)}`,
    {
      method: "GET",
    }
  )

  return toSnapshot(payload, { allowMissingQr: true })
}
