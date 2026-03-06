import { z } from "zod"
import { CATALOG_ERRORS } from "@/lib/errors/catalog-errors"

const optionalTrimmed = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}, z.string().optional())

const requiredName = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string()
    .min(1, CATALOG_ERRORS.SERVICE_NAME_REQUIRED.message)
    .min(2, CATALOG_ERRORS.SERVICE_NAME_MIN.message)
    .max(80, CATALOG_ERRORS.SERVICE_NAME_MAX.message)
)

const priceCentsSchema = z
  .number({ message: CATALOG_ERRORS.SERVICE_INVALID_PRICE.message })
  .int(CATALOG_ERRORS.SERVICE_INVALID_PRICE.message)
  .min(0, CATALOG_ERRORS.SERVICE_INVALID_PRICE.message)

const durationSchema = z
  .number({ message: CATALOG_ERRORS.SERVICE_INVALID_DURATION.message })
  .int(CATALOG_ERRORS.SERVICE_INVALID_DURATION.message)
  .min(5, CATALOG_ERRORS.SERVICE_INVALID_DURATION.message)
  .max(480, CATALOG_ERRORS.SERVICE_INVALID_DURATION.message)

export const createServiceSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: requiredName,
  description: optionalTrimmed.refine(
    (v) => (v ? v.length <= 500 : true),
    CATALOG_ERRORS.SERVICE_DESCRIPTION_MAX.message
  ),
  priceCents: priceCentsSchema,
  durationMinutes: durationSchema,
})

export const updateServiceSchema = z
  .object({
    categoryId: z.string().uuid().nullable().optional(),
    name: requiredName.optional(),
    description: optionalTrimmed.refine(
      (v) => (v ? v.length <= 500 : true),
      CATALOG_ERRORS.SERVICE_DESCRIPTION_MAX.message
    ),
    priceCents: priceCentsSchema.optional(),
    durationMinutes: durationSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar")
