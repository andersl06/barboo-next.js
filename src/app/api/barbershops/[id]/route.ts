import { Prisma } from "@prisma/client"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { geocodeAddress } from "@/lib/integrations/geocoding/geocode-address"
import { requireMembership } from "@/lib/membership/require-membership"

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function integrationStatus(code: string) {
  if (code.endsWith("SERVICE_UNAVAILABLE")) {
    return 503
  }

  return 400
}

function asOptionalTrimmed(value: unknown) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const barbershopUpdateSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres.").max(30, "Nome deve ter no máximo 30 caracteres."),
  description: z.preprocess(
    asOptionalTrimmed,
    z.string().max(500, "Descrição deve ter no máximo 500 caracteres.").optional()
  ),
  phone: z.string().trim().min(8, "Telefone inválido.").max(20, "Telefone inválido."),
  address: z.string().trim().min(3, "Endereço inválido.").max(120, "Endereço deve ter no máximo 120 caracteres."),
  addressNumber: z.string().trim().min(1, "Numero obrigatório.").max(20, "Numero deve ter no máximo 20 caracteres."),
  neighborhood: z.string().trim().min(2, "Bairro inválido.").max(60, "Bairro deve ter no máximo 60 caracteres."),
  city: z.string().trim().min(2, "Cidade inválida.").max(60, "Cidade deve ter no máximo 60 caracteres."),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF inválida."),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido.")
    .transform((value) => value.replace(/\D/g, "")),
  slug: z.preprocess(
    asOptionalTrimmed,
    z.string().max(80, "Slug deve ter no máximo 80 caracteres.").optional()
  ),
  cnpj: z.preprocess(
    asOptionalTrimmed,
    z
      .string()
      .refine((value) => value.replace(/\D/g, "").length === 14, "CNPJ inválido.")
      .optional()
  ),
})

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const status = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        slug: true,
        cnpj: true,
        status: true,
        logoUrl: true,
        coverUrl: true,
        latitude: true,
        longitude: true,
      },
    })

    if (!barbershop) {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia não encontrada.", 404)
    }

    return success({
      ...barbershop,
      latitude: barbershop.latitude !== null ? Number(barbershop.latitude) : null,
      longitude: barbershop.longitude !== null ? Number(barbershop.longitude) : null,
    })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params

    const auth = await requireAuth(req)
    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const status = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    const membership = await requireMembership(auth.user, barbershopId, ["OWNER"])
    if ("error" in membership) {
      return failure("FORBIDDEN", membership.message, membership.status)
    }

    const parsed = barbershopUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de Validação",
        400,
        parsed.error.issues.map((issue) => ({
          field:
            typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
              ? issue.path[0]
              : undefined,
          message: issue.message,
        }))
      )
    }

    const payload = parsed.data
    const normalizedSlug = slugify(payload.slug ?? payload.name)
    if (!normalizedSlug) {
      return failure("VALIDATION_ERROR", "Slug inválido.", 400, [
        { field: "slug", message: "Slug inválido." },
      ])
    }

    const geocoding = await geocodeAddress({
      address: payload.address,
      addressNumber: payload.addressNumber,
      neighborhood: payload.neighborhood,
      city: payload.city,
      state: payload.state,
      zipCode: payload.zipCode,
    })

    if (!geocoding.ok) {
      return failure(
        geocoding.error.code,
        geocoding.error.message,
        integrationStatus(geocoding.error.code),
        [
          {
            field: geocoding.error.field,
            message: geocoding.error.message,
          },
        ]
      )
    }

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        name: payload.name,
        description: payload.description ?? null,
        phone: payload.phone.replace(/\D/g, ""),
        address: payload.address,
        addressNumber: payload.addressNumber,
        neighborhood: payload.neighborhood,
        city: payload.city,
        state: payload.state,
        zipCode: payload.zipCode,
        slug: normalizedSlug,
        cnpj: payload.cnpj ? payload.cnpj.replace(/\D/g, "") : null,
        latitude: geocoding.data.latitude,
        longitude: geocoding.data.longitude,
      },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        slug: true,
        cnpj: true,
        status: true,
        logoUrl: true,
        coverUrl: true,
        latitude: true,
        longitude: true,
      },
    })

    return success({
      ...updated,
      latitude: updated.latitude !== null ? Number(updated.latitude) : null,
      longitude: updated.longitude !== null ? Number(updated.longitude) : null,
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return failure("CONFLICT", "Slug ou CNPJ Já em uso.", 409)
    }

    return handleError(err)
  }
}

