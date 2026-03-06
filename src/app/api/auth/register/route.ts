import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { success, failure } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { hashPassword } from "@/lib/security/bcrypt"
import { rateLimit } from "@/lib/security/rate-limit"
import { registerSchema } from "@/lib/validators/auth"

function p2002Fields(err: Prisma.PrismaClientKnownRequestError): string[] {
  const target = err.meta?.target

  if (Array.isArray(target)) {
    return target.filter((item): item is string => typeof item === "string")
  }

  if (typeof target === "string") {
    return [target]
  }

  return []
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)

    if (!rateLimit(ip)) {
      return failure(
        "RATE_LIMIT",
        "Muitas requisições. Tente novamente.",
        429
      )
    }

    const body = await req.json()

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
        onboardingIntent: data.onboardingIntent,
        onboardingStatus:
          data.onboardingIntent === "OWNER" ? "PENDING" : "DONE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return success(user, 201)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const duplicateFields = p2002Fields(err)

      if (duplicateFields.includes("email")) {
        return failure(
          AUTH_ERRORS.EMAIL_ALREADY_EXISTS.code,
          AUTH_ERRORS.EMAIL_ALREADY_EXISTS.message,
          409,
          [
            {
              field: AUTH_ERRORS.EMAIL_ALREADY_EXISTS.field,
              message: AUTH_ERRORS.EMAIL_ALREADY_EXISTS.message,
            },
          ]
        )
      }

      if (duplicateFields.includes("cpf")) {
        return failure(
          AUTH_ERRORS.CPF_ALREADY_EXISTS.code,
          AUTH_ERRORS.CPF_ALREADY_EXISTS.message,
          409,
          [
            {
              field: AUTH_ERRORS.CPF_ALREADY_EXISTS.field,
              message: AUTH_ERRORS.CPF_ALREADY_EXISTS.message,
            },
          ]
        )
      }
    }

    return handleError(err)
  }
}
