import { prisma } from "@/lib/db/prisma"
import {
  addBusinessDays,
  buildWeeklyPeriodFromStart,
  getRollingWeeklyPeriod,
  parseBusinessDateToUtc,
  toBusinessDate,
} from "@/lib/finance/invoices"

type GenerateWeeklyInvoiceParams = {
  barbershopId: string
  week?: string
}

export async function generateWeeklyInvoiceForBarbershop({
  barbershopId,
  week,
}: GenerateWeeklyInvoiceParams) {
  const anchorAppointment = await prisma.barbershopAppointment.findFirst({
    where: {
      barbershopId,
      status: "COMPLETED",
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      startAt: true,
    },
  })

  if (!anchorAppointment) {
    return {
      created: false,
      invoice: null,
    }
  }

  const anchorDate = toBusinessDate(anchorAppointment.startAt)

  let period = week ? getRollingWeeklyPeriod(anchorDate, week) : null

  if (!period) {
    const latestInvoice = await prisma.weeklyInvoice.findFirst({
      where: {
        barbershopId,
      },
      orderBy: {
        periodEnd: "desc",
      },
      select: {
        periodEnd: true,
      },
    })

    const nextStartDate = latestInvoice
      ? addBusinessDays(toBusinessDate(latestInvoice.periodEnd), 1)
      : anchorDate

    period = buildWeeklyPeriodFromStart(nextStartDate)
  }

  if (period.periodEndExclusiveAt.getTime() > Date.now()) {
    return {
      created: false,
      invoice: null,
    }
  }

  const existing = await prisma.weeklyInvoice.findUnique({
    where: {
      barbershopId_periodStart_periodEnd: {
        barbershopId,
        periodStart: parseBusinessDateToUtc(period.periodStartDate),
        periodEnd: parseBusinessDateToUtc(period.periodEndDate),
      },
    },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      dueAt: true,
      totalAppointments: true,
      totalFeesCents: true,
    },
  })

  if (existing) {
    return {
      created: false,
      invoice: existing,
    }
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const appointments = await tx.barbershopAppointment.findMany({
      where: {
        barbershopId,
        status: "COMPLETED",
        startAt: {
          gte: period.periodStartAt,
          lt: period.periodEndExclusiveAt,
        },
        weeklyInvoiceItems: {
          none: {},
        },
      },
      select: {
        id: true,
        serviceFeeCents: true,
      },
      orderBy: {
        startAt: "asc",
      },
    })

    const totalFeesCents = appointments.reduce((sum, item) => sum + item.serviceFeeCents, 0)

    const createdInvoice = await tx.weeklyInvoice.create({
      data: {
        barbershopId,
        periodStart: parseBusinessDateToUtc(period.periodStartDate),
        periodEnd: parseBusinessDateToUtc(period.periodEndDate),
        dueAt: period.dueAt,
        status: "OPEN",
        totalAppointments: appointments.length,
        totalFeesCents,
        items: {
          createMany: {
            data: appointments.map((item) => ({
              appointmentId: item.id,
            })),
          },
        },
      },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueAt: true,
        totalAppointments: true,
        totalFeesCents: true,
      },
    })

    return createdInvoice
  })

  return {
    created: true,
    invoice,
  }
}
