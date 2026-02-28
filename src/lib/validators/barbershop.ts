import { z } from "zod";
import { BARBERSHOP_ERRORS } from "../errors/barbershop-errors";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

/**
 * Helpers
 */
const requiredTrimmed = (requiredMsg: string) =>
  z.string().transform((v) => v.trim()).refine((v) => v.length > 0, requiredMsg);

const maxLen = (max: number, msg: string) =>
  z.string().refine((v) => v.length <= max, msg);

const minLen = (min: number, msg: string) =>
  z.string().refine((v) => v.length >= min, msg);

const optionalTrimmed = () =>
  z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

/**
 * CEP obrigatório:
 * - valida formato 00000-000 ou 00000000
 * - normaliza para só números
 */
const zipCodeSchema = requiredTrimmed(BARBERSHOP_ERRORS.ZIP_REQUIRED.message)
  .refine((v) => /^\d{5}-?\d{3}$/.test(v), BARBERSHOP_ERRORS.ZIP_INVALID.message)
  .transform((v) => v.replace(/\D/g, ""));

/**
 * Telefone obrigatório:
 * - valida formato BR (flexível)
 * - normaliza para só números
 */
const phoneSchema = requiredTrimmed(BARBERSHOP_ERRORS.PHONE_REQUIRED.message)
  .refine(
    (v) =>
      /^(\+?55\s?)?(\(?\d{2}\)?\s?)?(\d{4,5}[-\s]?\d{4})$/.test(v) ||
      /^0\d{3}\s?\d{3}\s?\d{4}$/.test(v),
    BARBERSHOP_ERRORS.PHONE_INVALID.message
  )
  .transform((v) => v.replace(/\D/g, ""));

/**
 * CNPJ (opcional) — valida DV + normaliza para números
 */
function isValidCNPJ(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDV = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];

  const base12 = cnpj.slice(0, 12);
  const dv1 = calcDV(base12, w1);
  const base13 = base12 + String(dv1);
  const dv2 = calcDV(base13, w2);

  return cnpj === base12 + String(dv1) + String(dv2);
}

const cnpjSchema = optionalTrimmed()
  .refine((v) => (v ? isValidCNPJ(v) : true), BARBERSHOP_ERRORS.CNPJ_INVALID.message)
  .transform((v) => (v ? v.replace(/\D/g, "") : undefined));

/**
 * CPF (opcional) — por enquanto só normaliza para números
 * (se quiser DV depois, a gente adiciona)
 */
const cpfSchema = optionalTrimmed().transform((v) => (v ? v.replace(/\D/g, "") : undefined));

/**
 * Email (opcional) — formato apenas
 */
const emailSchema = optionalTrimmed().refine(
  (v) => (v ? z.string().email().safeParse(v).success : true),
  BARBERSHOP_ERRORS.EMAIL_INVALID.message
);

/**
 * Description (opcional)
 */
const descriptionSchema = optionalTrimmed().refine(
  (v) => (v ? v.length <= 500 : true),
  BARBERSHOP_ERRORS.DESCRIPTION_MAX.message
);

/**
 * Slug (opcional) — só normaliza trim
 * (unicidade é no banco e mapeada via P2002)
 */
const slugSchema = optionalTrimmed();

export const barbershopCreateSchema = z.object({
  // obrigatórios
  name: requiredTrimmed(BARBERSHOP_ERRORS.NAME_MIN.message)
    .pipe(minLen(3, BARBERSHOP_ERRORS.NAME_MIN.message))
    .pipe(maxLen(30, BARBERSHOP_ERRORS.NAME_MAX.message)),

  phone: phoneSchema,

  address: requiredTrimmed(BARBERSHOP_ERRORS.ADDRESS_REQUIRED.message).pipe(
    maxLen(120, BARBERSHOP_ERRORS.ADDRESS_MAX.message)
  ),

  addressNumber: requiredTrimmed(BARBERSHOP_ERRORS.ADDRESS_NUMBER_REQUIRED.message).pipe(
    maxLen(20, BARBERSHOP_ERRORS.ADDRESS_NUMBER_MAX.message)
  ),

  neighborhood: requiredTrimmed(BARBERSHOP_ERRORS.NEIGHBORHOOD_REQUIRED.message).pipe(
    maxLen(60, BARBERSHOP_ERRORS.NEIGHBORHOOD_MAX.message)
  ),

  city: requiredTrimmed(BARBERSHOP_ERRORS.CITY_REQUIRED.message).pipe(
    maxLen(60, BARBERSHOP_ERRORS.CITY_MAX.message)
  ),

  state: requiredTrimmed(BARBERSHOP_ERRORS.UF_REQUIRED.message)
    .transform((v) => v.toUpperCase())
    .refine((v) => (UF_LIST as readonly string[]).includes(v), BARBERSHOP_ERRORS.UF_INVALID.message),

  zipCode: zipCodeSchema,

  // opcionais
  description: descriptionSchema,
  cnpj: cnpjSchema,
  cpf: cpfSchema,
  email: emailSchema,
  slug: slugSchema,
});

export type BarbershopCreateInput = z.infer<typeof barbershopCreateSchema>;

export type ValidatorResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        message: string;
        fieldErrors: Record<string, string[]>;
        formErrors: string[];
      };
    };

export function validateBarbershopCreate(payload: unknown): ValidatorResult<BarbershopCreateInput> {
  const parsed = barbershopCreateSchema.safeParse(payload);

  if (parsed.success) return { success: true, data: parsed.data };

  const flattened = parsed.error.flatten();
  return {
    success: false,
    error: {
      message: "VALIDATION_ERROR",
      fieldErrors: flattened.fieldErrors,
      formErrors: flattened.formErrors,
    },
  };
}