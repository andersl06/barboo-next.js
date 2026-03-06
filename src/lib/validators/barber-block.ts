import { z } from "zod"
import { SCHEDULE_ERRORS } from "@/lib/errors/schedule-errors"

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export const createBarberBlockSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida. Use YYYY-MM-DD"),
    allDay: z.boolean().default(false),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: z.string().trim().max(200, "Motivo deve ter no máximo 200 caracteres").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.allDay) {
      return
    }

    if (!data.startTime || !data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "startTime e endTime são obrigatórios quando allDay=false",
      })
      return
    }

    if (!TIME_REGEX.test(data.startTime) || !TIME_REGEX.test(data.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Formato de horário inválido. Use HH:MM",
      })
      return
    }

    if (data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: SCHEDULE_ERRORS.BLOCK_INVALID_RANGE.message,
      })
    }
  })

export type CreateBarberBlockInput = z.infer<typeof createBarberBlockSchema>
