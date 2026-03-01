import { z } from "zod"
import { isValidCPF } from "./cpf"

const requiredTrimmed = (msg: string) =>
  z.string().transform((v) => v.trim()).refine((v) => v.length > 0, msg)

export const createBarberSchema = z.object({
  name: requiredTrimmed("Nome é obrigatório").pipe(
    z.string().min(3, "Nome muito curto")
  ),
  email: requiredTrimmed("Email é obrigatório").pipe(
    z.string().email("Email inválido")
  ),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .length(11, "CPF deve conter 11 dígitos")
        .regex(/^\d+$/, "CPF deve conter apenas números")
        .refine(isValidCPF, {
          message: "CPF inválido",
        })
    ),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10, "Telefone inválido")),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
})

export type CreateBarberInput = z.infer<typeof createBarberSchema>
