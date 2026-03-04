import { z } from "zod"

function asOptionalTrimmed(value: unknown) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalPhoneSchema = z
  .preprocess(asOptionalTrimmed, z.string().optional())
  .transform((value) => value?.replace(/\D/g, ""))
  .refine(
    (value) => value === undefined || value.length === 10 || value.length === 11,
    "Telefone deve conter 10 ou 11 digitos."
  )

export const updateBarberProfileSchema = z
  .object({
    name: z
      .preprocess(asOptionalTrimmed, z.string().min(3, "Nome muito curto").max(80).optional()),
    email: z
      .preprocess(asOptionalTrimmed, z.string().email("Email invalido").optional())
      .transform((value) => value?.toLowerCase())
      .optional(),
    phone: optionalPhoneSchema.optional(),
    bio: z
      .preprocess(asOptionalTrimmed, z.string().max(500, "Bio deve ter no maximo 500 caracteres.").optional())
      .optional(),
    newPassword: z
      .preprocess(asOptionalTrimmed, z.string().min(6, "Senha deve ter no minimo 6 caracteres").optional())
      .optional(),
    confirmPassword: z
      .preprocess(asOptionalTrimmed, z.string().min(6, "Confirmacao de senha invalida").optional())
      .optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.newPassword && !payload.confirmPassword) {
      return
    }

    if (!payload.newPassword || !payload.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe nova senha e confirmacao.",
        path: !payload.newPassword ? ["newPassword"] : ["confirmPassword"],
      })
      return
    }

    if (payload.newPassword !== payload.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirmacao de senha nao confere.",
        path: ["confirmPassword"],
      })
    }
  })

export type UpdateBarberProfileInput = z.infer<typeof updateBarberProfileSchema>
