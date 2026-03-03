import { z } from "zod"

export const updateBarberProfileSchema = z.object({
  bio: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value.length === 0 ? undefined : value))
    .pipe(z.string().max(500, "Bio deve ter no máximo 500 caracteres.").optional())
    .optional(),
})

export type UpdateBarberProfileInput = z.infer<typeof updateBarberProfileSchema>
