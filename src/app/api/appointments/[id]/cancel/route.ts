import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { APPOINTMENT_ERRORS } from "@/lib/errors/appointment-errors"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { cancelAppointmentSchema } from "@/lib/validators/appointment"

const paramsSchema = z.object({
  id: z.string().uuid("id invalido."),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`appointments:cancel:${auth.user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 80,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const parsedParams = paramsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
        400,
        parsedParams.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const parsedBody = cancelAppointmentSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsedBody.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
        400,
        parsedBody.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const appointment = await prisma.barbershopAppointment.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        clientUserId: true,
        status: true,
        startAt: true,
      },
    })

    if (!appointment || appointment.clientUserId !== auth.user.id) {
      return failure(APPOINTMENT_ERRORS.NOT_FOUND.code, APPOINTMENT_ERRORS.NOT_FOUND.message, 404)
    }

    if (appointment.status === "CANCELED" || appointment.status === "REJECTED") {
      return failure(
        APPOINTMENT_ERRORS.INVALID_STATUS.code,
        APPOINTMENT_ERRORS.INVALID_STATUS.message,
        409
      )
    }

    if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
      return failure(
        APPOINTMENT_ERRORS.INVALID_STATUS.code,
        "Somente agendamentos pendentes ou confirmados podem ser cancelados.",
        409
      )
    }

    const latestCancelableTime = new Date(appointment.startAt.getTime() - 30 * 60 * 1000)
    if (new Date().getTime() > latestCancelableTime.getTime()) {
      return failure(
        APPOINTMENT_ERRORS.CANCEL_WINDOW_EXPIRED.code,
        APPOINTMENT_ERRORS.CANCEL_WINDOW_EXPIRED.message,
        409
      )
    }

    const updated = await prisma.barbershopAppointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledByUserId: auth.user.id,
        cancelReason: parsedBody.data.reason ?? null,
      },
      select: {
        id: true,
        status: true,
        canceledAt: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}

