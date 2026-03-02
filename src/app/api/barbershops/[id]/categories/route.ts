import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { requireMembership } from "@/lib/membership/require-membership"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"
import { CATALOG_ERRORS } from "@/lib/errors/catalog-errors"
import { createCategorySchema } from "@/lib/validators/category-create"

function isCategoryDuplicateError(err: unknown) {
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
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const allowed = rateLimit("catalog:categories:" + barbershopId + ":" + ip, { windowMs: 60 * 1000, maxRequests: 60 })

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

    const parsed = createCategorySchema.safeParse(await req.json())
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

    const category = await prisma.barbershopCategory.create({
      data: {
        barbershopId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    })

    return success(category, 201)
  } catch (err) {
    if (isCategoryDuplicateError(err)) {
      return failure(
        CATALOG_ERRORS.CATEGORY_DUPLICATE.code,
        CATALOG_ERRORS.CATEGORY_DUPLICATE.message,
        409,
        [{
          field: CATALOG_ERRORS.CATEGORY_DUPLICATE.field,
          message: CATALOG_ERRORS.CATEGORY_DUPLICATE.message,
        }]
      )
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
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const allowed = rateLimit("catalog:categories:read" + ":" + barbershopId + ":" + ip, { windowMs: 60 * 1000, maxRequests: 120 })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisições. Tente novamente.", 429)
    }

    const url = new URL(req.url)
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

    const categories = await prisma.barbershopCategory.findMany({
      where: {
        barbershopId,
        ...(canSeeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    })

    return success(categories)
  } catch (err) {
    return handleError(err)
  }
}
