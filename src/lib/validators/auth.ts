import { z } from "zod"
import { isValidCPF } from "./cpf"

export const onboardingIntentSchema = z.enum(["CLIENT", "OWNER"])

export const registerSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  cpf: z
    .string()
    .length(11, "CPF deve conter 11 digitos")
    .regex(/^\d+$/, "CPF deve conter apenas numeros")
    .refine(isValidCPF, {
      message: "CPF inválido",
    }),
  phone: z.string().min(10, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  onboardingIntent: onboardingIntentSchema.optional().default("CLIENT"),
})

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
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
