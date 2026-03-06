export type WhatsappInboundMessage = {
  waId: string
  messageId: string
  receivedAt: Date
  type?: string | null
  bodyPreview?: string | null
  raw?: unknown
}

export function dedupeInboundMessages(messages: WhatsappInboundMessage[]) {
  const seen = new Set<string>()
  const output: WhatsappInboundMessage[] = []

  for (const message of messages) {
    if (!message.messageId) continue
    if (seen.has(message.messageId)) continue
    seen.add(message.messageId)
    output.push(message)
  }

  return output
}
