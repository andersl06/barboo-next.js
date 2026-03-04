import { z } from "zod"

export const clientLocationSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude invalida")
    .max(90, "Latitude invalida"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude invalida")
    .max(180, "Longitude invalida"),
})

export type ClientLocationInput = z.infer<typeof clientLocationSchema>
