import { z } from "zod"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const optionalTrimmed = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}, z.string().optional())

export const listSlotsSchema = z.object({
  barberId: z.string().uuid("barberId invalido."),
  date: z
    .string()
    .regex(DATE_REGEX, "Data invalida. Use YYYY-MM-DD."),
  serviceDuration: z.coerce
    .number({ message: "serviceDuration invalido." })
    .int("serviceDuration deve ser inteiro.")
    .min(5, "serviceDuration minimo e 5 minutos.")
    .max(480, "serviceDuration maximo e 480 minutos."),
})

export const createAppointmentSchema = z.object({
  barbershopId: z.string().uuid().optional(),
  serviceId: z.string().uuid("serviceId invalido."),
  barberId: z.string().uuid("barberId invalido."),
  startAt: z
    .string()
    .min(1, "startAt e obrigatorio.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "startAt invalido."),
})

export const cancelAppointmentSchema = z.object({
  reason: optionalTrimmed.refine(
    (value) => (value ? value.length <= 300 : true),
    "Motivo deve ter no maximo 300 caracteres."
  ),
})
