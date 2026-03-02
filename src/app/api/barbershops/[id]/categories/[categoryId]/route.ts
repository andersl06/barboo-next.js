import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { requireAuth } from "@/lib/auth/require-auth"
import { requireActiveBarbershop } from "@/lib/barbershop/require-active-barbershop"
import { requireMembership } from "@/lib/membership/require-membership"
import { failure, success } from "@/lib/http/api-response"
import { handleError } from "@/lib/http/error-handler"
import { CATALOG_ERRORS } from "@/lib/errors/catalog-errors"
import { updateCategorySchema } from "@/lib/validators/category-create"

function isCategoryDuplicateError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError
    && err.code === "P2002"
    && Array.isArray(err.meta?.target)
    && err.meta.target.includes("barbershopId")
    && err.meta.target.includes("name")
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: barbershopId, categoryId } = await params

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

    const existing = await prisma.barbershopCategory.findFirst({
      where: { id: categoryId, barbershopId },
      select: { id: true },
    })

    if (!existing) {
      return failure(CATALOG_ERRORS.CATEGORY_NOT_FOUND.code, CATALOG_ERRORS.CATEGORY_NOT_FOUND.message, 404)
    }

    const parsed = updateCategorySchema.safeParse(await req.json())
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

    const category = await prisma.barbershopCategory.update({
      where: { id: categoryId },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    })

    return success(category)
  } catch (err) {
    if (isCategoryDuplicateError(err)) {
      return failure(CATALOG_ERRORS.CATEGORY_DUPLICATE.code, CATALOG_ERRORS.CATEGORY_DUPLICATE.message, 409, [
        {
          field: CATALOG_ERRORS.CATEGORY_DUPLICATE.field,
          message: CATALOG_ERRORS.CATEGORY_DUPLICATE.message,
        },
      ])
    }

    return handleError(err)
  }
}
