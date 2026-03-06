import { prisma } from "@/lib/db/prisma"
import { failure, success } from "@/lib/http/api-response"
import { getClientIp } from "@/lib/http/client-ip"
import { handleError } from "@/lib/http/error-handler"
import { rateLimit } from "@/lib/security/rate-limit"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || slug.trim().length === 0) {
      return failure("BAD_REQUEST", "Slug da barbearia é obrigatório.", 400)
    }

    const ip = getClientIp(req)
    const allowed = rateLimit(`barbershop:slug:${slug}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
    })

    if (!allowed) {
      return failure("RATE_LIMIT", "Muitas requisicoes. Tente novamente.", 429)
    }

    const barbershop = await prisma.barbershop.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        slug: true,
        name: true,
        description: true,
        phone: true,
        logoUrl: true,
        coverUrl: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        openingHours: true,
        socialLinks: true,
        facilities: true,
        paymentMethods: true,
        categories: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        services: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            categoryId: true,
            name: true,
            description: true,
            priceCents: true,
            durationMinutes: true,
            avgRating: true,
            ratingCount: true,
          },
        },
        memberships: {
          where: {
            isActive: true,
            OR: [
              { role: "BARBER" },
              {
                role: "OWNER",
                user: {
                  barberProfile: {
                    isNot: null,
                  },
                },
              },
            ],
          },
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                barberProfile: {
                  select: {
                    bio: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!barbershop || barbershop.status !== "ATIVA") {
      return failure("BARBERSHOP_NOT_FOUND", "Barbearia não encontrada.", 404)
    }

    return success({
      id: barbershop.id,
      slug: barbershop.slug,
      name: barbershop.name,
      description: barbershop.description,
      phone: barbershop.phone,
      logoUrl: barbershop.logoUrl,
      coverUrl: barbershop.coverUrl,
      address: barbershop.address,
      addressNumber: barbershop.addressNumber,
      neighborhood: barbershop.neighborhood,
      city: barbershop.city,
      state: barbershop.state,
      zipCode: barbershop.zipCode,
      latitude:
        barbershop.latitude !== null ? Number(barbershop.latitude) : null,
      longitude:
        barbershop.longitude !== null ? Number(barbershop.longitude) : null,
      openingHours: barbershop.openingHours,
      socialLinks: barbershop.socialLinks,
      facilities: barbershop.facilities,
      paymentMethods: barbershop.paymentMethods,
      categories: barbershop.categories,
      services: barbershop.services.map((service) => ({
        ...service,
        avgRating:
          service.avgRating !== null ? Number(service.avgRating) : null,
      })),
      barbers: barbershop.memberships.map((membership) => ({
        userId: membership.userId,
        name: membership.user.name,
        bio: membership.user.barberProfile?.bio ?? null,
        avatarUrl: membership.user.barberProfile?.avatarUrl ?? null,
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}
