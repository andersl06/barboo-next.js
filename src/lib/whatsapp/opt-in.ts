import { sendWhatsappGraphMessage } from "@/lib/whatsapp/graph"
import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"

export type WhatsappOptInTemplateInput = {
  waIdDigits: string
  customerName: string
  appointmentDate: string
  appointmentTime: string
  barbershopName: string
}

export type WhatsappOptInResult = {
  sent: boolean
  mode: "FREE_FORM" | "TEMPLATE" | "TEMPLATE_REQUIRED" | "TEMPLATE_ERROR" | "ERROR"
  errorCode?: number
  errorSubcode?: number
  errorMessage?: string
}

function resolveAppointmentUrl() {
  const appUrl = process.env.APP_URL?.trim()
  if (!appUrl) return null
  return `${appUrl.replace(/\/+$/, "")}/cliente/agendamentos`
}

function buildOptInMessage(input: WhatsappOptInTemplateInput) {
  const lines = [
    `Olá ${input.customerName}.`,
    "",
    "Recebemos sua solicitação de agendamento.",
    "",
    `📅 Data: ${input.appointmentDate}`,
    `⏰ Horário: ${input.appointmentTime}`,
    `💈 Barbearia: ${input.barbershopName}`,
    "",
    "Seu horário ainda precisa ser confirmado pelo barbeiro.",
    "",
    "Você pode consultar mais detalhes ou acompanhar o status do agendamento aqui:",
  ]

  const appointmentUrl = resolveAppointmentUrl()
  if (appointmentUrl) {
    lines.push(appointmentUrl)
  }

  return lines.join("\n")
}

export async function sendWhatsappOptInFreeForm(
  input: WhatsappOptInTemplateInput
): Promise<WhatsappOptInResult> {
  const waIdDigits = normalizeWhatsappDigits(input.waIdDigits)
  if (!waIdDigits) {
    return { sent: false, mode: "ERROR" }
  }

  const response = await sendWhatsappGraphMessage({
    messaging_product: "whatsapp",
    to: waIdDigits,
    type: "text",
    text: {
      preview_url: false,
      body: buildOptInMessage(input),
    },
  })

  if (response.ok) {
    return { sent: true, mode: "FREE_FORM" }
  }

  return {
    sent: false,
    mode: "ERROR",
    errorCode: response.errorCode ?? undefined,
    errorSubcode: response.errorSubcode ?? undefined,
    errorMessage: response.errorMessage ?? undefined,
  }
}

export async function sendWhatsappOptInTemplate(
  input: WhatsappOptInTemplateInput
): Promise<WhatsappOptInResult> {
  const waIdDigits = normalizeWhatsappDigits(input.waIdDigits)
  if (!waIdDigits) {
    return { sent: false, mode: "ERROR" }
  }

  const templateName = process.env.WHATSAPP_OPTIN_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_OPTIN_TEMPLATE_LANG ?? "pt_BR"

  if (!templateName) {
    return { sent: false, mode: "TEMPLATE_REQUIRED" }
  }

  const response = await sendWhatsappGraphMessage({
    messaging_product: "whatsapp",
    to: waIdDigits,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.customerName },
            { type: "text", text: input.appointmentDate },
            { type: "text", text: input.appointmentTime },
            { type: "text", text: input.barbershopName },
          ],
        },
      ],
    },
  })

  if (response.ok) {
    return { sent: true, mode: "TEMPLATE" }
  }

  if (response.errorCode === null || response.errorCode === 0) {
    return {
      sent: false,
      mode: "TEMPLATE_ERROR",
      errorCode: response.errorCode ?? undefined,
      errorSubcode: response.errorSubcode ?? undefined,
      errorMessage: response.errorMessage ?? undefined,
    }
  }

  return {
    sent: false,
    mode: "TEMPLATE_ERROR",
    errorCode: response.errorCode,
    errorSubcode: response.errorSubcode ?? undefined,
    errorMessage: response.errorMessage ?? undefined,
  }
}
