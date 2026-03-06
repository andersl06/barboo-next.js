import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

const updateTeamMemberSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres.").max(120, "Nome deve ter no máximo 120 caracteres.").optional(),
    bio: z
      .string()
      .trim()
      .max(500, "Bio deve ter no máximo 500 caracteres.")
      .optional()
      .transform((value) => (value === undefined ? undefined : value.length > 0 ? value : null)),
    canManageBlocks: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.")

async function getValidatedContext(req: Request, barbershopId: string) {
  const auth = await requireAuth(req)
  if ("error" in auth) {
    return { error: failure("UNAUTHORIZED", auth.message, auth.status) as Response }
  }

  const barbershopStatus = await requireActiveBarbershop(barbershopId, { allowSetup: true })
  if ("error" in barbershopStatus) {
    return {
      error: failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status) as Response,
    }
  }

  const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
  if ("error" in membership) {
    return { error: failure("FORBIDDEN", membership.message, membership.status) as Response }
  }

  return { auth, membership, error: null as Response | null }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; barberUserId: string }> }
) {
  try {
    const { id: barbershopId, barberUserId } = await params

    const context = await getValidatedContext(req, barbershopId)
    if (context.error) {
      return context.error
    }

    const targetMembership = await prisma.barbershopMembership.findUnique({
      where: {
        userId_barbershopId: {
          userId: barberUserId,
          barbershopId,
        },
      },
      select: {
        userId: true,
        role: true,
        isActive: true,
      },
    })

    if (!targetMembership || !targetMembership.isActive) {
      return failure("NOT_FOUND", "Barbeiro não encontrado na barbearia.", 404)
    }

    const parsed = updateTeamMemberSchema.safeParse(await req.json())
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de Validação",
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

    const payload = parsed.data

    await prisma.$transaction(async (tx) => {
      if (payload.name) {
        await tx.user.update({
          where: { id: barberUserId },
          data: { name: payload.name },
        })
      }

      if (payload.bio !== undefined || payload.canManageBlocks !== undefined) {
        await tx.barberProfile.upsert({
          where: { userId: barberUserId },
          create: {
            userId: barberUserId,
            bio: payload.bio ?? null,
            canManageBlocks: payload.canManageBlocks ?? false,
          },
          update: {
            ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
            ...(payload.canManageBlocks !== undefined
              ? { canManageBlocks: payload.canManageBlocks }
              : {}),
          },
        })
      }

      if (payload.canManageBlocks !== undefined && targetMembership.role === "BARBER") {
        await tx.barbershopMembership.update({
          where: {
            userId_barbershopId: {
              userId: barberUserId,
              barbershopId,
            },
          },
          data: {
            canManageBlocks: payload.canManageBlocks,
          },
        })
      }
    })

    const updated = await prisma.barbershopMembership.findUnique({
      where: {
        userId_barbershopId: {
          userId: barberUserId,
          barbershopId,
        },
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

    if (!updated) {
      return failure("NOT_FOUND", "Barbeiro não encontrado na barbearia.", 404)
    }

    return success({
      userId: updated.userId,
      role: updated.role,
      isActive: updated.isActive,
      canManageBlocks: updated.canManageBlocks,
      createdAt: updated.createdAt,
      name: updated.user.name,
      email: updated.user.email,
      bio: updated.user.barberProfile?.bio ?? null,
      avatarUrl: updated.user.barberProfile?.avatarUrl ?? null,
      weeklySchedule: updated.user.barberProfile?.weeklySchedule ?? null,
      profileCanManageBlocks: updated.user.barberProfile?.canManageBlocks ?? false,
    })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; barberUserId: string }> }
) {
  try {
    const { id: barbershopId, barberUserId } = await params

    const context = await getValidatedContext(req, barbershopId)
    if (context.error) {
      return context.error
    }

    const targetMembership = await prisma.barbershopMembership.findUnique({
      where: {
        userId_barbershopId: {
          userId: barberUserId,
          barbershopId,
        },
      },
      select: {
        userId: true,
        role: true,
        isActive: true,
      },
    })

    if (!targetMembership || !targetMembership.isActive) {
      return failure("NOT_FOUND", "Barbeiro não encontrado na barbearia.", 404)
    }

    if (targetMembership.role !== "BARBER") {
      return failure("FORBIDDEN", "Somente barbeiros podem ser removidos da equipe.", 403)
    }

    await prisma.barbershopMembership.update({
      where: {
        userId_barbershopId: {
          userId: barberUserId,
          barbershopId,
        },
      },
      data: {
        isActive: false,
        canManageBlocks: false,
      },
    })

    return success({ removed: true })
  } catch (err) {
    return handleError(err)
  }
}

