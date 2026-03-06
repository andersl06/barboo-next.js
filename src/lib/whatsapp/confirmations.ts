import { getWhatsappWindowStatus } from "@/lib/whatsapp/service"

export type WhatsappConfirmationInput = {
  waIdDigits: string
  customerName: string
  barberName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  price: string
  appointmentId: string
}

export type WhatsappConfirmationResult = {
  sent: boolean
  mode: "FREE_FORM" | "TEMPLATE" | "TEMPLATE_REQUIRED" | "TEMPLATE_ERROR" | "ERROR"
  errorCode?: number
}

function buildConfirmationMessage(input: WhatsappConfirmationInput) {
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

function buildGraphUrl() {
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
}

async function sendGraphMessage(body: unknown) {
  const graphToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!graphToken || !phoneNumberId) {
    return { ok: false, errorCode: 0 }
  }

  const response = await fetch(buildGraphUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${graphToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (response.ok) {
    return { ok: true }
  }

  try {
    const payload = (await response.json()) as { error?: { code?: number } }
    return { ok: false, errorCode: payload.error?.code ?? null }
  } catch {
    return { ok: false, errorCode: null }
  }
}

async function sendTemplateConfirmation(input: WhatsappConfirmationInput) {
  const templateName = process.env.WHATSAPP_CONFIRM_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_CONFIRM_TEMPLATE_LANG ?? "pt_BR"

  if (!templateName) {
    return { ok: false, errorCode: null, mode: "TEMPLATE_REQUIRED" as const }
  }

  const response = await sendGraphMessage({
    messaging_product: "whatsapp",
    to: input.waIdDigits,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.customerName },
            { type: "text", text: input.barberName },
            { type: "text", text: input.serviceName },
            { type: "text", text: input.appointmentDate },
            { type: "text", text: input.appointmentTime },
            { type: "text", text: input.price },
            { type: "text", text: input.appointmentId },
          ],
        },
      ],
    },
  })

  if (response.ok) {
    return { ok: true, mode: "TEMPLATE" as const }
  }

  if (response.errorCode === null || response.errorCode === 0) {
    return { ok: false, errorCode: response.errorCode ?? undefined, mode: "TEMPLATE_ERROR" as const }
  }

  return { ok: false, errorCode: response.errorCode, mode: "TEMPLATE_ERROR" as const }
}

export async function sendWhatsappAppointmentConfirmation(
  input: WhatsappConfirmationInput
): Promise<WhatsappConfirmationResult> {
  const waIdDigits = input.waIdDigits.replace(/\D/g, "")
  if (!waIdDigits) {
    return { sent: false, mode: "ERROR" }
  }

  const { windowOpen } = await getWhatsappWindowStatus(waIdDigits)

  if (windowOpen) {
    const response = await sendGraphMessage({
      messaging_product: "whatsapp",
      to: waIdDigits,
      type: "text",
      text: {
        preview_url: false,
        body: buildConfirmationMessage({ ...input, waIdDigits }),
      },
    })

    if (response.ok) {
      return { sent: true, mode: "FREE_FORM" }
    }

    if (response.errorCode !== 131047) {
      return { sent: false, mode: "ERROR", errorCode: response.errorCode ?? undefined }
    }
  }

  const templateResult = await sendTemplateConfirmation({ ...input, waIdDigits })
  if (templateResult.mode === "TEMPLATE_REQUIRED") {
    return { sent: false, mode: "TEMPLATE_REQUIRED" }
  }

  if (templateResult.ok) {
    return { sent: true, mode: "TEMPLATE" }
  }

  return {
    sent: false,
    mode: templateResult.mode,
    errorCode: templateResult.errorCode ?? undefined,
  }
}
