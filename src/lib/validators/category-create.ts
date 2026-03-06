import { z } from "zod"
import { CATALOG_ERRORS } from "../errors/catalog-errors"

const optionalTrimmed = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}, z.string().optional())

const requiredName = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string()
    .min(1, CATALOG_ERRORS.CATEGORY_NAME_REQUIRED.message)
    .min(2, CATALOG_ERRORS.CATEGORY_NAME_MIN.message)
    .max(60, CATALOG_ERRORS.CATEGORY_NAME_MAX.message)
)

export const createCategorySchema = z.object({
  name: requiredName,
  description: optionalTrimmed.refine(
    (v) => (v ? v.length <= 200 : true),
    CATALOG_ERRORS.CATEGORY_DESCRIPTION_MAX.message
  ),
})

export const updateCategorySchema = z
  .object({
    name: requiredName.optional(),
    description: optionalTrimmed.refine(
      (v) => (v ? v.length <= 200 : true),
      CATALOG_ERRORS.CATEGORY_DESCRIPTION_MAX.message
    ),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar")
