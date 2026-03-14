export type WhatsappGraphResult = {
  ok: boolean
  errorCode?: number | null
  errorSubcode?: number | null
  errorMessage?: string | null
  errorType?: string | null
}

function buildGraphUrl() {
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`
}

export async function sendWhatsappGraphMessage(body: unknown): Promise<WhatsappGraphResult> {
  const graphToken = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!graphToken || !phoneNumberId) {
    return { ok: false, errorCode: 0, errorMessage: "WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausente" }
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
    const payload = (await response.json()) as {
      error?: {
        code?: number
        error_subcode?: number
        message?: string
        type?: string
      }
    }
    return {
      ok: false,
      errorCode: payload.error?.code ?? null,
      errorSubcode: payload.error?.error_subcode ?? null,
      errorMessage: payload.error?.message ?? null,
      errorType: payload.error?.type ?? null,
    }
  } catch {
    return { ok: false, errorCode: null, errorMessage: "Falha ao parsear erro da Graph API" }
  }
}
