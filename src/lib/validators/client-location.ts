import { z } from "zod"

export const clientLocationSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude inválida")
    .max(90, "Latitude inválida"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude inválida")
    .max(180, "Longitude inválida"),
})

export type ClientLocationInput = z.infer<typeof clientLocationSchema>
