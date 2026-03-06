import { z } from "zod"

function asOptionalTrimmedString(value: unknown) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalPhoneSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const digits = value.replace(/\D/g, "")
  if (digits.length === 0) return null
  return digits
}, z.union([z.string(), z.null()]).optional())
  .refine(
    (value) => value === undefined || value === null || value.length === 10 || value.length === 11,
    "Telefone deve conter 10 ou 11 digitos."
  )

export const updateMeSchema = z.object({
  name: z
    .preprocess(
      asOptionalTrimmedString,
      z.string().min(3, "Nome muito curto.").max(80, "Nome muito longo.").optional()
    ),
  phone: optionalPhoneSchema,
}).refine(
  (payload) => payload.name !== undefined || payload.phone !== undefined,
  {
    message: "Informe ao menos um campo para atualizar.",
    path: ["name"],
  }
)

export const changeMyPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória."),
  newPassword: z.string().min(6, "Nova senha deve ter no mínimo 6 caracteres."),
  confirmPassword: z.string().min(6, "Confirmação de senha inválida."),
}).refine((payload) => payload.newPassword === payload.confirmPassword, {
  path: ["confirmPassword"],
  message: "Confirmação de senha não confere.",
})

