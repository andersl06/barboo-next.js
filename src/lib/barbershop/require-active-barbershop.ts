import { prisma } from "@/lib/db/prisma"
import { BarbershopStatus } from "@prisma/client"

export type BarbershopSuccess = {
  barbershopId: string
}

export type BarbershopError = {
  error: true
  status: 404 | 403
  code:
    | "BARBERSHOP_NOT_FOUND"
    | "BARBERSHOP_SUSPENDED"
    | "BARBERSHOP_IN_SETUP"
  message: string
}

export type BarbershopResult =
  | BarbershopSuccess
  | BarbershopError

export async function requireActiveBarbershop(
  barbershopId: string,
  options?: {
    allowSetup?: boolean
  }
): Promise<BarbershopResult> {

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!barbershop) {
    return {
      error: true,
      status: 404,
      code: "BARBERSHOP_NOT_FOUND",
      message: "Barbearia não encontrada",
    }
  }

  if (barbershop.status === BarbershopStatus.SUSPENSA) {
    return {
      error: true,
      status: 403,
      code: "BARBERSHOP_SUSPENDED",
      message: "Barbearia suspensa",
    }
  }

  if (
    barbershop.status === BarbershopStatus.EM_CONFIGURACAO &&
    !options?.allowSetup
  ) {
    return {
      error: true,
      status: 403,
      code: "BARBERSHOP_IN_SETUP",
      message: "Barbearia ainda está em configuração",
    }
  }

  return {
    barbershopId: barbershop.id,
  }
}