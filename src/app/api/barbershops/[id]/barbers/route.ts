import { prisma } from "@/lib/db/prisma"
import { hashPassword } from "@/lib/security/bcrypt"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireMembership } from "@/lib/membership/require-membership"
import { createBarberSchema } from "@/lib/validators/barber"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const barbershopId = resolvedParams?.id

    if (!barbershopId) {
      return failure("BAD_REQUEST", "ID da barbearia é obrigatório", 400)
    }

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

    const members = await prisma.barbershopMembership.findMany({
      where: {
        barbershopId,
        isActive: true,
        OR: [
          { role: "BARBER" },
          {
            role: "OWNER",
            user: {
              barberProfile: {
                isNot: null,
              },
            },
          },
        ],
      },
      select: {
        userId: true,
        role: true,
        isActive: true,
        canManageBlocks: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
            barberProfile: {
              select: {
                bio: true,
                avatarUrl: true,
                weeklySchedule: true,
                canManageBlocks: true,
              },
            },
          },
        },
      },
    })

    const data = members
      .map((item) => ({
        userId: item.userId,
        role: item.role,
        isActive: item.isActive,
        canManageBlocks: item.canManageBlocks,
        createdAt: item.createdAt,
        name: item.user.name,
        email: item.user.email,
        bio: item.user.barberProfile?.bio ?? null,
        avatarUrl: item.user.barberProfile?.avatarUrl ?? null,
        weeklySchedule: item.user.barberProfile?.weeklySchedule ?? null,
        profileCanManageBlocks: item.user.barberProfile?.canManageBlocks ?? false,
      }))
      .sort((a, b) => {
        if (a.role === "OWNER" && b.role !== "OWNER") return -1
        if (a.role !== "OWNER" && b.role === "OWNER") return 1
        return a.name.localeCompare(b.name)
      })

    return success(data)
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const barbershopId = resolvedParams?.id

    if (!barbershopId) {
      return failure("BAD_REQUEST", "ID da barbearia é obrigatório", 400)
    }

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

    const body = await req.json()
    const data = createBarberSchema.parse(body)
    const normalizedName =
      data.name
      ?? data.email.split("@")[0]?.replace(/[._-]+/g, " ").trim()
      ?? "Barbeiro"

    const passwordHash = await hashPassword(data.password)

    const newUser = await prisma.user.create({
      data: {
        name: normalizedName.length > 0 ? normalizedName : "Barbeiro",
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        passwordHash,
        mustChangePassword: true,
        memberships: {
          create: {
            barbershopId,
            role: "BARBER",
            canManageBlocks: false,
          },
        },
        barberProfile: {
          create: {},
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return success(
      {
        message: "Barbeiro criado com sucesso",
        barber: newUser,
      },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}
