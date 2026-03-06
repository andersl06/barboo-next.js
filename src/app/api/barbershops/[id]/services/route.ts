import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { requireMembership } from "@/lib/membership/require-membership"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { CATALOG_ERRORS } from "@/lib/errors/catalog-errors"
import { createServiceSchema } from "@/lib/validators/service-create"

function isServiceDuplicateError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError
    && err.code === "P2002"
    && Array.isArray(err.meta?.target)
    && err.meta.target.includes("barbershopId")
    && err.meta.target.includes("name")
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params
    const ip = getClientIp(req)
    const allowed = rateLimit("catalog:services:" + barbershopId + ":" + ip, { windowMs: 60 * 1000, maxRequests: 60 })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisições. Tente novamente.", 429)
    }

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

    const parsed = createServiceSchema.safeParse(await req.json())
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Erro de validação",
        400,
        parsed.error.issues.map((issue) => ({
          field: typeof issue.path[0] === "string" || typeof issue.path[0] === "number"
            ? issue.path[0]
            : undefined,
          message: issue.message,
        }))
      )
    }

    if (parsed.data.categoryId) {
      const category = await prisma.barbershopCategory.findFirst({
        where: {
          id: parsed.data.categoryId,
          barbershopId,
        },
        select: { id: true },
      })

      if (!category) {
        return failure(CATALOG_ERRORS.CATEGORY_NOT_FOUND.code, CATALOG_ERRORS.CATEGORY_NOT_FOUND.message, 404)
      }
    }

    const service = await prisma.barbershopService.create({
      data: {
        barbershopId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description,
        priceCents: parsed.data.priceCents,
        durationMinutes: parsed.data.durationMinutes,
      },
      select: {
        id: true,
        barbershopId: true,
        categoryId: true,
        name: true,
        description: true,
        priceCents: true,
        durationMinutes: true,
        isActive: true,
        avgRating: true,
        ratingCount: true,
        createdAt: true,
      },
    })

    return success(service, 201)
  } catch (err) {
    if (isServiceDuplicateError(err)) {
      return failure(CATALOG_ERRORS.SERVICE_DUPLICATE.code, CATALOG_ERRORS.SERVICE_DUPLICATE.message, 409, [
        {
          field: CATALOG_ERRORS.SERVICE_DUPLICATE.field,
          message: CATALOG_ERRORS.SERVICE_DUPLICATE.message,
        },
      ])
    }

    return handleError(err)
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: barbershopId } = await params
    const ip = getClientIp(req)
    const allowed = rateLimit("catalog:services:read" + ":" + barbershopId + ":" + ip, { windowMs: 60 * 1000, maxRequests: 120 })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisições. Tente novamente.", 429)
    }

    const url = new URL(req.url)
    const categoryId = url.searchParams.get("categoryId") || undefined
    const includeInactive = url.searchParams.get("includeInactive") === "true"

    const status = await requireActiveBarbershop(barbershopId, { allowSetup: true })
    if ("error" in status) {
      return failure(status.code, status.message, status.status)
    }

    let canSeeInactive = false
    if (includeInactive) {
      const auth = await requireAuth(req)
      if ("error" in auth) {
        return failure("UNAUTHORIZED", auth.message, auth.status)
      }

      const membership = await requireMembership(auth.user, barbershopId, ["OWNER", "BARBER"])
      if ("error" in membership) {
        return failure("FORBIDDEN", membership.message, membership.status)
      }

      canSeeInactive = true
    }

    const services = await prisma.barbershopService.findMany({
      where: {
        barbershopId,
        ...(categoryId ? { categoryId } : {}),
        ...(canSeeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        barbershopId: true,
        categoryId: true,
        name: true,
        description: true,
        priceCents: true,
        durationMinutes: true,
        isActive: true,
        avgRating: true,
        ratingCount: true,
        createdAt: true,
      },
    })

    return success(services)
  } catch (err) {
    return handleError(err)
  }
}
