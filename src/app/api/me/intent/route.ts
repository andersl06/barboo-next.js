import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { updateOnboardingIntentSchema } from "@/lib/validators/auth"

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const body = await req.json()
    const parsed = updateOnboardingIntentSchema.safeParse(body)
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

    const hasOwnerMembership = await prisma.barbershopMembership.findFirst({
      where: {
        userId: auth.user.id,
        role: "OWNER",
        isActive: true,
      },
      select: { id: true },
    })

    const onboardingIntent = parsed.data.onboardingIntent
    const onboardingStatus =
      onboardingIntent === "OWNER"
        ? (hasOwnerMembership ? "DONE" : "PENDING")
        : "DONE"

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        onboardingIntent,
        onboardingStatus,
      },
      select: {
        id: true,
        onboardingIntent: true,
        onboardingStatus: true,
      },
    })

    return success(updated)
  } catch (err) {
    return handleError(err)
  }
}
