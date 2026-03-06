type SendPasswordResetEmailInput = {
  to: string
  resetUrl: string
  recipientName?: string | null
}

function sanitizeProvider(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "console"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildPasswordResetHtml({
  resetUrl,
  recipientName,
}: {
  resetUrl: string
  recipientName?: string | null
}) {
  const safeUrl = escapeHtml(resetUrl)
  const safeName = recipientName ? escapeHtml(recipientName) : "cliente"

  return `
  <div style="background:#070B16;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif;color:#f1f2f7;">
    <div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,rgba(17,24,66,.92) 0%,rgba(11,16,43,.96) 100%);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;">
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:#f4f6ff;">Redefinir senha no Barboo</h1>
      <p style="margin:0 0 16px;color:#c8d2f2;font-size:14px;line-height:1.6;">Ola, ${safeName}. Recebemos uma solicitacao para redefinir sua senha.</p>
      <p style="margin:0 0 20px;color:#aeb8db;font-size:14px;line-height:1.6;">Clique no botao abaixo para criar uma nova senha. Esse link expira em breve por seguranca.</p>
      <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(180deg,#f36c20 0%,#cb4518 100%);color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 20px;">Redefinir senha</a>
      <p style="margin:20px 0 8px;color:#9eabd4;font-size:12px;line-height:1.6;">Se o botao não funcionar, copie e cole este link no navegador:</p>
      <p style="margin:0;color:#d8e3ff;font-size:12px;word-break:break-all;">${safeUrl}</p>
      <p style="margin:20px 0 0;color:#7f8dbd;font-size:12px;line-height:1.6;">Se Você não solicitou esta alteracao, ignore este e-mail.</p>
    </div>
  </div>`
}

function buildPasswordResetText({ resetUrl, recipientName }: { resetUrl: string; recipientName?: string | null }) {
  const prefix = recipientName ? `Ola, ${recipientName}.` : "Ola."
  return `${prefix}

Recebemos uma solicitacao para redefinir sua senha no Barboo.
Acesse o link abaixo para criar uma nova senha:

${resetUrl}

Se Você não solicitou esta alteracao, ignore este e-mail.`
}

async function sendWithResend({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!apiKey || !from) {
    throw new Error("RESEND_PROVIDER_MISSING_CONFIG")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`RESEND_SEND_FAILED:${response.status}:${details}`)
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  recipientName,
}: SendPasswordResetEmailInput) {
  const provider = sanitizeProvider(process.env.EMAIL_PROVIDER)
  const subject = "Redefinicao de senha - Barboo"
  const html = buildPasswordResetHtml({ resetUrl, recipientName })
  const text = buildPasswordResetText({ resetUrl, recipientName })

  if (provider === "resend") {
    await sendWithResend({
      to,
      subject,
      html,
      text,
    })
    return
  }

  console.info(`[barboo][email:console] to=${to} subject="${subject}" resetUrl=${resetUrl}`)
}
