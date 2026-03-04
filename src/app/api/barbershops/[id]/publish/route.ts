import { requireAuth } from "@/lib/auth/require-auth"
import { getBarbershopPublishReadiness } from "@/lib/barbershop/publish-readiness"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, {
      allowSetup: true,
    })
    if ("error" in barbershopStatus) {
      return failure(
        barbershopStatus.code,
        barbershopStatus.message,
        barbershopStatus.status
      )
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const readiness = await getBarbershopPublishReadiness(barbershopId)
    if (!readiness) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia nao encontrada", 404)
    }

    return success(readiness)
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, {
      allowSetup: true,
    })
    if ("error" in barbershopStatus) {
      return failure(
        barbershopStatus.code,
        barbershopStatus.message,
        barbershopStatus.status
      )
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const readiness = await getBarbershopPublishReadiness(barbershopId)
    if (!readiness) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia nao encontrada", 404)
    }

    if (!readiness.ready) {
      return failure(
        "BARBERSHOP_NOT_READY",
        "Barbearia ainda nao esta pronta para publicacao.",
        422,
        readiness.missing
      )
    }

    if (readiness.status === "ATIVA") {
      return success({
        published: true,
        alreadyActive: true,
        status: "ATIVA",
      })
    }

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: { status: "ATIVA" },
      select: {
        id: true,
        status: true,
      },
    })

    return success({
      published: true,
      alreadyActive: false,
      ...updated,
    })
  } catch (err) {
    return handleError(err)
  }
}
