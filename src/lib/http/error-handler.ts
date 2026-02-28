// src/lib/http/error-handler.ts

import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { failure } from "./api-response"

const P2002_FIELD_MAP: Record<
  string,
  typeof BARBERSHOP_ERRORS[keyof typeof BARBERSHOP_ERRORS]
> = {
  slug: BARBERSHOP_ERRORS.SLUG_ALREADY_EXISTS,
  cnpj: BARBERSHOP_ERRORS.CNPJ_ALREADY_EXISTS,
  cpf: BARBERSHOP_ERRORS.CPF_ALREADY_EXISTS,
}

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

  // 🔹 Validação Zod
  if (err instanceof ZodError) {
    return failure(
      "VALIDATION_ERROR",
      "Erro de validação",
      400,
      err.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }))
    )
  }

  // 🔹 Duplicidade Prisma (P2002)
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const duplicateField = extractP2002Fields(err).find(
      (field) => field in P2002_FIELD_MAP
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

  // 🔹 Fallback
  return failure("INTERNAL_ERROR", "Erro interno do servidor", 500)
}