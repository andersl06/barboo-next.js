import { z } from "zod"
import { isValidCPF } from "./cpf"

export const onboardingIntentSchema = z.enum(["CLIENT", "OWNER"])

function isEmail(value: string) {
  return z.string().email().safeParse(value).success
}

function isPhone(value: string) {
  return /^\d{10,11}$/.test(value)
}

const optionalCpfSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const digits = value.replace(/\D/g, "")
  return digits.length === 0 ? undefined : digits
}, z.string()
  .length(11, "CPF deve conter 11 digitos")
  .regex(/^\d+$/, "CPF deve conter apenas numeros")
  .refine(isValidCPF, {
    message: "CPF inválido",
  })
  .optional()
)

const loginIdentifierSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase()
  }
  return trimmed.replace(/\D/g, "")
}, z.string()
  .min(1, "Email ou telefone obrigatório")
  .refine((value) => isEmail(value) || isPhone(value), "Email ou telefone inválido")
)

export const registerSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  cpf: optionalCpfSchema,
  phone: z.string().min(10, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  onboardingIntent: onboardingIntentSchema.optional().default("CLIENT"),
})

export const loginSchema = z.object({
  login: loginIdentifierSchema,
  password: z.string().min(1, "Senha obrigatória"),
})

export const updateOnboardingIntentSchema = z.object({
  onboardingIntent: onboardingIntentSchema,
})

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.confirmPassword || data.newPassword === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Confirmação de senha não confere",
    }
  )

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(32, "Token inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirmação de senha não confere",
  })
