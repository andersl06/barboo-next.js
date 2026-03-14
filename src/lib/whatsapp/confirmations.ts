import { getWhatsappWindowStatus } from "@/lib/whatsapp/service"
import { normalizeWhatsappDigits } from "@/lib/whatsapp/normalize"
import { sendWhatsappGraphMessage } from "@/lib/whatsapp/graph"

export type WhatsappConfirmationInput = {
  waIdDigits: string
  customerName: string
  appointmentDate: string
  appointmentTime: string
  barbershopName: string
}

export type WhatsappConfirmationResult = {
  sent: boolean
  mode: "FREE_FORM" | "TEMPLATE" | "TEMPLATE_REQUIRED" | "TEMPLATE_ERROR" | "ERROR"
  errorCode?: number
  errorSubcode?: number
  errorMessage?: string
}

function buildConfirmationMessage(input: WhatsappConfirmationInput) {
  const appUrl = process.env.APP_URL?.trim()
  const appointmentUrl = appUrl ? `${appUrl.replace(/\/+$/, "")}/cliente/agendamentos` : null

  return [
    `Ola ${input.customerName}.`,
    "",
    "Seu horario foi confirmado com sucesso.",
    "",
    `Data: ${input.appointmentDate}`,
    `Horario: ${input.appointmentTime}`,
    `Barbearia: ${input.barbershopName}`,
    "",
    "Voce pode consultar mais detalhes sobre o seu agendamento aqui:",
    ...(appointmentUrl ? [appointmentUrl] : []),
  ].join("\n")
}

async function sendTemplateConfirmation(input: WhatsappConfirmationInput) {
  const templateName =
    process.env.WHATSAPP_BARBER_CONFIRM_TEMPLATE_NAME ??
    process.env.WHATSAPP_CONFIRM_TEMPLATE_NAME
  const templateLang =
    process.env.WHATSAPP_BARBER_CONFIRM_TEMPLATE_LANG ??
    process.env.WHATSAPP_CONFIRM_TEMPLATE_LANG ??
    "pt_BR"

  if (!templateName) {
    return {
      ok: false,
      mode: "TEMPLATE_REQUIRED" as const,
      errorCode: null,
      errorSubcode: null,
      errorMessage: null,
    }
  }

  const response = await sendWhatsappGraphMessage({
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
    return { ok: true, mode: "TEMPLATE" as const }
  }

  return {
    ok: false,
    mode: "TEMPLATE_ERROR" as const,
    errorCode: response.errorCode ?? undefined,
    errorSubcode: response.errorSubcode ?? undefined,
    errorMessage: response.errorMessage ?? undefined,
  }
}

export async function sendWhatsappAppointmentConfirmation(
  input: WhatsappConfirmationInput
): Promise<WhatsappConfirmationResult> {
  const waIdDigits = normalizeWhatsappDigits(input.waIdDigits)
  if (!waIdDigits) {
    return { sent: false, mode: "ERROR" }
  }

  const { windowOpen } = await getWhatsappWindowStatus(waIdDigits)

  if (windowOpen) {
    const response = await sendWhatsappGraphMessage({
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
      return {
        sent: false,
        mode: "ERROR",
        errorCode: response.errorCode ?? undefined,
        errorSubcode: response.errorSubcode ?? undefined,
        errorMessage: response.errorMessage ?? undefined,
      }
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
    errorSubcode: templateResult.errorSubcode ?? undefined,
    errorMessage: templateResult.errorMessage ?? undefined,
  }
}
