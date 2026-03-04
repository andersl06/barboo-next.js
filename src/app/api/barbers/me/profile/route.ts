import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { hashPassword } from "@/lib/security/bcrypt"
import { updateBarberProfileSchema } from "@/lib/validators/barber-profile-update"
import { Prisma } from "@prisma/client"

async function resolveMembership(userId: string) {
  const [ownerMembership, barberMembership] = await Promise.all([
    prisma.barbershopMembership.findFirst({
      where: {
        userId,
        role: "OWNER",
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.barbershopMembership.findFirst({
      where: {
        userId,
        role: "BARBER",
        isActive: true,
      },
      select: { id: true },
    }),
  ])

  return {
    hasOwnerMembership: Boolean(ownerMembership),
    hasBarberMembership: Boolean(barberMembership),
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const membership = await resolveMembership(auth.user.id)
    if (!membership.hasOwnerMembership && !membership.hasBarberMembership) {
      return failure("FORBIDDEN", "Acesso permitido apenas para owner/barber.", 403)
    }

    const [profile, user] = await Promise.all([
      prisma.barberProfile.upsert({
        where: { userId: auth.user.id },
        update: {},
        create: { userId: auth.user.id },
        select: {
          userId: true,
          bio: true,
          avatarUrl: true,
          weeklySchedule: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: auth.user.id },
        select: {
          name: true,
          email: true,
          phone: true,
        },
      }),
    ])

    if (!user) {
      return failure("UNAUTHORIZED", "Usuario nao encontrado.", 401)
    }

    return success({
      ...profile,
      name: user.name,
      email: user.email,
      phone: user.phone,
      hasBarberMembership: membership.hasBarberMembership,
    })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const membership = await resolveMembership(auth.user.id)
    if (!membership.hasOwnerMembership && !membership.hasBarberMembership) {
      return failure("FORBIDDEN", "Acesso permitido apenas para owner/barber.", 403)
    }

    const body = await req.json()
    const parsed = updateBarberProfileSchema.safeParse(body)

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

    const userData: {
      name?: string
      email?: string
      phone?: string
      passwordHash?: string
    } = {}

    if (parsed.data.name !== undefined) {
      userData.name = parsed.data.name
    }

    if (parsed.data.phone !== undefined) {
      userData.phone = parsed.data.phone
    }

    if (parsed.data.email !== undefined) {
      userData.email = parsed.data.email
    }

    if (parsed.data.newPassword) {
      userData.passwordHash = await hashPassword(parsed.data.newPassword)
    }

    const profileData: {
      bio?: string
    } = {}

    if (parsed.data.bio !== undefined) {
      profileData.bio = parsed.data.bio
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: auth.user.id },
          data: userData,
          select: { id: true },
        })
      }

      const profile = await tx.barberProfile.upsert({
        where: { userId: auth.user.id },
        update: profileData,
        create: {
          userId: auth.user.id,
          bio: parsed.data.bio ?? null,
        },
        select: {
          userId: true,
          bio: true,
          avatarUrl: true,
          weeklySchedule: true,
        },
      })

      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: {
          name: true,
          email: true,
          phone: true,
        },
      })

      if (!user) {
        throw new Error("Usuario nao encontrado.")
      }

      return {
        ...profile,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hasBarberMembership: membership.hasBarberMembership,
      }
    })

    return success(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return failure("CONFLICT", "Email ja esta em uso.", 409, [
        { field: "email", message: "Email ja esta em uso." },
      ])
    }

    return handleError(err)
  }
}
