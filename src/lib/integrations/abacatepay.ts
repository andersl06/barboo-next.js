import { ChargeStatus } from "@/lib/billing/types"

const ABACATEPAY_API_BASE = "https://api.abacatepay.com/v1"
const ABACATEPAY_TIMEOUT_MS = 10000

export class AbacatePayError extends Error {
  status?: number
  code: "CONFIG_ERROR" | "HTTP_ERROR" | "PARSE_ERROR"

  constructor(
    message: string,
    options: {
      code: "CONFIG_ERROR" | "HTTP_ERROR" | "PARSE_ERROR"
      status?: number
    }
  ) {
    super(message)
    this.name = "AbacatePayError"
    this.code = options.code
    this.status = options.status
  }
}

type AbacateResponse<T> = {
  data?: T
  error?: {
    message?: string
    code?: string
  } | null
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

function getApiKey() {
  const value = process.env.ABACATEPAY_API_KEY?.trim()
  if (!value) {
    throw new AbacatePayError("ABACATEPAY_API_KEY nao configurada.", {
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

  let payload: AbacateResponse<T> | null = null

  try {
    payload = (await response.json()) as AbacateResponse<T>
  } catch {
    throw new AbacatePayError("Resposta invalida da AbacatePay.", {
      code: "PARSE_ERROR",
      status: response.status,
    })
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? `Erro HTTP ${response.status} ao chamar AbacatePay.`
    throw new AbacatePayError(message, {
      code: "HTTP_ERROR",
      status: response.status,
    })
  }

  if (!payload || typeof payload !== "object" || !payload.data) {
    throw new AbacatePayError("Resposta da AbacatePay sem campo data.", {
      code: "PARSE_ERROR",
      status: response.status,
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
    throw new AbacatePayError("Resposta da AbacatePay sem codigo copia e cola.", {
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
