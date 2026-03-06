import { prisma } from "@/lib/db/prisma"

export type BookableBarber = {
  userId: string
  role: "OWNER" | "BARBER"
  name: string
  bio: string | null
  avatarUrl: string | null
  weeklySchedule: unknown
}

function isBookableMembership(item: {
  role: "OWNER" | "BARBER"
  isActive: boolean
  user: { barberProfile: { bio: string | null; avatarUrl: string | null; weeklySchedule: unknown } | null }
}) {
  if (!item.isActive) {
    return false
  }

  if (item.role === "BARBER") {
    return item.user.barberProfile !== null
  }

  return item.role === "OWNER" && item.user.barberProfile !== null
}

export async function listBookableBarbers(barbershopId: string): Promise<BookableBarber[]> {
  const rows = await prisma.barbershopMembership.findMany({
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
    select: {
      userId: true,
      role: true,
      isActive: true,
      user: {
        select: {
          name: true,
          barberProfile: {
            select: {
              bio: true,
              avatarUrl: true,
              weeklySchedule: true,
            },
          },
        },
      },
    },
  })

  return rows
    .filter(isBookableMembership)
    .map((item) => ({
      userId: item.userId,
      role: item.role,
      name: item.user.name,
      bio: item.user.barberProfile?.bio ?? null,
      avatarUrl: item.user.barberProfile?.avatarUrl ?? null,
      weeklySchedule: item.user.barberProfile?.weeklySchedule ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getBookableBarber(barbershopId: string, barberUserId: string): Promise<BookableBarber | null> {
  const membership = await prisma.barbershopMembership.findUnique({
    where: {
      userId_barbershopId: {
        userId: barberUserId,
        barbershopId,
      },
    },
    select: {
      userId: true,
      role: true,
      isActive: true,
      user: {
        select: {
          name: true,
          barberProfile: {
            select: {
              bio: true,
              avatarUrl: true,
              weeklySchedule: true,
            },
          },
        },
      },
    },
  })

  if (!membership || !isBookableMembership(membership)) {
    return null
  }

  return {
    userId: membership.userId,
    role: membership.role,
    name: membership.user.name,
    bio: membership.user.barberProfile?.bio ?? null,
    avatarUrl: membership.user.barberProfile?.avatarUrl ?? null,
    weeklySchedule: membership.user.barberProfile?.weeklySchedule ?? null,
  }
}
