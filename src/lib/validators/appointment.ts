import { z } from "zod"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const optionalTrimmed = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().optional())

export const listSlotsSchema = z.object({
  barberId: z.string().uuid("barberId inválido."),
  date: z
    .string()
    .regex(DATE_REGEX, "Data inválida. Use YYYY-MM-DD."),
  serviceDuration: z.coerce
    .number({ message: "serviceDuration inválido." })
    .int("serviceDuration deve ser inteiro.")
    .min(5, "serviceDuration mínimo e 5 minutos.")
    .max(480, "serviceDuration máximo e 480 minutos."),
})

export const createAppointmentSchema = z.object({
  barbershopId: z.string().uuid().optional(),
  serviceId: z.string().uuid("serviceId inválido."),
  barberId: z.string().uuid("barberId inválido."),
  startAt: z
    .string()
    .min(1, "startAt é obrigatório.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "startAt inválido."),
})

export const cancelAppointmentSchema = z.object({
  reason: optionalTrimmed.refine(
    (value) => (value ? value.length <= 300 : true),
    "Motivo deve ter no máximo 300 caracteres."
  ),
})
