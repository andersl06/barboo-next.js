import { requireAuth } from "@/lib/auth/require-auth"
import { ensureOwnerBarberProfile } from "@/lib/barbershop/ensureOwnerBarberProfile"
import { requireBarbershopNotSuspended } from "@/lib/barbershop/requireBarbershopNotSuspended"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireMembership } from "@/lib/membership/require-membership"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    if (!barbershopId) {
      return failure("BAD_REQUEST", "ID da barbearia é obrigatório", 400)
    }

    const auth = await requireAuth(req)

    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const barbershopStatus = await requireBarbershopNotSuspended(barbershopId)

    if (!barbershopStatus.ok) {
      return failure(barbershopStatus.code, barbershopStatus.message, barbershopStatus.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])

    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const profile = await ensureOwnerBarberProfile(auth.user.id)

    return success(
      {
        message: profile.created
          ? "Owner habilitado como barber com sucesso"
          : "Owner já estava habilitado como barber",
        barberProfileId: profile.profileId,
        alreadyBarber: !profile.created,
      },
      200
    )
  } catch (err) {
    return handleError(err)
  }
}
