import { NextResponse } from "next/server"
import { mapMercadoPagoStatus, MERCADOPAGO_PROVIDER, toAmountCents } from "@/lib/billing/mercadopago"
import { prisma } from "@/lib/db/prisma"
import { refreshBarbershopFinancialState } from "@/lib/finance/invoices"
import { getMercadoPagoPayment, MercadoPagoError, verifyMercadoPagoSignature } from "@/lib/integrations/mercadopago"

function asString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function extractDataId(payload: Record<string, unknown>) {
  const data = payload.data
  if (data && typeof data === "object") {
    const id = asString((data as Record<string, unknown>).id)
    if (id) return id
  }

  return asString(payload.id)
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  let payload: Record<string, unknown> | null = null

  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody)
      if (parsed && typeof parsed === "object") {
        payload = parsed as Record<string, unknown>
      }
    } catch {
      return NextResponse.json({ received: false }, { status: 400 })
    }
  }

  const url = new URL(req.url)
  const fallbackDataId = url.searchParams.get("data.id") || url.searchParams.get("id")
  const dataId = payload ? extractDataId(payload) ?? fallbackDataId : fallbackDataId

  const secret = process.env.MP_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error("[mercadopago] webhook secret not configured")
    return NextResponse.json({ received: false }, { status: 500 })
  }

  const signatureOk = verifyMercadoPagoSignature({
    rawBody,
    headers: req.headers,
    secret,
    dataId: dataId ?? null,
  })

  if (!signatureOk) {
    console.warn("[mercadopago] invalid webhook signature", {
      hasBody: Boolean(rawBody),
      dataId: dataId ?? null,
    })
    return NextResponse.json({ received: false }, { status: 401 })
  }

  if (!dataId) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const payment = await getMercadoPagoPayment(dataId)
    const expiresAt = payment.expiresAt ? new Date(payment.expiresAt) : null
    const paymentStatus = mapMercadoPagoStatus(payment.status, expiresAt)
    const amountCents = toAmountCents(payment.amount)

    const invoice = await prisma.weeklyInvoice.findFirst({
      where: {
        OR: [
          {
            paymentProvider: MERCADOPAGO_PROVIDER,
            providerPaymentId: payment.id,
          },
          ...(payment.externalReference ? [{ id: payment.externalReference }] : []),
        ],
      },
      select: {
        id: true,
        barbershopId: true,
        status: true,
        paidAt: true,
        totalFeesCents: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const shouldMarkPaid = paymentStatus === "PAID"
    const paidAt = shouldMarkPaid ? (invoice.paidAt ?? new Date()) : null
    const wasPaid = invoice.status === "PAID"

    await prisma.$transaction(async (tx) => {
      await tx.weeklyInvoice.update({
        where: { id: invoice.id },
        data: {
          status: shouldMarkPaid ? "PAID" : invoice.status,
          paidAt: shouldMarkPaid ? paidAt : invoice.paidAt,
          paymentProvider: MERCADOPAGO_PROVIDER,
          providerPaymentId: payment.id,
          providerStatus: payment.status,
          providerStatusDetail: payment.statusDetail,
          providerAmountCents: amountCents ?? invoice.totalFeesCents,
          providerExpiresAt: expiresAt,
          providerTicketUrl: payment.ticketUrl,
          providerExternalReference: payment.externalReference ?? invoice.id,
          providerPixCode: payment.qrCode,
          providerQrCodeBase64: payment.qrCodeBase64,
          providerPaidAt: shouldMarkPaid ? paidAt : undefined,
        },
        select: { id: true },
      })

      if (shouldMarkPaid && !wasPaid) {
        await refreshBarbershopFinancialState(invoice.barbershopId, tx)
      }
    })
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      console.error("[mercadopago] webhook processing failed", {
        errorCode: err.code,
        status: err.status,
        message: err.message,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    console.error("[mercadopago] webhook unexpected error", err)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
