import { prisma } from "@/lib/db/prisma"
import { hashPassword } from "@/lib/security/bcrypt"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireMembership } from "@/lib/membership/require-membership"
import { registerSchema } from "@/lib/validators/auth"

export async function POST(
  req: Request,
  { params }: { params: { id?: string } }
) {
  try {
    // ✅ Validar ID da barbearia
    const barbershopId = params?.id

    if (!barbershopId) {
      return failure("BAD_REQUEST", "ID da barbearia é obrigatório", 400)
    }

    // ✅ Autenticação
    const auth = await requireAuth(req)

    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    // ✅ Validação multi-tenant centralizada
    const membership = await requireMembership(
      auth.user,
      barbershopId,
      ["OWNER"] 
    )

    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const body = await req.json()

    // ✅ Sanitização
    body.email = body.email?.trim().toLowerCase()
    body.name = body.name?.trim()
    body.cpf = body.cpf?.trim()
    body.phone = body.phone?.trim()

    const data = registerSchema.parse(body)

    const passwordHash = await hashPassword(data.password)

    // 🔒 Garantir que email não existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      return failure("CONFLICT", "Email já cadastrado", 409)
    }

    // ✅ Criar usuário barbeiro
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
    })

    return success(
      { message: "Barbeiro criado com sucesso" },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}