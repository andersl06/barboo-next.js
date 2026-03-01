import { prisma } from "@/lib/db/prisma"
import { BarbershopStatus } from "@prisma/client"
import { BARBER_ERRORS } from "@/lib/errors/barber-errors"

export type RequireBarbershopNotSuspendedResult =
  | { ok: true; barbershopId: string }
  | {
      ok: false
      status: 404 | 403
      code: string
      message: string
    }

export async function requireBarbershopNotSuspended(
  barbershopId: string
): Promise<RequireBarbershopNotSuspendedResult> {
  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, status: true },
  })

  if (!barbershop) {
    return {
      ok: false,
      status: 404,
      code: BARBER_ERRORS.BARBERSHOP_NOT_FOUND.code,
      message: BARBER_ERRORS.BARBERSHOP_NOT_FOUND.message,
    }
  }

  if (barbershop.status === BarbershopStatus.SUSPENSA) {
    return {
      ok: false,
      status: 403,
      code: BARBER_ERRORS.BARBERSHOP_SUSPENDED.code,
      message: BARBER_ERRORS.BARBERSHOP_SUSPENDED.message,
    }
  }

  return { ok: true, barbershopId: barbershop.id }
}
