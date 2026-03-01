import { requireAuth } from "@/lib/auth/require-auth"
import { prisma } from "@/lib/db/prisma"
import { BARBERSHOP_ERRORS } from "@/lib/errors/barbershop-errors"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { lookupCnpj } from "@/lib/integrations/cnpj/cnpj-lookup"
import { geocodeAddress } from "@/lib/integrations/geocoding/geocode-address"
import { lookupZip } from "@/lib/integrations/zip/zip-lookup"
import { resolveOwnerBarbershopId } from "@/lib/membership/resolve-owner-barbershop"
import { validateBarbershopCreate } from "@/lib/validators/barbershop"

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

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)

    if ("error" in auth) {
      return failure("UNAUTHORIZED", auth.message, auth.status)
    }

    const body = await req.json()
    const validated = validateBarbershopCreate(body)

    if (!validated.success) {
      const fieldErrors = Object.entries(validated.error.fieldErrors).flatMap(
        ([field, messages]) =>
          (messages ?? []).map((message) => ({
            field,
            message,
          }))
      )

      return failure(validated.error.message, "Erro de validação", 400, fieldErrors)
    }

    const ownerBarbershopId = await resolveOwnerBarbershopId(auth.user.id)

    if (ownerBarbershopId) {
      return failure(
        BARBERSHOP_ERRORS.OWNER_ALREADY_HAS_BARBERSHOP.code,
        BARBERSHOP_ERRORS.OWNER_ALREADY_HAS_BARBERSHOP.message,
        409
      )
    }

    const payload = validated.data
    const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name)

    if (!slug) {
      return failure(
        BARBERSHOP_ERRORS.SLUG_INVALID.code,
        BARBERSHOP_ERRORS.SLUG_INVALID.message,
        400,
        [
          {
            field: BARBERSHOP_ERRORS.SLUG_INVALID.field,
            message: BARBERSHOP_ERRORS.SLUG_INVALID.message,
          },
        ]
      )
    }

    const zipLookup = await lookupZip(payload.zipCode)

    if (!zipLookup.ok) {
      return failure(
        zipLookup.error.code,
        zipLookup.error.message,
        integrationStatus(zipLookup.error.code),
        [
          {
            field: zipLookup.error.field,
            message: zipLookup.error.message,
          },
        ]
      )
    }

    const cnpjLookup = payload.cnpj ? await lookupCnpj(payload.cnpj) : null

    if (cnpjLookup && !cnpjLookup.ok) {
      return failure(
        cnpjLookup.error.code,
        cnpjLookup.error.message,
        integrationStatus(cnpjLookup.error.code),
        [
          {
            field: cnpjLookup.error.field,
            message: cnpjLookup.error.message,
          },
        ]
      )
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

    const created = await prisma.$transaction(async (tx) => {
      const barbershop = await tx.barbershop.create({
        data: {
          name: payload.name,
          description: payload.description,
          phone: payload.phone,
          address: payload.address,
          addressNumber: payload.addressNumber,
          neighborhood: payload.neighborhood,
          city: payload.city,
          state: payload.state,
          zipCode: payload.zipCode,
          openingHours: payload.openingHours,
          slug,
          cnpj: payload.cnpj,
          cpf: payload.cpf,
          status: "EM_CONFIGURACAO",
          latitude: geocoding.data.latitude,
          longitude: geocoding.data.longitude,
          facilities: [],
          paymentMethods: [],
        },
      })

      await tx.barbershopMembership.create({
        data: {
          userId: auth.user.id,
          barbershopId: barbershop.id,
          role: "OWNER",
          isActive: true,
        },
      })

      return barbershop
    })

    return success(
      {
        id: created.id,
        name: created.name,
        slug: created.slug,
        status: created.status,
        latitude: created.latitude,
        longitude: created.longitude,
      },
      201
    )
  } catch (err) {
    return handleError(err)
  }
}
