import { z } from "zod"

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const normalizedOptionalTime = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional()

const dayScheduleSchema = z
  .object({
    enabled: z.boolean(),
    start: normalizedOptionalTime,
    end: normalizedOptionalTime,
  })
  .superRefine((day, ctx) => {
    if (!day.enabled) {
      return
    }

    if (!day.start || !day.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start e end são obrigatórios quando enabled=true",
      })
      return
    }

    if (!TIME_REGEX.test(day.start) || !TIME_REGEX.test(day.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Formato de horário inválido. Use HH:MM",
      })
      return
    }

    if (day.start >= day.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário inválido: início deve ser menor que fim.",
      })
    }
  })

export const updateBarberScheduleSchema = z.object({
  weeklySchedule: z
    .object({
      monday: dayScheduleSchema.optional(),
      tuesday: dayScheduleSchema.optional(),
      wednesday: dayScheduleSchema.optional(),
      thursday: dayScheduleSchema.optional(),
      friday: dayScheduleSchema.optional(),
      saturday: dayScheduleSchema.optional(),
      sunday: dayScheduleSchema.optional(),
    })
    .strict(),
})

export type UpdateBarberScheduleInput = z.infer<typeof updateBarberScheduleSchema>
