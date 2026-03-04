import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { lookupZip } from "@/lib/integrations/zip/zip-lookup"
import { rateLimit } from "@/lib/security/rate-limit"

function integrationStatus(code: string) {
  if (code.endsWith("SERVICE_UNAVAILABLE")) {
    return 503
  }

  return 400
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params
    const normalizedZip = zipCode.replace(/\D/g, "")

    if (normalizedZip.length !== 8) {
      return failure(
        BARBERSHOP_ERRORS.ZIP_INVALID.code,
        BARBERSHOP_ERRORS.ZIP_INVALID.message,
        400,
        [
          {
            field: BARBERSHOP_ERRORS.ZIP_INVALID.field,
            message: BARBERSHOP_ERRORS.ZIP_INVALID.message,
          },
        ]
      )
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`utils:zip:${normalizedZip}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 40,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const zipLookup = await lookupZip(normalizedZip)
    if (!zipLookup.ok) {
      return failure(
        zipLookup.error.code,
        zipLookup.error.message,
        integrationStatus(zipLookup.error.code),
        [
          {
            field: zipLookup.error.field,
            message: zipLookup.error.message,
          },
        ]
      )
    }

    return success(zipLookup.data)
  } catch (err) {
    return handleError(err)
  }
}
