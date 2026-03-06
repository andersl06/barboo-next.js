import { z } from "zod"
import { isValidCPF } from "./cpf"

const requiredTrimmed = (message: string) =>
  z.string().transform((value) => value.trim()).refine((value) => value.length > 0, message)

const optionalTrimmed = () =>
  z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional()

export const createBarberSchema = z.object({
  name: optionalTrimmed().refine(
    (value) => (value ? value.length >= 3 : true),
    "Nome muito curto"
  ),
  email: requiredTrimmed("Email é obrigatório").pipe(
    z.string().email("Email inválido")
  ),
  cpf: optionalTrimmed()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine(
      (value) =>
        !value
        || (value.length === 11 && /^\d+$/.test(value) && isValidCPF(value)),
      "CPF inválido"
    ),
  phone: optionalTrimmed()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine((value) => !value || value.length >= 10, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
})

export type CreateBarberInput = z.infer<typeof createBarberSchema>
