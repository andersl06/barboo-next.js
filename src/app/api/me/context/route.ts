import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)

    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const ownerMembership = await prisma.barbershopMembership.findFirst({
      where: {
        userId: auth.user.id,
        role: "OWNER",
        isActive: true,
      },
      select: {
        barbershopId: true,
        barbershop: {
          select: { status: true },
        },
      },
    })

    const barberMembership = ownerMembership
      ? null
      : await prisma.barbershopMembership.findFirst({
          where: {
            userId: auth.user.id,
            role: "BARBER",
            isActive: true,
          },
          select: { barbershopId: true },
        })

    const effectiveRole = ownerMembership
      ? "OWNER"
      : barberMembership
        ? "BARBER"
        : "CLIENT"

    const ownerBarbershopId = ownerMembership?.barbershopId ?? null
    const barbershopStatus = ownerMembership?.barbershop.status ?? null

    const onboardingPending =
      auth.user.onboardingIntent === "OWNER"
      && auth.user.onboardingStatus === "PENDING"
      && !ownerBarbershopId

    return success({
      user: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        onboardingIntent: auth.user.onboardingIntent,
        onboardingStatus: auth.user.onboardingStatus,
        mustChangePassword: auth.user.mustChangePassword,
      },
      effectiveRole,
      ownerBarbershopId,
      barbershopStatus,
      onboardingPending,
    })
  } catch (err) {
    return handleError(err)
  }
}
