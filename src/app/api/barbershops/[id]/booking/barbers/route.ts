import { listBookableBarbers } from "@/lib/appointments/bookable-barbers"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { getClientIp } from "@/lib/http/client-ip"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const ip = getClientIp(req)
    const allowed = rateLimit(`booking:barbers:${barbershopId}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const status = await requireActiveBarbershop(barbershopId)
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const barbers = await listBookableBarbers(barbershopId)

    return success(barbers)
  } catch (err) {
    return handleError(err)
  }
}
