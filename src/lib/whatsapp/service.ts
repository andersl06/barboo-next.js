import { prisma } from "@/lib/db/prisma"
import { isWhatsappWindowOpen } from "@/lib/whatsapp/window"

export async function getWhatsappWindowStatus(waId: string) {
  if (!waId) {
    return { windowOpen: false, lastInboundAt: null }
  }

  const contact = await prisma.whatsAppContact.findUnique({
    where: { waId },
    select: { lastInboundAt: true },
  })

  const lastInboundAt = contact?.lastInboundAt ?? null
  return {
    windowOpen: isWhatsappWindowOpen(lastInboundAt),
    lastInboundAt,
  }
}
