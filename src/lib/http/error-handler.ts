import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { AUTH_ERRORS } from "@/lib/errors/auth-errors"
import { failure } from "./api-response"

const P2002_FIELD_MAP = {
  slug: BARBERSHOP_ERRORS.SLUG_ALREADY_EXISTS,
  cnpj: BARBERSHOP_ERRORS.CNPJ_ALREADY_EXISTS,
  cpf: AUTH_ERRORS.CPF_ALREADY_EXISTS,
  email: AUTH_ERRORS.EMAIL_ALREADY_EXISTS,
} as const

function extractP2002Fields(
  err: Prisma.PrismaClientKnownRequestError
): string[] {
  const metaTarget = err.meta?.target

  if (Array.isArray(metaTarget)) {
    return metaTarget.filter(
      (item): item is string => typeof item === "string"
    )
  }

  if (typeof metaTarget === "string") {
    return [metaTarget]
  }

  return []
}

export function handleError(err: unknown) {

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => {
      const firstPath = issue.path[0]
      const field =
        typeof firstPath === "string" || typeof firstPath === "number"
          ? firstPath
          : undefined

      return {
        field,
        message: issue.message,
      }
    })

    return failure(
      "VALIDATION_ERROR",
      "Erro de validação",
      400,
      details
    )
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const duplicateField = extractP2002Fields(err).find(
      (field): field is keyof typeof P2002_FIELD_MAP =>
        field in P2002_FIELD_MAP
    )

    if (duplicateField) {
      const mapped = P2002_FIELD_MAP[duplicateField]

      return failure(mapped.code, mapped.message, 409, [
        {
          field: mapped.field,
          message: mapped.message,
        },
      ])
    }

    return failure("DUPLICATE", "Dados já cadastrados", 409)
  }

  return failure(
    "INTERNAL_ERROR",
    "Erro interno do servidor",
    500
  )
}