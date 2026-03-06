import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { buildWhatsappReminderLink } from "@/lib/whatsapp/reminders"
import { getWhatsappWindowStatus } from "@/lib/whatsapp/service"

const payloadSchema = z.object({
  waIdDigits: z.string().trim().min(8).max(20).regex(/^\d+$/),
  customerName: z.string().trim().min(1).max(120),
  barberName: z.string().trim().min(1).max(120),
  serviceName: z.string().trim().min(1).max(120),
  appointmentDate: z.string().trim().min(1).max(30),
  appointmentTime: z.string().trim().min(1).max(30),
  price: z.string().trim().min(1).max(40),
  appointmentId: z.string().trim().min(1).max(80),
})

function buildConfirmationMessage(input: z.infer<typeof payloadSchema>) {
  return [
    `Olá, ${input.customerName}.`,
    "Seu compromisso foi confirmado.",
    `Barbeiro: ${input.barberName}`,
    `Serviço: ${input.serviceName}`,
    `Data: ${input.appointmentDate}`,
    `Horário: ${input.appointmentTime}`,
    `Valor: ${input.price}`,
    `ID: ${input.appointmentId}`,
  ].join("\n")
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if ("error" in auth) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: auth.message },
      { status: auth.status }
    )
  }

  const parsed = payloadSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Erro de validação." },
      { status: 400 }
    )
  }

  const input = parsed.data
  const waIdDigits = input.waIdDigits.replace(/\D/g, "")

  const { windowOpen } = await getWhatsappWindowStatus(waIdDigits)
  if (!windowOpen) {
    const waLink = buildWhatsappReminderLink({
      appointmentId: input.appointmentId,
    })

    return NextResponse.json({
      ok: true,
      sent: false,
      mode: "TEMPLATE_REQUIRED",
      hint: "Create approved template later",
      waLink,
    })
  }

  const graphToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!graphToken || !phoneNumberId) {
    return NextResponse.json(
      { ok: false, code: "CONFIG_ERROR", message: "WhatsApp não configurado." },
      { status: 500 }
    )
  }

  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"
  const graphUrl = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`

  const response = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${graphToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: waIdDigits,
      type: "text",
      text: {
        preview_url: false,
        body: buildConfirmationMessage(input),
      },
    }),
  })

  if (response.ok) {
    return NextResponse.json({
      ok: true,
      sent: true,
      mode: "FREE_FORM",
    })
  }

  let errorCode: number | null = null
  try {
    const payload = (await response.json()) as {
      error?: { code?: number }
    }
    errorCode = payload.error?.code ?? null
  } catch {
    errorCode = null
  }

  if (errorCode === 131047) {
    const waLink = buildWhatsappReminderLink({
      appointmentId: input.appointmentId,
    })

    return NextResponse.json({
      ok: true,
      sent: false,
      mode: "TEMPLATE_REQUIRED",
      hint: "Create approved template later",
      waLink,
    })
  }

  return NextResponse.json(
    { ok: false, code: "WHATSAPP_SEND_FAILED", message: "Falha ao enviar mensagem." },
    { status: 502 }
  )
}
