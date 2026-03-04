import { canManageBlocks } from "@/lib/barber/can-manage-blocks"
import { ensureBarberMembership } from "@/lib/barber/ensure-barber-membership"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"
import { createBarberBlockSchema } from "@/lib/validators/barber-block"

function getBarbershopId(req: Request) {
  return new URL(req.url).searchParams.get("barbershopId")
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ barberUserId: string }> }
) {
  try {
    const { barberUserId } = await params
    const barbershopId = getBarbershopId(req)

    if (!barbershopId) {
      return failure("BAD_REQUEST", "barbershopId e obrigatorio", 400)
    }

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in barbershopStatus) {
      return failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const permission = await canManageBlocks({
      actorUserId: auth.user.id,
      actorRole: membership.role,
      barbershopId,
      barberUserId,
    })

    if (!permission.ok) {
      return failure(permission.error.code, permission.error.message, permission.status)
    }

    const targetMembership = await ensureBarberMembership(barbershopId, barberUserId)
    if (!targetMembership) {
      return failure("NOT_FOUND", "Barbeiro nao encontrado na barbearia", 404)
    }

    const body = await req.json()
    const parsed = createBarberBlockSchema.safeParse(body)
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validacao",
        400,
        parsed.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const data = parsed.data
    const block = await prisma.barberBlock.create({
      data: {
        barbershopId,
        barberUserId,
        date: new Date(`${data.date}T00:00:00.000Z`),
        allDay: data.allDay,
        startTime: data.allDay ? null : data.startTime,
        endTime: data.allDay ? null : data.endTime,
        reason: data.reason,
        createdByUserId: auth.user.id,
      },
      select: {
        id: true,
        date: true,
        allDay: true,
        startTime: true,
        endTime: true,
        reason: true,
      },
    })

    return success(block, 201)
  } catch (err) {
    return handleError(err)
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ barberUserId: string }> }
) {
  try {
    const { barberUserId } = await params
    const url = new URL(req.url)
    const barbershopId = url.searchParams.get("barbershopId")
    const date = url.searchParams.get("date")

    if (!barbershopId) {
      return failure("BAD_REQUEST", "barbershopId e obrigatorio", 400)
    }

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in barbershopStatus) {
      return failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const permission = await canManageBlocks({
      actorUserId: auth.user.id,
      actorRole: membership.role,
      barbershopId,
      barberUserId,
    })

    if (!permission.ok) {
      return failure(permission.error.code, permission.error.message, permission.status)
    }

    const where: {
      barbershopId: string
      barberUserId: string
      date?: Date
    } = {
      barbershopId,
      barberUserId,
    }

    if (date) {
      where.date = new Date(`${date}T00:00:00.000Z`)
    }

    const blocks = await prisma.barberBlock.findMany({
      where,
      orderBy: [
        { date: "asc" },
        { startTime: "asc" },
      ],
    })

    return success(blocks)
  } catch (err) {
    return handleError(err)
  }
}
