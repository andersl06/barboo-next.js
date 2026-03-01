import { prisma } from "@/lib/db/prisma"
import { hashPassword } from "@/lib/security/bcrypt"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireMembership } from "@/lib/membership/require-membership"
import { createBarberSchema } from "@/lib/validators/barber"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"

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

    const passwordHash = await hashPassword(data.password)

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        passwordHash,
        mustChangePassword: true,
        memberships: {
          create: {
            barbershopId,
            role: "BARBER",
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