import { prisma } from "@/lib/db/prisma"
import { hashPassword } from "@/lib/security/bcrypt"
import { registerSchema } from "@/lib/validators/auth"
import { success, failure } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown"

    if (!rateLimit(ip)) {
      return failure(
        "RATE_LIMIT",
        "Muitas requisições. Tente novamente.",
        429
      )
    }

    const body = await req.json()

    // Sanitização
    body.email = body.email?.trim().toLowerCase()
    body.name = body.name?.trim()
    body.cpf = body.cpf?.replace(/\D/g, "")
    body.phone = body.phone?.replace(/\D/g, "")

    const data = registerSchema.parse(body)

    const passwordHash = await hashPassword(data.password)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        passwordHash,
      },
    })

    return success(
      {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}