import { z } from "zod"
import { isValidCPF } from "./cpf"

export const registerSchema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  cpf: z
    .string()
    .length(11, "CPF deve conter 11 dígitos")
    .regex(/^\d+$/, "CPF deve conter apenas números")
    .refine(isValidCPF, {
      message: "CPF inválido"
    }),
  phone: z.string().min(10, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
})

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória")
})