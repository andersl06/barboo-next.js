import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"
import { sendWhatsappGraphMessage } from "@/lib/whatsapp/graph"

export type WhatsappReminderInput = {
  waIdDigits: string
  customerName: string
  appointmentDate: string
  appointmentTime: string
  barbershopName: string
}

export type WhatsappReminderResult = {
  sent: boolean
  mode: "FREE_FORM" | "TEMPLATE" | "TEMPLATE_REQUIRED" | "TEMPLATE_ERROR" | "ERROR"
  errorCode?: number
  errorSubcode?: number
  errorMessage?: string
}

function buildReminderMessage(input: WhatsappReminderInput) {
  const appUrl = process.env.APP_URL?.trim()
  const appointmentUrl = appUrl ? `${appUrl.replace(/\/+$/, "")}/cliente/agendamentos` : null

  return [
    `Ola ${input.customerName}.`,
    "",
    "Nao se esqueca do seu compromisso.",
    "",
    "Seu horario esta agendado para:",
    `Data: ${input.appointmentDate}`,
    `Horario: ${input.appointmentTime}`,
    `Barbearia: ${input.barbershopName}`,
    "",
    "Voce pode consultar mais detalhes do seu agendamento aqui:",
    ...(appointmentUrl ? [appointmentUrl] : []),
  ].join("\n")
}

export async function sendWhatsappReminderFreeForm(
  input: WhatsappReminderInput
): Promise<WhatsappReminderResult> {
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
      body: buildReminderMessage(input),
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

export async function sendWhatsappReminderTemplate(
  input: WhatsappReminderInput
): Promise<WhatsappReminderResult> {
  const waIdDigits = normalizeWhatsappDigits(input.waIdDigits)
  if (!waIdDigits) {
    return { sent: false, mode: "ERROR" }
  }

  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME
  const templateLang = process.env.WHATSAPP_REMINDER_TEMPLATE_LANG ?? "pt_BR"

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
            { type: "text", parameter_name: "nome_cliente", text: input.customerName },
            { type: "text", parameter_name: "data", text: input.appointmentDate },
            { type: "text", parameter_name: "horario", text: input.appointmentTime },
            { type: "text", parameter_name: "barbearia", text: input.barbershopName },
          ],
        },
      ],
    },
  })

  if (response.ok) {
    return { sent: true, mode: "TEMPLATE" }
  }

  return {
    sent: false,
    mode: "TEMPLATE_ERROR",
    errorCode: response.errorCode ?? undefined,
    errorSubcode: response.errorSubcode ?? undefined,
    errorMessage: response.errorMessage ?? undefined,
  }
}
