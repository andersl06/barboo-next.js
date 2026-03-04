import { z } from "zod"
import { isValidCPF } from "./cpf"

export const onboardingIntentSchema = z.enum(["CLIENT", "OWNER"])

export const registerSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("Email invalido"),
  cpf: z
    .string()
    .length(11, "CPF deve conter 11 digitos")
    .regex(/^\d+$/, "CPF deve conter apenas numeros")
    .refine(isValidCPF, {
      message: "CPF invalido",
    }),
  phone: z.string().min(10, "Telefone invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
  onboardingIntent: onboardingIntentSchema.optional().default("CLIENT"),
})

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
})

export const updateOnboardingIntentSchema = z.object({
  onboardingIntent: onboardingIntentSchema,
})

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.confirmPassword || data.newPassword === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Confirmacao de senha nao confere",
    }
  )
