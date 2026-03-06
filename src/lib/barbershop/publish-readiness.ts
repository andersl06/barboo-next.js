import { prisma } from "@/lib/db/prisma"

type ReadinessItem = {
  key: string
  ok: boolean
  message: string
  field?: string
}

type ReadinessMissingItem = {
  field?: string
  message: string
}

export type BarbershopPublishReadiness = {
  ready: boolean
  status: "EM_CONFIGURACAO" | "ATIVA" | "SUSPENSA"
  summary: {
    activeBarbers: number
    activeCategories: number
    activeServices: number
  }
  checklist: ReadinessItem[]
  missing: ReadinessMissingItem[]
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0)
}

export async function getBarbershopPublishReadiness(
  barbershopId: string
): Promise<BarbershopPublishReadiness | null> {
  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: {
      status: true,
      description: true,
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
    },
  })

  if (!barbershop) {
    return null
  }

  const [activeBarbers, activeCategories, activeServices] =
    await Promise.all([
      prisma.barbershopMembership.count({
        where: {
          barbershopId,
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
      }),
      prisma.barbershopCategory.count({
        where: {
          barbershopId,
          isActive: true,
        },
      }),
      prisma.barbershopService.count({
        where: {
          barbershopId,
          isActive: true,
        },
      }),
    ])

  const checklist: ReadinessItem[] = [
    {
      key: "description",
      field: "description",
      ok: hasText(barbershop.description),
      message: "Adicione uma Descrição da barbearia.",
    },
    {
      key: "logo",
      field: "logoUrl",
      ok: hasText(barbershop.logoUrl),
      message: "Envie o logo da barbearia.",
    },
    {
      key: "cover",
      field: "coverUrl",
      ok: hasText(barbershop.coverUrl),
      message: "Envie a capa da barbearia.",
    },
    {
      key: "address",
      field: "address",
      ok:
        hasText(barbershop.address) &&
        hasText(barbershop.addressNumber) &&
        hasText(barbershop.neighborhood) &&
        hasText(barbershop.city) &&
        hasText(barbershop.state) &&
        hasText(barbershop.zipCode),
      message: "Preencha o Endereço completo da barbearia.",
    },
    {
      key: "location",
      field: "location",
      ok: barbershop.latitude !== null && barbershop.longitude !== null,
      message: "Defina a localização da barbearia.",
    },
    {
      key: "barbers",
      field: "barbers",
      ok: activeBarbers > 0,
      message: "Adicione ao menos um barbeiro ativo (barbeiro ou owner habilitado).",
    },
    {
      key: "categories",
      field: "categories",
      ok: activeCategories > 0,
      message: "Crie ao menos uma categoria ativa.",
    },
    {
      key: "services",
      field: "services",
      ok: activeServices > 0,
      message: "Crie ao menos um Serviço ativo.",
    },
  ]

  const missing = checklist
    .filter((item) => !item.ok)
    .map((item) => ({
      field: item.field,
      message: item.message,
    }))

  return {
    ready: missing.length === 0,
    status: barbershop.status,
    summary: {
      activeBarbers,
      activeCategories,
      activeServices,
    },
    checklist,
    missing,
  }
}
