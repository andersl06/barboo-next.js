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
  email: requiredTrimmed("Email e obrigatorio").pipe(
    z.string().email("Email invalido")
  ),
  cpf: optionalTrimmed()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine(
      (value) =>
        !value
        || (value.length === 11 && /^\d+$/.test(value) && isValidCPF(value)),
      "CPF invalido"
    ),
  phone: optionalTrimmed()
    .transform((value) => (value ? value.replace(/\D/g, "") : undefined))
    .refine((value) => !value || value.length >= 10, "Telefone invalido"),
  password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
})

export type CreateBarberInput = z.infer<typeof createBarberSchema>
