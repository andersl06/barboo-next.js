import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { failure } from "./api-response"

export function handleError(err: any) {
  console.error("🔥 ERRO REAL:", err)
  if (err instanceof ZodError) {
    return failure(
      "VALIDATION_ERROR",
      "Erro de validação",
      422,
      err.issues.map(issue => ({
        field: issue.path[0],
        message: issue.message,
      }))
    )
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return failure(
        "DUPLICATE_ERROR",
        "Dados já cadastrados",
        409
      )
    }
  }

  return failure(
    "INTERNAL_ERROR",
    "Erro interno do servidor",
    500
  )
}